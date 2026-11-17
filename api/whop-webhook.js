import { Whop } from '@whop/sdk';
import { supabase } from '../lib/supabaseClient.js';
import { PAID_PLANS, whopConfig } from '../lib/plans.js';

// Whop -> subscriptions. What each event does to a person's plan:
//   payment.succeeded, membership.activated   active (trialing during a free trial), new period end
//   membership.updated                        Whop's one event for a membership changing (it
//                                             activates, deactivates, or cancel_at_period_end
//                                             flips): its status and cancel_at_period_end say which
//   membership.cancel_at_period_end_changed   canceled (keeps the plan until
//                                             the period end) or active again
//   membership.cancelled / .canceled          canceled, same as above
//   payment.failed                            past_due: a few days' grace
//                                             while Whop retries the card
//   membership.deactivated                    inactive: access has ended
// lib/plans.js (activePlanKey) turns those statuses into what someone gets.
//
// Whop retries a delivery until it gets a 2xx, so a failure here returns 500
// and forgets the event id, and the retry is processed in full.

export const config = {
  api: {
    bodyParser: false,
  },
};

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function resolvePlan(data) {
  const metadataPlan = data?.metadata?.plan || data?.checkout_configuration?.metadata?.plan || data?.membership?.metadata?.plan;
  if (PAID_PLANS.includes(metadataPlan)) return metadataPlan;

  const planId = data?.plan?.id || data?.plan_id || data?.checkout_configuration?.plan?.id || data?.membership?.plan?.id;
  const whop = whopConfig();
  if (planId && planId === whop.planId('pro')) return 'pro';
  if (planId && planId === whop.planId('starter')) return 'starter';
  return null;
}

function resolveMembershipId(type, data) {
  if (data?.membership_id) return data.membership_id;
  if (data?.membership?.id) return data.membership.id;
  // On membership events the object is the membership itself; on payment
  // events data.id is the payment, never a membership.
  return type.startsWith('membership.') ? data?.id || null : null;
}

/** Whop sends unix seconds on some objects and ISO strings on others. */
function toIso(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  const d = Number.isFinite(n) ? new Date(n < 1e12 ? n * 1000 : n) : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function resolvePeriodEnd(data) {
  return toIso(data?.renewal_period_end || data?.current_period_end || data?.membership?.renewal_period_end || data?.expires_at);
}

/** The person: the user id put in the checkout metadata, else the row that already has this membership. */
async function resolveUser(data, membershipId) {
  const fromMetadata = data?.metadata?.user_id || data?.checkout_configuration?.metadata?.user_id || data?.membership?.metadata?.user_id;
  if (fromMetadata) return { userId: fromMetadata, existing: null };
  if (!membershipId) return { userId: null, existing: null };
  const { data: row, error } = await supabase
    .from('subscriptions')
    .select('user_id,plan')
    .eq('whop_membership_id', membershipId)
    .maybeSingle();
  if (error) throw error;
  return { userId: row?.user_id || null, existing: row };
}

async function saveSubscription(userId, fields) {
  const row = { user_id: userId, updated_at: new Date().toISOString() };
  for (const [k, v] of Object.entries(fields)) if (v !== undefined) row[k] = v;
  const { error } = await supabase.from('subscriptions').upsert(row, { onConflict: 'user_id' });
  if (error) throw error;
}

export async function applyEvent(type, data) {
  const membershipId = resolveMembershipId(type, data);
  const { userId } = await resolveUser(data, membershipId);
  if (!userId) {
    console.warn(`Whop webhook ${type}: no user for membership ${membershipId || '(none)'}, skipped.`);
    return;
  }
  const plan = resolvePlan(data) || undefined; // unknown: keep the plan already saved
  const periodEnd = resolvePeriodEnd(data) || undefined;
  const base = { whop_membership_id: membershipId || undefined, current_period_end: periodEnd };

  switch (type) {
    case 'membership.updated': {
      // What the membership is now: Whop's status, and whether it ends at the period end.
      const st = String(data?.status || '');
      if (st === 'trialing' || st === 'active') {
        return saveSubscription(userId, data?.cancel_at_period_end === true
          ? { ...base, plan, status: 'canceled', canceled_at: new Date().toISOString() }
          : { ...base, plan, status: st, canceled_at: null });
      }
      if (st === 'past_due') return saveSubscription(userId, { ...base, plan, status: 'past_due' });
      if (['canceled', 'cancelled', 'completed', 'expired', 'unresolved', 'drafted'].includes(st)) {
        return saveSubscription(userId, { ...base, plan, status: 'inactive', canceled_at: new Date().toISOString() });
      }
      return undefined; // a status we don't act on
    }

    case 'payment.succeeded':
    case 'membership.activated':
      if (!plan) {
        // A first activation must say which plan; a renewal may not, and keeps the saved one.
        const { data: row, error } = await supabase.from('subscriptions').select('plan').eq('user_id', userId).maybeSingle();
        if (error) throw error;
        if (!row || !PAID_PLANS.includes(row.plan)) {
          console.warn(`Whop webhook ${type}: no plan for user ${userId}, skipped.`);
          return;
        }
      }
      // A membership that starts with a free trial is "trialing" until its first charge.
      return saveSubscription(userId, { ...base, plan, status: data?.status === 'trialing' ? 'trialing' : 'active', canceled_at: null });

    case 'membership.cancel_at_period_end_changed': {
      const cancelling = data?.cancel_at_period_end === true;
      return saveSubscription(userId, cancelling
        ? { ...base, plan, status: 'canceled', canceled_at: new Date().toISOString() }
        : { ...base, plan, status: 'active', canceled_at: null });
    }

    case 'membership.cancelled':
    case 'membership.canceled':
      return saveSubscription(userId, { ...base, plan, status: 'canceled', canceled_at: new Date().toISOString() });

    case 'payment.failed':
      return saveSubscription(userId, { ...base, plan, status: 'past_due' });

    case 'membership.deactivated':
      return saveSubscription(userId, { ...base, plan, status: 'inactive', canceled_at: new Date().toISOString() });

    default:
      return undefined; // events we don't act on
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).send('Method not allowed');
  }

  let webhookData;
  let headers;
  try {
    const whop = new Whop({
      apiKey: process.env.WHOP_API_KEY,
      webhookKey: Buffer.from(process.env.WHOP_WEBHOOK_SECRET || '').toString('base64'),
    });
    const rawBody = await readRawBody(req);
    headers = Object.fromEntries(Object.entries(req.headers).map(([key, value]) => [key, Array.isArray(value) ? value.join(',') : value]));
    webhookData = whop.webhooks.unwrap(rawBody, { headers });
  } catch (error) {
    console.error('Whop webhook rejected:', error);
    return res.status(400).send('Invalid webhook');
  }

  const type = String(webhookData.type || '');
  const eventId = headers['webhook-id'] || webhookData.id || null;

  if (eventId) {
    const { error } = await supabase.from('webhook_events').insert({ id: eventId, type });
    if (error?.code === '23505') return res.status(200).send('Duplicate');
    if (error) {
      console.error('Whop webhook: could not record event', error);
      return res.status(500).send('Try again');
    }
  }

  try {
    await applyEvent(type, webhookData.data || {});
    return res.status(200).send('OK');
  } catch (error) {
    console.error(`Whop webhook ${type} failed:`, error);
    // Forget the event so Whop's retry is processed, not dropped as a duplicate.
    if (eventId) await supabase.from('webhook_events').delete().eq('id', eventId);
    return res.status(500).send('Try again');
  }
}

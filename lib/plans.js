// The paid plans, in one place: what each costs, which models it unlocks and
// how much use it includes. The site, the account API and the admin pages all
// read from here; the Haze 2 router (supabase/functions/auto) enforces the
// same limits, so keep the two in step.
//
// Keys stay "starter" and "pro" (the subscriptions table and Whop metadata use
// them); the names people see are "Pro" and "Max".
//
// Limits are what Codeply pays Anthropic for a person's turns, in US dollars,
// so a heavy model like Fable uses them up faster than Sonnet:
//   window  a rolling 5 hours
//   month   the billing period
// Every number can be changed from the environment without a deploy of code.

const num = (key, fallback) => {
  const v = Number(process.env[key]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};

export const WINDOW_HOURS = 5;

export const PLANS = {
  free: {
    key: 'free',
    name: 'Free',
    price: 0,
    models: ['haze'],
    comingSoon: [],
    trialDays: 0,
    // Every plan: your own API keys, custom providers and local models.
    customModels: true,
    // Pro and Max: sign in with a ChatGPT or Claude subscription for subagents and past the limits.
    connectSubscriptions: false,
    limits: null, // the free tier keeps Haze 2's own daily allowance
  },
  starter: {
    key: 'starter',
    name: 'Pro',
    price: num('WHOP_STARTER_PRICE', 20),
    // The model picker: any of these, or Haze 2's choice.
    models: ['haze', 'opus', 'sonnet', 'haiku'],
    comingSoon: ['tera', 'luna'],
    trialDays: num('PLAN_STARTER_TRIAL_DAYS', 3),
    customModels: true,
    connectSubscriptions: true,
    limits: {
      windowHours: WINDOW_HOURS,
      windowUsd: num('PLAN_STARTER_WINDOW_USD', 1),
      monthUsd: num('PLAN_STARTER_MONTH_USD', 10),
    },
  },
  pro: {
    key: 'pro',
    name: 'Max',
    price: num('WHOP_PRO_PRICE', 100),
    models: ['haze', 'opus', 'sonnet', 'haiku', 'fable'],
    comingSoon: ['tera', 'luna', 'sol', 'astra'],
    trialDays: 0,
    customModels: true,
    connectSubscriptions: true,
    limits: {
      windowHours: WINDOW_HOURS,
      windowUsd: num('PLAN_PRO_WINDOW_USD', 5),
      monthUsd: num('PLAN_PRO_MONTH_USD', 50),
    },
  },
};

export const PAID_PLANS = ['starter', 'pro'];

export const MODEL_LABELS = {
  haze: 'Haze 2 (picks the model for you)',
  opus: 'Claude Opus 5.5',
  sonnet: 'Claude Sonnet 5.5',
  haiku: 'Claude Haiku 5.5',
  fable: 'Claude Fable 5.2',
  tera: 'ChatGPT Tera',
  luna: 'ChatGPT Luna',
  sol: 'ChatGPT Sol',
  astra: 'ChatGPT Astra',
};

// ---------- Whop ----------
// WHOP_ENV=sandbox points everything at Whop's sandbox (sandbox.whop.com, no real money), with
// its own API key, plans and webhook secret. Until the plans exist, the placeholders below keep
// the flow working end to end on paper: checkout returns a placeholder link instead of failing.
export const PLACEHOLDER_PLAN = { starter: 'plan_PLACEHOLDER_PRO', pro: 'plan_PLACEHOLDER_MAX' };

export function whopConfig() {
  const sandbox = (process.env.WHOP_ENV || '').toLowerCase() === 'sandbox';
  const planId = (plan) => process.env[plan === 'pro' ? 'WHOP_PRO_PLAN_ID' : 'WHOP_STARTER_PLAN_ID'] || PLACEHOLDER_PLAN[plan];
  return {
    sandbox,
    apiBase: sandbox ? 'https://sandbox-api.whop.com/api/v1' : 'https://api.whop.com/api/v1',
    checkoutHost: sandbox ? 'https://sandbox.whop.com' : 'https://whop.com',
    apiKey: process.env.WHOP_API_KEY || '',
    planId,
    /** A plan still on its placeholder: no Whop plan behind it yet. */
    isPlaceholder: (plan) => planId(plan).includes('PLACEHOLDER'),
    /** The plan's own checkout page (no account attached): the fallback while checkout can't be created. */
    planLink: (plan) => process.env[plan === 'pro' ? 'WHOP_PRO_CHECKOUT_URL' : 'WHOP_STARTER_CHECKOUT_URL']
      || `${sandbox ? 'https://sandbox.whop.com' : 'https://whop.com'}/checkout/${planId(plan)}/`,
  };
}

// How long a failed renewal keeps its plan while Whop retries the card.
const PAST_DUE_GRACE_MS = num('PLAN_PAST_DUE_GRACE_DAYS', 3) * 86400_000;

const time = (v) => {
  const t = v ? new Date(v).getTime() : NaN;
  return Number.isFinite(t) ? t : null;
};

/**
 * The plan a subscriptions row entitles someone to right now.
 *   active    the plan
 *   canceled  the plan until the end of the period they paid for
 *   past_due  the plan for a few days past the period end, while Whop retries
 *   anything else, or no row: free
 */
export function activePlanKey(sub, now = Date.now()) {
  if (!sub || !PAID_PLANS.includes(sub.plan)) return 'free';
  const end = time(sub.current_period_end);
  // A free trial (Whop's "trialing") counts as the plan.
  if (sub.status === 'active' || sub.status === 'trialing') return sub.plan;
  if (sub.status === 'canceled') return end !== null && end > now ? sub.plan : 'free';
  if (sub.status === 'past_due') {
    const from = end ?? time(sub.updated_at);
    return from !== null && from + PAST_DUE_GRACE_MS > now ? sub.plan : 'free';
  }
  return 'free';
}

/** What the apps and the site show about a plan. */
export function describePlan(key) {
  const p = PLANS[key] || PLANS.free;
  return {
    key: p.key,
    name: p.name,
    price: p.price,
    models: p.models.map((id) => ({ id, label: MODEL_LABELS[id] || id })),
    comingSoon: p.comingSoon.map((id) => ({ id, label: MODEL_LABELS[id] || id })),
    trialDays: p.trialDays || 0,
    customModels: !!p.customModels,
    connectSubscriptions: !!p.connectSubscriptions,
    limits: p.limits,
  };
}

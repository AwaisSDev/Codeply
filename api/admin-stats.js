// /api/admin-stats — single aggregated feed for the admin analytics dashboard.
//
// GET (admins only) -> {
//   generated_at,
//   signups:   { today, week, total, waitlist_total, trend: [{date,count}...] },
//   users:     { total, active_now },
//   revenue:   { month, currency, source, mrr, active_starter, active_pro },
//   churn:     { rate, canceled_month, active_total },
//   placements:{ total, month },
//   models:    [{ model, calls }...],          // by real usage, falls back to settings
//   peak_hours:[{ hour, calls }...],           // 0..23 UTC, last 30d
//   countries: [{ country, users }...],        // ISO-2, falls back to profiles.country
//   _notes:    [ ... ]                         // capture-status hints
// }
//
// Auth: same pattern as remote-config.js — Bearer token -> requireUser -> is_admin.
import { supabase } from '../lib/supabaseClient.js';
import { requireUser } from './auth.js';
import { applyCors } from '../lib/cors.js';

const DAY = 24 * 60 * 60 * 1000;

function startOfTodayUTC() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString();
}
function startOfMonthUTC() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}
function isoDaysAgo(n) {
  return new Date(Date.now() - n * DAY).toISOString();
}
function currentMonthKey() {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}

// safe COUNT on a table with optional filters; returns 0 on any failure
async function countRows(table, build) {
  try {
    let q = supabase.from(table).select('*', { count: 'exact', head: true });
    if (build) q = build(q);
    const { count, error } = await q;
    if (error) return 0;
    return count || 0;
  } catch {
    return 0;
  }
}

// ---- Revenue from Whop (best-effort), falls back to subscription-based MRR ----
async function whopRevenueThisMonth() {
  const apiKey = process.env.WHOP_API_KEY;
  if (!apiKey) return null;
  try {
    const { Whop } = await import('@whop/sdk');
    const whop = new Whop({ apiKey });
    const since = Math.floor(new Date(startOfMonthUTC()).getTime() / 1000);

    // The SDK surface has shifted across versions; try the common shapes and
    // bail to the subscription estimate if none match.
    const candidates = [
      () => whop.payments?.list?.({ per: 100 }),
      () => whop.payments?.list?.({ limit: 100 }),
      () => whop.memberships?.list?.({ per: 100 }),
    ];
    let rows = null;
    for (const fn of candidates) {
      try {
        const res = await fn?.();
        if (!res) continue;
        rows = Array.isArray(res) ? res : (res.data || res.items || res.results || null);
        if (rows) break;
      } catch { /* try next */ }
    }
    if (!rows) return null;

    let total = 0;
    let currency = 'USD';
    for (const p of rows) {
      const ts = p.created_at || p.created || p.paid_at || p.timestamp;
      const t = ts ? (String(ts).length > 10 ? Date.parse(ts) / 1000 : +ts) : null;
      if (t && t < since) continue;
      const amt = +(p.final_amount ?? p.amount ?? p.total ?? p.subtotal ?? 0);
      if (!isNaN(amt)) total += amt;
      if (p.currency) currency = String(p.currency).toUpperCase();
    }
    // Some Whop payloads report cents; normalize obvious cent values.
    return { amount: total > 100000 ? total / 100 : total, currency, source: 'whop' };
  } catch {
    return null;
  }
}

// Subscription-based MRR fallback (configure prices via env if you like).
async function subscriptionRevenue() {
  const STARTER = +(process.env.WHOP_STARTER_PRICE || 9);
  const PRO = +(process.env.WHOP_PRO_PRICE || 29);
  const [activeStarter, activePro] = await Promise.all([
    countRows('subscriptions', (q) => q.eq('status', 'active').eq('plan', 'starter')),
    countRows('subscriptions', (q) => q.eq('status', 'active').eq('plan', 'pro')),
  ]);
  const mrr = activeStarter * STARTER + activePro * PRO;
  return {
    amount: mrr, currency: 'USD', source: 'subscriptions (estimated)',
    mrr, active_starter: activeStarter, active_pro: activePro,
    starter_price: STARTER, pro_price: PRO,
  };
}

// daily signups trend for the last 14 days, from profiles.created_at
async function signupTrend() {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('created_at')
      .gte('created_at', isoDaysAgo(14));
    if (error || !data) return [];
    const buckets = {};
    for (let i = 13; i >= 0; i--) {
      buckets[new Date(Date.now() - i * DAY).toISOString().slice(0, 10)] = 0;
    }
    for (const r of data) {
      const k = String(r.created_at).slice(0, 10);
      if (k in buckets) buckets[k]++;
    }
    return Object.entries(buckets).map(([date, count]) => ({ date, count }));
  } catch {
    return [];
  }
}

// Try an RPC; on failure return null so the caller can fall back.
async function tryRpc(name, args) {
  try {
    const { data, error } = await supabase.rpc(name, args || {});
    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return;

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ message: 'Method not allowed.' });
  }

  const user = await requireUser(req, res);
  if (!user) return;

  const { data: profile } = await supabase
    .from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
  if (!profile?.is_admin) {
    return res.status(403).json({ message: 'Admin access required.' });
  }

  const notes = [];
  const month = currentMonthKey();

  // ── Signups & users ────────────────────────────────────────────────────────
  const [signupToday, signupWeek, totalUsers, waitlistTotal] = await Promise.all([
    countRows('profiles', (q) => q.gte('created_at', startOfTodayUTC())),
    countRows('profiles', (q) => q.gte('created_at', isoDaysAgo(7))),
    countRows('profiles'),
    countRows('waitlist_subscribers'),
  ]);
  const trend = await signupTrend();

  // ── Active users right now (needs usage_events from migration v3) ───────────
  let activeNow = await tryRpc('active_users', { p_minutes: 5 });
  if (activeNow === null) {
    activeNow = 0;
    notes.push('active_now needs the active_users() function (run supabase-migration-v3.sql). Reads usage_history, last 5 min.');
  }

  // ── Code placements (times AI was used) ─────────────────────────────────────
  // Primary source: usage_history (one row per AI call). Falls back to the
  // usage_monthly aggregate if usage_history is empty/unavailable.
  let placementsTotal = 0, placementsMonth = 0;
  placementsTotal = await countRows('usage_history');
  placementsMonth = await countRows('usage_history', (q) => q.gte('created_at', startOfMonthUTC()));
  if (placementsTotal === 0) {
    try {
      const { data: allUsage } = await supabase.from('usage_monthly').select('requests,month');
      for (const r of allUsage || []) {
        placementsTotal += r.requests || 0;
        if (r.month === month) placementsMonth += r.requests || 0;
      }
    } catch { /* leave zeros */ }
  }

  // ── Revenue (Whop first, subscription estimate fallback) ────────────────────
  const subRev = await subscriptionRevenue();
  let revenue = await whopRevenueThisMonth();
  if (!revenue) {
    revenue = { month: subRev.amount, currency: subRev.currency, source: subRev.source };
    notes.push('Revenue is estimated from active subscriptions (Whop API unavailable or env not set). Set WHOP_STARTER_PRICE / WHOP_PRO_PRICE to tune, or ensure WHOP_API_KEY is configured for live figures.');
  } else {
    revenue = { month: revenue.amount, currency: revenue.currency, source: 'whop' };
  }
  revenue.mrr = subRev.mrr;
  revenue.active_starter = subRev.active_starter;
  revenue.active_pro = subRev.active_pro;

  // ── Churn ───────────────────────────────────────────────────────────────────
  const [canceledMonth, activeTotal] = await Promise.all([
    countRows('subscriptions', (q) => q.gte('canceled_at', startOfMonthUTC())),
    countRows('subscriptions', (q) => q.eq('status', 'active')),
  ]);
  const churnDenom = activeTotal + canceledMonth;
  const churnRate = churnDenom > 0 ? +((canceledMonth / churnDenom) * 100).toFixed(2) : 0;

  // ── Most used models (real usage via RPC, else user_settings selection) ─────
  let models = await tryRpc('usage_by_model', { p_days: 30, p_limit: 8 });
  if (!models || models.length === 0) {
    try {
      const { data: settings } = await supabase.from('user_settings').select('model');
      const counts = {};
      for (const s of settings || []) {
        const m = s.model || 'unknown';
        counts[m] = (counts[m] || 0) + 1;
      }
      models = Object.entries(counts)
        .map(([model, calls]) => ({ model, calls }))
        .sort((a, b) => b.calls - a.calls).slice(0, 8);
      if (models.length) notes.push('Models shown by current user selection (user_settings). Once usage_history has rows, ranking switches to real call volume.');
    } catch { models = []; }
  }

  // ── Peak usage hours (needs usage_events) ───────────────────────────────────
  let peakHours = await tryRpc('usage_by_hour', { p_days: 30 });
  if (!peakHours) {
    peakHours = [];
    notes.push('Peak usage hours need the usage_by_hour() function (run supabase-migration-v3.sql). Reads usage_history.');
  }
  // normalize to a full 0..23 array
  const hourMap = {};
  for (const h of peakHours || []) hourMap[h.hour] = Number(h.calls) || 0;
  const peak_hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, calls: hourMap[h] || 0 }));

  // ── Users by country (events, else profiles.country) ────────────────────────
  let countries = await tryRpc('users_by_country', { p_days: 90 });
  if (!countries || countries.length === 0) {
    try {
      const { data: profs } = await supabase.from('profiles').select('country');
      const counts = {};
      for (const p of profs || []) {
        if (!p.country) continue;
        counts[p.country] = (counts[p.country] || 0) + 1;
      }
      countries = Object.entries(counts).map(([country, users]) => ({ country, users }))
        .sort((a, b) => b.users - a.users);
      if (!countries.length) notes.push('No country data yet. profiles.country fills in as signups are captured with geo (x-vercel-ip-country).');
    } catch { countries = []; }
  }
  countries = (countries || []).map((c) => ({ country: c.country, users: Number(c.users) || 0 }));

  // ── Recent users (directory + today's signup feed) ──────────────────────────
  // name + avatar (pfp) when the user has them; plan from subscriptions.
  let usersList = [];
  try {
    const { data: recent } = await supabase
      .from('profiles')
      .select('id,email,full_name,avatar_url,created_at,referral_source')
      .order('created_at', { ascending: false })
      .limit(200);
    const { data: subs } = await supabase.from('subscriptions').select('user_id,plan,status');
    const subMap = {};
    for (const s of subs || []) subMap[s.user_id] = s;
    usersList = (recent || []).map((p) => {
      const sub = subMap[p.id];
      return {
        id: p.id,
        email: p.email,
        full_name: p.full_name,
        avatar_url: p.avatar_url,
        created_at: p.created_at,
        plan: sub && sub.status === 'active' ? sub.plan : 'free',
        referral_source: p.referral_source || null,
      };
    });
  } catch { usersList = []; }

  return res.status(200).json({
    generated_at: new Date().toISOString(),
    signups: { today: signupToday, week: signupWeek, total: totalUsers, waitlist_total: waitlistTotal, trend },
    users: { total: totalUsers, active_now: Number(activeNow) || 0 },
    revenue,
    churn: { rate: churnRate, canceled_month: canceledMonth, active_total: activeTotal },
    placements: { total: placementsTotal, month: placementsMonth },
    models: models || [],
    peak_hours,
    countries,
    users_list: usersList,
    _notes: notes,
  });
}

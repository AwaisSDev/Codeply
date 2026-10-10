// /api/admin-overview: everything the admin dashboard shows, in one feed.
//
// Who uses which app and how much AI they burn, over the last 30 days:
//   app_events     Craft, Crew and the CLI (counts sent by the apps through the
//                  track function: app, model, route, tokens; never content)
//   usage_history  Drop (the Codeply desktop app, through the AI proxy) and
//                  phone calls (prompt_text "voice call")
// plus signups, revenue and feature use (bot calls, reminders, Gmail).
//
// Auth: Bearer token -> requireUser -> profiles.is_admin, like admin-stats.
import { supabase } from '../lib/supabaseClient.js';
import { requireUser } from './auth.js';
import { applyCors } from '../lib/cors.js';

const DAY = 24 * 60 * 60 * 1000;
const MAX_DAYS = 366;
const PRODUCTS = [
  { key: 'craft', label: 'Craft' },
  { key: 'crew', label: 'Crew' },
  { key: 'cli', label: 'CLI' },
  { key: 'drop', label: 'Drop' },
  { key: 'phone', label: 'Phone' },
];

const isoDaysAgo = (n) => new Date(Date.now() - n * DAY).toISOString();
const dayKey = (iso) => String(iso).slice(0, 10);
/** Every day from one YYYY-MM-DD to another, inclusive. */
function daysBetween(from, to) {
  const out = [];
  for (let t = Date.parse(from + 'T00:00:00Z'); t <= Date.parse(to + 'T00:00:00Z'); t += DAY) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}
/** The range asked for: ?from=&to= (days, inclusive) or ?days=N ending today. Defaults to the last 30 days. */
function parseRange(q = {}) {
  const day = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) && !Number.isNaN(Date.parse(v + 'T00:00:00Z')) ? String(v) : null);
  const todayKey = new Date().toISOString().slice(0, 10);
  let from = day(q.from), to = day(q.to);
  if (!from || !to) {
    const n = Math.min(MAX_DAYS, Math.max(1, parseInt(q.days, 10) || 30));
    to = todayKey; from = new Date(Date.now() - (n - 1) * DAY).toISOString().slice(0, 10);
  }
  if (from > to) [from, to] = [to, from];
  if (to > todayKey) to = todayKey;
  if (from > to) from = to;
  const earliest = new Date(Date.parse(to + 'T00:00:00Z') - (MAX_DAYS - 1) * DAY).toISOString().slice(0, 10);
  if (from < earliest) from = earliest;
  return { from, to };
}
function lastDays(n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(new Date(Date.now() - i * DAY).toISOString().slice(0, 10));
  return out;
}

/** Every row of a query, a page at a time (PostgREST returns 1000 at most). */
async function fetchAll(build, max = 100000) {
  const rows = [];
  for (let from = 0; from < max; from += 1000) {
    const { data, error } = await build().range(from, from + 999);
    if (error || !data) break;
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

async function countRows(table, build) {
  try {
    let q = supabase.from(table).select('*', { count: 'exact', head: true });
    if (build) q = build(q);
    const { count, error } = await q;
    return error ? 0 : count || 0;
  } catch { return 0; }
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ message: 'Method not allowed.' }); }
  const user = await requireUser(req, res);
  if (!user) return;
  const { data: me } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
  if (!me?.is_admin) return res.status(403).json({ message: 'Admin access required.' });

  const notes = [];
  const range = parseRange(req.query);
  const since = `${range.from}T00:00:00.000Z`;
  const until = `${range.to}T23:59:59.999Z`;
  const days = daysBetween(range.from, range.to);
  const today = range.to;                       // "today" and "this week" are the end of the range
  const weekAgo = Date.parse(until) - 7 * DAY;

  // ── Usage rows from every app, in one shape ──────────────────────────────
  const [appRows, histRows] = await Promise.all([
    fetchAll(() => supabase.from('app_events').select('user_id,product,kind,model,provider,tokens_in,tokens_out,version,platform,created_at').gte('created_at', since).lte('created_at', until).order('created_at', { ascending: true })),
    fetchAll(() => supabase.from('usage_history').select('user_id,model,tokens_in,tokens_out,tokens_total,prompt_text,created_at').gte('created_at', since).lte('created_at', until).order('created_at', { ascending: true })),
  ]);
  const events = [
    ...appRows.map((r) => ({ user: r.user_id, product: r.product, kind: r.kind, model: r.model || '', provider: r.provider || '', tin: r.tokens_in || 0, tout: r.tokens_out || 0, at: r.created_at, version: r.version, platform: r.platform })),
    ...histRows.map((r) => {
      const phone = String(r.prompt_text || '').trim().toLowerCase() === 'voice call';
      const tin = r.tokens_in || 0; const tout = r.tokens_out || 0;
      return { user: r.user_id, product: phone ? 'phone' : 'drop', kind: 'ai', model: r.model || '', provider: phone ? 'phone' : 'proxy', tin: tin || (tout ? 0 : r.tokens_total || 0), tout, at: r.created_at };
    }),
  ];
  if (!appRows.length) notes.push('Craft, Crew and CLI usage is recorded from Craft 1.1.14 on (and the CLI from its next update). Until people update, those products show little or nothing.');
  notes.push('Drop counts AI calls made through the Codeply proxy; phone counts voice calls with bots. Tokens for phone calls are estimates.');

  const ai = events.filter((e) => e.kind === 'ai');
  const tokens = (e) => e.tin + e.tout;
  const distinct = (list) => new Set(list.map((e) => e.user).filter(Boolean)).size;

  // ── Products ─────────────────────────────────────────────────────────────
  const products = PRODUCTS.map((p) => {
    const mine = events.filter((e) => e.product === p.key);
    const mineAi = mine.filter((e) => e.kind === 'ai');
    const byDay = Object.fromEntries(days.map((d) => [d, { users: new Set(), calls: 0, tokens: 0 }]));
    for (const e of mine) {
      const b = byDay[dayKey(e.at)];
      if (!b) continue;
      if (e.user) b.users.add(e.user);
      if (e.kind === 'ai') { b.calls++; b.tokens += tokens(e); }
    }
    const pm = new Map();
    for (const e of mineAi) { if (!e.model) continue; const m = pm.get(e.model) || { model: e.model, calls: 0, tokens: 0 }; m.calls++; m.tokens += tokens(e); pm.set(e.model, m); }
    return {
      key: p.key, label: p.label,
      users_week: distinct(mine.filter((e) => Date.parse(e.at) >= weekAgo)),
      users_month: distinct(mine),
      calls_month: mineAi.length,
      tokens_month: mineAi.reduce((n, e) => n + tokens(e), 0),
      tokens_in_month: mineAi.reduce((n, e) => n + e.tin, 0),
      tokens_out_month: mineAi.reduce((n, e) => n + e.tout, 0),
      top_models: [...pm.values()].sort((a, b) => b.tokens - a.tokens).slice(0, 3),
      trend: days.map((d) => ({ date: d, users: byDay[d].users.size, calls: byDay[d].calls, tokens: byDay[d].tokens })),
    };
  });

  // ── Daily totals (with signups) ──────────────────────────────────────────
  const profilesNew = await fetchAll(() => supabase.from('profiles').select('created_at').gte('created_at', since).lte('created_at', until));
  const signupsByDay = {};
  for (const p of profilesNew) { const k = dayKey(p.created_at); signupsByDay[k] = (signupsByDay[k] || 0) + 1; }
  const daily = days.map((d) => {
    const dayEvents = events.filter((e) => dayKey(e.at) === d);
    const dayAi = dayEvents.filter((e) => e.kind === 'ai');
    return { date: d, active_users: distinct(dayEvents), calls: dayAi.length, tokens: dayAi.reduce((n, e) => n + tokens(e), 0), signups: signupsByDay[d] || 0 };
  });

  // ── Models and routes ────────────────────────────────────────────────────
  const modelMap = new Map();
  for (const e of ai) {
    if (!e.model) continue;
    const k = `${e.model}|${e.provider}`;
    const m = modelMap.get(k) || { model: e.model, provider: e.provider || 'proxy', calls: 0, tokens: 0, users: new Set() };
    m.calls++; m.tokens += tokens(e); if (e.user) m.users.add(e.user);
    modelMap.set(k, m);
  }
  const models = [...modelMap.values()].sort((a, b) => b.tokens - a.tokens || b.calls - a.calls).slice(0, 15)
    .map((m) => ({ model: m.model, provider: m.provider, calls: m.calls, tokens: m.tokens, users: m.users.size }));
  const provMap = new Map();
  for (const e of ai) { const k = e.provider || 'proxy'; const p = provMap.get(k) || { provider: k, calls: 0, tokens: 0 }; p.calls++; p.tokens += tokens(e); provMap.set(k, p); }
  const providers = [...provMap.values()].sort((a, b) => b.calls - a.calls);

  const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, calls: 0 }));
  for (const e of ai) hours[new Date(e.at).getUTCHours()].calls++;

  // ── Top users by tokens ──────────────────────────────────────────────────
  const userMap = new Map();
  for (const e of events) {
    if (!e.user) continue;
    const u = userMap.get(e.user) || { id: e.user, products: new Set(), calls: 0, tokens: 0, tin: 0, tout: 0, apps: {}, models: {}, last_seen: e.at };
    u.products.add(e.product);
    if (e.kind === 'ai') {
      u.calls++; u.tokens += tokens(e); u.tin += e.tin; u.tout += e.tout;
      const a = u.apps[e.product] || (u.apps[e.product] = { key: e.product, calls: 0, tokens: 0 }); a.calls++; a.tokens += tokens(e);
      if (e.model) u.models[e.model] = (u.models[e.model] || 0) + tokens(e);
    }
    if (e.at > u.last_seen) u.last_seen = e.at;
    userMap.set(e.user, u);
  }
  // Every signed-up user, so the Users tab lists people with no usage this month too:
  // the active ones first (by tokens), then everyone else by when they joined.
  const USER_CAP = 5000;
  const allProfiles = await fetchAll(() => supabase.from('profiles').select('id,email,full_name,created_at,country').order('created_at', { ascending: false }), USER_CAP);
  const prof = Object.fromEntries(allProfiles.map((p) => [p.id, p]));
  const missing = [...userMap.keys()].filter((id) => !prof[id]);
  if (missing.length) {
    const { data: extra } = await supabase.from('profiles').select('id,email,full_name,created_at,country').in('id', missing.slice(0, 1000));
    for (const p of extra || []) prof[p.id] = p;
  }
  const active = [...userMap.values()].sort((a, b) => b.tokens - a.tokens || b.calls - a.calls);
  const idle = allProfiles.filter((p) => !userMap.has(p.id));
  const top_users = [
    ...active.map((u) => ({
      id: u.id, email: prof[u.id]?.email || '', name: prof[u.id]?.full_name || '', joined_at: prof[u.id]?.created_at || null, country: prof[u.id]?.country || '',
      products: [...u.products], calls: u.calls, tokens: u.tokens, tokens_in: u.tin, tokens_out: u.tout, last_seen: u.last_seen,
      by_product: Object.values(u.apps).sort((a, b) => b.tokens - a.tokens),
      top_model: Object.entries(u.models).sort((a, b) => b[1] - a[1])[0]?.[0] || '',
    })),
    ...idle.map((p) => ({
      id: p.id, email: p.email || '', name: p.full_name || '', joined_at: p.created_at || null, country: p.country || '',
      products: [], calls: 0, tokens: 0, tokens_in: 0, tokens_out: 0, last_seen: null, by_product: [], top_model: '',
    })),
  ];
  const users_active_count = active.length;
  // each app's heaviest users, from the same ranking
  for (const p of products) {
    p.top_users = top_users.map((u) => ({ id: u.id, email: u.email, name: u.name, tokens: (u.by_product.find((x) => x.key === p.key) || {}).tokens || 0 }))
      .filter((u) => u.tokens > 0).sort((a, b) => b.tokens - a.tokens).slice(0, 3);
  }

  // ── Versions and platforms (from the apps that report them) ─────────────
  const latest = new Map();
  for (const e of events) {
    if (!e.version || !e.user) continue;
    const k = `${e.user}|${e.product}`;
    if (!latest.has(k) || e.at > latest.get(k).at) latest.set(k, e);
  }
  const verMap = new Map();
  for (const e of latest.values()) { const k = `${e.product}|${e.version}`; verMap.set(k, (verMap.get(k) || 0) + 1); }
  const versions = [...verMap.entries()].map(([k, users]) => { const [product, version] = k.split('|'); return { product, version, users }; })
    .sort((a, b) => b.users - a.users);
  const platMap = new Map();
  for (const e of events) if (e.platform && e.user) { const s = platMap.get(e.platform) || new Set(); s.add(e.user); platMap.set(e.platform, s); }
  const platforms = [...platMap.entries()].map(([platform, s]) => ({ platform, users: s.size })).sort((a, b) => b.users - a.users);

  // ── Totals, features, revenue, countries ────────────────────────────────
  const dayStart = new Date(`${today}T00:00:00Z`).getTime();
  const [usersTotal, signupsToday, signupsWeek, remindersMonth, botCallsMonth, mailWatch, gmailCalls, customModels, activeStarter, activePro] = await Promise.all([
    countRows('profiles'),
    countRows('profiles', (q) => q.gte('created_at', new Date(dayStart).toISOString()).lte('created_at', until)),
    countRows('profiles', (q) => q.gte('created_at', new Date(weekAgo).toISOString()).lte('created_at', until)),
    countRows('reminders', (q) => q.gte('created_at', since).lte('created_at', until)),
    countRows('reminders', (q) => q.eq('kind', 'call').in('status', ['sent', 'done']).gte('due_at', since).lte('due_at', until)),
    countRows('mail_watch_accounts', (q) => q.eq('enabled', true)),
    countRows('mail_links'),
    countRows('user_models'),
    countRows('subscriptions', (q) => q.eq('status', 'active').eq('plan', 'starter')),
    countRows('subscriptions', (q) => q.eq('status', 'active').eq('plan', 'pro')),
  ]);
  const voice = await fetchAll(() => supabase.from('tts_usage').select('chars').gte('day', range.from).lte('day', range.to));
  const mrr = activeStarter * +(process.env.WHOP_STARTER_PRICE || 9) + activePro * +(process.env.WHOP_PRO_PRICE || 29);

  const countryRows = await fetchAll(() => supabase.from('profiles').select('country'));
  const cMap = {};
  for (const p of countryRows) if (p.country) cMap[p.country] = (cMap[p.country] || 0) + 1;
  const countries = Object.entries(cMap).map(([country, users]) => ({ country, users })).sort((a, b) => b.users - a.users);

  return res.status(200).json({
    generated_at: new Date().toISOString(),
    range_days: days.length,
    range,
    totals: {
      users: usersTotal,
      signups_today: signupsToday,
      signups_week: signupsWeek,
      active_today: distinct(events.filter((e) => Date.parse(e.at) >= dayStart)),
      active_week: distinct(events.filter((e) => Date.parse(e.at) >= weekAgo)),
      active_month: distinct(events),
      ai_calls_month: ai.length,
      tokens_month: ai.reduce((n, e) => n + tokens(e), 0),
      tokens_in_month: ai.reduce((n, e) => n + e.tin, 0),
      tokens_out_month: ai.reduce((n, e) => n + e.tout, 0),
      mrr,
      revenue_month: mrr,
      currency: 'USD',
    },
    products,
    daily,
    models,
    providers,
    peak_hours: hours,
    top_users,
    users_active_count,
    features: {
      bot_calls_month: botCallsMonth,
      reminders_month: remindersMonth,
      mail_watch_accounts: mailWatch,
      gmail_on_calls: gmailCalls,
      custom_models: customModels,
      voice_chars_month: voice.reduce((n, r) => n + (r.chars || 0), 0),
    },
    versions,
    platforms,
    countries,
    notes,
  });
}

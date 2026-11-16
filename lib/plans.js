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
    limits: null, // the free tier keeps Haze 2's own daily allowance
  },
  starter: {
    key: 'starter',
    name: 'Pro',
    price: num('WHOP_STARTER_PRICE', 20),
    models: ['haze', 'opus'],
    comingSoon: [],
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
    models: ['haze', 'opus', 'fable'],
    comingSoon: ['chatgpt'],
    limits: {
      windowHours: WINDOW_HOURS,
      windowUsd: num('PLAN_PRO_WINDOW_USD', 5),
      monthUsd: num('PLAN_PRO_MONTH_USD', 50),
    },
  },
};

export const PAID_PLANS = ['starter', 'pro'];

export const MODEL_LABELS = {
  haze: 'Haze 2 (Sonnet 5.5 and Haiku 5.5, picked for you)',
  opus: 'Claude Opus 5.5',
  fable: 'Claude Fable 5.2',
  chatgpt: 'ChatGPT models',
};

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
  if (sub.status === 'active') return sub.plan;
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
    limits: p.limits,
  };
}

// Pricing: Pro and Max checkout through Whop.
// Sign-in is the same Supabase account as /chat and the apps, and shares /chat's
// saved session (same storage key), so someone signed in there is signed in here.
(function () {
  'use strict';

  const SUPABASE_URL = 'https://zswkhfkfseclgadhvobg.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpzd2toZmtmc2VjbGdhZGh2b2JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMzYyOTgsImV4cCI6MjA5NTgxMjI5OH0.EoTQdIGQQDrN1uEqQfya3VmrQMT68jkzPLphbLwNTWg';
  const $ = (id) => document.getElementById(id);
  const sb = window.supabase && window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'craft-phone-auth' },
  });

  const banner = $('prBanner');
  const say = (text, kind) => {
    banner.textContent = text;
    banner.dataset.kind = kind || 'info';
    banner.hidden = !text;
  };

  async function session() {
    if (!sb) return null;
    const { data } = await sb.auth.getSession();
    return (data && data.session) || null;
  }

  async function api(path, token, opts = {}) {
    const res = await fetch(path, {
      ...opts,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.message || 'Something went wrong. Try again.');
    return body;
  }

  // ─── The plan you're on ───────────────────────────────────────────────────
  const NAMES = { free: 'Free', starter: 'Pro', pro: 'Max' };
  async function showCurrentPlan() {
    const s = await session();
    if (!s) return;
    try {
      const acct = await api('/api/account', s.access_token);
      const key = (acct.plan && acct.plan.key) || 'free';
      document.querySelectorAll('.pr-card').forEach((card) => {
        const mine = card.dataset.plan === key;
        card.classList.toggle('pr-current', mine);
        const btn = card.querySelector('[data-buy]');
        if (btn && mine) { btn.textContent = 'Your plan'; btn.disabled = true; }
      });
      const sub = acct.subscription || {};
      if (key !== 'free' && sub.status === 'canceled' && sub.current_period_end) {
        say(`Your ${NAMES[key]} plan is canceled and ends on ${new Date(sub.current_period_end).toLocaleDateString()}.`);
      } else if (key !== 'free' && sub.status === 'past_due') {
        say('Your last payment didn\'t go through. Update your card in Whop to keep your plan.', 'warn');
      }
    } catch { /* the page works without it */ }
  }

  // ─── Checkout ─────────────────────────────────────────────────────────────
  let wanted = null;
  async function buy(plan) {
    const s = await session();
    if (!s) { wanted = plan; openSignin(); return; }
    const btn = document.querySelector(`[data-buy="${plan}"]`);
    const label = btn.textContent;
    btn.disabled = true; btn.textContent = 'Opening checkout...';
    try {
      const { checkoutUrl } = await api('/api/create-checkout', s.access_token, { method: 'POST', body: JSON.stringify({ plan }) });
      window.location.href = checkoutUrl;
    } catch (e) {
      say(e.message, 'warn');
      btn.disabled = false; btn.textContent = label;
    }
  }
  document.querySelectorAll('[data-buy]').forEach((b) => b.addEventListener('click', () => buy(b.dataset.buy)));

  // ─── Sign in ──────────────────────────────────────────────────────────────
  const modal = $('prSignin');
  function openSignin() {
    $('prLogin').hidden = false; $('prOtp').hidden = true;
    modal.hidden = false;
    $('prEmail').focus();
  }
  function closeSignin() { modal.hidden = true; wanted = null; }
  modal.addEventListener('click', (e) => { if (e.target === modal || e.target.closest('[data-close]')) closeSignin(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) closeSignin(); });

  const showErr = (id, text) => { const el = $(id); el.textContent = text; el.hidden = !text; };
  const friendly = (e, fallback) => {
    const m = String((e && e.message) || '');
    if (/invalid login credentials/i.test(m)) return 'That email and password don\'t match.';
    if (/signups not allowed|user not found/i.test(m)) return 'No Codeply account uses that email.';
    if (/token has expired|invalid/i.test(m)) return 'That code didn\'t work. Check it or send a new one.';
    return m || fallback;
  };
  async function signedIn() {
    const plan = wanted;
    modal.hidden = true; wanted = null;
    await showCurrentPlan();
    if (plan) buy(plan);
  }

  $('prLogin').addEventListener('submit', async (e) => {
    e.preventDefault();
    showErr('prLoginErr', '');
    const email = $('prEmail').value.trim();
    const password = $('prPassword').value;
    if (!password) { showErr('prLoginErr', 'Enter your password, or use a code.'); return; }
    try {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
      $('prPassword').value = '';
      await signedIn();
    } catch (x) { showErr('prLoginErr', friendly(x, 'Sign-in failed.')); }
  });
  $('prUseCode').addEventListener('click', async () => {
    const email = $('prEmail').value.trim();
    if (!email) { showErr('prLoginErr', 'Enter your email first.'); return; }
    showErr('prLoginErr', '');
    try {
      const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
      if (error) throw error;
      $('prOtpSent').textContent = `We emailed a sign-in code to ${email}.`;
      $('prLogin').hidden = true; $('prOtp').hidden = false;
      $('prCode').focus();
    } catch (x) { showErr('prLoginErr', friendly(x, 'Could not send a code.')); }
  });
  $('prOtp').addEventListener('submit', async (e) => {
    e.preventDefault();
    showErr('prOtpErr', '');
    const token = $('prCode').value.replace(/\D+/g, '');
    if (token.length < 6) { showErr('prOtpErr', 'Enter the full code from the email.'); return; }
    try {
      const { error } = await sb.auth.verifyOtp({ email: $('prEmail').value.trim(), token, type: 'email' });
      if (error) throw error;
      await signedIn();
    } catch (x) { showErr('prOtpErr', friendly(x, 'Sign-in failed.')); }
  });

  // Back from Whop: the webhook may land a moment after the redirect.
  if (new URLSearchParams(location.search).get('checkout') === 'done') {
    say('Thanks! Your plan is being set up. It shows here and in the apps within a minute.');
    setTimeout(showCurrentPlan, 4000);
  }
  showCurrentPlan();
})();

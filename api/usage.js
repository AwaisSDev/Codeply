// /api/usage — cumulative token usage per user (monthly), plus cap status.
// GET  -> { month, tokens, requests, monthly_cap, per_prompt_cap, capReached }
// POST -> { tokens, requests? } adds usage for the current month
import { supabase } from '../lib/supabaseClient.js';
import { getJsonBody, requireUser } from './auth.js';
import { applyCors } from '../lib/cors.js';

function currentMonth() {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return;

  const user = await requireUser(req, res);
  if (!user) return;

  const month = currentMonth();

  if (req.method === 'POST') {
    const body = getJsonBody(req);
    const tokens = Math.max(0, Math.floor(+body.tokens || 0));
    const requests = Math.max(0, Math.floor(+body.requests || 1));
    if (tokens > 0 || requests > 0) {
      const { data: row } = await supabase
        .from('usage_monthly')
        .select('tokens,requests')
        .eq('user_id', user.id)
        .eq('month', month)
        .maybeSingle();
      const { error } = await supabase.from('usage_monthly').upsert({
        user_id: user.id,
        month,
        tokens: (row?.tokens || 0) + tokens,
        requests: (row?.requests || 0) + requests,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,month' });
      if (error) return res.status(500).json({ message: 'Could not record usage.' });

      // Per-event log (powers the admin dashboard: peak hours, model ranking,
      // users-by-country, live "active now"). Best-effort: never blocks usage.
      // Requires supabase-migration-v3.sql (usage_events table); the insert is
      // wrapped so a missing table or column simply no-ops.
      try {
        // Country comes free from Vercel's edge geo headers.
        const country =
          req.headers['x-vercel-ip-country'] ||
          req.headers['cf-ipcountry'] ||
          null;

        // Model/provider: prefer what the client reports, else the saved setting.
        let model = body.model || null;
        let provider = body.provider || null;
        if (!model) {
          const { data: s } = await supabase
            .from('user_settings')
            .select('model,provider')
            .eq('user_id', user.id)
            .maybeSingle();
          model = s?.model || null;
          provider = provider || s?.provider || null;
        }

        await supabase.from('usage_events').insert({
          user_id: user.id,
          model,
          provider,
          country: country ? String(country).toUpperCase().slice(0, 2) : null,
          tokens,
        });
      } catch { /* table not migrated yet, or transient — ignore */ }
    }
  } else if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ message: 'Method not allowed.' });
  }

  const [{ data: usage }, { data: settings }] = await Promise.all([
    supabase.from('usage_monthly').select('tokens,requests').eq('user_id', user.id).eq('month', month).maybeSingle(),
    supabase.from('user_settings').select('monthly_cap,per_prompt_cap').eq('user_id', user.id).maybeSingle(),
  ]);

  const tokens = usage?.tokens || 0;
  const monthlyCap = settings?.monthly_cap || 0;

  return res.status(200).json({
    month,
    tokens,
    requests: usage?.requests || 0,
    monthly_cap: monthlyCap,
    per_prompt_cap: settings?.per_prompt_cap || 0,
    capReached: monthlyCap > 0 && tokens >= monthlyCap,
  });
}

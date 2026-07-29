// /api/admin-user — per-user drill-down for the admin analytics dashboard.
//
// GET ?id=<user_id> (admins only) -> {
//   profile:  { id, email, full_name, avatar_url, created_at, country, referral_source, plan },
//   usage:    { calls, tokens_in, tokens_out, tokens_total, first_at, last_at },
//   applies:  { count, lines_added, lines_removed, first_at, last_at },
//   recent:   [{ at, type:'call'|'apply', model?, tokens_total?, lines_added?, lines_removed? }, ...]
// }
//
// Deliberately excludes usage_history.prompt_text — this view answers "how
// much did this person use Codeply and when", never "what did they ask for".
//
// Auth: same pattern as admin-stats.js — Bearer token -> requireUser -> is_admin.
import { supabase } from '../lib/supabaseClient.js';
import { requireUser } from './auth.js';
import { applyCors } from '../lib/cors.js';

// Enough rows to give an accurate lifetime total for any real user while
// keeping the query bounded; a note is added if a user somehow blows past it.
const ROW_CAP = 5000;

export default async function handler(req, res) {
  if (applyCors(req, res)) return;

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ message: 'Method not allowed.' });
  }

  const admin = await requireUser(req, res);
  if (!admin) return;

  const { data: adminProfile } = await supabase
    .from('profiles').select('is_admin').eq('id', admin.id).maybeSingle();
  if (!adminProfile?.is_admin) {
    return res.status(403).json({ message: 'Admin access required.' });
  }

  const targetId = String(req.query?.id || '').trim();
  if (!targetId) return res.status(400).json({ message: 'id required.' });

  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('id,email,full_name,avatar_url,created_at,referral_source,country')
    .eq('id', targetId)
    .maybeSingle();
  if (profileErr || !profile) return res.status(404).json({ message: 'User not found.' });

  const { data: sub } = await supabase
    .from('subscriptions').select('plan,status').eq('user_id', targetId).maybeSingle();

  const notes = [];

  const { data: usageRows } = await supabase
    .from('usage_history')
    .select('model,tokens_in,tokens_out,tokens_total,created_at')
    .eq('user_id', targetId)
    .order('created_at', { ascending: false })
    .limit(ROW_CAP);
  if ((usageRows || []).length >= ROW_CAP) notes.push(`usage capped at ${ROW_CAP} most recent calls`);

  const { data: applyRows } = await supabase
    .from('apply_history')
    .select('file_path,lines_added,lines_removed,created_at')
    .eq('user_id', targetId)
    .order('created_at', { ascending: false })
    .limit(ROW_CAP);
  if ((applyRows || []).length >= ROW_CAP) notes.push(`applies capped at ${ROW_CAP} most recent`);

  const usage = (usageRows || []).reduce((acc, r) => {
    acc.calls++;
    acc.tokens_in += r.tokens_in || 0;
    acc.tokens_out += r.tokens_out || 0;
    acc.tokens_total += r.tokens_total || 0;
    if (!acc.last_at) acc.last_at = r.created_at;
    acc.first_at = r.created_at;
    return acc;
  }, { calls: 0, tokens_in: 0, tokens_out: 0, tokens_total: 0, first_at: null, last_at: null });

  const applies = (applyRows || []).reduce((acc, r) => {
    acc.count++;
    acc.lines_added += r.lines_added || 0;
    acc.lines_removed += r.lines_removed || 0;
    if (!acc.last_at) acc.last_at = r.created_at;
    acc.first_at = r.created_at;
    return acc;
  }, { count: 0, lines_added: 0, lines_removed: 0, first_at: null, last_at: null });

  // Merge the two event streams into one recent-activity timeline, newest first.
  const recent = [
    ...(usageRows || []).map((r) => ({ at: r.created_at, type: 'call', model: r.model, tokens_total: r.tokens_total })),
    ...(applyRows || []).map((r) => ({ at: r.created_at, type: 'apply', lines_added: r.lines_added, lines_removed: r.lines_removed })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 50);

  return res.status(200).json({
    profile: {
      id: profile.id,
      email: profile.email,
      full_name: profile.full_name,
      avatar_url: profile.avatar_url,
      created_at: profile.created_at,
      country: profile.country || null,
      referral_source: profile.referral_source || null,
      plan: sub && sub.status === 'active' ? sub.plan : 'free',
    },
    usage,
    applies,
    recent,
    _notes: notes,
  });
}

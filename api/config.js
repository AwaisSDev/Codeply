import { supabase, publicSupabaseConfig } from '../lib/supabaseClient.js';
import { applyCors } from '../lib/cors.js';
import { getJsonBody, requireUser } from './auth.js';

const REMOTE_FIELDS = ['kill_switch', 'min_version', 'update_banner', 'feature_flags', 'free_mode'];

export default async function handler(req, res) {
  if (applyCors(req, res)) return;

  // Route based on the URL path
  const url = req.url || '';
  if (url.includes('remote-config')) {
    return handleRemoteConfig(req, res);
  }

  return handleStandardConfig(req, res);
}

async function handleStandardConfig(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ message: 'Method not allowed.' });
  }

  if (!publicSupabaseConfig.anonKey) {
    return res.status(500).json({ message: 'Missing SUPABASE_ANON_KEY environment variable.' });
  }

  let freeMode = false;
  try {
    const { data } = await supabase
      .from('app_settings')
      .select('free_mode')
      .eq('id', 1)
      .maybeSingle();
    freeMode = !!(data && data.free_mode);
  } catch (error) {
    console.error('Could not read app_settings.free_mode:', error);
    freeMode = false;
  }

  return res.status(200).json({ ...publicSupabaseConfig, freeMode });
}

async function handleRemoteConfig(req, res) {
  if (req.method === 'GET') {
    const { data } = await supabase.from('remote_config').select('*').eq('id', 1).maybeSingle();
    return res.status(200).json(data || {
      kill_switch: false, min_version: '0.0.0', update_banner: '', feature_flags: {}, free_mode: false,
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ message: 'Method not allowed.' });
  }

  const user = await requireUser(req, res);
  if (!user) return;

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
  if (!profile?.is_admin) {
    return res.status(403).json({ message: 'Admin access required.' });
  }

  const body = getJsonBody(req);
  const patch = {};
  for (const f of REMOTE_FIELDS) {
    if (body[f] === undefined) continue;
    if (f === 'kill_switch' || f === 'free_mode') patch[f] = !!body[f];
    else if (f === 'feature_flags') patch[f] = (body[f] && typeof body[f] === 'object') ? body[f] : {};
    else patch[f] = String(body[f]);
  }
  if (!Object.keys(patch).length) return res.status(400).json({ message: 'Nothing to update.' });

  const { error } = await supabase
    .from('remote_config')
    .upsert({ id: 1, ...patch, updated_at: new Date().toISOString() }, { onConflict: 'id' });
  if (error) return res.status(500).json({ message: 'Could not update config.' });

  if (patch.kill_switch !== undefined) {
    await supabase.from('app_config').upsert(
      { key: 'kill_switch', value: String(patch.kill_switch), updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    );
  }
  if (patch.free_mode !== undefined) {
    await supabase.from('app_settings').upsert({ id: 1, free_mode: patch.free_mode }, { onConflict: 'id' });
  }

  const { data } = await supabase.from('remote_config').select('*').eq('id', 1).maybeSingle();
  return res.status(200).json(data);
}
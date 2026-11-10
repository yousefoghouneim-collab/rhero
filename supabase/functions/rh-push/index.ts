// RHero push sender: delivers rh_notifications to the user's phones (Web Push).
// Called by a database trigger (x-rh-hook secret) or by the app ("send a test").
import { createClient } from 'npm:@supabase/supabase-js@2.49.4';
import { sendPush, type Vapid } from './webpush.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

let cache: { vapid: Vapid; hook: string } | null = null;
async function config() {
  if (cache) return cache;
  const { data } = await admin.from('rh_config').select('key,value').in('key', ['vapid_public', 'vapid_jwk', 'vapid_subject', 'push_hook_secret']);
  const m = new Map((data ?? []).map((r: { key: string; value: string }) => [r.key, r.value]));
  cache = { vapid: { publicKey: m.get('vapid_public')!, jwk: JSON.parse(m.get('vapid_jwk') ?? '{}'), subject: m.get('vapid_subject') ?? 'mailto:admin@rhero.app' }, hook: m.get('push_hook_secret') ?? '' };
  return cache;
}

async function pushToUser(userId: string, message: Record<string, unknown>) {
  const { vapid } = await config();
  const { data: subs } = await admin.from('rh_push_subs').select('*').eq('user_id', userId);
  let sent = 0;
  for (const s of subs ?? []) {
    try {
      const status = await sendPush(s, message, vapid);
      if (status === 404 || status === 410) await admin.from('rh_push_subs').delete().eq('id', s.id);
      else if (status >= 200 && status < 300) sent++;
      else console.error('push service responded', status, s.endpoint.slice(0, 60));
    } catch (e) { console.error('push failed', e); }
  }
  return sent;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const body = await req.json().catch(() => ({}));
    const hook = req.headers.get('x-rh-hook');
    if (hook) {
      const { hook: secret } = await config();
      if (!secret || hook !== secret) return json({ error: 'forbidden' }, 403);
      const { data: n } = await admin.from('rh_notifications').select('*').eq('id', body.notification_id).maybeSingle();
      if (!n) return json({ ok: true, sent: 0 });
      const sent = await pushToUser(n.user_id, { title: n.title, body: n.body ?? '', url: n.link ?? '/', tag: n.kind });
      return json({ ok: true, sent });
    }
    if (body.action === 'test') {
      const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
      const { data, error } = await admin.auth.getUser(token);
      if (error || !data.user) return json({ error: 'Please sign in again' }, 401);
      const sent = await pushToUser(data.user.id, { title: 'RHero notifications are on ✅', body: 'You will get the daily report and stock alerts here.', url: '/m', tag: 'test' });
      return json({ ok: true, sent });
    }
    return json({ error: 'Unknown request' }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : 'error' }, 500);
  }
});

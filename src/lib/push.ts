import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase';

export const VAPID_PUBLIC_KEY = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) ?? 'BNFfr7C9LS9vJ13mHE6dq7SYV7NqaFjDKOHkNR5D-MnkfmNyR0xCGC_SUkEmWWt2ihAq-6gE9pKQc5qmWmDVgpI';

function b64urlToBytes(s: string): Uint8Array {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
function bytesToB64url(buf: ArrayBuffer | null): string {
  if (!buf) return '';
  let s = '';
  new Uint8Array(buf).forEach((b) => { s += String.fromCharCode(b); });
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function pushSupport(): { ok: boolean; reason?: string } {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    return { ok: false, reason: ios ? 'On iPhone, first add RHero to your Home Screen, then open it from there to turn on notifications.' : 'This browser does not support push notifications.' };
  }
  return { ok: true };
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupport().ok) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager.getSubscription()) ?? null;
}

export async function enablePush(userId: string): Promise<void> {
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Notifications are blocked — allow them in the browser settings.');
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64urlToBytes(VAPID_PUBLIC_KEY) }));
  const { error } = await supabase.from('rh_push_subs').upsert({
    user_id: userId, endpoint: sub.endpoint, p256dh: bytesToB64url(sub.getKey('p256dh')), auth: bytesToB64url(sub.getKey('auth')), user_agent: navigator.userAgent.slice(0, 200),
  }, { onConflict: 'endpoint' });
  if (error) throw error;
}

export async function disablePush(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  await supabase.from('rh_push_subs').delete().eq('endpoint', sub.endpoint);
  await sub.unsubscribe();
}

export async function sendTestPush(): Promise<number> {
  const { data: s } = await supabase.auth.getSession();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/rh-push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${s.session?.access_token ?? ''}` },
    body: JSON.stringify({ action: 'test' }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Could not send');
  return body.sent ?? 0;
}

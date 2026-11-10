import { createClient } from '@supabase/supabase-js';

// Public (browser-safe) project values. Row-level security protects all data.
export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? 'https://yxmyavagjafymwnejaqp.supabase.co';
export const SUPABASE_ANON_KEY =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4bXlhdmFnamFmeW13bmVqYXFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyNzUyODEsImV4cCI6MjA5ODg1MTI4MX0.PUKznXyVGV9c1FIySbKYSwqmsOcbwM0wGW6zY-3VlSw';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'rhero-auth' },
  realtime: { params: { eventsPerSecond: 20 } },
});

export function errMsg(e: unknown): string {
  if (!e) return 'Something went wrong';
  if (typeof e === 'string') return e;
  const anyE = e as { message?: string; error_description?: string; details?: string };
  const m = anyE.message || anyE.error_description || anyE.details || 'Something went wrong';
  if (/Failed to fetch|NetworkError|network/i.test(m)) return 'No internet connection — try again';
  if (/JWT expired|invalid JWT/i.test(m)) return 'Your session expired — please sign in again';
  return m;
}

/** Calls the rh-admin edge function with the signed-in user's token. */
export async function adminCall<T = unknown>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const { data: s } = await supabase.auth.getSession();
  const token = s.session?.access_token;
  const res = await fetch(`${SUPABASE_URL}/functions/v1/rh-admin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ action, ...payload }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body as T;
}

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AUTH_STORAGE_KEY, supabase } from '../lib/supabase';
import type { Org, Profile } from '../lib/types';
import { orgNow } from '../lib/time';
import { clearOutbox, flush, outbox } from '../lib/outbox';

type Status = 'loading' | 'signedout' | 'noaccess' | 'ready';
type Me = Profile & { org: Org };
type Ctx = {
  status: Status;
  session: Session | null;
  me: Me | null;
  profile: Profile | null;
  org: Org | null;
  signOut: () => Promise<void>;
  reloadMe: () => void;
  demoRefreshing: boolean;
};
const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [demoRefreshing, setDemoRefreshing] = useState(false);
  const demoChecked = useRef<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setSessionLoaded(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { setSession(s); setSessionLoaded(true); });
    return () => sub.subscription.unsubscribe();
  }, []);

  const uid = session?.user.id;
  const meQ = useQuery({
    queryKey: ['me', uid],
    enabled: !!uid,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('rh_profiles').select('*, org:rh_orgs(*)').eq('id', uid!).maybeSingle();
      if (error) throw error;
      return (data as Me | null) ?? null;
    },
  });
  const me = meQ.data ?? null;

  // demo workspace: rebuild sample history once per day on first login
  useEffect(() => {
    if (!me?.org?.is_demo) return;
    const today = orgNow(me.org.timezone).date;
    const key = `${me.org.id}:${today}`;
    if (demoChecked.current === key || me.org.demo_seeded_on === today) { demoChecked.current = key; return; }
    demoChecked.current = key;
    setDemoRefreshing(true);
    supabase.rpc('rh_demo_refresh', { p_force: false })
      .then(({ data }) => { if (data) void qc.invalidateQueries(); })
      .then(() => setDemoRefreshing(false), () => setDemoRefreshing(false));
  }, [me?.org?.id, me?.org?.is_demo, me?.org?.demo_seeded_on, me?.org?.timezone, qc]);

  // heartbeat so the office manager can see who is active
  useEffect(() => {
    if (!me) return;
    const beat = () => { if (document.visibilityState === 'visible') supabase.rpc('rh_touch', { p_language: null }).then(() => undefined, () => undefined); };
    beat();
    const id = setInterval(beat, 5 * 60_000);
    document.addEventListener('visibilitychange', beat);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', beat); };
  }, [me?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  let status: Status = 'loading';
  if (sessionLoaded && !session) status = 'signedout';
  else if (session && me) status = me.active ? 'ready' : 'noaccess';
  else if (session && meQ.isSuccess && !me) status = 'noaccess';
  else if (session && meQ.isError && !me) status = 'noaccess';

  const value: Ctx = {
    status, session, me, profile: me, org: me?.org ?? null, demoRefreshing,
    reloadMe: () => void qc.invalidateQueries({ queryKey: ['me'] }),
    signOut: async () => {
      const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
      // last chance to send queued work (never waits long)
      if (outbox.get().ops.length && navigator.onLine) await Promise.race([flush(), wait(2500)]);
      // tell the server (this device only) but never hang on it
      await Promise.race([supabase.auth.signOut({ scope: 'local' }).catch(() => undefined), wait(1500)]);
      clearOutbox();
      qc.clear();
      try {
        [AUTH_STORAGE_KEY, `${AUTH_STORAGE_KEY}-code-verifier`, `${AUTH_STORAGE_KEY}-user`, 'rhero-query-cache'].forEach((k) => localStorage.removeItem(k));
      } catch { /* storage blocked */ }
      // a fresh page: nothing of the old session can linger
      window.location.replace('/login');
    },
  };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): Ctx {
  const c = useContext(AuthCtx);
  if (!c) throw new Error('AuthProvider missing');
  return c;
}
/** For screens rendered only when signed in. */
export function useMe() {
  const { me, org } = useAuth();
  if (!me || !org) throw new Error('Not signed in');
  return { me, org };
}

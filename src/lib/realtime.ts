import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { createStore, useStore } from './store';
import type { Notification, Role } from './types';
import { toast } from './toast';

export const liveStore = createStore<{ live: boolean; lastEvent: number }>({ live: false, lastEvent: 0 });
export const useLive = () => useStore(liveStore);

/**
 * Live updates: subscribes to database changes for the org and refreshes the affected
 * screens instantly. Self-healing — channels that error or close are re-created with
 * backoff, and a light safety-net refresh runs every 30 s while the app is visible.
 */
export function useRealtime(orgId: string, userId: string, role: Role) {
  const qc = useQueryClient();
  useEffect(() => {
    let disposed = false;
    const pending = new Set<string>();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const bump = (keys: string[]) => {
      keys.forEach((k) => pending.add(k));
      liveStore.set((s) => ({ ...s, lastEvent: Date.now() }));
      if (timer) return;
      timer = setTimeout(() => {
        pending.forEach((k) => void qc.invalidateQueries({ queryKey: [k] }));
        pending.clear();
        timer = null;
      }, 250);
    };

    const tables: [string, string[]][] = [
      ['rh_task_done', ['done']],
      ['rh_stock_counts', ['counts', 'itemHistory', 'reportPreview']],
      ['rh_items', ['items']],
      ['rh_issues', ['issues']],
      ['rh_tasks', ['tasks']],
      ['rh_routines', ['routines']],
      ['rh_areas', ['areas']],
      ['rh_profiles', ['team']],
    ];
    if (role === 'manager') {
      tables.push(['rh_requests', ['requests']], ['rh_visitor_passes', ['passes']], ['rh_orders', ['orders', 'moves']], ['rh_daily_reports', ['reports']]);
    }

    const status: Record<string, boolean> = { org: false, me: false };
    const setLive = () => liveStore.set((s) => ({ ...s, live: status.org && status.me }));
    const channels: Record<string, RealtimeChannel | null> = { org: null, me: null };
    const retries: Record<string, number> = { org: 0, me: 0 };

    const build = (name: 'org' | 'me'): RealtimeChannel => {
      const ch = supabase.channel(`rhero:${name}:${orgId}:${userId}:${Date.now()}`);
      if (name === 'org') {
        // No column filters: row-level security already limits every change to this org
        // (the realtime server rejects column filters on this project, so we don't send them).
        for (const [table, keys] of tables) {
          ch.on('postgres_changes', { event: '*', schema: 'public', table }, () => bump(keys));
        }
      } else {
        // no filter: row-level security only delivers this user's own notifications
        ch.on('postgres_changes', { event: '*', schema: 'public', table: 'rh_notifications' }, (payload) => {
          bump(['notifications']);
          if (payload.eventType === 'INSERT' && role === 'manager') {
            const n = payload.new as Notification;
            toast(n.title, n.kind === 'stock_red' || n.kind === 'issue' || n.kind === 'round' ? 'bad' : 'info');
            try { if (document.visibilityState === 'visible') navigator.vibrate?.(30); } catch { /* ignore */ }
          }
        });
      }
      return ch;
    };

    const connect = async (name: 'org' | 'me') => {
      // join with the person's own token from the start — otherwise a channel can join anonymously and
      // miss the token hand-over, and row-level security then hides every change from it
      await supabase.realtime.setAuth().catch(() => undefined);
      if (disposed) return;
      const ch = build(name);
      channels[name] = ch;
      ch.subscribe((s) => {
        if (disposed || channels[name] !== ch) return;
        if (s === 'SUBSCRIBED') {
          status[name] = true;
          retries[name] = 0;
          setLive();
          void qc.invalidateQueries(); // catch up on anything missed while connecting
        } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') {
          status[name] = false;
          setLive();
          const wait = Math.min(30_000, 1000 * 2 ** retries[name]++);
          channels[name] = null;
          void supabase.removeChannel(ch);
          setTimeout(() => void connect(name), wait);
        }
      });
    };
    void connect('org');
    void connect('me');

    // safety net: refresh the live data every 30 s while the screen is visible
    const safety = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      ['done', 'counts', 'items', 'issues', 'notifications', ...(role === 'manager' ? ['requests', 'passes', 'orders', 'team'] : [])]
        .forEach((k) => void qc.invalidateQueries({ queryKey: [k] }));
    }, 30_000);

    // back in the foreground → catch up immediately
    const onVis = () => { if (document.visibilityState === 'visible') void qc.invalidateQueries(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('online', onVis);

    return () => {
      disposed = true;
      clearInterval(safety);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('online', onVis);
      if (timer) clearTimeout(timer);
      liveStore.set((s) => ({ ...s, live: false }));
      Object.values(channels).forEach((ch) => { if (ch) void supabase.removeChannel(ch); });
    };
  }, [orgId, userId, role, qc]);
}

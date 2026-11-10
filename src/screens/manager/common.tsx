import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useMe } from '../../auth/AuthProvider';
import { useNotifications } from '../../lib/data';
import { useLive } from '../../lib/realtime';
import { supabase } from '../../lib/supabase';
import { ago } from '../../lib/time';
import { Mark } from '../../components/Brand';
import { Button, EmptyState, IconButton, Sheet, cx } from '../../components/ui';

export function LiveDot({ className }: { className?: string }) {
  const { live } = useLive();
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold', live ? 'bg-ok-soft text-ok-ink' : 'bg-sunken text-muted', className)} title={live ? 'Live updates on' : 'Connecting…'}>
      <span className={cx('h-2 w-2 rounded-full', live ? 'bg-ok animate-pulse2' : 'bg-muted/50')} />
      {live ? 'Live' : 'Offline'}
    </span>
  );
}

const KIND_ICON: Record<string, string> = { stock_red: '🔴', issue: '⚠️', request: '🛒', pass: '🪪', report: '📊', round: '⏰' };

export function NotificationsBell() {
  const q = useNotifications();
  const qc = useQueryClient();
  const nav = useNavigate();
  const { me } = useMe();
  const [open, setOpen] = useState(false);
  const unread = (q.data ?? []).filter((n) => !n.read_at).length;
  const markAll = async () => {
    await supabase.from('rh_notifications').update({ read_at: new Date().toISOString() }).eq('user_id', me.id).is('read_at', null);
    void qc.invalidateQueries({ queryKey: ['notifications'] });
  };
  return (
    <>
      <IconButton label="Notifications" onClick={() => setOpen(true)} className="relative">
        <Bell className="h-[22px] w-[22px]" />
        {unread > 0 && <span data-testid="bell-count" className="absolute -end-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-red px-1 text-[11px] font-bold text-white tnum">{unread > 9 ? '9+' : unread}</span>}
      </IconButton>
      <Sheet open={open} onClose={() => setOpen(false)} title="Notifications"
        footer={unread > 0 ? <Button variant="secondary" block icon={<CheckCheck className="h-4 w-4" />} onClick={() => void markAll()}>Mark all as read</Button> : undefined}>
        {(q.data ?? []).length === 0 ? (
          <EmptyState title="No notifications yet" body="Low stock, issues from the cleaners, new requests and the 4 PM report will appear here." />
        ) : (
          <div className="-mx-2 divide-y divide-line">
            {(q.data ?? []).map((n) => (
              <button key={n.id} className={cx('flex w-full gap-3 rounded-xl px-2 py-3 text-start hover:bg-sunken', !n.read_at && 'bg-navy-50/60')}
                onClick={async () => {
                  if (!n.read_at) { await supabase.from('rh_notifications').update({ read_at: new Date().toISOString() }).eq('id', n.id); void qc.invalidateQueries({ queryKey: ['notifications'] }); }
                  setOpen(false);
                  if (n.link) nav(n.link);
                }}>
                <span className="mt-0.5 text-xl">{KIND_ICON[n.kind] ?? '🔔'}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-2">
                    <span className={cx('text-[15px] leading-snug', !n.read_at ? 'font-semibold' : 'font-medium')}>{n.title}</span>
                    {!n.read_at && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-red" />}
                  </span>
                  {n.body && <span className="mt-0.5 block text-sm text-muted">{n.body}</span>}
                  <span className="mt-1 block text-xs text-muted">{ago(n.created_at)}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </Sheet>
    </>
  );
}

/** Page header: sticky on mobile with the RH mark, title, live state and bell. */
export function PageTop({ title, sub, actions, back }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode; back?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur lg:static lg:border-0 lg:bg-transparent lg:backdrop-blur-0">
      <div className="h-safe-top lg:hidden" />
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 lg:px-8 lg:pb-2 lg:pt-6">
        {back ?? <Mark className="h-7 w-7 lg:hidden" />}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold leading-tight lg:text-2xl">{title}</h1>
          {sub && <p className="truncate text-[13px] text-muted lg:text-sm">{sub}</p>}
        </div>
        <div className="flex items-center gap-1.5">
          {actions}
          <LiveDot className="hidden sm:inline-flex" />
          <NotificationsBell />
        </div>
      </div>
    </header>
  );
}

export function PageBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('mx-auto max-w-6xl px-4 pb-8 pt-4 lg:px-8', className)}>{children}</div>;
}

export function useSearchText<T>(list: T[], text: string, fields: (x: T) => (string | null | undefined)[]) {
  return useMemo(() => {
    const n = text.trim().toLowerCase();
    if (!n) return list;
    return list.filter((x) => fields(x).some((f) => (f ?? '').toLowerCase().includes(n)));
  }, [list, text]); // eslint-disable-line react-hooks/exhaustive-deps
}

export function KV({ k, v }: { k: ReactNode; v: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <dt className="text-sm text-muted">{k}</dt>
      <dd className="text-end text-[15px] font-medium">{v || '–'}</dd>
    </div>
  );
}

/** Opens WhatsApp with prefilled text (works on phone and desktop) */
export function whatsappUrl(text: string, phone?: string | null) {
  const p = phone ? phone.replace(/[^\d]/g, '') : '';
  return `https://wa.me/${p}?text=${encodeURIComponent(text)}`;
}
export async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy'); ta.remove(); return ok;
  }
}

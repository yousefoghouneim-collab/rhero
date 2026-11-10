import { useMemo, useState } from 'react';
import { CheckCircle2, Info, Search } from 'lucide-react';
import { useMe } from '../auth/AuthProvider';
import { Bi, useI18n } from '../i18n';
import { useCounts, useItems } from '../lib/data';
import { enqueue, pendingCounts, useQueueView } from '../lib/outbox';
import { clock, useOrgNow } from '../lib/time';
import { fmtQty, itemStatus } from '../lib/stock';
import type { Item, Section } from '../lib/types';
import { toast } from '../lib/toast';
import { Button, Input, ProgressBar, Skeleton, Stepper, cx, statusBar } from './ui';

type V = { o: number; s: number };

export function StockCountView({ section, title, hideTitle, bottomClass = 'bottom-[calc(68px+env(safe-area-inset-bottom))]' }: { section: Section; title: string; hideTitle?: boolean; bottomClass?: string }) {
  const { org } = useMe();
  const { t, ts, tb, second, dir2 } = useI18n();
  const now = useOrgNow(org.timezone);
  const itemsQ = useItems();
  const countsQ = useCounts(now.date);
  const { view } = useQueueView();
  const [edits, setEdits] = useState<Record<string, V>>({});
  const [q, setQ] = useState('');
  const [saving, setSaving] = useState(false);

  const items = useMemo(() => (itemsQ.data ?? []).filter((i) => i.section === section && i.active), [itemsQ.data, section]);
  const today = useMemo(() => new Map((countsQ.data ?? []).map((c) => [c.item_id, c])), [countsQ.data]);
  const pend = useMemo(() => pendingCounts(view, now.date), [view, now.date]);

  const base = (i: Item): V => {
    const p = pend.get(i.id);
    if (p) return { o: p.qty_opened, s: p.qty_store };
    const c = today.get(i.id);
    if (c) return { o: Number(c.qty_opened), s: Number(c.qty_store) };
    return { o: Number(i.qty_opened), s: Number(i.qty_store) };
  };
  const val = (i: Item) => edits[i.id] ?? base(i);
  const changedIds = items.filter((i) => { const e = edits[i.id]; if (!e) return false; const b = base(i); return e.o !== b.o || e.s !== b.s; }).map((i) => i.id);
  const countedToday = items.filter((i) => today.has(i.id) || pend.has(i.id)).length;
  const lastAt = (countsQ.data ?? []).filter((c) => items.some((i) => i.id === c.item_id)).reduce<string | null>((m, c) => (!m || c.counted_at > m ? c.counted_at : m), null);

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = needle ? items.filter((i) => i.name.toLowerCase().includes(needle) || (i.code ?? '').toLowerCase().includes(needle)) : items;
    const g: { cat: string; items: Item[] }[] = [];
    list.forEach((i) => { let x = g.find((y) => y.cat === i.category); if (!x) { x = { cat: i.category, items: [] }; g.push(x); } x.items.push(i); });
    return g;
  }, [items, q]);

  const set = (i: Item, patch: Partial<V>) => setEdits((e) => ({ ...e, [i.id]: { ...val(i), ...patch } }));

  const save = async () => {
    setSaving(true);
    enqueue({ kind: 'counts', day: now.date, at: new Date().toISOString(), rows: items.map((i) => { const v = val(i); return { item_id: i.id, qty_opened: i.track_opened ? v.o : 0, qty_store: v.s }; }) });
    setEdits({});
    toast(`${tb('saved')} ✓`);
    try { navigator.vibrate?.([20, 40, 20]); } catch { /* ignore */ }
    setSaving(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (itemsQ.isLoading) return <div className="space-y-3 p-4"><Skeleton className="h-24" /><Skeleton className="h-28" /><Skeleton className="h-28" /></div>;

  return (
    <div className="pb-28">
      <div className="space-y-3 px-4 pt-4">
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
          <div className="flex items-center justify-between gap-3">
            {hideTitle ? <span /> : <h2 className="text-lg font-semibold">{title}</h2>}
            {countedToday >= items.length && items.length > 0 ? (
              <span className="flex items-center gap-1 text-sm font-semibold text-ok"><CheckCircle2 className="h-4 w-4" />{t('statusDone')}</span>
            ) : null}
          </div>
          <p className="mt-0.5 text-[13px] text-muted">
            {lastAt ? t('countedAt', { time: clock(lastAt, org.timezone) }) : t('notCounted')} · {t('itemsCounted', { n: countedToday, total: items.length })}
          </p>
          {second && (
            <p className="text-[12.5px] text-muted/90" lang={second} dir={dir2}>
              {lastAt ? ts('countedAt', { time: clock(lastAt, org.timezone) }) : ts('notCounted')} · {ts('itemsCounted', { n: countedToday, total: items.length })}
            </p>
          )}
          <ProgressBar value={items.length ? countedToday / items.length : 0} className="mt-3" height="h-1.5" bar={countedToday >= items.length ? 'bg-ok' : 'bg-navy-700'} />
          {section === 'pantry' && (
            <p className="mt-3 flex gap-2 rounded-xl bg-navy-50 px-3 py-2.5 text-[13px] leading-snug text-navy-700"><Info className="mt-0.5 h-4 w-4 shrink-0" /><span><Bi k="stockHint" sub="mt-1.5 block opacity-80" /></span></p>
          )}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute start-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tb('search')} className="ps-11" type="search" />
        </div>
      </div>

      {groups.map((g) => (
        <section key={g.cat} className="mt-4">
          <h3 className="sticky top-0 z-10 bg-bg/95 px-5 py-2 text-[13px] font-semibold uppercase tracking-wider text-muted backdrop-blur">{g.cat}</h3>
          <div className="mx-4 overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
            {g.items.map((i, idx) => {
              const v = val(i);
              const b = base(i);
              const changed = changedIds.includes(i.id);
              const st = itemStatus({ qty_store: v.s, warn_qty: i.warn_qty, min_qty: i.min_qty, last_counted_at: 'x' });
              const done = today.has(i.id) || pend.has(i.id);
              return (
                <div key={i.id} className={cx('px-4 py-3.5', idx > 0 && 'border-t border-line', changed && 'bg-navy-50/50')}>
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 text-2xl leading-none">{i.emoji ?? '📦'}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-semibold">{i.name}</p>
                        <span className={cx('h-2.5 w-2.5 shrink-0 rounded-full', statusBar[st])} />
                        {done && !changed && <CheckCircle2 className="h-4 w-4 shrink-0 text-ok" />}
                      </div>
                      <p className="text-[12.5px] text-muted">
                        {[i.unit, i.pack_info].filter(Boolean).join(' · ')}
                        {i.track_opened ? ` — ${t('lastCount', { opened: fmtQty(b.o), store: fmtQty(b.s) })}` : ` — ${fmtQty(b.s)}`}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2.5 flex items-end justify-end gap-3">
                    {i.track_opened && <Stepper label={t('opened')} sub={ts('opened')} value={v.o} onChange={(n) => set(i, { o: n })} changed={changed && v.o !== b.o} />}
                    <Stepper label={i.track_opened ? t('inStore') : t('count')} sub={i.track_opened ? ts('inStore') : ts('count')} value={v.s} onChange={(n) => set(i, { s: n })} changed={changed && v.s !== b.s} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <div className={cx('fixed inset-x-0 z-30 px-4 pb-3 pt-2 no-print', bottomClass)}>
        <div className="mx-auto max-w-md">
          <Button size="xl" block loading={saving} onClick={save} variant={changedIds.length ? 'primary' : 'success'} className="shadow-lift">
            <span className="flex flex-col items-center leading-tight">
              <span>{changedIds.length ? `${t('saveCount')} · ${t('changedN', { n: changedIds.length })}` : t('confirmAll')}</span>
              {second && (
                <span className="text-[13px] font-medium opacity-80" lang={second} dir={dir2}>
                  {changedIds.length ? `${ts('saveCount')} · ${ts('changedN', { n: changedIds.length })}` : ts('confirmAll')}
                </span>
              )}
            </span>
          </Button>
        </div>
      </div>
    </div>
  );
}

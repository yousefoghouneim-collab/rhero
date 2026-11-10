import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck, Download, ExternalLink, FileSpreadsheet, PackagePlus, Pencil, Plus, Search, SlidersHorizontal } from 'lucide-react';
import { useMe } from '../../auth/AuthProvider';
import { useItemHistory, useItems, useStockMoves, useTeam } from '../../lib/data';
import { supabase, errMsg } from '../../lib/supabase';
import { toast } from '../../lib/toast';
import { ago, clock, prettyDate } from '../../lib/time';
import { available, fmtQty, itemStatus, money, needQty, STATUS_LABEL, STATUS_RANK, type StockStatus } from '../../lib/stock';
import type { Item, Section } from '../../lib/types';
import { Badge, Button, Card, Chips, EmptyState, Field, Input, Segmented, Select, Sheet, Skeleton, StatusPill, Toggle, cx, statusBar, statusText } from '../../components/ui';
import { PageBody, PageTop } from './common';

type Filter = 'all' | StockStatus;

export default function Inventory() {
  const items = useItems();
  const [section, setSection] = useState<Section>('pantry');
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Item | null>(null);
  const [edit, setEdit] = useState<Partial<Item> | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const all = useMemo(() => (items.data ?? []).filter((i) => i.active && i.section === section), [items.data, section]);
  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: all.length, red: 0, orange: 0, green: 0, none: 0 };
    all.forEach((i) => { c[itemStatus(i)]++; });
    return c;
  }, [all]);
  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return all.filter((i) => (filter === 'all' || itemStatus(i) === filter) && (!n || i.name.toLowerCase().includes(n) || (i.supplier ?? '').toLowerCase().includes(n) || (i.code ?? '').toLowerCase().includes(n)));
  }, [all, filter, q]);
  const groups = useMemo(() => {
    const g: { cat: string; items: Item[] }[] = [];
    [...shown].sort((a, b) => (filter === 'all' ? a.sort - b.sort : STATUS_RANK[itemStatus(a)] - STATUS_RANK[itemStatus(b)])).forEach((i) => {
      let x = g.find((y) => y.cat === i.category); if (!x) { x = { cat: i.category, items: [] }; g.push(x); } x.items.push(i);
    });
    return g;
  }, [shown, filter]);
  const lastCount = all.reduce<string | null>((m, i) => (i.last_counted_at && (!m || i.last_counted_at > m) ? i.last_counted_at : m), null);
  const stockValue = all.reduce((s, i) => s + available(i) * (i.unit_price ?? 0), 0);

  const exportCsv = () => {
    const head = ['Code', 'Item', 'Section', 'Category', 'Unit', 'Pack', 'Opened', 'In store', 'Available', 'Min (red)', 'Low (orange)', 'Target', 'Need to order', 'Status', 'Supplier', 'Unit price AED', 'Last counted'];
    const rows = (items.data ?? []).filter((i) => i.active).map((i) => [i.code, i.name, i.section, i.category, i.unit, i.pack_info, i.qty_opened, i.qty_store, available(i), i.min_qty, i.warn_qty, i.par_qty, needQty(i), STATUS_LABEL[itemStatus(i)], i.supplier, i.unit_price, i.last_counted_at]);
    const csv = [head, ...rows].map((r) => r.map((c) => { const s = c === null || c === undefined ? '' : String(c); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `RHero-inventory-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div>
      <PageTop title="Inventory" sub={lastCount ? `Last count ${ago(lastCount)}` : 'Not counted yet'}
        actions={<Button size="sm" variant="soft" className="hidden sm:inline-flex" icon={<Download className="h-4 w-4" />} onClick={exportCsv}>Export</Button>} />
      <PageBody>
        <Segmented<Section> value={section} onChange={(s) => { setSection(s); setFilter('all'); }}
          options={[{ value: 'pantry', label: 'Pantry & cleaning' }, { value: 'stationery', label: 'Stationery' }]} />

        <div className="mt-4 grid grid-cols-3 gap-3">
          {(['red', 'orange', 'green'] as const).map((s) => (
            <button key={s} onClick={() => setFilter(filter === s ? 'all' : s)} className={cx('rounded-2xl border bg-surface p-3 text-start shadow-card transition', filter === s ? 'border-navy-700 ring-2 ring-navy-100' : 'border-line')}>
              <div className="flex items-center gap-2"><span className={cx('h-2.5 w-2.5 rounded-full', statusBar[s])} /><span className="text-[12px] font-semibold uppercase tracking-wide text-muted">{STATUS_LABEL[s]}</span></div>
              <p className={cx('mt-1 text-2xl font-semibold tnum', statusText[s])}>{counts[s]}</p>
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute start-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search items or suppliers" className="ps-11" type="search" />
          </div>
          <div className="flex gap-2">
            <Link to={`/m/count/${section}`} className="flex-1 sm:flex-none"><Button block icon={<ClipboardCheck className="h-4 w-4" />}>Count now</Button></Link>
            <Button variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={() => setEdit({ section, category: section === 'pantry' ? 'Kitchen & Pantry' : 'Desk Supplies', unit: 'piece', track_opened: section === 'pantry', par_qty: 5, warn_qty: 2, min_qty: 1, active: true, emoji: '📦' })}>Item</Button>
            <Button variant="secondary" icon={<FileSpreadsheet className="h-4 w-4" />} onClick={() => setImportOpen(true)} className="hidden sm:inline-flex">Import</Button>
          </div>
        </div>
        <div className="mt-3">
          <Chips<Filter> value={filter} onChange={setFilter} options={[
            { value: 'all', label: 'All', count: counts.all },
            { value: 'red', label: 'Order now', count: counts.red, tone: 'bg-bad' },
            { value: 'orange', label: 'Running low', count: counts.orange, tone: 'bg-warn' },
            { value: 'green', label: 'In stock', count: counts.green, tone: 'bg-ok' },
            { value: 'none', label: 'Not counted', count: counts.none, tone: 'bg-line' },
          ]} />
        </div>

        {items.isLoading ? <Skeleton className="mt-4 h-72" /> : groups.length === 0 ? (
          <div className="mt-4"><EmptyState title="Nothing here" body="Try another filter or search." /></div>
        ) : groups.map((g) => (
          <section key={g.cat} className="mt-5">
            <h3 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wider text-muted">{g.cat} <span className="font-normal">· {g.items.length}</span></h3>
            <Card className="divide-y divide-line overflow-hidden">
              {g.items.map((i) => {
                const st = itemStatus(i);
                return (
                  <button key={i.id} onClick={() => setSel(i)} className="relative flex w-full items-center gap-3 px-3.5 py-3 text-start hover:bg-sunken/60">
                    <span className={cx('absolute inset-y-0 start-0 w-1', statusBar[st])} />
                    <span className="ms-1 text-2xl">{i.emoji ?? '📦'}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{i.name}</p>
                      <p className="truncate text-[12.5px] text-muted">{[i.unit, i.pack_info].filter(Boolean).join(' · ')}{i.supplier ? ` · ${i.supplier}` : ''}</p>
                    </div>
                    <div className="hidden text-end sm:block">
                      <p className="text-[11px] font-semibold uppercase text-muted">Opened · Store</p>
                      <p className="font-semibold tnum">{i.track_opened ? fmtQty(i.qty_opened) : '–'} · <span className={statusText[st]}>{fmtQty(i.qty_store)}</span></p>
                    </div>
                    <div className="w-[104px] text-end">
                      <StatusPill status={st} />
                      <p className="mt-1 text-[12px] text-muted sm:hidden tnum">{i.track_opened ? `${fmtQty(i.qty_opened)} open · ` : ''}{fmtQty(i.qty_store)} store</p>
                      {(st === 'red' || st === 'orange') && <p className="mt-1 hidden text-[12px] text-muted sm:block">need {fmtQty(needQty(i))}</p>}
                    </div>
                  </button>
                );
              })}
            </Card>
          </section>
        ))}

        <p className="mt-6 text-center text-[13px] text-muted">
          Status uses sealed stock in store: red ≤ minimum, orange ≤ low level. Estimated stock value {money(stockValue)}.
          <button className="ms-2 font-semibold text-navy-600 sm:hidden" onClick={exportCsv}>Export CSV</button>
        </p>
      </PageBody>

      {sel && <ItemSheet item={(items.data ?? []).find((x) => x.id === sel.id) ?? sel} onClose={() => setSel(null)} onEdit={(i) => { setSel(null); setEdit(i); }} />}
      {edit && <ItemEditor value={edit} onClose={() => setEdit(null)} />}
      {importOpen && <ImportSheet section={section} onClose={() => setImportOpen(false)} />}
    </div>
  );
}

export function ItemSheet({ item, onClose, onEdit }: { item: Item; onClose: () => void; onEdit: (i: Item) => void }) {
  const { org } = useMe();
  const qc = useQueryClient();
  const hist = useItemHistory(item.id, 30);
  const moves = useStockMoves(item.id);
  const team = useTeam();
  const [mode, setMode] = useState<null | 'receive' | 'adjust'>(null);
  const [qty, setQty] = useState('');
  const [busy, setBusy] = useState(false);
  const st = itemStatus(item);
  const rows = (hist.data ?? []).slice().reverse();
  const used = rows.filter((r) => r.used !== null);
  const avgDaily = used.length ? used.reduce((s, r) => s + Math.max(Number(r.used), 0), 0) / used.length : null;
  const daysLeft = avgDaily && avgDaily > 0 ? available(item) / avgDaily : null;
  const maxTotal = Math.max(item.par_qty, ...rows.map((r) => Number(r.qty_opened) + Number(r.qty_store)), 1);
  const who = (team.data ?? []).find((p) => p.id === item.last_counted_by)?.full_name;

  const submit = async () => {
    const n = Number(qty);
    if (!Number.isFinite(n) || (mode === 'receive' && n <= 0) || (mode === 'adjust' && n < 0)) return toast('Enter a valid quantity', 'bad');
    setBusy(true);
    const delta = mode === 'receive' ? n : n - item.qty_store;
    const { error } = await supabase.from('rh_stock_moves').insert({ item_id: item.id, kind: mode === 'receive' ? 'receive' : 'adjust', qty: delta, note: mode === 'receive' ? 'Delivery received' : `Stock corrected to ${n}` });
    setBusy(false);
    if (error) return toast(errMsg(error), 'bad');
    toast(mode === 'receive' ? `+${n} ${item.unit} added` : 'Stock corrected');
    setMode(null); setQty('');
    void qc.invalidateQueries({ queryKey: ['items'] });
    void qc.invalidateQueries({ queryKey: ['moves'] });
  };

  return (
    <Sheet open onClose={onClose} wide title={<span className="flex items-center gap-2"><span className="text-2xl">{item.emoji ?? '📦'}</span>{item.name}</span>}
      footer={mode ? (
        <div className="flex gap-2">
          <Input autoFocus inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} placeholder={mode === 'receive' ? `How many ${item.unit} arrived?` : `Exact ${item.unit} in store now`} />
          <Button loading={busy} onClick={() => void submit()}>Save</Button>
          <Button variant="ghost" onClick={() => setMode(null)}>Cancel</Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button icon={<PackagePlus className="h-4 w-4" />} onClick={() => setMode('receive')}>Delivery received</Button>
          <Button variant="secondary" icon={<SlidersHorizontal className="h-4 w-4" />} onClick={() => { setMode('adjust'); setQty(String(item.qty_store)); }}>Correct stock</Button>
          <Button variant="ghost" icon={<Pencil className="h-4 w-4" />} onClick={() => onEdit(item)}>Edit item</Button>
        </div>
      )}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={st} />
          <span className="text-sm text-muted">{[item.unit, item.pack_info].filter(Boolean).join(' · ')} · {item.category}{item.code ? ` · ${item.code}` : ''}</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card className="p-3"><p className="text-[12px] font-semibold uppercase text-muted">In store</p><p className={cx('text-2xl font-semibold tnum', statusText[st])}>{fmtQty(item.qty_store)}</p></Card>
          <Card className="p-3"><p className="text-[12px] font-semibold uppercase text-muted">Opened</p><p className="text-2xl font-semibold tnum">{item.track_opened ? fmtQty(item.qty_opened) : '–'}</p></Card>
          <Card className="p-3"><p className="text-[12px] font-semibold uppercase text-muted">Target</p><p className="text-2xl font-semibold tnum">{fmtQty(item.par_qty)}</p><p className="text-[12px] text-muted">orange ≤{fmtQty(item.warn_qty)} · red ≤{fmtQty(item.min_qty)}</p></Card>
          <Card className="p-3"><p className="text-[12px] font-semibold uppercase text-muted">Need to order</p><p className="text-2xl font-semibold tnum">{fmtQty(needQty(item))}</p>{item.unit_price ? <p className="text-[12px] text-muted">≈ {money(needQty(item) * item.unit_price)}</p> : null}</Card>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-sunken p-3"><p className="text-[12px] font-semibold uppercase text-muted">Avg use / day</p><p className="text-lg font-semibold tnum">{avgDaily === null ? '–' : fmtQty(Math.round(avgDaily * 10) / 10)} <span className="text-sm font-normal text-muted">{item.unit}</span></p></div>
          <div className="rounded-2xl bg-sunken p-3"><p className="text-[12px] font-semibold uppercase text-muted">Lasts about</p><p className={cx('text-lg font-semibold tnum', daysLeft !== null && daysLeft < 5 && 'text-bad')}>{daysLeft === null ? '–' : `${Math.max(0, Math.floor(daysLeft))} days`}</p></div>
          <div className="rounded-2xl bg-sunken p-3"><p className="text-[12px] font-semibold uppercase text-muted">Last counted</p><p className="text-lg font-semibold">{item.last_counted_at ? ago(item.last_counted_at) : 'never'}</p>{who && <p className="text-[12px] text-muted">by {who}</p>}</div>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold">Stock level — last {rows.length} counts</p>
          {rows.length === 0 ? <p className="text-sm text-muted">No counts yet.</p> : (
            <div className="rounded-2xl border border-line p-3">
              <div className="relative flex h-32 items-end gap-1">
                <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-warn/60" style={{ bottom: `${(item.warn_qty / maxTotal) * 100}%` }} />
                <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-bad/60" style={{ bottom: `${(item.min_qty / maxTotal) * 100}%` }} />
                {rows.map((r) => {
                  const s = itemStatus({ qty_store: Number(r.qty_store), warn_qty: item.warn_qty, min_qty: item.min_qty, last_counted_at: r.counted_at });
                  const tot = Number(r.qty_opened) + Number(r.qty_store);
                  return (
                    <div key={r.id} className="group relative flex flex-1 flex-col justify-end" title={`${prettyDate(r.day)} · ${fmtQty(r.qty_store)} store + ${fmtQty(r.qty_opened)} open${r.used !== null ? ` · used ${fmtQty(r.used)}` : ''}`}>
                      <div className={cx('w-full rounded-t-md opacity-90', statusBar[s])} style={{ height: `${Math.max((tot / maxTotal) * 100, 2)}%` }} />
                    </div>
                  );
                })}
              </div>
              <div className="mt-1.5 flex justify-between text-[11px] text-muted"><span>{prettyDate(rows[0].day, { day: 'numeric', month: 'short' })}</span><span>{prettyDate(rows[rows.length - 1].day, { day: 'numeric', month: 'short' })}</span></div>
            </div>
          )}
        </div>

        {(item.supplier || item.supplier_url || item.unit_price) && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line p-3">
            <div><p className="text-[12px] font-semibold uppercase text-muted">Supplier</p><p className="font-semibold">{item.supplier ?? '–'}{item.unit_price ? <span className="font-normal text-muted"> · {money(item.unit_price)} / {item.unit}</span> : null}</p></div>
            {item.supplier_url && <a href={item.supplier_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm font-semibold text-navy-600">View product <ExternalLink className="h-4 w-4" /></a>}
          </div>
        )}

        {(moves.data ?? []).length > 0 && (
          <div>
            <p className="mb-2 text-sm font-semibold">Deliveries & corrections</p>
            <div className="divide-y divide-line rounded-2xl border border-line">
              {(moves.data ?? []).slice(0, 8).map((m) => (
                <div key={m.id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span>{m.note ?? m.kind}</span>
                  <span className="flex items-center gap-3"><span className={cx('font-semibold tnum', Number(m.qty) >= 0 ? 'text-ok' : 'text-bad')}>{Number(m.qty) >= 0 ? '+' : ''}{fmtQty(m.qty)}</span><span className="text-muted">{prettyDate(m.created_at.slice(0, 10), { day: 'numeric', month: 'short' })} {clock(m.created_at, org.timezone)}</span></span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
}

const PANTRY_CATS = ['Cleaning & Washroom', 'Kitchen & Pantry', 'Snacks & Hospitality'];
const STAT_CATS = ['Paper & Notebooks', 'Writing', 'Filing', 'Desk Supplies', 'Printer & IT'];

export function ItemEditor({ value, onClose }: { value: Partial<Item>; onClose: () => void }) {
  const { org } = useMe();
  const qc = useQueryClient();
  const [v, setV] = useState<Partial<Item>>(value);
  const [busy, setBusy] = useState(false);
  const num = (k: keyof Item) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value === '' ? null : Number(e.target.value) });
  const save = async () => {
    if (!v.name?.trim()) return toast('Item name is required', 'bad');
    if ((v.min_qty ?? 0) > (v.warn_qty ?? 0)) return toast('Red level must be lower than the orange level', 'bad');
    setBusy(true);
    const row = {
      name: v.name.trim(), emoji: v.emoji || '📦', code: v.code || null, section: v.section ?? 'pantry', category: v.category || 'Other', unit: v.unit || 'piece',
      pack_info: v.pack_info || null, track_opened: !!v.track_opened, par_qty: v.par_qty ?? 0, warn_qty: v.warn_qty ?? 0, min_qty: v.min_qty ?? 0,
      monthly_usage: v.monthly_usage ?? null, supplier: v.supplier || null, supplier_url: v.supplier_url || null, unit_price: v.unit_price ?? null, active: v.active ?? true,
    };
    const { error } = v.id ? await supabase.from('rh_items').update(row).eq('id', v.id) : await supabase.from('rh_items').insert({ ...row, org_id: org.id, sort: 999 });
    setBusy(false);
    if (error) return toast(errMsg(error), 'bad');
    void qc.invalidateQueries({ queryKey: ['items'] });
    toast('Item saved');
    onClose();
  };
  const cats = v.section === 'stationery' ? STAT_CATS : PANTRY_CATS;
  return (
    <Sheet open onClose={onClose} wide title={v.id ? 'Edit item' : 'New item'} footer={<Button block loading={busy} onClick={() => void save()}>Save item</Button>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid grid-cols-[72px_1fr] gap-3 sm:col-span-2">
          <Field label="Icon"><Input value={v.emoji ?? ''} onChange={(e) => setV({ ...v, emoji: e.target.value })} className="text-center text-xl" maxLength={4} /></Field>
          <Field label="Item name"><Input value={v.name ?? ''} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="e.g. Nescafé Gold" /></Field>
        </div>
        <Field label="List"><Select value={v.section} onChange={(e) => setV({ ...v, section: e.target.value as Section })}><option value="pantry">Pantry & cleaning (cleaners count daily)</option><option value="stationery">Stationery (you count)</option></Select></Field>
        <Field label="Category">
          <Input list="rh-cats" value={v.category ?? ''} onChange={(e) => setV({ ...v, category: e.target.value })} />
          <datalist id="rh-cats">{cats.map((c) => <option key={c} value={c} />)}</datalist>
        </Field>
        <Field label="Counted in" hint="e.g. box, pack, bottle"><Input value={v.unit ?? ''} onChange={(e) => setV({ ...v, unit: e.target.value })} /></Field>
        <Field label="Pack size" hint="optional"><Input value={v.pack_info ?? ''} onChange={(e) => setV({ ...v, pack_info: e.target.value })} placeholder="e.g. 200 g jar" /></Field>
        <div className="grid grid-cols-3 gap-3 sm:col-span-2">
          <Field label="Target"><Input inputMode="decimal" value={v.par_qty ?? ''} onChange={num('par_qty')} /></Field>
          <Field label="Orange at"><Input inputMode="decimal" value={v.warn_qty ?? ''} onChange={num('warn_qty')} /></Field>
          <Field label="Red at"><Input inputMode="decimal" value={v.min_qty ?? ''} onChange={num('min_qty')} /></Field>
        </div>
        <p className="-mt-2 text-[13px] text-muted sm:col-span-2">Target = how much you want after a delivery. Orange / red = sealed packs left in store when it should warn you.</p>
        <Field label="Monthly use" hint="optional"><Input inputMode="decimal" value={v.monthly_usage ?? ''} onChange={num('monthly_usage')} /></Field>
        <Field label="Unit price (AED)" hint="optional"><Input inputMode="decimal" value={v.unit_price ?? ''} onChange={num('unit_price')} /></Field>
        <Field label="Supplier"><Input value={v.supplier ?? ''} onChange={(e) => setV({ ...v, supplier: e.target.value })} /></Field>
        <Field label="Product link"><Input value={v.supplier_url ?? ''} onChange={(e) => setV({ ...v, supplier_url: e.target.value })} placeholder="https://" /></Field>
        <Field label="Code" hint="optional"><Input value={v.code ?? ''} onChange={(e) => setV({ ...v, code: e.target.value })} /></Field>
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-xl bg-sunken p-3"><span className="text-sm font-medium">Count opened packs separately</span><Toggle checked={!!v.track_opened} onChange={(x) => setV({ ...v, track_opened: x })} /></div>
          <div className="flex items-center justify-between rounded-xl bg-sunken p-3"><span className="text-sm font-medium">Active</span><Toggle checked={v.active ?? true} onChange={(x) => setV({ ...v, active: x })} /></div>
        </div>
      </div>
    </Sheet>
  );
}

// --------------------------------------------------------------- Excel import
type Parsed = { name: string; category?: string; unit?: string; qty?: number; min?: number; par?: number; price?: number; supplier?: string };
function detect(header: string[]): Record<string, number> {
  const find = (re: RegExp) => header.findIndex((h) => re.test(h));
  return {
    name: find(/^(item|items|description|product|name|item name|item description)/i),
    category: find(/categor|group|type/i),
    unit: find(/^(unit|uom|units)/i),
    qty: find(/order\s*qty|qty|quantity|monthly/i),
    min: find(/^min|reorder/i),
    par: find(/^par|^max|target/i),
    price: find(/price|cost|rate/i),
    supplier: find(/supplier|vendor/i),
  };
}
function ImportSheet({ section, onClose }: { section: Section; onClose: () => void }) {
  const { org } = useMe();
  const items = useItems();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Parsed[]>([]);
  const [target, setTarget] = useState<Section>(section);
  const [busy, setBusy] = useState(false);
  const existing = new Set((items.data ?? []).map((i) => i.name.trim().toLowerCase()));
  const fresh = rows.filter((r) => !existing.has(r.name.trim().toLowerCase()));

  const onFile = async (f?: File) => {
    if (!f) return;
    try {
      let table: (string | number | null)[][] = [];
      if (/\.csv$/i.test(f.name)) {
        table = (await f.text()).split(/\r?\n/).map((l) => l.split(',').map((c) => c.replace(/^"|"$/g, '')));
      } else {
        const { default: readXlsxFile } = await import('read-excel-file');
        table = (await readXlsxFile(f)) as unknown as (string | number | null)[][];
      }
      const hi = table.findIndex((r) => r.some((c) => /^(item|items|description|product|name)/i.test(String(c ?? '').trim())));
      if (hi < 0) return toast('Could not find a header row with an "Item" column', 'bad');
      const header = table[hi].map((c) => String(c ?? '').trim());
      const m = detect(header);
      const n = (v: unknown) => { const x = Number(String(v ?? '').replace(/[^\d.]/g, '')); return Number.isFinite(x) && String(v ?? '').trim() !== '' ? x : undefined; };
      const parsed: Parsed[] = table.slice(hi + 1).map((r) => ({
        name: String(r[m.name] ?? '').trim(),
        category: m.category >= 0 ? String(r[m.category] ?? '').trim() || undefined : undefined,
        unit: m.unit >= 0 ? String(r[m.unit] ?? '').trim() || undefined : undefined,
        qty: m.qty >= 0 ? n(r[m.qty]) : undefined,
        min: m.min >= 0 ? n(r[m.min]) : undefined,
        par: m.par >= 0 ? n(r[m.par]) : undefined,
        price: m.price >= 0 ? n(r[m.price]) : undefined,
        supplier: m.supplier >= 0 ? String(r[m.supplier] ?? '').trim() || undefined : undefined,
      })).filter((r) => r.name && !/^total/i.test(r.name));
      setRows(parsed);
      if (!parsed.length) toast('No item rows found', 'bad');
    } catch (e) {
      toast(`Could not read the file: ${errMsg(e)}`, 'bad');
    }
  };
  const run = async () => {
    setBusy(true);
    const payload = fresh.map((r) => {
      const par = r.par ?? r.qty ?? 5;
      return {
        org_id: org.id, section: target, name: r.name, category: r.category || (target === 'pantry' ? 'Kitchen & Pantry' : 'Desk Supplies'), unit: r.unit || 'piece',
        par_qty: par, warn_qty: Math.max(Math.round(par * 0.35), r.min ?? 0), min_qty: r.min ?? Math.max(Math.round(par * 0.15), 0), monthly_usage: r.qty ?? null,
        unit_price: r.price ?? null, supplier: r.supplier ?? null, track_opened: target === 'pantry', emoji: target === 'pantry' ? '🧴' : '🗂️', sort: 900,
      };
    });
    const { error } = await supabase.from('rh_items').insert(payload);
    setBusy(false);
    if (error) return toast(errMsg(error), 'bad');
    toast(`${payload.length} items imported`);
    void qc.invalidateQueries({ queryKey: ['items'] });
    onClose();
  };
  return (
    <Sheet open onClose={onClose} wide title="Import items from Excel"
      footer={rows.length ? <Button block loading={busy} disabled={!fresh.length} onClick={() => void run()}>Import {fresh.length} new items</Button> : undefined}>
      <div className="space-y-4">
        <p className="text-sm text-muted">Upload your inventory sheet (.xlsx or .csv). RHero finds the columns automatically: item / description, category, unit, quantity (used as monthly target), min, price and supplier. Items that already exist are skipped.</p>
        <input ref={fileRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" icon={<FileSpreadsheet className="h-4 w-4" />} onClick={() => fileRef.current?.click()}>Choose file</Button>
          <Segmented<Section> value={target} onChange={setTarget} size="sm" options={[{ value: 'pantry', label: 'Pantry & cleaning' }, { value: 'stationery', label: 'Stationery' }]} />
        </div>
        {rows.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-line">
            <div className="max-h-72 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-sunken text-start text-[12px] uppercase text-muted"><tr><th className="p-2 text-start">Item</th><th className="p-2 text-start">Category</th><th className="p-2">Qty</th><th className="p-2">Unit</th><th className="p-2"></th></tr></thead>
                <tbody>
                  {rows.slice(0, 200).map((r, i) => (
                    <tr key={i} className="border-t border-line"><td className="p-2">{r.name}</td><td className="p-2 text-muted">{r.category ?? '–'}</td><td className="p-2 text-center tnum">{r.qty ?? r.par ?? '–'}</td><td className="p-2 text-center">{r.unit ?? '–'}</td>
                      <td className="p-2 text-end">{existing.has(r.name.trim().toLowerCase()) ? <Badge>exists</Badge> : <Badge tone="ok">new</Badge>}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
}

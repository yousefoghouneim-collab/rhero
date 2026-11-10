import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Copy, Mail, MessageCircle, PackageCheck, Plus, Printer, Send, ShoppingCart, Trash2, Truck, XCircle } from 'lucide-react';
import { useMe } from '../../auth/AuthProvider';
import { useItems, useOrders } from '../../lib/data';
import { supabase, errMsg } from '../../lib/supabase';
import { toast } from '../../lib/toast';
import { prettyDate } from '../../lib/time';
import { available, fmtQty, itemStatus, money, needQty, STATUS_RANK } from '../../lib/stock';
import type { Item, Order, OrderStatus } from '../../lib/types';
import { Badge, Button, Card, Chips, EmptyState, Field, Input, Segmented, Select, Sheet, Skeleton, StatusPill, Textarea, cx, statusText, useConfirm } from '../../components/ui';
import { copyText, PageBody, PageTop, whatsappUrl } from './common';

type Tab = 'need' | 'orders';
const STATUS_TONE: Record<OrderStatus, 'neutral' | 'navy' | 'warn' | 'ok' | 'bad'> = { draft: 'neutral', ordered: 'navy', partial: 'warn', received: 'ok', cancelled: 'bad' };
const STATUS_TXT: Record<OrderStatus, string> = { draft: 'Draft', ordered: 'Ordered', partial: 'Part received', received: 'Received', cancelled: 'Cancelled' };

export default function Supply() {
  const [tab, setTab] = useState<Tab>('need');
  const [openOrder, setOpenOrder] = useState<string | null>(null);
  const orders = useOrders();
  const openCount = (orders.data ?? []).filter((o) => ['draft', 'ordered', 'partial'].includes(o.status)).length;
  return (
    <div>
      <PageTop title="To supply" sub="What to order, and orders on the way" />
      <PageBody>
        <Segmented<Tab> value={tab} onChange={setTab} options={[{ value: 'need', label: 'Items to supply' }, { value: 'orders', label: 'Orders', count: openCount || undefined }]} />
        <div className="mt-4">
          {tab === 'need' ? <NeedTab onCreated={(id) => { setTab('orders'); setOpenOrder(id); }} /> : <OrdersTab onOpen={setOpenOrder} />}
        </div>
      </PageBody>
      {openOrder && <OrderSheet id={openOrder} onClose={() => setOpenOrder(null)} />}
    </div>
  );
}

function NeedTab({ onCreated }: { onCreated: (id: string) => void }) {
  const { org } = useMe();
  const qc = useQueryClient();
  const items = useItems();
  const orders = useOrders();
  const [scope, setScope] = useState<'all' | 'pantry' | 'stationery'>('all');
  const [sel, setSel] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);

  const onOrder = useMemo(() => {
    const m = new Map<string, Order>();
    (orders.data ?? []).filter((o) => ['draft', 'ordered', 'partial'].includes(o.status)).forEach((o) => o.lines?.forEach((l) => { if (l.item_id && l.received_qty < l.qty) m.set(l.item_id, o); }));
    return m;
  }, [orders.data]);
  const list = useMemo(() => (items.data ?? [])
    .filter((i) => i.active && (scope === 'all' || i.section === scope) && ['red', 'orange'].includes(itemStatus(i)))
    .sort((a, b) => STATUS_RANK[itemStatus(a)] - STATUS_RANK[itemStatus(b)] || a.section.localeCompare(b.section) || a.sort - b.sort), [items.data, scope]);
  const chosen = list.filter((i) => sel[i.id] !== undefined);
  const est = chosen.reduce((s, i) => s + (sel[i.id] ?? 0) * (i.unit_price ?? 0), 0);
  const allNeedCost = list.reduce((s, i) => s + needQty(i) * (i.unit_price ?? 0), 0);
  const toggle = (i: Item) => setSel((s) => { const n = { ...s }; if (n[i.id] !== undefined) delete n[i.id]; else n[i.id] = Math.max(needQty(i), 1); return n; });
  const selectWhere = (f: (i: Item) => boolean) => setSel(Object.fromEntries(list.filter((i) => f(i) && !onOrder.has(i.id)).map((i) => [i.id, Math.max(needQty(i), 1)])));

  const create = async () => {
    if (!chosen.length) return;
    setBusy(true);
    try {
      const groups = new Map<string, Item[]>();
      chosen.forEach((i) => { const k = i.supplier || 'Supplier to confirm'; groups.set(k, [...(groups.get(k) ?? []), i]); });
      let firstId = '';
      for (const [supplier, its] of groups) {
        const { data, error } = await supabase.from('rh_orders').insert({ org_id: org.id, supplier, status: 'draft', notes: 'Created from the To-supply list' }).select('id').single();
        if (error) throw error;
        firstId ||= data.id;
        const { error: le } = await supabase.from('rh_order_lines').insert(its.map((i) => ({ order_id: data.id, item_id: i.id, name: i.name + (i.pack_info ? ` (${i.pack_info})` : ''), unit: i.unit, qty: sel[i.id], unit_price: i.unit_price })));
        if (le) throw le;
      }
      toast(groups.size > 1 ? `${groups.size} draft orders created (one per supplier)` : 'Draft order created');
      setSel({});
      await qc.invalidateQueries({ queryKey: ['orders'] });
      onCreated(firstId);
    } catch (e) {
      toast(errMsg(e), 'bad');
    } finally {
      setBusy(false);
    }
  };

  if (items.isLoading) return <Skeleton className="h-72" />;
  return (
    <div className="pb-24">
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3"><p className="text-[12px] font-semibold uppercase text-muted">Order now</p><p className="text-2xl font-semibold text-bad tnum">{list.filter((i) => itemStatus(i) === 'red').length}</p></Card>
        <Card className="p-3"><p className="text-[12px] font-semibold uppercase text-muted">Running low</p><p className="text-2xl font-semibold text-warn tnum">{list.filter((i) => itemStatus(i) === 'orange').length}</p></Card>
        <Card className="p-3"><p className="text-[12px] font-semibold uppercase text-muted">Est. to refill</p><p className="text-lg font-semibold tnum">{money(allNeedCost)}</p></Card>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Chips value={scope} onChange={setScope} className="mx-0 px-0" options={[{ value: 'all', label: 'All' }, { value: 'pantry', label: 'Pantry & cleaning' }, { value: 'stationery', label: 'Stationery' }]} />
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" variant="soft" onClick={() => selectWhere((i) => itemStatus(i) === 'red')}>Select all red</Button>
        <Button size="sm" variant="soft" onClick={() => selectWhere(() => true)}>Select all</Button>
        {chosen.length > 0 && <Button size="sm" variant="ghost" onClick={() => setSel({})}>Clear</Button>}
      </div>

      {list.length === 0 ? (
        <div className="mt-4"><EmptyState icon={<CheckCircle2 className="h-8 w-8" />} title="Nothing to order" body="All counted items are above their low level. Items appear here automatically when the count drops." /></div>
      ) : (
        <Card className="mt-3 divide-y divide-line overflow-hidden">
          {list.map((i) => {
            const st = itemStatus(i);
            const ord = onOrder.get(i.id);
            const on = sel[i.id] !== undefined;
            return (
              <div key={i.id} className={cx('flex items-center gap-3 px-3.5 py-3', on && 'bg-navy-50/60')}>
                <input type="checkbox" checked={on} onChange={() => toggle(i)} className="h-5 w-5 shrink-0 accent-navy-700" aria-label={`Select ${i.name}`} />
                <span className="text-2xl">{i.emoji ?? '📦'}</span>
                <button className="min-w-0 flex-1 text-start" onClick={() => toggle(i)}>
                  <p className="truncate font-semibold">{i.name}</p>
                  <p className="text-[12.5px] text-muted">
                    Available now: <span className={cx('font-semibold', statusText[st])}>{fmtQty(available(i))}</span>
                    {i.track_opened ? ` (${fmtQty(i.qty_store)} sealed + ${fmtQty(i.qty_opened)} open)` : ''} · target {fmtQty(i.par_qty)} {i.unit}
                  </p>
                  <p className="text-[12.5px] text-muted">{i.supplier ?? 'No supplier'}{i.unit_price ? ` · ${money(i.unit_price)}/${i.unit}` : ''}</p>
                  {ord && <Badge tone={ord.status === 'draft' ? 'neutral' : 'navy'} className="mt-1">{ord.status === 'draft' ? `In draft ${ord.ref}` : `On order ${ord.ref}${ord.expected_on ? ` · due ${prettyDate(ord.expected_on, { day: 'numeric', month: 'short' })}` : ''}`}</Badge>}
                </button>
                <div className="flex flex-col items-end gap-1.5">
                  <StatusPill status={st} />
                  {on ? (
                    <div className="flex items-center gap-1">
                      <span className="text-[12px] text-muted">Qty</span>
                      <input inputMode="numeric" value={sel[i.id]} onChange={(e) => setSel((s) => ({ ...s, [i.id]: Math.max(Number(e.target.value.replace(/\D/g, '')) || 0, 0) }))}
                        className="h-9 w-16 rounded-lg border border-line text-center font-semibold tnum outline-none focus:border-navy-400" />
                    </div>
                  ) : (
                    <p className="text-[13px] font-semibold">Need <span className="tnum">{fmtQty(needQty(i))}</span></p>
                  )}
                </div>
              </div>
            );
          })}
        </Card>
      )}

      {chosen.length > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(70px+env(safe-area-inset-bottom))] z-30 px-4 lg:bottom-6 lg:ps-[280px]">
          <div className="mx-auto flex max-w-3xl items-center gap-3 rounded-2xl bg-navy-700 p-3 text-white shadow-lift">
            <ShoppingCart className="ms-1 h-5 w-5" />
            <div className="min-w-0 flex-1"><p className="font-semibold">{chosen.length} item{chosen.length > 1 ? 's' : ''} selected</p><p className="text-[13px] text-white/70">≈ {money(est)} · grouped by supplier</p></div>
            <Button variant="white" loading={busy} onClick={() => void create()}>Create order</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function OrdersTab({ onOpen }: { onOpen: (id: string) => void }) {
  const orders = useOrders();
  const [f, setF] = useState<'open' | 'received' | 'all'>('open');
  const list = (orders.data ?? []).filter((o) => f === 'all' || (f === 'open' ? ['draft', 'ordered', 'partial'].includes(o.status) : o.status === 'received'));
  if (orders.isLoading) return <Skeleton className="h-60" />;
  return (
    <div>
      <Chips value={f} onChange={setF} className="mx-0 px-0" options={[{ value: 'open', label: 'Open' }, { value: 'received', label: 'Received' }, { value: 'all', label: 'All' }]} />
      {list.length === 0 ? <div className="mt-3"><EmptyState icon={<Truck className="h-8 w-8" />} title="No orders here" body="Select items in “Items to supply” and tap Create order." /></div> : (
        <Card className="mt-3 divide-y divide-line">
          {list.map((o) => {
            const total = (o.lines ?? []).reduce((s, l) => s + l.qty * (l.unit_price ?? 0), 0);
            return (
              <button key={o.id} onClick={() => onOpen(o.id)} className="flex w-full items-center gap-3 p-3.5 text-start hover:bg-sunken/60">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sunken"><Truck className="h-5 w-5 text-navy-500" /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{o.ref}</p><Badge tone={STATUS_TONE[o.status]}>{STATUS_TXT[o.status]}</Badge></div>
                  <p className="truncate text-[13px] text-muted">{o.supplier ?? 'No supplier'} · {(o.lines ?? []).length} lines · {money(total)}</p>
                  <p className="text-[12px] text-muted">{o.status === 'received' && o.received_at ? `Received ${prettyDate(o.received_at.slice(0, 10))}` : o.expected_on ? `Expected ${prettyDate(o.expected_on)}` : `Created ${prettyDate(o.created_at.slice(0, 10))}`}</p>
                </div>
              </button>
            );
          })}
        </Card>
      )}
    </div>
  );
}

export function orderText(o: Order, orgName: string, managerName: string) {
  const lines = (o.lines ?? []).map((l, i) => `${i + 1}. ${l.name} — ${fmtQty(l.qty)} ${l.unit ?? ''}`.trim()).join('\n');
  return `Purchase order ${o.ref} — ${orgName}\nSupplier: ${o.supplier ?? '-'}\n\n${lines}\n\nPlease confirm availability, price and delivery date to RH Aero Systems, Dubai South.\nThank you,\n${managerName}\nOffice Manager`;
}

function OrderSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const { me, org } = useMe();
  const qc = useQueryClient();
  const orders = useOrders();
  const items = useItems();
  const o = (orders.data ?? []).find((x) => x.id === id);
  const [mode, setMode] = useState<null | 'ordered' | 'receive' | 'add'>(null);
  const [expected, setExpected] = useState('');
  const [recv, setRecv] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [addItem, setAddItem] = useState('');
  const { ask, node } = useConfirm();
  if (!o) return <Sheet open onClose={onClose} title="Order"><Skeleton className="h-40" /></Sheet>;
  const total = (o.lines ?? []).reduce((s, l) => s + l.qty * (l.unit_price ?? 0), 0);
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['orders'] }); void qc.invalidateQueries({ queryKey: ['items'] }); };
  const text = orderText(o, org.name, me.full_name);

  const update = async (patch: Partial<Order>) => {
    setBusy(true);
    const { error } = await supabase.from('rh_orders').update(patch).eq('id', o.id);
    setBusy(false);
    if (error) return toast(errMsg(error), 'bad');
    refresh();
  };
  const setLineQty = async (lineId: string, qty: number) => {
    if (qty <= 0) { await supabase.from('rh_order_lines').delete().eq('id', lineId); } else { await supabase.from('rh_order_lines').update({ qty }).eq('id', lineId); }
    refresh();
  };
  const receive = async () => {
    setBusy(true);
    const lines = (o.lines ?? []).map((l) => ({ id: l.id, qty: Number(recv[l.id] ?? Math.max(l.qty - l.received_qty, 0)) || 0 }));
    const { error } = await supabase.rpc('rh_receive_order', { p_order: o.id, p_lines: lines });
    setBusy(false);
    if (error) return toast(errMsg(error), 'bad');
    toast('Delivery received — stock updated');
    setMode(null);
    refresh();
  };
  const add = async () => {
    const it = (items.data ?? []).find((x) => x.id === addItem);
    if (!it) return;
    await supabase.from('rh_order_lines').insert({ order_id: o.id, item_id: it.id, name: it.name + (it.pack_info ? ` (${it.pack_info})` : ''), unit: it.unit, qty: Math.max(needQty(it), 1), unit_price: it.unit_price });
    setAddItem(''); setMode(null); refresh();
  };

  let footer: React.ReactNode = null;
  if (mode === 'ordered') footer = (
    <div className="space-y-2">
      <Field label="Expected delivery (optional)"><Input type="date" value={expected} onChange={(e) => setExpected(e.target.value)} /></Field>
      <div className="flex gap-2"><Button variant="secondary" block onClick={() => setMode(null)}>Back</Button>
        <Button block loading={busy} onClick={async () => { await update({ status: 'ordered', ordered_at: new Date().toISOString(), expected_on: expected || null }); toast('Marked as ordered'); setMode(null); }}>Confirm ordered</Button></div>
    </div>);
  else if (mode === 'receive') footer = <div className="flex gap-2"><Button variant="secondary" block onClick={() => setMode(null)}>Back</Button><Button variant="success" block loading={busy} onClick={() => void receive()}>Add to stock</Button></div>;
  else if (o.status === 'draft') footer = (
    <div className="flex flex-wrap gap-2">
      <Button className="flex-1" icon={<Send className="h-4 w-4" />} onClick={() => setMode('ordered')} disabled={!(o.lines ?? []).length}>Mark as ordered</Button>
      <Button variant="ghost" icon={<Trash2 className="h-4 w-4" />} onClick={async () => { if (await ask('Delete this draft?', { danger: true, confirm: 'Delete' })) { await supabase.from('rh_orders').delete().eq('id', o.id); refresh(); onClose(); } }}>Delete</Button>
    </div>);
  else if (o.status === 'ordered' || o.status === 'partial') footer = (
    <div className="flex flex-wrap gap-2">
      <Button variant="success" className="flex-1" icon={<PackageCheck className="h-4 w-4" />} onClick={() => setMode('receive')}>Receive delivery</Button>
      <Button variant="ghost" icon={<XCircle className="h-4 w-4" />} onClick={async () => { if (await ask('Cancel this order?', { danger: true, confirm: 'Cancel order' })) await update({ status: 'cancelled' }); }}>Cancel</Button>
    </div>);

  return (
    <Sheet open onClose={onClose} wide title={<span className="flex items-center gap-2">{o.ref} <Badge tone={STATUS_TONE[o.status]}>{STATUS_TXT[o.status]}</Badge></span>} footer={footer}>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Supplier">
            {o.status === 'draft' ? <Input defaultValue={o.supplier ?? ''} onBlur={(e) => e.target.value !== (o.supplier ?? '') && void update({ supplier: e.target.value })} /> : <p className="font-semibold">{o.supplier ?? '–'}</p>}
          </Field>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-muted">Created</p><p className="font-semibold">{prettyDate(o.created_at.slice(0, 10))}</p></div>
            <div><p className="text-muted">{o.status === 'received' ? 'Received' : 'Expected'}</p><p className="font-semibold">{o.received_at ? prettyDate(o.received_at.slice(0, 10)) : o.expected_on ? prettyDate(o.expected_on) : '–'}</p></div>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-line">
          <table className="w-full text-sm">
            <thead className="bg-sunken text-[12px] uppercase text-muted"><tr><th className="p-2.5 text-start">Item</th><th className="p-2.5 text-end">Qty</th><th className="hidden p-2.5 text-end sm:table-cell">Price</th>{mode === 'receive' ? <th className="p-2.5 text-end">Received now</th> : <th className="p-2.5 text-end">Got</th>}</tr></thead>
            <tbody>
              {(o.lines ?? []).map((l) => (
                <tr key={l.id} className="border-t border-line">
                  <td className="p-2.5"><p className="font-medium">{l.name}</p><p className="text-[12px] text-muted">{l.unit}</p></td>
                  <td className="p-2.5 text-end">
                    {o.status === 'draft' ? <input inputMode="numeric" defaultValue={l.qty} onBlur={(e) => Number(e.target.value) !== l.qty && void setLineQty(l.id, Number(e.target.value) || 0)} className="h-9 w-16 rounded-lg border border-line text-center font-semibold tnum" /> : <span className="font-semibold tnum">{fmtQty(l.qty)}</span>}
                  </td>
                  <td className="hidden p-2.5 text-end text-muted tnum sm:table-cell">{l.unit_price ? money(l.qty * l.unit_price) : '–'}</td>
                  <td className="p-2.5 text-end">
                    {mode === 'receive' ? <input inputMode="decimal" value={recv[l.id] ?? String(Math.max(l.qty - l.received_qty, 0))} onChange={(e) => setRecv({ ...recv, [l.id]: e.target.value })} className="h-9 w-16 rounded-lg border border-navy-300 text-center font-semibold tnum" />
                      : <span className={cx('tnum', l.received_qty >= l.qty ? 'font-semibold text-ok' : 'text-muted')}>{fmtQty(l.received_qty)}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr className="border-t border-line bg-sunken/60"><td className="p-2.5 font-semibold">Estimated total</td><td /><td className="hidden p-2.5 text-end font-semibold tnum sm:table-cell">{money(total)}</td><td className="p-2.5 text-end font-semibold tnum sm:hidden">{money(total)}</td></tr></tfoot>
          </table>
        </div>
        {o.status === 'draft' && (mode === 'add' ? (
          <div className="flex gap-2">
            <Select value={addItem} onChange={(e) => setAddItem(e.target.value)}>
              <option value="">Choose an item…</option>
              {(items.data ?? []).filter((i) => i.active).map((i) => <option key={i.id} value={i.id}>{i.emoji} {i.name}</option>)}
            </Select>
            <Button onClick={() => void add()} disabled={!addItem}>Add</Button>
          </div>
        ) : <Button size="sm" variant="soft" icon={<Plus className="h-4 w-4" />} onClick={() => setMode('add')}>Add item</Button>)}

        <Field label="Notes"><Textarea defaultValue={o.notes ?? ''} rows={2} onBlur={(e) => e.target.value !== (o.notes ?? '') && void update({ notes: e.target.value })} /></Field>

        <div>
          <p className="mb-2 text-sm font-semibold">Send to supplier</p>
          <div className="flex flex-wrap gap-2">
            <a href={whatsappUrl(text)} target="_blank" rel="noreferrer"><Button size="sm" variant="secondary" icon={<MessageCircle className="h-4 w-4" />}>WhatsApp</Button></a>
            <a href={`mailto:?subject=${encodeURIComponent(`Purchase order ${o.ref} — RH Aero Systems`)}&body=${encodeURIComponent(text)}`}><Button size="sm" variant="secondary" icon={<Mail className="h-4 w-4" />}>Email</Button></a>
            <Button size="sm" variant="secondary" icon={<Copy className="h-4 w-4" />} onClick={async () => { await copyText(text); toast('Order copied'); }}>Copy</Button>
            <Button size="sm" variant="secondary" icon={<Printer className="h-4 w-4" />} onClick={() => printOrder(o, org.name, me.full_name)}>Print / PDF</Button>
          </div>
        </div>
      </div>
      {node}
    </Sheet>
  );
}

function printOrder(o: Order, orgName: string, manager: string) {
  const w = window.open('', '_blank');
  if (!w) return;
  const rows = (o.lines ?? []).map((l, i) => `<tr><td>${i + 1}</td><td>${l.name}</td><td style="text-align:right">${fmtQty(l.qty)} ${l.unit ?? ''}</td><td style="text-align:right">${l.unit_price ? money(l.unit_price) : ''}</td><td style="text-align:right">${l.unit_price ? money(l.qty * l.unit_price) : ''}</td></tr>`).join('');
  const total = (o.lines ?? []).reduce((s, l) => s + l.qty * (l.unit_price ?? 0), 0);
  w.document.write(`<html><head><title>${o.ref}</title><style>body{font-family:Barlow,Arial,sans-serif;color:#161a33;padding:28px}h1{color:#202854;margin:0}table{width:100%;border-collapse:collapse;margin-top:18px}td,th{border-bottom:1px solid #e4e7ef;padding:8px;text-align:left}th{background:#f3f4f8;font-size:12px;text-transform:uppercase}.bar{height:4px;background:linear-gradient(90deg,#b20709 0 20%,#202854 20%);margin:10px 0 18px}</style></head><body>
    <h1>Purchase order ${o.ref}</h1><div class="bar"></div>
    <p><b>${orgName}</b> · Dubai South<br/>Supplier: <b>${o.supplier ?? '-'}</b><br/>Date: ${new Date(o.created_at).toLocaleDateString('en-GB')}${o.expected_on ? `<br/>Requested delivery: ${o.expected_on}` : ''}</p>
    <table><thead><tr><th>#</th><th>Item</th><th style="text-align:right">Qty</th><th style="text-align:right">Unit price</th><th style="text-align:right">Total</th></tr></thead><tbody>${rows}</tbody>
    <tfoot><tr><td></td><td><b>Estimated total</b></td><td></td><td></td><td style="text-align:right"><b>${money(total)}</b></td></tr></tfoot></table>
    ${o.notes ? `<p>Notes: ${o.notes}</p>` : ''}<p style="margin-top:40px">Prepared by ${manager}, Office Manager</p></body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 300);
}

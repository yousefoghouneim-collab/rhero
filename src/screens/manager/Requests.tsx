import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Globe, Plus, Search } from 'lucide-react';
import { useMe } from '../../auth/AuthProvider';
import { useRequests } from '../../lib/data';
import { supabase, errMsg } from '../../lib/supabase';
import { toast } from '../../lib/toast';
import { ago, prettyDate } from '../../lib/time';
import { money } from '../../lib/stock';
import type { PurchaseRequest, RequestStatus } from '../../lib/types';
import { Badge, Button, Card, Chips, EmptyState, Field, Input, Select, Sheet, Skeleton, Textarea, cx } from '../../components/ui';
import { PageBody, PageTop, useSearchText } from './common';

export const REQ_CATEGORIES = ['IT Equipment', 'Furniture', 'Office Equipment', 'Stationery', 'Pantry', 'Cleaning', 'Other'];
export const REQ_STATUS: Record<RequestStatus, { label: string; tone: 'navy' | 'teal' | 'violet' | 'ok' | 'bad' | 'amber' }> = {
  new: { label: 'New', tone: 'navy' },
  approved: { label: 'Approved', tone: 'teal' },
  ordered: { label: 'Ordered', tone: 'violet' },
  delivered: { label: 'Delivered', tone: 'ok' },
  on_hold: { label: 'On hold', tone: 'amber' },
  rejected: { label: 'Rejected', tone: 'bad' },
};
const PRIO: Record<string, string> = { low: 'text-muted', normal: 'text-muted', high: 'text-warn', urgent: 'text-bad' };
const CAT_ICON: Record<string, string> = { 'IT Equipment': '🖥️', Furniture: '🪑', 'Office Equipment': '🖨️', Stationery: '✏️', Pantry: '☕', Cleaning: '🧽', Other: '📦' };

type F = 'open' | RequestStatus | 'all';

export default function Requests() {
  const reqs = useRequests();
  const [f, setF] = useState<F>('open');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Partial<PurchaseRequest> | null>(null);
  const all = reqs.data ?? [];
  const byStatus = (s: F) => all.filter((r) => s === 'all' || (s === 'open' ? ['new', 'approved', 'ordered', 'on_hold'].includes(r.status) : r.status === s));
  const list = useSearchText(byStatus(f), q, (r) => [r.title, r.requester_name, r.department, r.ref, r.category]);
  const openValue = useMemo(() => byStatus('open').reduce((s, r) => s + (r.est_unit_cost ?? 0) * r.qty, 0), [all]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <PageTop title="Requests & orders" sub="Monitors, desks, chairs, docks and other purchases"
        actions={<Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setSel({ title: '', category: 'IT Equipment', qty: 1, priority: 'normal', status: 'new' })}>New</Button>} />
      <PageBody>
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-3"><p className="text-[12px] font-semibold uppercase text-muted">New</p><p className="text-2xl font-semibold tnum text-navy-700">{byStatus('new').length}</p></Card>
          <Card className="p-3"><p className="text-[12px] font-semibold uppercase text-muted">In progress</p><p className="text-2xl font-semibold tnum">{byStatus('approved').length + byStatus('ordered').length}</p></Card>
          <Card className="p-3"><p className="text-[12px] font-semibold uppercase text-muted">Open value</p><p className="text-lg font-semibold tnum">{money(openValue)}</p></Card>
        </div>
        <div className="relative mt-4">
          <Search className="pointer-events-none absolute start-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search requests, people, departments" className="ps-11" type="search" />
        </div>
        <div className="mt-3">
          <Chips<F> value={f} onChange={setF} options={[
            { value: 'open', label: 'Open', count: byStatus('open').length },
            ...(['new', 'approved', 'ordered', 'delivered', 'on_hold', 'rejected'] as RequestStatus[]).map((s) => ({ value: s as F, label: REQ_STATUS[s].label, count: byStatus(s).length })),
            { value: 'all', label: 'All', count: all.length },
          ]} />
        </div>
        {reqs.isLoading ? <Skeleton className="mt-4 h-60" /> : list.length === 0 ? (
          <div className="mt-4"><EmptyState title="No requests" body="Share the item request form (Forms & templates) so employees can send what they need — it lands here automatically." /></div>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {list.map((r) => (
              <Card key={r.id} onClick={() => setSel(r)} as="button" className="p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sunken text-xl">{CAT_ICON[r.category] ?? '📦'}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{r.title}</p></div>
                    <p className="text-[13px] text-muted">{r.qty} × · {r.requester_name ?? '–'}{r.department ? ` · ${r.department}` : ''}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge tone={REQ_STATUS[r.status].tone}>{REQ_STATUS[r.status].label}</Badge>
                      {r.source === 'form' && <Badge tone="neutral"><Globe className="h-3 w-3" />Form</Badge>}
                      {(r.priority === 'high' || r.priority === 'urgent') && <span className={cx('text-xs font-semibold uppercase', PRIO[r.priority])}>{r.priority}</span>}
                      {r.needed_by && <span className="text-xs text-muted">by {prettyDate(r.needed_by, { day: 'numeric', month: 'short' })}</span>}
                    </div>
                  </div>
                  <div className="text-end">
                    <p className="text-[12px] text-muted">{r.ref}</p>
                    {r.est_unit_cost ? <p className="text-sm font-semibold tnum">{money(r.est_unit_cost * r.qty)}</p> : null}
                    <p className="text-[12px] text-muted">{ago(r.created_at)}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </PageBody>
      {sel && <RequestSheet value={sel} onClose={() => setSel(null)} />}
    </div>
  );
}

function RequestSheet({ value, onClose }: { value: Partial<PurchaseRequest>; onClose: () => void }) {
  const { org } = useMe();
  const qc = useQueryClient();
  const [v, setV] = useState<Partial<PurchaseRequest>>(value);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof PurchaseRequest) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value });
  const save = async (statusOverride?: RequestStatus) => {
    if (!v.title?.trim()) return toast('What is needed?', 'bad');
    setBusy(true);
    const row = {
      title: v.title.trim(), category: v.category ?? 'Other', qty: Number(v.qty) || 1, specs: v.specs || null, reason: v.reason || null, link: v.link || null,
      needed_by: v.needed_by || null, priority: v.priority ?? 'normal', requester_name: v.requester_name || null, requester_email: v.requester_email || null,
      requester_phone: v.requester_phone || null, department: v.department || null, est_unit_cost: v.est_unit_cost ? Number(v.est_unit_cost) : null,
      supplier: v.supplier || null, po_number: v.po_number || null, status: statusOverride ?? v.status ?? 'new', notes: v.notes || null,
    };
    const { error } = v.id ? await supabase.from('rh_requests').update(row).eq('id', v.id) : await supabase.from('rh_requests').insert({ ...row, org_id: org.id, source: 'manager' });
    setBusy(false);
    if (error) return toast(errMsg(error), 'bad');
    void qc.invalidateQueries({ queryKey: ['requests'] });
    toast(statusOverride ? `Marked ${REQ_STATUS[statusOverride].label.toLowerCase()}` : 'Saved');
    onClose();
  };
  const next: RequestStatus[] = v.status === 'new' ? ['approved', 'on_hold', 'rejected'] : v.status === 'approved' ? ['ordered', 'on_hold'] : v.status === 'ordered' ? ['delivered'] : v.status === 'on_hold' ? ['approved', 'rejected'] : [];
  return (
    <Sheet open onClose={onClose} wide title={v.id ? `${v.ref} · ${v.title}` : 'New request'}
      footer={
        <div className="flex flex-wrap gap-2">
          {v.id && next.map((s) => <Button key={s} variant={s === 'rejected' ? 'danger' : s === 'delivered' ? 'success' : 'soft'} loading={busy} onClick={() => void save(s)}>{REQ_STATUS[s].label}</Button>)}
          <Button className="ms-auto" loading={busy} onClick={() => void save()}>{v.id ? 'Save changes' : 'Add request'}</Button>
        </div>
      }>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><Field label="Item needed"><Input value={v.title ?? ''} onChange={set('title')} placeholder='e.g. 27" monitor' /></Field></div>
        <Field label="Category"><Select value={v.category} onChange={set('category')}>{REQ_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="How many"><Input inputMode="numeric" value={v.qty ?? 1} onChange={set('qty')} /></Field>
          <Field label="Priority"><Select value={v.priority} onChange={set('priority')}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></Select></Field>
        </div>
        <div className="sm:col-span-2"><Field label="Specs"><Textarea value={v.specs ?? ''} onChange={set('specs')} rows={2} placeholder="Model, size, colour, technical requirements" /></Field></div>
        <div className="sm:col-span-2"><Field label="Why is it needed?"><Textarea value={v.reason ?? ''} onChange={set('reason')} rows={2} /></Field></div>
        <Field label="Needed by"><Input type="date" value={v.needed_by ?? ''} onChange={set('needed_by')} /></Field>
        <Field label="Link (example product)"><div className="flex gap-2"><Input value={v.link ?? ''} onChange={set('link')} placeholder="https://" />{v.link && <a href={v.link} target="_blank" rel="noreferrer" className="flex items-center px-2 text-navy-600"><ExternalLink className="h-5 w-5" /></a>}</div></Field>
        <Field label="Requested by"><Input value={v.requester_name ?? ''} onChange={set('requester_name')} /></Field>
        <Field label="Department / team"><Input value={v.department ?? ''} onChange={set('department')} /></Field>
        <Field label="Email"><Input type="email" value={v.requester_email ?? ''} onChange={set('requester_email')} /></Field>
        <Field label="Phone"><Input type="tel" value={v.requester_phone ?? ''} onChange={set('requester_phone')} /></Field>
        <Field label="Estimated unit cost (AED)"><Input inputMode="decimal" value={v.est_unit_cost ?? ''} onChange={set('est_unit_cost')} /></Field>
        <Field label="Supplier"><Input value={v.supplier ?? ''} onChange={set('supplier')} /></Field>
        <Field label="PO number"><Input value={v.po_number ?? ''} onChange={set('po_number')} placeholder="SAP / PO reference" /></Field>
        <Field label="Status"><Select value={v.status} onChange={set('status')}>{(Object.keys(REQ_STATUS) as RequestStatus[]).map((s) => <option key={s} value={s}>{REQ_STATUS[s].label}</option>)}</Select></Field>
        <div className="sm:col-span-2"><Field label="Internal notes"><Textarea value={v.notes ?? ''} onChange={set('notes')} rows={2} /></Field></div>
        {v.est_unit_cost ? <p className="text-sm text-muted sm:col-span-2">Estimated total: <b className="text-ink">{money(Number(v.est_unit_cost) * (Number(v.qty) || 1))}</b></p> : null}
      </div>
    </Sheet>
  );
}

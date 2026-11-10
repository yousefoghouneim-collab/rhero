import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Copy, Globe, MessageCircle, Plus, Printer, Search, Trash2, UserPlus } from 'lucide-react';
import { useMe } from '../../auth/AuthProvider';
import { usePasses } from '../../lib/data';
import { supabase, errMsg } from '../../lib/supabase';
import { toast } from '../../lib/toast';
import { hhmm, orgNow, prettyDate } from '../../lib/time';
import type { PassStatus, VisitorPass } from '../../lib/types';
import { Badge, Button, Card, Chips, EmptyState, Field, Input, Select, Sheet, Skeleton, Textarea } from '../../components/ui';
import { copyText, PageBody, PageTop, useSearchText, whatsappUrl } from './common';

export const PASS_STATUS: Record<PassStatus, { label: string; tone: 'navy' | 'teal' | 'ok' | 'bad' | 'neutral' }> = {
  pending: { label: 'Pending', tone: 'navy' },
  approved: { label: 'Approved', tone: 'teal' },
  issued: { label: 'Pass issued', tone: 'ok' },
  rejected: { label: 'Rejected', tone: 'bad' },
  completed: { label: 'Visit done', tone: 'neutral' },
};
const ID_LABEL = { emirates_id: 'Emirates ID', passport: 'Passport', other: 'ID' };

export function passText(p: Partial<VisitorPass>, org: string) {
  const extra = (p.extra_visitors ?? []).map((x) => `  + ${x.name}${x.id_number ? ` (${x.id_number})` : ''}`).join('\n');
  return [
    `GATE PASS REQUEST — ${org}`,
    p.ref ? `Ref: ${p.ref}` : '',
    `Visitor: ${p.visitor_name ?? ''}`,
    `${ID_LABEL[p.id_type ?? 'emirates_id']}: ${p.id_number ?? ''}`,
    p.nationality ? `Nationality: ${p.nationality}` : '',
    p.company ? `Company: ${p.company}` : '',
    p.occupation ? `Occupation: ${p.occupation}` : '',
    p.phone ? `Mobile: ${p.phone}` : '',
    p.email ? `Email: ${p.email}` : '',
    `Visit date: ${p.visit_date ? prettyDate(p.visit_date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : ''}${p.arrival_time ? `, ${hhmm(p.arrival_time)}` : ''}${p.departure_time ? `–${hhmm(p.departure_time)}` : ''}`,
    `Reason: ${p.visit_reason ?? ''}`,
    `Meeting: ${p.host_name ?? ''}${p.host_team ? ` (${p.host_team})` : ''}`,
    p.vehicle_plate ? `Vehicle: ${p.vehicle_plate}` : '',
    p.equipment ? `Bringing: ${p.equipment}` : '',
    extra ? `Additional visitors:\n${extra}` : '',
  ].filter(Boolean).join('\n');
}

type F = 'upcoming' | 'today' | 'pending' | 'past' | 'all';

export default function Passes() {
  const { org } = useMe();
  const passes = usePasses();
  const today = orgNow(org.timezone).date;
  const [f, setF] = useState<F>('upcoming');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Partial<VisitorPass> | null>(null);
  const all = passes.data ?? [];
  const pick = (x: F) => all.filter((p) => x === 'all' || (x === 'today' ? p.visit_date === today : x === 'upcoming' ? p.visit_date >= today : x === 'pending' ? p.status === 'pending' : p.visit_date < today));
  const list = useSearchText(pick(f), q, (p) => [p.visitor_name, p.company, p.host_name, p.ref, p.id_number]).slice().sort((a, b) => (f === 'past' || f === 'all' ? (a.visit_date < b.visit_date ? 1 : -1) : a.visit_date < b.visit_date ? -1 : 1));

  return (
    <div>
      <PageTop title="Gate passes" sub="Visitor access for Dubai South"
        actions={<Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setSel({ id_type: 'emirates_id', visit_date: today, status: 'pending', extra_visitors: [] })}>New</Button>} />
      <PageBody>
        <div className="relative">
          <Search className="pointer-events-none absolute start-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search visitor, company, host, ID" className="ps-11" type="search" />
        </div>
        <div className="mt-3">
          <Chips<F> value={f} onChange={setF} options={[
            { value: 'upcoming', label: 'Upcoming', count: pick('upcoming').length },
            { value: 'today', label: 'Today', count: pick('today').length },
            { value: 'pending', label: 'Pending', count: pick('pending').length },
            { value: 'past', label: 'Past' },
            { value: 'all', label: 'All', count: all.length },
          ]} />
        </div>
        {passes.isLoading ? <Skeleton className="mt-4 h-60" /> : list.length === 0 ? (
          <div className="mt-4"><EmptyState icon={<UserPlus className="h-8 w-8" />} title="No visitors here" body="Employees can request a pass for their visitor using the gate pass form (Forms & templates)." /></div>
        ) : (
          <Card className="mt-4 divide-y divide-line">
            {list.map((p) => (
              <button key={p.id} onClick={() => setSel(p)} className="flex w-full items-center gap-3 p-3.5 text-start hover:bg-sunken/60">
                <div className="w-14 shrink-0 rounded-xl bg-sunken py-1.5 text-center">
                  <p className="text-[11px] font-semibold uppercase text-muted">{prettyDate(p.visit_date, { month: 'short' })}</p>
                  <p className="text-lg font-semibold leading-none tnum">{prettyDate(p.visit_date, { day: 'numeric' })}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{p.visitor_name}{p.extra_visitors?.length ? ` +${p.extra_visitors.length}` : ''}</p>
                  <p className="truncate text-[13px] text-muted">{p.company ?? p.occupation ?? '—'} · meets {p.host_name}{p.arrival_time ? ` · ${hhmm(p.arrival_time)}` : ''}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge tone={PASS_STATUS[p.status].tone}>{PASS_STATUS[p.status].label}</Badge>
                  {p.source === 'form' && <span className="flex items-center gap-1 text-[11px] text-muted"><Globe className="h-3 w-3" />form</span>}
                </div>
              </button>
            ))}
          </Card>
        )}
      </PageBody>
      {sel && <PassSheet value={sel} onClose={() => setSel(null)} />}
    </div>
  );
}

function PassSheet({ value, onClose }: { value: Partial<VisitorPass>; onClose: () => void }) {
  const { org } = useMe();
  const qc = useQueryClient();
  const [v, setV] = useState<Partial<VisitorPass>>({ ...value, arrival_time: hhmm(value.arrival_time) || null, departure_time: hhmm(value.departure_time) || null });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof VisitorPass) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value });
  const text = passText(v, org.name);
  const save = async (status?: PassStatus) => {
    if (!v.visitor_name?.trim() || !v.id_number?.trim() || !v.visit_reason?.trim() || !v.host_name?.trim() || !v.visit_date) return toast('Visitor name, ID, reason, host and date are required', 'bad');
    setBusy(true);
    const row = {
      visitor_name: v.visitor_name.trim(), id_type: v.id_type ?? 'emirates_id', id_number: v.id_number.trim(), nationality: v.nationality || null, email: v.email || null, phone: v.phone || null,
      company: v.company || null, occupation: v.occupation || null, visit_reason: v.visit_reason.trim(), visit_date: v.visit_date, arrival_time: v.arrival_time || null, departure_time: v.departure_time || null,
      host_name: v.host_name.trim(), host_team: v.host_team || null, host_email: v.host_email || null, host_phone: v.host_phone || null, vehicle_plate: v.vehicle_plate || null,
      equipment: v.equipment || null, extra_visitors: (v.extra_visitors ?? []).filter((x) => x.name?.trim()), notes: v.notes || null, status: status ?? v.status ?? 'pending',
    };
    const { error } = v.id ? await supabase.from('rh_visitor_passes').update(row).eq('id', v.id) : await supabase.from('rh_visitor_passes').insert({ ...row, org_id: org.id, source: 'manager' });
    setBusy(false);
    if (error) return toast(errMsg(error), 'bad');
    void qc.invalidateQueries({ queryKey: ['passes'] });
    toast(status ? PASS_STATUS[status].label : 'Saved');
    onClose();
  };
  const next: PassStatus[] = v.status === 'pending' ? ['approved', 'rejected'] : v.status === 'approved' ? ['issued'] : v.status === 'issued' ? ['completed'] : [];
  return (
    <Sheet open onClose={onClose} wide title={v.id ? `${v.ref} · ${v.visitor_name}` : 'New gate pass'}
      footer={<div className="flex flex-wrap gap-2">{v.id && next.map((s) => <Button key={s} variant={s === 'rejected' ? 'danger' : s === 'issued' ? 'success' : 'soft'} loading={busy} onClick={() => void save(s)}>{s === 'issued' ? 'Mark pass issued' : PASS_STATUS[s].label}</Button>)}
        <Button className="ms-auto" loading={busy} onClick={() => void save()}>{v.id ? 'Save' : 'Add pass'}</Button></div>}>
      <div className="space-y-5">
        {v.id && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" icon={<Copy className="h-4 w-4" />} onClick={async () => { await copyText(text); toast('Copied — paste it to building security'); }}>Copy for security</Button>
            <a href={whatsappUrl(text)} target="_blank" rel="noreferrer"><Button size="sm" variant="secondary" icon={<MessageCircle className="h-4 w-4" />}>WhatsApp</Button></a>
            <Button size="sm" variant="secondary" icon={<Printer className="h-4 w-4" />} onClick={() => printPass(text, v)}>Print</Button>
          </div>
        )}
        <section className="grid gap-4 sm:grid-cols-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted sm:col-span-2">Visitor</h3>
          <Field label="Full name"><Input value={v.visitor_name ?? ''} onChange={set('visitor_name')} /></Field>
          <div className="grid grid-cols-[130px_1fr] gap-2">
            <Field label="ID type"><Select value={v.id_type} onChange={set('id_type')}><option value="emirates_id">Emirates ID</option><option value="passport">Passport</option><option value="other">Other</option></Select></Field>
            <Field label="ID number"><Input value={v.id_number ?? ''} onChange={set('id_number')} placeholder={v.id_type === 'emirates_id' ? '784-XXXX-XXXXXXX-X' : ''} /></Field>
          </div>
          <Field label="Nationality"><Input value={v.nationality ?? ''} onChange={set('nationality')} /></Field>
          <Field label="Company"><Input value={v.company ?? ''} onChange={set('company')} /></Field>
          <Field label="Occupation / job title"><Input value={v.occupation ?? ''} onChange={set('occupation')} /></Field>
          <Field label="Mobile"><Input type="tel" value={v.phone ?? ''} onChange={set('phone')} /></Field>
          <Field label="Email"><Input type="email" value={v.email ?? ''} onChange={set('email')} /></Field>
          <Field label="Vehicle plate (if driving)"><Input value={v.vehicle_plate ?? ''} onChange={set('vehicle_plate')} /></Field>
        </section>
        <section className="grid gap-4 sm:grid-cols-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted sm:col-span-2">Visit</h3>
          <Field label="Date"><Input type="date" value={v.visit_date ?? ''} onChange={set('visit_date')} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Arrival"><Input type="time" value={v.arrival_time ?? ''} onChange={set('arrival_time')} /></Field>
            <Field label="Leaving"><Input type="time" value={v.departure_time ?? ''} onChange={set('departure_time')} /></Field>
          </div>
          <div className="sm:col-span-2"><Field label="Reason for visit"><Textarea value={v.visit_reason ?? ''} onChange={set('visit_reason')} rows={2} /></Field></div>
          <Field label="Meeting (host)"><Input value={v.host_name ?? ''} onChange={set('host_name')} /></Field>
          <Field label="Host team"><Input value={v.host_team ?? ''} onChange={set('host_team')} /></Field>
          <Field label="Host email"><Input type="email" value={v.host_email ?? ''} onChange={set('host_email')} /></Field>
          <Field label="Host phone"><Input type="tel" value={v.host_phone ?? ''} onChange={set('host_phone')} /></Field>
          <div className="sm:col-span-2"><Field label="Equipment / laptops / tools brought in"><Input value={v.equipment ?? ''} onChange={set('equipment')} /></Field></div>
        </section>
        <section>
          <div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Additional visitors</h3>
            <Button size="sm" variant="soft" icon={<Plus className="h-4 w-4" />} onClick={() => setV({ ...v, extra_visitors: [...(v.extra_visitors ?? []), { name: '', id_number: '' }] })}>Add</Button></div>
          <div className="space-y-2">
            {(v.extra_visitors ?? []).map((x, i) => (
              <div key={i} className="flex gap-2">
                <Input placeholder="Name" value={x.name} onChange={(e) => setV({ ...v, extra_visitors: (v.extra_visitors ?? []).map((y, j) => (j === i ? { ...y, name: e.target.value } : y)) })} />
                <Input placeholder="ID / passport" value={x.id_number ?? ''} onChange={(e) => setV({ ...v, extra_visitors: (v.extra_visitors ?? []).map((y, j) => (j === i ? { ...y, id_number: e.target.value } : y)) })} />
                <button className="px-2 text-muted hover:text-bad" onClick={() => setV({ ...v, extra_visitors: (v.extra_visitors ?? []).filter((_, j) => j !== i) })} aria-label="Remove"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        </section>
        <Field label="Notes"><Textarea value={v.notes ?? ''} onChange={set('notes')} rows={2} /></Field>
        <Field label="Status"><Select value={v.status} onChange={set('status')}>{(Object.keys(PASS_STATUS) as PassStatus[]).map((s) => <option key={s} value={s}>{PASS_STATUS[s].label}</option>)}</Select></Field>
      </div>
    </Sheet>
  );
}

function printPass(text: string, v: Partial<VisitorPass>) {
  const w = window.open('', '_blank');
  if (!w) return;
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  w.document.write(`<html><head><title>Gate pass ${v.ref ?? ''}</title><style>body{font-family:Barlow,Arial,sans-serif;padding:28px;color:#161a33}.card{border:2px solid #202854;border-radius:14px;padding:22px;max-width:640px}.bar{height:5px;background:linear-gradient(90deg,#b20709 0 22%,#202854 22%);margin:10px 0 16px;border-radius:4px}pre{font-family:inherit;font-size:15px;line-height:1.55;white-space:pre-wrap}</style></head><body><div class="card"><h2 style="margin:0;color:#202854">Visitor gate pass</h2><div class="bar"></div><pre>${esc(text)}</pre><p style="margin-top:30px">Approved by: ____________________ &nbsp; Signature: ____________</p></div></body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 300);
}

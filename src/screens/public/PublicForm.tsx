import { useEffect, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Plus, Trash2 } from 'lucide-react';
import { supabase, errMsg } from '../../lib/supabase';
import { Logo } from '../../components/Brand';
import { Button, Card, Field, Input, Select, Skeleton, Textarea } from '../../components/ui';
import { REQ_CATEGORIES } from '../manager/Requests';

type Data = Record<string, string>;
const LS = 'rhero-form-me';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="space-y-4 p-5">
      <h2 className="text-[13px] font-semibold uppercase tracking-wider text-muted">{title}</h2>
      {children}
    </Card>
  );
}

export default function PublicForm() {
  const { token = '', kind = 'request' } = useParams();
  const info = useQuery({
    queryKey: ['formInfo', token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('rh_form_info', { p_token: token });
      if (error) throw error;
      return data as { org: string; is_demo: boolean } | null;
    },
  });
  const saved = (() => { try { return JSON.parse(localStorage.getItem(LS) || '{}') as Data; } catch { return {}; } })();
  const [d, setD] = useState<Data>(kind === 'pass'
    ? { id_type: 'emirates_id', host_name: saved.name ?? '', host_team: saved.team ?? '', host_email: saved.email ?? '', host_phone: saved.phone ?? '' }
    : { category: 'IT Equipment', qty: '1', priority: 'normal', requester_name: saved.name ?? '', department: saved.team ?? '', requester_email: saved.email ?? '', requester_phone: saved.phone ?? '' });
  const [extra, setExtra] = useState<{ name: string; id_number: string }[]>([]);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ref, setRef] = useState<string | null>(null);
  useEffect(() => { document.title = kind === 'pass' ? 'Gate pass request · RHero' : 'Item request · RHero'; }, [kind]);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setD({ ...d, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (kind === 'pass' && !consent) return setErr('Please confirm the visitor agreed to share their details.');
    setBusy(true);
    const payload = kind === 'pass' ? { ...d, extra_visitors: extra.filter((x) => x.name.trim()) } : d;
    const { data, error } = await supabase.rpc('rh_submit_form', { p_token: token, p_kind: kind === 'pass' ? 'pass' : 'request', p_data: payload });
    setBusy(false);
    if (error) return setErr(errMsg(error));
    try {
      localStorage.setItem(LS, JSON.stringify(kind === 'pass'
        ? { name: d.host_name, team: d.host_team, email: d.host_email, phone: d.host_phone }
        : { name: d.requester_name, team: d.department, email: d.requester_email, phone: d.requester_phone }));
    } catch { /* ignore */ }
    setRef(String(data));
    window.scrollTo({ top: 0 });
  };

  if (info.isLoading) return <div className="mx-auto max-w-xl p-4"><Skeleton className="h-96" /></div>;
  if (!info.data) return <div className="flex min-h-dvh items-center justify-center p-6 text-center text-muted">This form link is not valid. Please ask the office manager for the current link.</div>;

  return (
    <div className="min-h-dvh bg-bg">
      <header className="bg-navy-grad px-5 pb-10 pt-[max(24px,env(safe-area-inset-top))] text-white">
        <div className="mx-auto max-w-xl">
          <Logo dark className="h-9" />
          <p className="mt-5 text-sm uppercase tracking-[.16em] text-white/60">{info.data.org}</p>
          <h1 className="mt-1 text-2xl font-semibold">{kind === 'pass' ? 'Gate pass request' : 'Item request'}</h1>
          <p className="mt-1 text-white/70">{kind === 'pass' ? 'Fill in your visitor’s details at least 24 hours before the visit. The office manager arranges the gate pass.' : 'Tell the office manager what you need — what, why, when, how many and the specs.'}</p>
        </div>
      </header>
      <div className="mx-auto -mt-6 max-w-xl px-4 pb-10">
        {ref ? (
          <Card className="p-8 text-center">
            <CheckCircle2 className="mx-auto h-14 w-14 text-ok" />
            <h2 className="mt-3 text-xl font-semibold">Sent — thank you!</h2>
            <p className="mt-1 text-muted">Your reference is <b className="text-ink">{ref}</b>. The office manager has been notified.</p>
            <Button className="mt-6" variant="secondary" onClick={() => { setRef(null); setD(kind === 'pass' ? { ...d, visitor_name: '', id_number: '', visit_reason: '' } : { ...d, title: '', specs: '', reason: '', link: '' }); }}>Send another</Button>
          </Card>
        ) : (
          <form onSubmit={(e) => void submit(e)} className="space-y-4">
            {kind === 'pass' ? (
              <>
                <Section title="You (host)">
                  <Field label="Your name *"><Input required name="host_name" autoComplete="name" value={d.host_name ?? ''} onChange={set('host_name')} /></Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Team / department"><Input value={d.host_team ?? ''} onChange={set('host_team')} /></Field>
                    <Field label="Your mobile"><Input type="tel" name="host_phone" autoComplete="tel" value={d.host_phone ?? ''} onChange={set('host_phone')} /></Field>
                  </div>
                  <Field label="Your email"><Input type="email" name="host_email" autoComplete="email" value={d.host_email ?? ''} onChange={set('host_email')} /></Field>
                </Section>
                <Section title="Visitor">
                  <Field label="Visitor full name (as on ID) *"><Input required name="visitor_name" autoComplete="off" value={d.visitor_name ?? ''} onChange={set('visitor_name')} /></Field>
                  <div className="grid grid-cols-[140px_1fr] gap-3">
                    <Field label="ID type"><Select value={d.id_type} onChange={set('id_type')}><option value="emirates_id">Emirates ID</option><option value="passport">Passport</option><option value="other">Other</option></Select></Field>
                    <Field label="ID / passport no. *"><Input required value={d.id_number ?? ''} onChange={set('id_number')} placeholder={d.id_type === 'emirates_id' ? '784-XXXX-XXXXXXX-X' : ''} /></Field>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Nationality"><Input value={d.nationality ?? ''} onChange={set('nationality')} /></Field>
                    <Field label="Company"><Input value={d.company ?? ''} onChange={set('company')} /></Field>
                    <Field label="Occupation / job title"><Input value={d.occupation ?? ''} onChange={set('occupation')} /></Field>
                    <Field label="Visitor mobile"><Input type="tel" value={d.phone ?? ''} onChange={set('phone')} /></Field>
                    <Field label="Visitor email"><Input type="email" value={d.email ?? ''} onChange={set('email')} /></Field>
                    <Field label="Car plate (if driving)"><Input value={d.vehicle_plate ?? ''} onChange={set('vehicle_plate')} /></Field>
                  </div>
                </Section>
                <Section title="Visit">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-3 sm:col-span-1"><Field label="Date *"><Input required type="date" value={d.visit_date ?? ''} onChange={set('visit_date')} /></Field></div>
                    <Field label="Arrival"><Input type="time" value={d.arrival_time ?? ''} onChange={set('arrival_time')} /></Field>
                    <Field label="Leaving"><Input type="time" value={d.departure_time ?? ''} onChange={set('departure_time')} /></Field>
                  </div>
                  <Field label="Reason for visit *"><Textarea required value={d.visit_reason ?? ''} onChange={set('visit_reason')} rows={2} placeholder="e.g. Interview for Tooling Technician, supplier meeting, training…" /></Field>
                  <Field label="Laptops / tools / equipment brought in"><Input value={d.equipment ?? ''} onChange={set('equipment')} /></Field>
                  <div>
                    <div className="mb-2 flex items-center justify-between"><span className="text-sm font-semibold">Other visitors in the same group</span>
                      <Button type="button" size="sm" variant="soft" icon={<Plus className="h-4 w-4" />} onClick={() => setExtra([...extra, { name: '', id_number: '' }])}>Add</Button></div>
                    {extra.map((x, i) => (
                      <div key={i} className="mb-2 flex gap-2">
                        <Input placeholder="Name" value={x.name} onChange={(e) => setExtra(extra.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)))} />
                        <Input placeholder="ID / passport" value={x.id_number} onChange={(e) => setExtra(extra.map((y, j) => (j === i ? { ...y, id_number: e.target.value } : y)))} />
                        <button type="button" className="px-2 text-muted" onClick={() => setExtra(extra.filter((_, j) => j !== i))} aria-label="Remove"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    ))}
                  </div>
                  <Field label="Anything else"><Textarea value={d.notes ?? ''} onChange={set('notes')} rows={2} /></Field>
                </Section>
                <label className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4 text-sm">
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-5 w-5 accent-navy-700" />
                  <span>I confirm these details are correct and the visitor agreed to share them for gate access at Dubai South.</span>
                </label>
              </>
            ) : (
              <>
                <Section title="What do you need?">
                  <Field label="Item *"><Input required name="title" value={d.title ?? ''} onChange={set('title')} placeholder='e.g. 27" monitor, office chair, USB-C dock' /></Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Category"><Select value={d.category} onChange={set('category')}>{REQ_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select></Field>
                    <Field label="How many *"><Input required inputMode="numeric" value={d.qty ?? '1'} onChange={set('qty')} /></Field>
                  </div>
                  <Field label="Specs" hint="model, size, colour, requirements"><Textarea value={d.specs ?? ''} onChange={set('specs')} rows={2} /></Field>
                  <Field label="Why do you need it?"><Textarea value={d.reason ?? ''} onChange={set('reason')} rows={2} /></Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Needed by"><Input type="date" value={d.needed_by ?? ''} onChange={set('needed_by')} /></Field>
                    <Field label="Priority"><Select value={d.priority} onChange={set('priority')}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></Select></Field>
                  </div>
                  <Field label="Link to a similar product" hint="optional"><Input type="url" value={d.link ?? ''} onChange={set('link')} placeholder="https://" /></Field>
                  <Field label="Estimated price per unit (AED)" hint="optional"><Input inputMode="decimal" value={d.est_unit_cost ?? ''} onChange={set('est_unit_cost')} /></Field>
                </Section>
                <Section title="About you">
                  <Field label="Your name *"><Input required name="requester_name" autoComplete="name" value={d.requester_name ?? ''} onChange={set('requester_name')} /></Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Department / team"><Input value={d.department ?? ''} onChange={set('department')} /></Field>
                    <Field label="Mobile"><Input type="tel" name="requester_phone" autoComplete="tel" value={d.requester_phone ?? ''} onChange={set('requester_phone')} /></Field>
                  </div>
                  <Field label="Email"><Input type="email" name="requester_email" autoComplete="email" value={d.requester_email ?? ''} onChange={set('requester_email')} /></Field>
                </Section>
              </>
            )}
            {err && <p className="rounded-xl bg-bad-soft px-4 py-3 text-sm font-medium text-bad-ink" role="alert">{err}</p>}
            <Button type="submit" size="xl" block loading={busy}>Send to the office manager</Button>
            <p className="text-center text-xs text-muted">Powered by RHero · RH Aero Systems</p>
          </form>
        )}
      </div>
    </div>
  );
}

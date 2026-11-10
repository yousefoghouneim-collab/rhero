import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Camera, Copy, FileBarChart2, Mail, MessageCircle, Printer, RefreshCw } from 'lucide-react';
import { useMe } from '../../auth/AuthProvider';
import { useReportPreview, useReports } from '../../lib/data';
import { supabase, errMsg } from '../../lib/supabase';
import { toast } from '../../lib/toast';
import { clock, orgNow, prettyDate } from '../../lib/time';
import { fmtQty } from '../../lib/stock';
import type { ReportData } from '../../lib/types';
import { Badge, Button, Card, EmptyState, ProgressBar, SectionTitle, Skeleton, cx } from '../../components/ui';
import { copyText, PageBody, PageTop, whatsappUrl } from './common';
import { ISSUE_KINDS } from '../cleaner/ReportIssue';

export function reportText(d: ReportData, tz: string) {
  const c = d.cleaning;
  const pct = c.total ? Math.round((c.done / c.total) * 100) : 0;
  const lines = [
    `RHero daily report — ${prettyDate(d.day, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}`,
    '',
    `🧹 Cleaning: ${c.done}/${c.total} tasks (${pct}%)${c.late ? ` · ${c.late} late` : ''}`,
    ...c.routines.map((r) => `${r.icon} ${r.name} ${r.done}/${r.total}${r.missed.length ? ` — missed: ${r.missed.map((m) => m.title).join(', ')}` : ' ✓'}`),
    c.cleaners.length ? `👥 ${c.cleaners.map((x) => `${x.name.split(' ')[0]} ${x.done}`).join(' · ')}` : '',
    '',
    `📦 Stock count: ${d.stock.counted}/${d.stock.total} items${d.stock.counted_by ? ` by ${d.stock.counted_by}` : ''}${d.stock.counted_at ? ` at ${clock(d.stock.counted_at, tz)}` : ''}`,
    d.stock.red.length ? `🔴 Order now (${d.stock.red.length}): ${d.stock.red.map((i) => `${i.name} (${fmtQty(i.store)} left)`).join(', ')}` : '🟢 Nothing urgent to order',
    d.stock.orange.length ? `🟠 Running low (${d.stock.orange.length}): ${d.stock.orange.map((i) => i.name).join(', ')}` : '',
    d.stock.used.length ? `📉 Used today: ${d.stock.used.slice(0, 6).map((u) => `${u.name} ${fmtQty(u.used)}`).join(', ')}` : '',
    '',
    `⚠️ Issues: ${d.issues.new.length} new · ${d.issues.open} open`,
    `🛒 Requests: ${d.requests.new_today} new · ${d.requests.pending} pending   🪪 Visitors today: ${d.passes.today}`,
  ];
  return lines.filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n');
}

export default function Reports() {
  const { day } = useParams();
  const reports = useReports();
  const nav = useNavigate();
  const list = reports.data ?? [];
  return (
    <div>
      <PageTop title="Daily reports" sub="Saved every day at the report time (default 4 PM)"
        back={day ? <button onClick={() => nav('/m/reports')} className="-ms-1 rounded-lg p-1.5 text-navy-700 hover:bg-navy-50 lg:hidden" aria-label="Back"><ArrowLeft className="h-6 w-6" /></button> : undefined} />
      <PageBody className="lg:grid lg:grid-cols-[300px_1fr] lg:gap-6">
        <div className={cx(day && 'hidden lg:block')}>
          {reports.isLoading ? <Skeleton className="h-80" /> : list.length === 0 ? <EmptyState icon={<FileBarChart2 className="h-8 w-8" />} title="No reports yet" body="The first report is created today at the report time." /> : (
            <Card className="divide-y divide-line overflow-hidden">
              {list.map((r) => {
                const c = r.data.cleaning;
                const pct = c.total ? c.done / c.total : 0;
                return (
                  <Link key={r.id} to={`/m/reports/${r.day}`} className={cx('block px-4 py-3 hover:bg-sunken/60', r.day === day && 'bg-navy-50')}>
                    <div className="flex items-center justify-between"><p className="font-semibold">{prettyDate(r.day, { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                      <span className="flex gap-1.5">{r.data.stock.red.length > 0 && <Badge tone="bad">{r.data.stock.red.length} order</Badge>}</span></div>
                    <div className="mt-1.5 flex items-center gap-2"><ProgressBar value={pct} height="h-1.5" bar={pct >= 1 ? 'bg-ok' : 'bg-navy-700'} /><span className="text-xs font-semibold tnum">{Math.round(pct * 100)}%</span></div>
                  </Link>
                );
              })}
            </Card>
          )}
        </div>
        <div className={cx(!day && 'hidden lg:block')}>
          {day ? <ReportView day={day} /> : <EmptyState title="Pick a day" body="Choose a report on the left." />}
        </div>
      </PageBody>
    </div>
  );
}

function ReportView({ day }: { day: string }) {
  const { org } = useMe();
  const qc = useQueryClient();
  const reports = useReports();
  const saved = (reports.data ?? []).find((r) => r.day === day);
  const today = orgNow(org.timezone).date;
  const preview = useReportPreview(day, !saved && !reports.isLoading);
  const d = saved?.data ?? preview.data;
  const text = useMemo(() => (d ? reportText(d, org.timezone) : ''), [d, org.timezone]);
  const snapshot = async () => {
    const { error } = await supabase.rpc('rh_save_report', { p_day: day });
    if (error) return toast(errMsg(error), 'bad');
    toast('Report saved');
    void qc.invalidateQueries({ queryKey: ['reports'] });
  };
  if (reports.isLoading || (!saved && preview.isLoading)) return <Skeleton className="h-96" />;
  if (!d) return <EmptyState title="No report for this day" />;
  const c = d.cleaning;
  const pct = c.total ? Math.round((c.done / c.total) * 100) : 0;
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wider text-muted">{saved ? `Saved ${clock(saved.created_at, org.timezone)}` : 'Live preview — not saved yet'}</p>
            <h2 className="text-xl font-semibold">{prettyDate(day, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</h2>
          </div>
          <div className="flex flex-wrap gap-2 no-print">
            <a href={whatsappUrl(text)} target="_blank" rel="noreferrer"><Button size="sm" variant="secondary" icon={<MessageCircle className="h-4 w-4" />}>WhatsApp</Button></a>
            <a href={`mailto:?subject=${encodeURIComponent(`RHero daily report — ${day}`)}&body=${encodeURIComponent(text)}`}><Button size="sm" variant="secondary" icon={<Mail className="h-4 w-4" />}>Email</Button></a>
            <Button size="sm" variant="secondary" icon={<Copy className="h-4 w-4" />} onClick={async () => { await copyText(text); toast('Report copied'); }}>Copy</Button>
            <Button size="sm" variant="secondary" icon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>PDF</Button>
            {day === today && <Button size="sm" variant="soft" icon={saved ? <RefreshCw className="h-4 w-4" /> : <Camera className="h-4 w-4" />} onClick={() => void snapshot()}>{saved ? 'Update' : 'Save now'}</Button>}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl bg-sunken p-3"><p className="text-[12px] font-semibold uppercase text-muted">Cleaning</p><p className="text-2xl font-semibold tnum">{pct}%</p><p className="text-[12px] text-muted">{c.done}/{c.total} tasks{c.late ? ` · ${c.late} late` : ''}</p></div>
          <div className="rounded-2xl bg-sunken p-3"><p className="text-[12px] font-semibold uppercase text-muted">Stock count</p><p className="text-2xl font-semibold tnum">{d.stock.counted}/{d.stock.total}</p><p className="text-[12px] text-muted">{d.stock.counted_at ? clock(d.stock.counted_at, org.timezone) : 'not done'}</p></div>
          <div className="rounded-2xl bg-bad-soft p-3"><p className="text-[12px] font-semibold uppercase text-bad-ink">Order now</p><p className="text-2xl font-semibold text-bad tnum">{d.stock.red.length}</p></div>
          <div className="rounded-2xl bg-warn-soft p-3"><p className="text-[12px] font-semibold uppercase text-warn-ink">Running low</p><p className="text-2xl font-semibold text-warn tnum">{d.stock.orange.length}</p></div>
        </div>
      </Card>

      <div>
        <SectionTitle>Cleaning rounds</SectionTitle>
        <Card className="divide-y divide-line">
          {c.routines.map((r) => (
            <div key={r.id} className="p-4">
              <div className="flex items-center gap-3">
                <span className="text-xl">{r.icon}</span>
                <p className="flex-1 font-semibold">{r.name} <span className="font-normal text-muted">· {r.start}–{r.end}</span></p>
                <Badge tone={r.done >= r.total ? 'ok' : 'warn'}>{r.done}/{r.total}</Badge>
              </div>
              {(r.first_done || r.late > 0) && <p className="mt-1 ps-9 text-[13px] text-muted">{r.first_done ? `${clock(r.first_done, org.timezone)}–${clock(r.last_done, org.timezone)}` : ''}{r.late ? ` · ${r.late} done late` : ''}</p>}
              {r.missed.length > 0 && <ul className="mt-2 space-y-1 ps-9">{r.missed.map((m, i) => <li key={i} className="text-[14px] text-bad-ink">✗ {m.title}{m.area ? <span className="text-muted"> · {m.area}</span> : null}</li>)}</ul>}
            </div>
          ))}
          {c.cleaners.length > 0 && <div className="flex flex-wrap gap-2 p-4">{c.cleaners.map((x) => <Badge key={x.id} tone="navy">{x.name} · {x.done} tasks</Badge>)}</div>}
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <SectionTitle>🔴 Order now</SectionTitle>
          <Card className="divide-y divide-line">
            {d.stock.red.length === 0 ? <p className="p-4 text-sm text-ok-ink">Nothing urgent.</p> : d.stock.red.map((i) => (
              <div key={i.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[14px]"><span>{i.emoji} {i.name}</span><span className="text-bad tnum">{fmtQty(i.store)} left · need {fmtQty(i.need)}</span></div>
            ))}
          </Card>
        </div>
        <div>
          <SectionTitle>🟠 Running low</SectionTitle>
          <Card className="divide-y divide-line">
            {d.stock.orange.length === 0 ? <p className="p-4 text-sm text-ok-ink">All good.</p> : d.stock.orange.map((i) => (
              <div key={i.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[14px]"><span>{i.emoji} {i.name}</span><span className="text-warn-ink tnum">{fmtQty(i.store)} in store</span></div>
            ))}
          </Card>
        </div>
      </div>

      {d.stock.used.length > 0 && (
        <div>
          <SectionTitle>Used today (from the count)</SectionTitle>
          <Card className="flex flex-wrap gap-2 p-4">{d.stock.used.map((u, i) => <Badge key={i} tone="neutral">{u.emoji} {u.name} · {fmtQty(u.used)} {u.unit}</Badge>)}</Card>
        </div>
      )}

      <div>
        <SectionTitle>Issues & requests</SectionTitle>
        <Card className="p-4">
          {d.issues.new.length === 0 ? <p className="text-sm text-muted">No new issues. {d.issues.open} open in total.</p> : (
            <ul className="space-y-2">{d.issues.new.map((i, k) => <li key={k} className="text-[14px]">{ISSUE_KINDS.find((x) => x.kind === i.kind)?.emoji} {i.note ?? i.kind} <span className="text-muted">· {i.area ?? ''} · {i.by ?? ''} · {clock(i.at, org.timezone)}</span></li>)}</ul>
          )}
          <p className="mt-3 text-sm text-muted">Requests: {d.requests.new_today} new today, {d.requests.pending} pending · Visitors today: {d.passes.today}{d.passes.pending ? ` · ${d.passes.pending} passes pending` : ''}</p>
        </Card>
      </div>
    </div>
  );
}

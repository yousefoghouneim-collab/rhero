import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, BadgeCheck, CheckCircle2, ClipboardList, Clock, FileBarChart2, Package, ShoppingCart, Sparkles } from 'lucide-react';
import { useMe } from '../../auth/AuthProvider';
import { useCounts, useIssues, useItems, usePasses, useReports, useRequests, useTeam, type DayRoutine } from '../../lib/data';
import { useToday } from '../../lib/today';
import { ago, clock, hhmm, prettyDate } from '../../lib/time';
import { available, fmtQty, itemStatus, needQty, STATUS_RANK } from '../../lib/stock';
import { Avatar, Badge, Card, ProgressBar, ProgressRing, SectionTitle, Sheet, Skeleton, StatusPill, cx, statusText } from '../../components/ui';
import { PageBody, PageTop } from './common';
import { ISSUE_KINDS } from '../cleaner/ReportIssue';

export function roundTone(r: DayRoutine) {
  return r.state === 'done' ? 'ok' : r.state === 'active' ? 'navy' : r.state === 'overdue' ? 'warn' : 'neutral';
}
export function roundLabel(r: DayRoutine) {
  return r.state === 'done' ? 'Done' : r.state === 'active' ? 'In progress' : r.state === 'overdue' ? 'Not finished' : `Starts ${hhmm(r.start_time)}`;
}

export default function Dashboard() {
  const { me, org } = useMe();
  const { now, rounds, total, done, stock, loading, doneRows } = useToday();
  const items = useItems();
  const counts = useCounts(now.date);
  const issues = useIssues();
  const team = useTeam();
  const reqs = useRequests();
  const passes = usePasses();
  const reports = useReports();
  const [openRound, setOpenRound] = useState<DayRoutine | null>(null);

  const people = useMemo(() => new Map((team.data ?? []).map((p) => [p.id, p])), [team.data]);
  const counted = (items.data ?? []).filter((i) => i.active && i.last_counted_at);
  const red = counted.filter((i) => itemStatus(i) === 'red');
  const orange = counted.filter((i) => itemStatus(i) === 'orange');
  const toOrder = [...red, ...orange].sort((a, b) => STATUS_RANK[itemStatus(a)] - STATUS_RANK[itemStatus(b)] || needQty(b) - needQty(a)).slice(0, 7);
  const openIssues = (issues.data ?? []).filter((i) => i.status === 'open');
  const newReqs = (reqs.data ?? []).filter((r) => r.status === 'new');
  const visitsToday = (passes.data ?? []).filter((p) => p.visit_date === now.date && p.status !== 'rejected');
  const pendingPasses = (passes.data ?? []).filter((p) => p.status === 'pending');
  const todayReport = (reports.data ?? []).find((r) => r.day === now.date);
  const reportTime = org.settings.report_time ?? '16:00';
  const overdueTasks = rounds.filter((r) => r.state === 'overdue' && r.kind !== 'stock').reduce((s, r) => s + (r.total - r.doneCount), 0);
  const cleaners = (team.data ?? []).filter((p) => p.role === 'cleaner' && p.active);
  const pantryCounts = (counts.data ?? []);
  const lastCount = pantryCounts.reduce<string | null>((m, c) => (!m || c.counted_at > m ? c.counted_at : m), null);
  const countBy = lastCount ? people.get(pantryCounts.find((c) => c.counted_at === lastCount)?.counted_by ?? '')?.full_name : null;
  const stockRoutine = rounds.find((r) => r.kind === 'stock');

  // live activity feed
  const feed = useMemo(() => {
    const ev: { at: string; who?: string | null; color?: string | null; text: string; icon: string }[] = [];
    const taskTitle = new Map<string, { title: string; area: string | null }>();
    rounds.forEach((r) => r.tasks.forEach((t) => taskTitle.set(t.id, { title: t.title, area: t.area?.name ?? null })));
    doneRows.forEach((d) => {
      const t = taskTitle.get(d.task_id);
      const p = d.done_by ? people.get(d.done_by) : null;
      if (t) ev.push({ at: d.done_at, who: p?.full_name, color: p?.color, text: `${t.title}${t.area ? ` · ${t.area}` : ''}`, icon: '✓' });
    });
    const byPerson = new Map<string, { at: string; n: number }>();
    pantryCounts.forEach((c) => {
      const k = c.counted_by ?? '?';
      const cur = byPerson.get(k);
      byPerson.set(k, { at: !cur || c.counted_at > cur.at ? c.counted_at : cur.at, n: (cur?.n ?? 0) + 1 });
    });
    byPerson.forEach((v, k) => { const p = people.get(k); ev.push({ at: v.at, who: p?.full_name, color: p?.color, text: `Saved stock count · ${v.n} items`, icon: '📦' }); });
    (issues.data ?? []).filter((i) => i.created_at.slice(0, 10) >= now.date.slice(0, 10)).forEach((i) => {
      const p = i.reported_by ? people.get(i.reported_by) : null;
      const k = ISSUE_KINDS.find((x) => x.kind === i.kind);
      ev.push({ at: i.created_at, who: p?.full_name, color: p?.color, text: `Reported: ${i.note ?? i.kind}`, icon: k?.emoji ?? '⚠️' });
    });
    return ev.sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 12);
  }, [rounds, doneRows, people, pantryCounts, issues.data, now.date]);

  const greet = now.minutes < 12 * 60 ? 'Good morning' : now.minutes < 17 * 60 ? 'Good afternoon' : 'Good evening';

  return (
    <div>
      <PageTop title={`${greet}, ${me.full_name.split(' ')[0]}`} sub={`${prettyDate(now.date, { weekday: 'long', day: 'numeric', month: 'long' })} · ${now.hhmm} Dubai`} />
      <PageBody>
        {/* KPI tiles */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Link to="/m/cleaning" className="block">
            <Card className="flex h-full items-center gap-3 p-4">
              <ProgressRing value={total ? done / total : 0} size={60} stroke={6} bar={total && done >= total ? 'stroke-ok' : 'stroke-navy-700'}>
                <span className="text-[13px] font-bold tnum">{total ? Math.round((done / total) * 100) : 0}%</span>
              </ProgressRing>
              <div className="min-w-0">
                <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">Cleaning</p>
                <p className="text-lg font-semibold tnum leading-tight" data-testid="kpi-cleaning">{done}/{total}</p>
                <p className={cx('text-[12.5px]', overdueTasks ? 'font-semibold text-warn' : 'text-muted')}>{overdueTasks ? `${overdueTasks} overdue` : 'tasks today'}</p>
              </div>
            </Card>
          </Link>
          <Link to="/m/supply" className="block">
            <Card className="h-full p-4">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">Stock alerts</p>
              <div className="mt-1 flex items-end gap-4">
                <div><p className="text-3xl font-semibold text-bad tnum leading-none">{red.length}</p><p className="mt-1 text-[12px] font-semibold text-bad-ink">Order now</p></div>
                <div><p className="text-3xl font-semibold text-warn tnum leading-none">{orange.length}</p><p className="mt-1 text-[12px] font-semibold text-warn-ink">Running low</p></div>
              </div>
            </Card>
          </Link>
          <Link to="/m/inventory" className="block">
            <Card className="h-full p-4">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">Stock count</p>
              <p className="mt-1 text-lg font-semibold tnum"><span data-testid="kpi-stock">{stock.counted}/{stock.total}</span> <span className="text-sm font-normal text-muted">items</span></p>
              <p className="text-[12.5px] text-muted">{lastCount ? `${clock(lastCount, org.timezone)}${countBy ? ` · ${countBy.split(' ')[0]}` : ''}` : stockRoutine ? `Due by ${hhmm(stockRoutine.end_time)}` : 'Not scheduled today'}</p>
              <ProgressBar value={stock.total ? stock.counted / stock.total : 0} className="mt-2" height="h-1.5" bar={stock.counted >= stock.total ? 'bg-ok' : 'bg-navy-700'} />
            </Card>
          </Link>
          <Link to="/m/cleaning?tab=issues" className="block">
            <Card className="h-full p-4">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">Open issues</p>
              <p className={cx('mt-1 text-3xl font-semibold tnum leading-none', openIssues.length ? 'text-bad' : 'text-ok')} data-testid="kpi-issues">{openIssues.length}</p>
              <p className="mt-1 truncate text-[12.5px] text-muted">{openIssues[0]?.note ?? 'All clear'}</p>
            </Card>
          </Link>
        </div>

        <div className="mt-2 grid gap-x-6 lg:grid-cols-[1.35fr_1fr]">
          <div>
            <SectionTitle action={<Link to="/m/cleaning" className="text-sm font-semibold text-navy-600">All tasks</Link>}>Today's rounds</SectionTitle>
            {loading ? <Skeleton className="h-48" /> : (
              <Card className="divide-y divide-line">
                {rounds.length === 0 && <p className="p-5 text-muted">No rounds scheduled today.</p>}
                {rounds.map((r) => (
                  <button key={r.id} onClick={() => (r.kind === 'stock' ? undefined : setOpenRound(r))} className="flex w-full items-center gap-3 p-3.5 text-start hover:bg-sunken/70">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sunken text-xl">{r.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-semibold">{r.name}</p>
                        <Badge tone={roundTone(r)} dot={r.state === 'active'}>{roundLabel(r)}</Badge>
                      </div>
                      <div className="mt-1.5 flex items-center gap-3">
                        <ProgressBar value={r.total ? r.doneCount / r.total : 0} height="h-1.5" bar={r.state === 'done' ? 'bg-ok' : r.state === 'overdue' ? 'bg-warn' : 'bg-navy-700'} />
                        <span className="shrink-0 text-[13px] font-semibold tnum">{r.doneCount}/{r.total}</span>
                      </div>
                      <p className="mt-1 text-[12.5px] text-muted tnum">{hhmm(r.start_time)}–{hhmm(r.end_time)}{r.lateCount ? ` · ${r.lateCount} late` : ''}</p>
                    </div>
                  </button>
                ))}
              </Card>
            )}

            <SectionTitle action={<Link to="/m/supply" className="flex items-center gap-1 text-sm font-semibold text-navy-600">To supply <ArrowRight className="h-4 w-4" /></Link>}>Needs ordering</SectionTitle>
            <Card>
              {toOrder.length === 0 ? (
                <div className="flex items-center gap-3 p-5 text-ok-ink"><CheckCircle2 className="h-5 w-5" /> Everything is well stocked.</div>
              ) : (
                <div className="divide-y divide-line">
                  {toOrder.map((i) => {
                    const st = itemStatus(i);
                    return (
                      <div key={i.id} className="flex items-center gap-3 px-3.5 py-3">
                        <span className="text-xl">{i.emoji ?? '📦'}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{i.name}</p>
                          <p className="text-[12.5px] text-muted">Available: <span className={cx('font-semibold', statusText[st])}>{fmtQty(available(i))}</span> {i.unit} · need {fmtQty(needQty(i))}</p>
                        </div>
                        <StatusPill status={st} />
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          <div>
            <SectionTitle><span className="flex items-center gap-2">Live activity <span className="h-2 w-2 rounded-full bg-ok animate-pulse2" /></span></SectionTitle>
            <Card className="p-1.5">
              {feed.length === 0 ? <p className="p-4 text-sm text-muted">Nothing yet today — activity from the cleaners appears here instantly.</p> : (
                <ul>
                  {feed.map((e, idx) => (
                    <li key={idx} className="flex items-start gap-3 rounded-xl px-2.5 py-2 animate-fadeup">
                      {e.who ? <Avatar name={e.who} color={e.color} size={30} /> : <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-sunken">{e.icon}</span>}
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] leading-snug"><span className="font-semibold">{e.who?.split(' ')[0] ?? 'Someone'}</span> <span className="text-muted">{e.icon === '✓' ? 'completed' : ''}</span> {e.text}</p>
                      </div>
                      <span className="shrink-0 text-xs text-muted tnum">{clock(e.at, org.timezone)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <SectionTitle action={<Link to="/m/team" className="text-sm font-semibold text-navy-600">Team</Link>}>Cleaners</SectionTitle>
            <Card className="divide-y divide-line">
              {cleaners.length === 0 && <div className="p-4 text-sm text-muted">No cleaners yet. <Link to="/m/team" className="font-semibold text-navy-600">Add your two cleaners</Link> with their phone numbers.</div>}
              {cleaners.map((c) => {
                const n = doneRows.filter((d) => d.done_by === c.id).length;
                const active = c.last_seen_at && Date.now() - new Date(c.last_seen_at).getTime() < 15 * 60_000;
                return (
                  <div key={c.id} className="flex items-center gap-3 p-3.5">
                    <div className="relative"><Avatar name={c.full_name} color={c.color} size={38} />
                      <span className={cx('absolute -bottom-0.5 -end-0.5 h-3 w-3 rounded-full border-2 border-white', active ? 'bg-ok' : 'bg-line')} /></div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{c.full_name}</p>
                      <p className="text-[12.5px] text-muted">{active ? 'Active now' : `Last seen ${ago(c.last_seen_at)}`}</p>
                    </div>
                    <div className="text-end"><p className="text-lg font-semibold tnum leading-none">{n}</p><p className="text-[11px] text-muted">tasks today</p></div>
                  </div>
                );
              })}
            </Card>

            <SectionTitle>Requests & visitors</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <Link to="/m/requests"><Card className="h-full p-4">
                <ClipboardList className="h-5 w-5 text-navy-400" />
                <p className="mt-2 text-2xl font-semibold tnum leading-none">{newReqs.length}</p>
                <p className="mt-1 text-[13px] text-muted">new item requests</p>
              </Card></Link>
              <Link to="/m/passes"><Card className="h-full p-4">
                <BadgeCheck className="h-5 w-5 text-navy-400" />
                <p className="mt-2 text-2xl font-semibold tnum leading-none">{visitsToday.length}</p>
                <p className="mt-1 text-[13px] text-muted">visits today{pendingPasses.length ? ` · ${pendingPasses.length} pending` : ''}</p>
              </Card></Link>
            </div>

            <SectionTitle>Daily report</SectionTitle>
            <Link to={`/m/reports/${now.date}`}>
              <Card className="flex items-center gap-3 p-4">
                <span className={cx('flex h-11 w-11 items-center justify-center rounded-xl', todayReport ? 'bg-ok-soft text-ok' : 'bg-navy-50 text-navy-600')}>
                  {todayReport ? <FileBarChart2 className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{todayReport ? "Today's report is ready" : `Sent to you at ${reportTime}`}</p>
                  <p className="text-[13px] text-muted">{todayReport ? `Generated ${clock(todayReport.created_at, org.timezone)} · cleaning + stock + issues` : 'Tap for a live preview of today so far'}</p>
                </div>
                <ArrowRight className="h-5 w-5 text-navy-300" />
              </Card>
            </Link>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { to: '/m/count/stationery', icon: Package, label: 'Count stationery' },
            { to: '/m/supply', icon: ShoppingCart, label: 'Create order' },
            { to: '/m/cleaning?tab=setup', icon: Sparkles, label: 'Edit routines' },
            { to: '/m/cleaning?tab=issues', icon: AlertTriangle, label: 'Issues' },
          ].map((a) => (
            <Link key={a.to} to={a.to}><Card className="flex items-center gap-2.5 p-3.5 text-[14px] font-semibold"><a.icon className="h-5 w-5 text-navy-500" />{a.label}</Card></Link>
          ))}
        </div>
      </PageBody>

      <RoundSheet round={openRound} onClose={() => setOpenRound(null)} />
    </div>
  );
}

export function RoundSheet({ round, onClose }: { round: DayRoutine | null; onClose: () => void }) {
  const { org } = useMe();
  const team = useTeam();
  const people = useMemo(() => new Map((team.data ?? []).map((p) => [p.id, p])), [team.data]);
  if (!round) return null;
  return (
    <Sheet open onClose={onClose} title={<span>{round.icon} {round.name}</span>}>
      <p className="mb-3 text-sm text-muted tnum">{hhmm(round.start_time)}–{hhmm(round.end_time)} · {round.doneCount}/{round.total} done{round.description ? ` · ${round.description}` : ''}</p>
      <div className="divide-y divide-line rounded-2xl border border-line">
        {round.tasks.map((t) => {
          const p = t.doneRow?.done_by ? people.get(t.doneRow.done_by) : null;
          return (
            <div key={t.id} className="flex items-center gap-3 px-3.5 py-3">
              <span className={cx('flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs', t.done ? 'bg-ok text-white' : 'border-2 border-line')}>{t.done ? '✓' : ''}</span>
              <div className="min-w-0 flex-1">
                <p className={cx('text-[15px]', t.done && 'text-muted')}>{t.title}</p>
                <p className="text-[12.5px] text-muted">{t.area ? `${t.area.icon} ${t.area.name}` : ''}{t.doneRow ? ` · ${clock(t.doneRow.done_at, org.timezone)}${p ? ` by ${p.full_name.split(' ')[0]}` : ''}` : ''}</p>
              </div>
              {t.late && <Badge tone="warn">Late</Badge>}
              {!t.done && round.state === 'overdue' && <Badge tone="bad">Missed</Badge>}
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}

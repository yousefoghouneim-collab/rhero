import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, CheckCircle2, ImageIcon, Pencil, Plus, Trash2 } from 'lucide-react';
import { useMe } from '../../auth/AuthProvider';
import { useAreas, useIssues, useReports, useRoutines, useTasks, useTeam, type DayRoutine } from '../../lib/data';
import { useToday } from '../../lib/today';
import { supabase, errMsg } from '../../lib/supabase';
import { toast } from '../../lib/toast';
import { ago, clock, hhmm, prettyDate, WEEKDAYS } from '../../lib/time';
import type { Area, Issue, Routine, RoutineKind, Task } from '../../lib/types';
import { Badge, Button, Card, CheckCircle, EmptyState, Field, Input, ProgressBar, SectionTitle, Segmented, Select, Sheet, Skeleton, Textarea, Toggle, cx, useConfirm } from '../../components/ui';
import { PageBody, PageTop } from './common';
import { roundLabel, roundTone } from './Dashboard';
import { ISSUE_KINDS } from '../cleaner/ReportIssue';

type Tab = 'today' | 'history' | 'issues' | 'setup';

export default function Cleaning() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'today';
  const issues = useIssues();
  const open = (issues.data ?? []).filter((i) => i.status === 'open').length;
  return (
    <div>
      <PageTop title="Cleaning" sub="Routines, live progress, issues" />
      <PageBody>
        <Segmented<Tab> value={tab} onChange={(t) => setParams(t === 'today' ? {} : { tab: t }, { replace: true })}
          options={[{ value: 'today', label: 'Today' }, { value: 'history', label: 'History' }, { value: 'issues', label: 'Issues', count: open || undefined }, { value: 'setup', label: 'Setup' }]} />
        <div className="mt-4">
          {tab === 'today' && <TodayTab />}
          {tab === 'history' && <HistoryTab />}
          {tab === 'issues' && <IssuesTab />}
          {tab === 'setup' && <SetupTab />}
        </div>
      </PageBody>
    </div>
  );
}

function TodayTab() {
  const { org } = useMe();
  const { rounds, loading, toggle, now } = useToday();
  const team = useTeam();
  const people = useMemo(() => new Map((team.data ?? []).map((p) => [p.id, p])), [team.data]);
  const [openId, setOpenId] = useState<string | null>(null);
  useEffect(() => {
    if (!openId && rounds.length) setOpenId((rounds.find((r) => r.state === 'active') ?? rounds.find((r) => r.state === 'overdue') ?? rounds[0]).id);
  }, [rounds, openId]);
  if (loading) return <Skeleton className="h-64" />;
  if (!rounds.length) return <EmptyState title="No rounds today" body="Rounds run on the days set in Setup." />;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">{prettyDate(now.date, { weekday: 'long', day: 'numeric', month: 'long' })} — tap a task to mark it done on behalf of the team.</p>
      {rounds.map((r) => (
        <Card key={r.id}>
          <button className="flex w-full items-center gap-3 p-4 text-start" onClick={() => setOpenId(openId === r.id ? null : r.id)}>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sunken text-xl">{r.icon}</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{r.name}</p><Badge tone={roundTone(r)} dot={r.state === 'active'}>{roundLabel(r)}</Badge></div>
              <div className="mt-1.5 flex items-center gap-3">
                <ProgressBar value={r.total ? r.doneCount / r.total : 0} height="h-1.5" bar={r.state === 'done' ? 'bg-ok' : r.state === 'overdue' ? 'bg-warn' : 'bg-navy-700'} />
                <span className="text-[13px] font-semibold tnum">{r.doneCount}/{r.total}</span>
              </div>
              <p className="mt-1 text-[12.5px] text-muted tnum">{hhmm(r.start_time)}–{hhmm(r.end_time)}{r.description ? ` · ${r.description}` : ''}</p>
            </div>
          </button>
          {openId === r.id && r.kind !== 'stock' && (
            <div className="divide-y divide-line border-t border-line">
              {r.tasks.map((t) => {
                const p = t.doneRow?.done_by ? people.get(t.doneRow.done_by) : null;
                return (
                  <button key={t.id} onClick={() => toggle(t)} className="flex w-full items-center gap-3 px-4 py-3 text-start hover:bg-sunken/60">
                    <CheckCircle checked={t.done} pending={t.pending} size={26} />
                    <div className="min-w-0 flex-1">
                      <p className={cx('text-[15px]', t.done && 'text-muted line-through decoration-ok/40')}>{t.title}</p>
                      <p className="text-[12.5px] text-muted">{t.area ? `${t.area.icon} ${t.area.name}` : ''}{t.doneRow ? ` · ${clock(t.doneRow.done_at, org.timezone)}${p ? ` · ${p.full_name}` : ''}` : ''}</p>
                    </div>
                    {t.late && <Badge tone="warn">Late</Badge>}
                    {!t.done && r.state === 'overdue' && <Badge tone="bad">Missed</Badge>}
                  </button>
                );
              })}
            </div>
          )}
          {openId === r.id && r.kind === 'stock' && (
            <div className="border-t border-line p-4 text-sm"><Link to="/m/inventory" className="font-semibold text-navy-600">Open inventory →</Link> {r.doneCount}/{r.total} items counted today.</div>
          )}
        </Card>
      ))}
    </div>
  );
}

function HistoryTab() {
  const reports = useReports();
  if (reports.isLoading) return <Skeleton className="h-64" />;
  const list = reports.data ?? [];
  if (!list.length) return <EmptyState title="No history yet" body="A report is saved every day at 4 PM — history builds up from there." />;
  const avg = Math.round((list.reduce((s, r) => s + (r.data.cleaning.total ? r.data.cleaning.done / r.data.cleaning.total : 0), 0) / list.length) * 100);
  return (
    <div className="space-y-3">
      <Card className="grid grid-cols-3 gap-3 p-4">
        <div><p className="text-[12px] font-semibold uppercase text-muted">Avg completion</p><p className="text-2xl font-semibold tnum">{avg}%</p></div>
        <div><p className="text-[12px] font-semibold uppercase text-muted">Days tracked</p><p className="text-2xl font-semibold tnum">{list.length}</p></div>
        <div><p className="text-[12px] font-semibold uppercase text-muted">Missed tasks</p><p className="text-2xl font-semibold tnum">{list.reduce((s, r) => s + (r.data.cleaning.total - r.data.cleaning.done), 0)}</p></div>
      </Card>
      <Card className="divide-y divide-line">
        {list.map((r) => {
          const pct = r.data.cleaning.total ? r.data.cleaning.done / r.data.cleaning.total : 0;
          return (
            <Link key={r.id} to={`/m/reports/${r.day}`} className="flex items-center gap-3 p-3.5 hover:bg-sunken/60">
              <div className="w-24 shrink-0"><p className="font-semibold">{prettyDate(r.day, { weekday: 'short', day: 'numeric', month: 'short' })}</p></div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3"><ProgressBar value={pct} height="h-2" bar={pct >= 1 ? 'bg-ok' : pct >= 0.9 ? 'bg-navy-700' : 'bg-warn'} /><span className="w-12 text-end text-sm font-semibold tnum">{Math.round(pct * 100)}%</span></div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {r.data.cleaning.routines.map((x) => (
                    <span key={x.id} className={cx('rounded-md px-1.5 py-0.5 text-[11px] font-semibold', x.done >= x.total ? 'bg-ok-soft text-ok-ink' : 'bg-warn-soft text-warn-ink')}>{x.icon} {x.done}/{x.total}</span>
                  ))}
                  <span className={cx('rounded-md px-1.5 py-0.5 text-[11px] font-semibold', r.data.stock.counted >= r.data.stock.total ? 'bg-ok-soft text-ok-ink' : 'bg-bad-soft text-bad-ink')}>📦 {r.data.stock.counted}/{r.data.stock.total}</span>
                </div>
              </div>
            </Link>
          );
        })}
      </Card>
    </div>
  );
}

export function useSignedUrl(path: string | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (!path) { setUrl(null); return; }
    supabase.storage.from('rhero').createSignedUrl(path, 3600).then(({ data }) => { if (alive) setUrl(data?.signedUrl ?? null); });
    return () => { alive = false; };
  }, [path]);
  return url;
}

function IssueRow({ i, onOpen }: { i: Issue; onOpen: () => void }) {
  const areas = useAreas();
  const team = useTeam();
  const k = ISSUE_KINDS.find((x) => x.kind === i.kind)!;
  const a = (areas.data ?? []).find((x) => x.id === i.area_id);
  const p = (team.data ?? []).find((x) => x.id === i.reported_by);
  return (
    <button onClick={onOpen} className="flex w-full items-center gap-3 p-3.5 text-start hover:bg-sunken/60">
      <span className="text-2xl">{k.emoji}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{i.note || i.kind}</p>
        <p className="text-[12.5px] text-muted">{a ? `${a.icon} ${a.name} · ` : ''}{p?.full_name ?? ''} · {ago(i.created_at)}</p>
      </div>
      {i.photo_path && <ImageIcon className="h-4 w-4 text-navy-300" />}
      <Badge tone={i.status === 'open' ? 'warn' : 'ok'}>{i.status === 'open' ? 'Open' : 'Resolved'}</Badge>
    </button>
  );
}

function IssuesTab() {
  const issues = useIssues();
  const qc = useQueryClient();
  const [sel, setSel] = useState<Issue | null>(null);
  const url = useSignedUrl(sel?.photo_path ?? null);
  const list = issues.data ?? [];
  const open = list.filter((i) => i.status === 'open');
  const closed = list.filter((i) => i.status !== 'open').slice(0, 30);
  const setStatus = async (i: Issue, status: 'open' | 'resolved') => {
    const { error } = await supabase.from('rh_issues').update({ status, resolved_at: status === 'resolved' ? new Date().toISOString() : null }).eq('id', i.id);
    if (error) return toast(errMsg(error), 'bad');
    toast(status === 'resolved' ? 'Marked as resolved' : 'Reopened');
    setSel(null);
    void qc.invalidateQueries({ queryKey: ['issues'] });
  };
  if (issues.isLoading) return <Skeleton className="h-48" />;
  return (
    <div>
      <SectionTitle>Open ({open.length})</SectionTitle>
      {open.length === 0 ? <EmptyState icon={<CheckCircle2 className="h-8 w-8" />} title="No open issues" body="When a cleaner reports a problem (out of soap, something broken, a spill) it shows up here instantly." /> : (
        <Card className="divide-y divide-line">{open.map((i) => <IssueRow key={i.id} i={i} onOpen={() => setSel(i)} />)}</Card>
      )}
      {closed.length > 0 && (<><SectionTitle>Resolved</SectionTitle><Card className="divide-y divide-line">{closed.map((i) => <IssueRow key={i.id} i={i} onOpen={() => setSel(i)} />)}</Card></>)}
      <Sheet open={!!sel} onClose={() => setSel(null)} title="Issue"
        footer={sel && (sel.status === 'open'
          ? <Button variant="success" block icon={<CheckCircle2 className="h-5 w-5" />} onClick={() => void setStatus(sel, 'resolved')}>Mark resolved</Button>
          : <Button variant="secondary" block onClick={() => void setStatus(sel, 'open')}>Reopen</Button>)}>
        {sel && (
          <div className="space-y-3">
            <IssueRow i={sel} onOpen={() => undefined} />
            {sel.photo_path && (url ? <img src={url} alt="Issue photo" className="w-full rounded-2xl border border-line" /> : <Skeleton className="h-56" />)}
            {sel.resolved_at && <p className="text-sm text-muted">Resolved {ago(sel.resolved_at)}</p>}
          </div>
        )}
      </Sheet>
    </div>
  );
}

// ---------------------------------------------------------------------- Setup
function SetupTab() {
  const routines = useRoutines();
  const tasks = useTasks();
  const areas = useAreas();
  const [editR, setEditR] = useState<Partial<Routine> | null>(null);
  const [editT, setEditT] = useState<Partial<Task> | null>(null);
  const [editA, setEditA] = useState<Partial<Area> | null>(null);
  const [openR, setOpenR] = useState<string | null>(null);
  const qc = useQueryClient();
  const { ask, node } = useConfirm();

  const move = async (list: Task[], idx: number, dir: -1 | 1) => {
    const a = list[idx]; const b = list[idx + dir];
    if (!a || !b) return;
    await Promise.all([
      supabase.from('rh_tasks').update({ sort: b.sort }).eq('id', a.id),
      supabase.from('rh_tasks').update({ sort: a.sort }).eq('id', b.id),
    ]);
    void qc.invalidateQueries({ queryKey: ['tasks'] });
  };
  const delTask = async (t: Task) => {
    if (!(await ask('Delete this task?', { body: `"${t.title}" will be removed from the routine. Past completions stay in the history.`, confirm: 'Delete', danger: true }))) return;
    const { error } = await supabase.from('rh_tasks').update({ active: false }).eq('id', t.id);
    if (error) return toast(errMsg(error), 'bad');
    void qc.invalidateQueries({ queryKey: ['tasks'] });
    toast('Task removed');
  };

  if (routines.isLoading || tasks.isLoading) return <Skeleton className="h-64" />;
  return (
    <div>
      <p className="text-sm text-muted">Changes apply instantly on the cleaners' phones. Times are Dubai time.</p>
      <SectionTitle action={<Button size="sm" variant="soft" icon={<Plus className="h-4 w-4" />} onClick={() => setEditR({ name: '', icon: '🧹', kind: 'cleaning', start_time: '10:00', end_time: '10:30', days: [1, 2, 3, 4, 5], active: true })}>Routine</Button>}>Routines</SectionTitle>
      <div className="space-y-3">
        {(routines.data ?? []).map((r) => {
          const list = (tasks.data ?? []).filter((t) => t.routine_id === r.id && t.active).sort((a, b) => a.sort - b.sort);
          return (
            <Card key={r.id} className={cx(!r.active && 'opacity-60')}>
              <div className="flex items-center gap-3 p-4">
                <button className="flex min-w-0 flex-1 items-center gap-3 text-start" onClick={() => setOpenR(openR === r.id ? null : r.id)}>
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sunken text-xl">{r.icon}</span>
                  <div className="min-w-0">
                    <p className="font-semibold">{r.name} {!r.active && <Badge>Paused</Badge>}</p>
                    <p className="text-[13px] text-muted tnum">{hhmm(r.start_time)}–{hhmm(r.end_time)} · {r.days.length === 7 ? 'Every day' : r.days.map((d) => WEEKDAYS[d - 1].short).join(' ')} · {r.kind === 'stock' ? 'Stock count' : `${list.length} tasks`}</p>
                  </div>
                </button>
                <Button size="sm" variant="ghost" icon={<Pencil className="h-4 w-4" />} onClick={() => setEditR(r)}>Edit</Button>
              </div>
              {openR === r.id && r.kind !== 'stock' && (
                <div className="border-t border-line">
                  {list.map((t, idx) => {
                    const a = (areas.data ?? []).find((x) => x.id === t.area_id);
                    return (
                      <div key={t.id} className="flex items-center gap-2 border-b border-line px-4 py-2.5 last:border-0">
                        <div className="flex flex-col">
                          <button className="text-navy-300 hover:text-navy-700 disabled:opacity-20" disabled={idx === 0} onClick={() => void move(list, idx, -1)} aria-label="Move up"><ArrowUp className="h-4 w-4" /></button>
                          <button className="text-navy-300 hover:text-navy-700 disabled:opacity-20" disabled={idx === list.length - 1} onClick={() => void move(list, idx, 1)} aria-label="Move down"><ArrowDown className="h-4 w-4" /></button>
                        </div>
                        <button className="min-w-0 flex-1 text-start" onClick={() => setEditT(t)}>
                          <p className="text-[15px]">{t.title}</p>
                          <p className="text-[12.5px] text-muted">{a ? `${a.icon} ${a.name}` : 'No area'}{t.days?.length ? ` · ${t.days.map((d) => WEEKDAYS[d - 1].short).join(' ')} only` : ''}{Object.keys(t.title_i18n ?? {}).length ? ' · translated' : ''}</p>
                        </button>
                        <button className="p-2 text-muted hover:text-bad" onClick={() => void delTask(t)} aria-label="Delete task"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    );
                  })}
                  <div className="p-3"><Button size="sm" variant="soft" block icon={<Plus className="h-4 w-4" />} onClick={() => setEditT({ routine_id: r.id, title: '', area_id: null, days: null, active: true })}>Add task</Button></div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <SectionTitle action={<Button size="sm" variant="soft" icon={<Plus className="h-4 w-4" />} onClick={() => setEditA({ name: '', icon: '🧹', active: true })}>Area</Button>}>Areas</SectionTitle>
      <Card className="flex flex-wrap gap-2 p-3">
        {(areas.data ?? []).map((a) => (
          <button key={a.id} onClick={() => setEditA(a)} className={cx('flex h-10 items-center gap-2 rounded-full border border-line px-3.5 text-sm font-medium hover:border-navy-200', !a.active && 'opacity-50')}>
            <span>{a.icon}</span>{a.name}
          </button>
        ))}
      </Card>

      {editR && <RoutineSheet value={editR} onClose={() => setEditR(null)} />}
      {editT && <TaskSheet value={editT} onClose={() => setEditT(null)} />}
      {editA && <AreaSheet value={editA} onClose={() => setEditA(null)} />}
      {node}
    </div>
  );
}

function RoutineSheet({ value, onClose }: { value: Partial<Routine>; onClose: () => void }) {
  const { org } = useMe();
  const qc = useQueryClient();
  const [v, setV] = useState<Partial<Routine>>({ ...value, start_time: hhmm(value.start_time) || '10:00', end_time: hhmm(value.end_time) || '10:30' });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!v.name?.trim()) return toast('Give the routine a name', 'bad');
    if ((v.end_time ?? '') <= (v.start_time ?? '')) return toast('End time must be after start time', 'bad');
    setBusy(true);
    const row = { name: v.name.trim(), icon: v.icon || '🧹', kind: v.kind ?? 'cleaning', start_time: v.start_time, end_time: v.end_time, days: v.days?.length ? v.days : [1, 2, 3, 4, 5], description: v.description || null, active: v.active ?? true };
    const { error } = v.id ? await supabase.from('rh_routines').update(row).eq('id', v.id) : await supabase.from('rh_routines').insert({ ...row, org_id: org.id, sort: 99 });
    setBusy(false);
    if (error) return toast(errMsg(error), 'bad');
    void qc.invalidateQueries({ queryKey: ['routines'] });
    toast('Routine saved');
    onClose();
  };
  return (
    <Sheet open onClose={onClose} title={v.id ? 'Edit routine' : 'New routine'} footer={<Button block loading={busy} onClick={() => void save()}>Save</Button>}>
      <div className="space-y-4">
        <div className="grid grid-cols-[72px_1fr] gap-3">
          <Field label="Icon"><Input value={v.icon ?? ''} onChange={(e) => setV({ ...v, icon: e.target.value })} className="text-center text-xl" maxLength={4} /></Field>
          <Field label="Name"><Input value={v.name ?? ''} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="e.g. Afternoon refresh" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Starts"><Input type="time" value={v.start_time ?? ''} onChange={(e) => setV({ ...v, start_time: e.target.value })} /></Field>
          <Field label="Ends"><Input type="time" value={v.end_time ?? ''} onChange={(e) => setV({ ...v, end_time: e.target.value })} /></Field>
        </div>
        <Field label="Type">
          <Select value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value as RoutineKind })}>
            <option value="cleaning">Cleaning round</option><option value="toilets">Toilet check</option><option value="stock">Stock count</option>
          </Select>
        </Field>
        <Field label="Days">
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAYS.map((d) => {
              const on = v.days?.includes(d.n);
              return <button key={d.n} type="button" onClick={() => setV({ ...v, days: on ? (v.days ?? []).filter((x) => x !== d.n) : [...(v.days ?? []), d.n].sort() })}
                className={cx('h-10 w-12 rounded-xl border text-sm font-semibold', on ? 'border-navy-700 bg-navy-700 text-white' : 'border-line bg-surface')}>{d.short}</button>;
            })}
          </div>
        </Field>
        <Field label="Instructions (optional)"><Textarea value={v.description ?? ''} onChange={(e) => setV({ ...v, description: e.target.value })} rows={2} /></Field>
        <div className="flex items-center justify-between rounded-xl bg-sunken p-3"><span className="font-medium">Active</span><Toggle checked={v.active ?? true} onChange={(a) => setV({ ...v, active: a })} /></div>
      </div>
    </Sheet>
  );
}

function TaskSheet({ value, onClose }: { value: Partial<Task>; onClose: () => void }) {
  const { org } = useMe();
  const qc = useQueryClient();
  const areas = useAreas();
  const team = useTeam();
  const [v, setV] = useState<Partial<Task>>(value);
  const [busy, setBusy] = useState(false);
  const specific = !!(v.days && v.days.length);
  const save = async () => {
    if (!v.title?.trim()) return toast('Write what needs to be done', 'bad');
    setBusy(true);
    const row = { title: v.title.trim(), area_id: v.area_id || null, days: v.days?.length ? v.days : null, assignee_id: v.assignee_id || null, active: true };
    const { error } = v.id ? await supabase.from('rh_tasks').update(row).eq('id', v.id) : await supabase.from('rh_tasks').insert({ ...row, org_id: org.id, routine_id: v.routine_id, sort: 999 });
    setBusy(false);
    if (error) return toast(errMsg(error), 'bad');
    void qc.invalidateQueries({ queryKey: ['tasks'] });
    toast('Task saved');
    onClose();
  };
  return (
    <Sheet open onClose={onClose} title={v.id ? 'Edit task' : 'New task'} footer={<Button block loading={busy} onClick={() => void save()}>Save</Button>}>
      <div className="space-y-4">
        <Field label="Task" hint="Keep it short — cleaners read it on the phone"><Input value={v.title ?? ''} onChange={(e) => setV({ ...v, title: e.target.value })} placeholder="e.g. Clean the coffee machine" /></Field>
        <Field label="Area">
          <Select value={v.area_id ?? ''} onChange={(e) => setV({ ...v, area_id: e.target.value || null })}>
            <option value="">No area</option>
            {(areas.data ?? []).filter((a) => a.active).map((a) => <option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
          </Select>
        </Field>
        <Field label="Repeat">
          <Segmented value={specific ? 'some' : 'all'} onChange={(x) => setV({ ...v, days: x === 'all' ? null : v.days?.length ? v.days : [5] })}
            options={[{ value: 'all', label: 'Every routine day' }, { value: 'some', label: 'Only some days' }]} size="sm" />
          {specific && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {WEEKDAYS.map((d) => {
                const on = v.days?.includes(d.n);
                return <button key={d.n} type="button" onClick={() => setV({ ...v, days: on ? (v.days ?? []).filter((x) => x !== d.n) : [...(v.days ?? []), d.n].sort() })}
                  className={cx('h-10 w-12 rounded-xl border text-sm font-semibold', on ? 'border-navy-700 bg-navy-700 text-white' : 'border-line bg-surface')}>{d.short}</button>;
              })}
            </div>
          )}
        </Field>
        <Field label="Assigned to" hint="Optional — otherwise any cleaner">
          <Select value={v.assignee_id ?? ''} onChange={(e) => setV({ ...v, assignee_id: e.target.value || null })}>
            <option value="">Anyone</option>
            {(team.data ?? []).filter((p) => p.role === 'cleaner' && p.active).map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </Select>
        </Field>
        {v.id && Object.keys(v.title_i18n ?? {}).length > 0 && <p className="rounded-xl bg-navy-50 p-3 text-[13px] text-navy-700">This task shows in the cleaners' languages. Changing the English text will remove the translations.</p>}
      </div>
    </Sheet>
  );
}

function AreaSheet({ value, onClose }: { value: Partial<Area>; onClose: () => void }) {
  const { org } = useMe();
  const qc = useQueryClient();
  const [v, setV] = useState<Partial<Area>>(value);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!v.name?.trim()) return toast('Give the area a name', 'bad');
    setBusy(true);
    const row = { name: v.name.trim(), icon: v.icon || '🧹', active: v.active ?? true };
    const { error } = v.id ? await supabase.from('rh_areas').update(row).eq('id', v.id) : await supabase.from('rh_areas').insert({ ...row, org_id: org.id, sort: 99 });
    setBusy(false);
    if (error) return toast(errMsg(error), 'bad');
    void qc.invalidateQueries({ queryKey: ['areas'] });
    onClose();
  };
  return (
    <Sheet open onClose={onClose} title={v.id ? 'Edit area' : 'New area'} footer={<Button block loading={busy} onClick={() => void save()}>Save</Button>}>
      <div className="space-y-4">
        <div className="grid grid-cols-[72px_1fr] gap-3">
          <Field label="Icon"><Input value={v.icon ?? ''} onChange={(e) => setV({ ...v, icon: e.target.value })} className="text-center text-xl" maxLength={4} /></Field>
          <Field label="Name"><Input value={v.name ?? ''} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="e.g. Workshop office" /></Field>
        </div>
        <div className="flex items-center justify-between rounded-xl bg-sunken p-3"><span className="font-medium">Active</span><Toggle checked={v.active ?? true} onChange={(a) => setV({ ...v, active: a })} /></div>
      </div>
    </Sheet>
  );
}

export type { DayRoutine };

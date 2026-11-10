import { useMemo } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, PartyPopper } from 'lucide-react';
import { useMe } from '../../auth/AuthProvider';
import { Bi, BiName, useI18n } from '../../i18n';
import { useToday } from '../../lib/today';
import { useTeam, type DayTask } from '../../lib/data';
import type { I18n } from '../../lib/types';
import { clock, hhmm } from '../../lib/time';
import { Badge, Button, CheckCircle, ProgressBar, Skeleton, cx } from '../../components/ui';
import { RoundStatus } from './CleanerToday';

export default function RoundView() {
  const { id } = useParams();
  const nav = useNavigate();
  const { me, org } = useMe();
  const { t, tb, trs, second, dir2 } = useI18n();
  const { rounds, loading, toggle } = useToday();
  const team = useTeam();
  const names = useMemo(() => new Map((team.data ?? []).map((p) => [p.id, p.full_name.split(' ')[0]])), [team.data]);
  const round = rounds.find((r) => r.id === id);

  const groups = useMemo(() => {
    const g: { key: string; icon: string; name: string; i18n: I18n | null; tasks: DayTask[] }[] = [];
    for (const task of round?.tasks ?? []) {
      const key = task.area?.id ?? 'none';
      let grp = g.find((x) => x.key === key);
      if (!grp) { grp = { key, icon: task.area?.icon ?? '🧹', name: task.area?.name ?? '', i18n: task.area?.name_i18n ?? null, tasks: [] }; g.push(grp); }
      grp.tasks.push(task);
    }
    return g;
  }, [round]);

  if (loading) return <div className="space-y-3 p-4"><Skeleton className="h-28" /><Skeleton className="h-16" /><Skeleton className="h-16" /></div>;
  if (!round) return <Navigate to="/c" replace />;
  if (round.kind === 'stock') return <Navigate to="/c/stock" replace />;
  const allDone = round.total > 0 && round.doneCount >= round.total;

  return (
    <div className="mx-auto max-w-md">
      <header className="sticky top-0 z-20 border-b border-line bg-surface/95 px-4 pb-3 pt-[max(12px,env(safe-area-inset-top))] backdrop-blur">
        <div className="flex items-center gap-2">
          <button onClick={() => nav('/c')} className="focus-ring -ms-2 flex h-11 w-11 items-center justify-center rounded-xl text-navy-700 active:bg-navy-50" aria-label={t('back')}>
            <ArrowLeft className="h-6 w-6 flip-rtl" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold leading-tight">{round.icon} <BiName base={round.name} i18n={round.name_i18n} sub="block text-[13px] font-medium text-muted" /></h1>
            <p className="text-[13px] text-muted tnum" dir="ltr">{hhmm(round.start_time)}–{hhmm(round.end_time)}</p>
          </div>
          <RoundStatus r={round} />
        </div>
        <div className="mt-3 flex items-center gap-3">
          <ProgressBar value={round.total ? round.doneCount / round.total : 0} bar={allDone ? 'bg-ok' : 'bg-navy-700'} />
          <span className="shrink-0 text-sm font-semibold tnum">{round.doneCount}/{round.total}</span>
        </div>
      </header>

      <div className="space-y-5 px-4 pb-6 pt-4">
        {!allDone && <p className="rounded-xl bg-navy-50 px-3.5 py-2.5 text-[14px] font-medium text-navy-700">👆 <Bi k="tapWhenDone" sub="block text-[13px] font-medium opacity-80" /></p>}
        {groups.map((g) => (
          <section key={g.key}>
            {g.name && (
              <h2 className="mb-2 flex items-center gap-2 px-1 text-[15px] font-semibold text-ink">
                <span className="text-xl">{g.icon}</span>
                <span className="min-w-0"><BiName base={g.name} i18n={g.i18n} sub="block text-[13px] font-medium text-muted" /></span>
              </h2>
            )}
            <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
              {g.tasks.map((task, i) => {
                const by = task.doneRow?.done_by ? names.get(task.doneRow.done_by) : task.pending && task.done ? me.full_name.split(' ')[0] : null;
                return (
                  <button key={task.id} onClick={() => toggle(task)} data-testid="task-row" data-done={task.done ? '1' : '0'}
                    className={cx('flex w-full items-center gap-3.5 px-4 py-3.5 text-start transition active:bg-navy-50', i > 0 && 'border-t border-line', task.done && 'bg-ok-soft/40')}>
                    <CheckCircle checked={task.done} pending={task.pending} size={32} />
                    <span className="min-w-0 flex-1">
                      <span className={cx('block text-[17px] leading-snug', task.done ? 'text-muted line-through decoration-ok/50' : 'font-medium')}>{task.title}</span>
                      {second && trs(task.title, task.title_i18n) && (
                        <span className="block text-[14px] leading-snug text-muted" lang={second} dir={dir2}>{trs(task.title, task.title_i18n)}</span>
                      )}
                      <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[13px] text-muted">
                        {task.done && (
                          <span className="tnum" dir="ltr">✓ {task.doneRow ? clock(task.doneRow.done_at, org.timezone) : clock(new Date().toISOString(), org.timezone)}</span>
                        )}
                        {task.done && by && <span>· {t('by', { name: by })}</span>}
                        {task.late && <Badge tone="warn" className="py-0">{t('late')}</Badge>}
                        {task.days && task.days.length > 0 && task.days.length < 7 && <Badge tone="violet" className="py-0">{t('weekly')}</Badge>}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}

        {allDone && (
          <div className="rounded-3xl bg-gradient-to-br from-ok to-green-700 p-6 text-center text-white shadow-lift animate-fadeup">
            <PartyPopper className="mx-auto h-10 w-10" />
            <p className="mt-2 text-xl font-semibold"><Bi k="allDone" sub="mt-0.5 block text-[15px] font-medium opacity-85" /></p>
            <Button variant="white" className="mt-4" onClick={() => nav('/c')}>{tb('back')}</Button>
          </div>
        )}
      </div>
    </div>
  );
}

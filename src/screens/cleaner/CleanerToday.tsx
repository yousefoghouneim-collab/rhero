import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ChevronRight, Clock, Package } from 'lucide-react';
import { useMe } from '../../auth/AuthProvider';
import { Bi, BiName, useI18n } from '../../i18n';
import { longDate } from '../../i18n/locale';
import { useToday } from '../../lib/today';
import { hhmm } from '../../lib/time';
import type { DayRoutine } from '../../lib/data';
import type { StrKey } from '../../i18n/strings';
import { Badge, Card, ProgressBar, ProgressRing, Skeleton, cx } from '../../components/ui';
import { Mark } from '../../components/Brand';

export function RoundStatus({ r }: { r: DayRoutine }) {
  const { t } = useI18n();
  if (r.state === 'done') return <Badge tone="ok"><CheckCircle2 className="h-3.5 w-3.5" />{t('statusDone')}</Badge>;
  if (r.state === 'active') return <Badge tone="red"><span className="h-2 w-2 rounded-full bg-brand-red animate-pulse2" />{t('statusNow')}</Badge>;
  if (r.state === 'overdue') return <Badge tone="warn">{t('statusMissed')}</Badge>;
  return <Badge tone="neutral"><Clock className="h-3.5 w-3.5" />{t('startsAt', { time: hhmm(r.start_time) })}</Badge>;
}

export default function CleanerToday() {
  const { me, org } = useMe();
  const { t, ts, tb, second, dir2 } = useI18n();
  const { now, rounds, total, done, loading } = useToday();
  const gKey: StrKey = now.minutes < 12 * 60 ? 'goodMorning' : now.minutes < 17 * 60 ? 'goodAfternoon' : 'goodEvening';
  const first = me.full_name.split(' ')[0];
  const current = rounds.find((r) => r.state === 'active') ?? rounds.find((r) => r.state === 'upcoming') ?? rounds.find((r) => r.state === 'overdue');
  const shiftStart = org.settings.shift_start ?? '08:30';
  const shiftEnd = org.settings.shift_end ?? '17:30';

  return (
    <div>
      <header className="relative overflow-hidden bg-navy-grad px-5 pb-16 pt-[max(20px,env(safe-area-inset-top))] text-white">
        <div className="absolute inset-x-0 bottom-0 h-1 livery" />
        <div className="mx-auto max-w-md">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-white/70">{t(gKey)}{ts(gKey) && <span className="text-white/50" lang={second ?? undefined} dir={dir2}> · {ts(gKey)}</span>}</p>
              <h1 className="truncate text-[28px] font-semibold leading-tight">{first} 👋</h1>
              <p className="mt-1 text-sm text-white/60">
                {longDate(now.date, 'en')} · {t('shift', { start: shiftStart, end: shiftEnd })}
              </p>
              {second && (
                <p className="text-[13px] text-white/45" lang={second} dir={dir2}>
                  {longDate(now.date, second)} · {ts('shift', { start: shiftStart, end: shiftEnd })}
                </p>
              )}
            </div>
            {org.is_demo && <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider">{t('demo')}</span>}
          </div>
        </div>
      </header>

      <div className="relative z-10 mx-auto -mt-12 max-w-md space-y-4 px-4">
        <Card className="flex items-center gap-4 p-4">
          <ProgressRing value={total ? done / total : 0} size={68} stroke={7} bar={done >= total && total > 0 ? 'stroke-ok' : 'stroke-navy-700'}>
            <span className="text-sm font-semibold tnum">{total ? Math.round((done / total) * 100) : 0}%</span>
          </ProgressRing>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold uppercase tracking-wide text-muted"><Bi k="dayProgress" sub="block text-[11px] font-medium normal-case tracking-normal opacity-80" /></p>
            <p className="text-xl font-semibold tnum"><Bi k="doneOf" vars={{ done, total }} sub="block text-[14px] font-medium text-muted" /></p>
            {total > 0 && done < total && <p className="text-sm text-muted">{tb('leftN', { n: total - done })}</p>}
          </div>
        </Card>

        {loading ? (
          <div className="space-y-3"><Skeleton className="h-36" /><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
        ) : rounds.length === 0 ? (
          <Card className="p-8 text-center text-muted"><Bi k="noRounds" /></Card>
        ) : (
          <>
            {current && <NowCard r={current} />}
            <div>
              <h2 className="mb-2 mt-5 px-1 text-[13px] font-semibold uppercase tracking-wider text-muted"><Bi k="allRounds" sub="block text-[11px] font-medium normal-case tracking-normal opacity-80" /></h2>
              <div className="space-y-2.5">
                {rounds.map((r) => (
                  <Link key={r.id} to={r.kind === 'stock' ? '/c/stock' : `/c/round/${r.id}`} className="block">
                    <Card className={cx('flex items-center gap-3 p-3.5 transition active:scale-[.99]', r.state === 'active' && 'border-navy-300 ring-2 ring-navy-100')}>
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sunken text-2xl">{r.icon}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[16px] font-semibold"><BiName base={r.name} i18n={r.name_i18n} sub="block truncate text-[13px] font-medium text-muted" /></p>
                        <p className="text-[13px] text-muted tnum" dir="ltr">{hhmm(r.start_time)}–{hhmm(r.end_time)} · {r.kind === 'stock' ? t('itemsCounted', { n: r.doneCount, total: r.total }) : `${r.doneCount}/${r.total}`}</p>
                        <ProgressBar value={r.total ? r.doneCount / r.total : 0} className="mt-2" height="h-1.5" bar={r.state === 'done' ? 'bg-ok' : r.state === 'overdue' ? 'bg-warn' : 'bg-navy-700'} />
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <RoundStatus r={r} />
                        <ChevronRight className="h-5 w-5 text-navy-200 flip-rtl" />
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}

        <Link to="/c/issue" className="block">
          <Card className="flex items-center gap-3 border-dashed p-4">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-bad-soft text-bad"><AlertTriangle className="h-5 w-5" /></span>
            <span className="block flex-1 font-semibold"><Bi k="reportProblem" sub="block text-[13px] font-medium text-muted" /></span>
            <ChevronRight className="h-5 w-5 text-navy-200 flip-rtl" />
          </Card>
        </Link>
        <div className="h-2" />
      </div>
    </div>
  );
}

function NowCard({ r }: { r: DayRoutine }) {
  const { t, ts } = useI18n();
  const to = r.kind === 'stock' ? '/c/stock' : `/c/round/${r.id}`;
  const labelKey: StrKey = r.state === 'active' ? 'statusNow' : r.state === 'upcoming' ? 'next' : 'statusMissed';
  const goKey: StrKey = r.kind === 'stock' ? 'countNow' : r.doneCount > 0 ? 'continue' : 'start';
  return (
    <Link to={to} className="block">
      <div className={cx('relative overflow-hidden rounded-3xl p-5 text-white shadow-lift', r.state === 'overdue' ? 'bg-gradient-to-br from-warn to-orange-700' : 'bg-gradient-to-br from-navy-600 to-navy-800')}>
        <Mark white className="pointer-events-none absolute -end-8 -top-6 h-40 w-40 opacity-10" />
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider">
          {r.state === 'active' && <span className="h-2 w-2 rounded-full bg-[#ff6b6b] animate-pulse2" />}{t(labelKey)}
          {ts(labelKey) && <span className="opacity-70">· {ts(labelKey)}</span>}
        </span>
        <h2 className="mt-3 text-2xl font-semibold leading-tight">{r.icon} <BiName base={r.name} i18n={r.name_i18n} sub="mt-0.5 block text-[17px] font-medium opacity-80" /></h2>
        <p className="mt-1 text-white/75 tnum" dir="ltr">{hhmm(r.start_time)} – {hhmm(r.end_time)}</p>
        <div className="mt-4 flex items-center gap-3">
          <ProgressBar value={r.total ? r.doneCount / r.total : 0} bar="bg-white" className="bg-white/20" />
          <span className="shrink-0 text-sm font-semibold tnum">{r.doneCount}/{r.total}</span>
        </div>
        <div className="mt-4 inline-flex min-h-12 items-center gap-2 rounded-2xl bg-white px-5 py-1.5 font-semibold text-navy-700">
          {r.kind === 'stock' ? <Package className="h-5 w-5" /> : null}
          <Bi k={goKey} stack sub="text-[12px] font-medium opacity-70" />
          <ChevronRight className="h-5 w-5 flip-rtl" />
        </div>
      </div>
    </Link>
  );
}

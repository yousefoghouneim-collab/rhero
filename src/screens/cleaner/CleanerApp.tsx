import { useEffect } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CloudOff, Home, Package, UserRound } from 'lucide-react';
import { useMe } from '../../auth/AuthProvider';
import { useI18n } from '../../i18n';
import { useRealtime } from '../../lib/realtime';
import { onOpSettled, useOutbox } from '../../lib/outbox';
import { toast } from '../../lib/toast';
import { cx } from '../../components/ui';
import CleanerToday from './CleanerToday';
import RoundView from './RoundView';
import CleanerStock from './CleanerStock';
import ReportIssue from './ReportIssue';
import CleanerMe from './CleanerMe';

export default function CleanerApp() {
  const { me, org } = useMe();
  const { t } = useI18n();
  const qc = useQueryClient();
  useRealtime(org.id, me.id, 'cleaner');
  const { ops, online, syncing } = useOutbox();

  useEffect(() => onOpSettled((op, ok, err) => {
    if (op.kind === 'done' || op.kind === 'undone') void qc.invalidateQueries({ queryKey: ['done'] });
    if (op.kind === 'counts') { void qc.invalidateQueries({ queryKey: ['counts'] }); void qc.invalidateQueries({ queryKey: ['items'] }); }
    if (op.kind === 'issue') void qc.invalidateQueries({ queryKey: ['issues'] });
    if (!ok) toast(`${t('sendFailed')}: ${err ?? ''}`, 'bad');
  }), [qc, t]);

  const tabs = [
    { to: '/c', end: true, icon: Home, label: t('today') },
    { to: '/c/stock', icon: Package, label: t('stock') },
    { to: '/c/issue', icon: AlertTriangle, label: t('problem') },
    { to: '/c/me', icon: UserRound, label: t('me') },
  ];

  return (
    <div className="min-h-dvh pb-[calc(76px+env(safe-area-inset-bottom))]">
      {(!online || ops.length > 0) && (
        <div className={cx('sticky top-0 z-30 flex items-center gap-2 px-4 pb-2 pt-[max(8px,env(safe-area-inset-top))] text-[13px] font-semibold', online ? 'bg-navy-600 text-white' : 'bg-warn text-white')}>
          {online ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <CloudOff className="h-4 w-4" />}
          <span>{online ? (syncing ? t('syncing') : t('syncing')) : t('offline')}</span>
          {ops.length > 0 && <span className="ms-auto rounded-full bg-white/20 px-2 tnum">{ops.length}</span>}
        </div>
      )}
      <Routes>
        <Route index element={<CleanerToday />} />
        <Route path="round/:id" element={<RoundView />} />
        <Route path="stock" element={<CleanerStock />} />
        <Route path="issue" element={<ReportIssue />} />
        <Route path="me" element={<CleanerMe />} />
      </Routes>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-safe backdrop-blur no-print">
        <div className="mx-auto grid max-w-md grid-cols-4">
          {tabs.map(({ to, end, icon: Icon, label }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) => cx('flex h-[64px] flex-col items-center justify-center gap-1 text-[12px] font-semibold transition', isActive ? 'text-navy-700' : 'text-muted')}>
              {({ isActive }) => (<>
                <span className={cx('flex h-8 w-14 items-center justify-center rounded-full transition', isActive && 'bg-navy-50')}><Icon className="h-[22px] w-[22px]" strokeWidth={isActive ? 2.4 : 2} /></span>
                {label}
              </>)}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

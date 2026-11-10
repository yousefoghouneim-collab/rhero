import { lazy, Suspense, useMemo } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import { BadgeCheck, BarChart3, Boxes, ClipboardList, FileText, LayoutDashboard, LogOut, MoreHorizontal, Settings, ShoppingCart, Sparkles, Users } from 'lucide-react';
import { useAuth, useMe } from '../../auth/AuthProvider';
import { useRealtime } from '../../lib/realtime';
import { useItems, useRequests } from '../../lib/data';
import { itemStatus } from '../../lib/stock';
import { Avatar, PageLoader, cx } from '../../components/ui';
import { Logo } from '../../components/Brand';
import Dashboard from './Dashboard';

const Cleaning = lazy(() => import('./Cleaning'));
const Inventory = lazy(() => import('./Inventory'));
const Supply = lazy(() => import('./Supply'));
const Requests = lazy(() => import('./Requests'));
const Passes = lazy(() => import('./Passes'));
const Forms = lazy(() => import('./Forms'));
const Reports = lazy(() => import('./Reports'));
const Team = lazy(() => import('./Team'));
const SettingsPage = lazy(() => import('./SettingsPage'));
const More = lazy(() => import('./More'));
const ManagerCount = lazy(() => import('./ManagerCount'));

export default function ManagerApp() {
  const { me, org } = useMe();
  const { signOut } = useAuth();
  useRealtime(org.id, me.id, 'manager');
  const items = useItems();
  const reqs = useRequests();
  const red = useMemo(() => (items.data ?? []).filter((i) => i.active && itemStatus(i) === 'red').length, [items.data]);
  const newReq = (reqs.data ?? []).filter((r) => r.status === 'new').length;

  const nav = [
    { to: '/m', end: true, label: 'Dashboard', icon: LayoutDashboard },
    { to: '/m/cleaning', label: 'Cleaning', icon: Sparkles },
    { to: '/m/inventory', label: 'Inventory', icon: Boxes },
    { to: '/m/supply', label: 'To supply', icon: ShoppingCart, badge: red },
    { to: '/m/requests', label: 'Requests & orders', icon: ClipboardList, badge: newReq },
    { to: '/m/passes', label: 'Gate passes', icon: BadgeCheck },
    { to: '/m/forms', label: 'Forms & templates', icon: FileText },
    { to: '/m/reports', label: 'Daily reports', icon: BarChart3 },
    { to: '/m/team', label: 'Team', icon: Users },
    { to: '/m/settings', label: 'Settings', icon: Settings },
  ];
  const mobile = [nav[0], nav[1], nav[2], nav[3], { to: '/m/more', label: 'More', icon: MoreHorizontal, badge: newReq }];

  return (
    <div className="min-h-dvh lg:flex">
      <aside className="sticky top-0 hidden h-dvh w-[264px] shrink-0 flex-col bg-navy-grad text-white lg:flex no-print">
        <div className="px-6 pb-4 pt-7"><Logo dark className="h-9" /></div>
        <div className="mx-6 mb-3 h-px livery opacity-80" />
        <p className="px-6 pb-2 text-[11px] font-semibold uppercase tracking-[.16em] text-white/45">{org.name}</p>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
          {nav.map(({ to, end, label, icon: Icon, badge }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) => cx('flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition', isActive ? 'bg-white text-navy-700' : 'text-white/80 hover:bg-white/10 hover:text-white')}>
              <Icon className="h-5 w-5" />
              <span className="flex-1">{label}</span>
              {!!badge && <span className="rounded-full bg-brand-red px-2 text-xs font-bold text-white tnum">{badge}</span>}
            </NavLink>
          ))}
          <div className="mx-3 mt-5 rounded-2xl border border-white/10 bg-white/5 p-3 text-[13px] text-white/70">
            <p className="font-semibold text-white">Coming next</p>
            <p className="mt-1 leading-snug">Phase 2: invoices, budgets & spend, petty cash, staff kits, access cards. Phase 3: SAP & employee requests portal.</p>
          </div>
        </nav>
        <div className="flex items-center gap-3 border-t border-white/10 px-5 py-4">
          <Avatar name={me.full_name} color="#af1615" size={36} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{me.full_name}</p>
            <p className="text-xs text-white/55">Office manager{org.is_demo ? ' · Demo' : ''}</p>
          </div>
          <button onClick={() => void signOut()} className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white" aria-label="Sign out"><LogOut className="h-5 w-5" /></button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 pb-[calc(70px+env(safe-area-inset-bottom))] lg:pb-0">
        {org.is_demo && (
          <div className="bg-brand-red px-4 py-1 text-center text-[12px] font-semibold text-white no-print">
            <span className="sm:hidden">Demo · sample data, refreshed daily</span>
            <span className="hidden sm:inline">Demo workspace — sample data, refreshed daily. Changes you make are visible to other demo users.</span>
          </div>
        )}
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route index element={<Dashboard />} />
            <Route path="cleaning/*" element={<Cleaning />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="count/:section" element={<ManagerCount />} />
            <Route path="supply" element={<Supply />} />
            <Route path="requests" element={<Requests />} />
            <Route path="passes" element={<Passes />} />
            <Route path="forms" element={<Forms />} />
            <Route path="reports" element={<Reports />} />
            <Route path="reports/:day" element={<Reports />} />
            <Route path="team" element={<Team />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="more" element={<More />} />
          </Routes>
        </Suspense>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-safe backdrop-blur lg:hidden no-print">
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {mobile.map(({ to, end, label, icon: Icon, badge }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) => cx('relative flex h-[62px] flex-col items-center justify-center gap-0.5 text-[11.5px] font-semibold', isActive ? 'text-navy-700' : 'text-muted')}>
              {({ isActive }) => (<>
                <span className={cx('relative flex h-8 w-12 items-center justify-center rounded-full transition', isActive && 'bg-navy-50')}>
                  <Icon className="h-[21px] w-[21px]" strokeWidth={isActive ? 2.4 : 2} />
                  {!!badge && <span className="absolute -end-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand-red px-1 text-[10px] font-bold text-white tnum">{badge}</span>}
                </span>
                {label}
              </>)}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

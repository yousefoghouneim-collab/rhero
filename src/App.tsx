import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { I18nProvider } from './i18n';
import { Button, PageLoader, Toaster } from './components/ui';
import { hideBootSplash, Logo } from './components/Brand';
import Login from './screens/Login';
import type { Role } from './lib/types';

const CleanerApp = lazy(() => import('./screens/cleaner/CleanerApp'));
const ManagerApp = lazy(() => import('./screens/manager/ManagerApp'));
const PublicForm = lazy(() => import('./screens/public/PublicForm'));
const PrintTemplate = lazy(() => import('./screens/public/PrintTemplate'));

function Splash() {
  return <div className="min-h-dvh bg-navy-grad" />;
}

function LangGate({ children }: { children: ReactNode }) {
  const { me } = useAuth();
  const loc = useLocation();
  const publicPage = loc.pathname.startsWith('/f/') || loc.pathname.startsWith('/print/');
  const forced = publicPage || me?.role === 'manager' ? 'en' : me?.role === 'cleaner' ? me.language : null;
  return <I18nProvider forced={forced}>{children}</I18nProvider>;
}

function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { status, me, signOut } = useAuth();
  const loc = useLocation();
  if (status === 'loading') return <Splash />;
  if (status === 'signedout') return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname)}`} replace />;
  if (status === 'noaccess' || !me) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-bg p-6 text-center">
        <Logo />
        <p className="max-w-sm text-muted">This account doesn't have access to RHero. Ask the office manager to add you.</p>
        <Button onClick={() => void signOut()}>Sign out</Button>
      </div>
    );
  }
  if (me.role !== role) return <Navigate to={me.role === 'manager' ? '/m' : '/c'} replace />;
  return <>{children}</>;
}

function HomeRedirect() {
  const { status, me } = useAuth();
  if (status === 'loading') return <Splash />;
  if (status !== 'ready' || !me) return <Navigate to="/login" replace />;
  return <Navigate to={me.role === 'manager' ? '/m' : '/c'} replace />;
}

function BootHider() {
  const { status } = useAuth();
  const loc = useLocation();
  useEffect(() => {
    if (status !== 'loading' || loc.pathname.startsWith('/f/') || loc.pathname.startsWith('/print/') || loc.pathname === '/login') hideBootSplash();
  }, [status, loc.pathname]);
  return null;
}

export default function App() {
  return (
    <AuthProvider>
      <LangGate>
        <BootHider />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/f/:token/:kind" element={<PublicForm />} />
            <Route path="/print/:kind" element={<PrintTemplate />} />
            <Route path="/c/*" element={<RequireRole role="cleaner"><CleanerApp /></RequireRole>} />
            <Route path="/m/*" element={<RequireRole role="manager"><ManagerApp /></RequireRole>} />
            <Route path="*" element={<HomeRedirect />} />
          </Routes>
        </Suspense>
        <Toaster />
      </LangGate>
    </AuthProvider>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Globe, Lock, Mail, Phone, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { Bi, Second, useI18n } from '../i18n';
import { langLabel } from '../i18n/strings';
import { Avatar, Button, Input, Label, Segmented, cx } from '../components/ui';
import { Logo } from '../components/Brand';
import { LanguageSheet } from '../components/LanguageSheet';
import { DEMO, signInWithEmail, signInWithPhone } from '../lib/auth';
import { maskPhoneInput } from '../lib/phone';
import { errMsg } from '../lib/supabase';

type Mode = 'phone' | 'email';

export default function Login() {
  const { status, me } = useAuth();
  const { t, tb, pref, setLang } = useI18n();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<Mode>('phone');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [langOpen, setLangOpen] = useState(false);
  const autoDemo = useRef(false);

  const go = async (key: string, fn: () => Promise<void>, wrongMsg: string) => {
    setError(null);
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      const m = errMsg(e);
      setError(/invalid login|credentials|phone/i.test(m) ? wrongMsg : /internet/i.test(m) ? tb('noInternet') : m);
      setBusy(null);
    }
  };
  const demo = (who: 'manager' | 'cleaner1' | 'cleaner2') =>
    go(who, () => (who === 'manager' ? signInWithEmail(DEMO.manager.email, DEMO.manager.password) : signInWithPhone(DEMO[who].phone, DEMO[who].pin)), 'Demo login failed');

  // ?demo=manager | cleaner | cleaner2 — direct demo links
  useEffect(() => {
    const d = params.get('demo');
    if (!d || autoDemo.current || status !== 'signedout') return;
    autoDemo.current = true;
    void demo(d === 'manager' ? 'manager' : d === 'cleaner2' ? 'cleaner2' : 'cleaner1');
  }, [params, status]); // eslint-disable-line react-hooks/exhaustive-deps

  if (status === 'ready' && me) {
    const next = params.get('next');
    const home = me.role === 'manager' ? '/m' : '/c';
    return <Navigate to={next && next.startsWith(home) ? next : home} replace />;
  }

  const langName = langLabel(pref);

  return (
    <div className="min-h-dvh bg-navy-grad">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
        <header className="flex items-center justify-between px-5 pt-[max(18px,env(safe-area-inset-top))]">
          <span className="text-xs font-semibold uppercase tracking-[.18em] text-white/50">RH Aero Systems</span>
          <button onClick={() => setLangOpen(true)} className="focus-ring flex h-9 items-center gap-2 rounded-full bg-white/10 px-3 text-sm font-semibold text-white hover:bg-white/15">
            <Globe className="h-4 w-4" /> {langName}
          </button>
        </header>

        <div className="px-6 pb-8 pt-10">
          <Logo dark className="h-14" />
          <p className="mt-4 text-lg text-white/80">{t('tagline')}</p>
          <Second k="tagline" className="mt-0.5 block text-[15px] text-white/55" />
        </div>

        <div className="mt-auto rounded-t-[28px] bg-bg px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-6 shadow-lift sm:mb-8 sm:rounded-[28px]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (mode === 'phone') void go('form', () => signInWithPhone(phone, pin), tb('wrongLogin'));
              else void go('form', () => signInWithEmail(email, password), 'Wrong email or password');
            }}
            className="space-y-4"
          >
            <Segmented<Mode> value={mode} onChange={(m) => { setMode(m); setError(null); }}
              options={[{ value: 'phone', label: <><Phone className="h-4 w-4" />{t('phone')}</> }, { value: 'email', label: <><Mail className="h-4 w-4" />{t('email')}</> }]} />

            {mode === 'phone' ? (
              <>
                <div>
                  <Label htmlFor="phone"><Bi k="phone" sub="ms-1.5 inline text-[13px] font-medium text-muted" /></Label>
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 start-3.5 flex items-center text-muted"><Phone className="h-5 w-5" /></span>
                    <Input id="phone" type="tel" inputMode="tel" autoComplete="tel" dir="ltr" placeholder="050 123 4567" value={phone}
                      onChange={(e) => setPhone(maskPhoneInput(e.target.value))} className="ps-11 text-lg tracking-wide" required />
                  </div>
                </div>
                <div>
                  <Label htmlFor="pin" hint={t('pinHint')}>{t('pin')}</Label>
                  <Second k="pinHint" className="-mt-1 mb-1.5 block text-xs text-muted" />
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 start-3.5 flex items-center text-muted"><Lock className="h-5 w-5" /></span>
                    <Input id="pin" type="password" inputMode="numeric" pattern="[0-9]*" autoComplete="current-password" maxLength={8} dir="ltr" placeholder="••••"
                      value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} className="ps-11 text-xl tracking-[.5em]" required />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <Label htmlFor="email">{t('email')}</Label>
                  <Input id="email" type="email" autoComplete="username" dir="ltr" placeholder="name@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div>
                  <Label htmlFor="password">{t('password')}</Label>
                  <Input id="password" type="password" autoComplete="current-password" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
              </>
            )}

            {error && <p className="rounded-xl bg-bad-soft px-3.5 py-2.5 text-sm font-medium text-bad-ink" role="alert">{error}</p>}

            <Button type="submit" size="xl" block loading={busy === 'form'} icon={busy === 'form' ? undefined : <ArrowRight className="h-5 w-5 flip-rtl" />}>
              <Bi k="signIn" stack="center" sub="text-[13px] font-medium opacity-80" />
            </Button>
          </form>

          <div className="mt-7">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-brand-red" />
              <h2 className="text-sm font-semibold"><Bi k="demoTitle" sub="ms-1.5 inline font-medium text-muted" /></h2>
            </div>
            <p className="mb-3 text-[13px] text-muted"><Bi k="demoHint" /></p>
            <div className="grid gap-2">
              {([
                { key: 'manager' as const, name: DEMO.manager.name, role: t('officeManager'), sub: 'Dashboard · stock · orders · reports', color: '#202854' },
                { key: 'cleaner1' as const, name: DEMO.cleaner1.name, role: t('cleaner'), sub: `${DEMO.cleaner1.phone} · PIN ${DEMO.cleaner1.pin} · English + Luganda`, color: '#0f766e' },
                { key: 'cleaner2' as const, name: DEMO.cleaner2.name, role: t('cleaner'), sub: `${DEMO.cleaner2.phone} · PIN ${DEMO.cleaner2.pin} · English + Kiswahili`, color: '#c2410c' },
              ]).map((d) => (
                <button key={d.key} onClick={() => void demo(d.key)} disabled={!!busy}
                  className={cx('focus-ring flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 text-start shadow-card transition hover:border-navy-200 active:scale-[.99] disabled:opacity-60')}>
                  <Avatar name={d.name} color={d.color} size={42} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2"><span className="font-semibold">{d.name}</span><span className="text-xs font-semibold text-navy-500">{d.role}</span></span>
                    <span className="block truncate text-[13px] text-muted" dir="ltr">{d.sub}</span>
                  </span>
                  {busy === d.key ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-navy-200 border-t-navy-700" /> : <ArrowRight className="h-5 w-5 text-navy-300 flip-rtl" />}
                </button>
              ))}
            </div>
          </div>

          <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-muted">
            <ShieldCheck className="h-3.5 w-3.5" /> RHero · RH Aero Systems · Dubai South
          </p>
        </div>
      </div>
      <LanguageSheet open={langOpen} onClose={() => setLangOpen(false)} value={pref} onPick={setLang} />
    </div>
  );
}

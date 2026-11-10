import { useMemo, useState } from 'react';
import { ChevronRight, Globe, LogOut, Phone, Smartphone } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth, useMe } from '../../auth/AuthProvider';
import { useI18n } from '../../i18n';
import { LANGS } from '../../i18n/strings';
import { useTeam } from '../../lib/data';
import { useToday } from '../../lib/today';
import { adminCall, supabase } from '../../lib/supabase';
import { formatPhone } from '../../lib/phone';
import type { Lang } from '../../lib/types';
import { Avatar, Card, Sheet, Stat } from '../../components/ui';
import { LanguageSheet } from '../../components/LanguageSheet';

export default function CleanerMe() {
  const { me, org } = useMe();
  const { signOut } = useAuth();
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const team = useTeam();
  const { doneRows, stock } = useToday();
  const [langOpen, setLangOpen] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);
  const manager = useMemo(() => (team.data ?? []).find((p) => p.role === 'manager' && p.phone), [team.data]);
  const mine = doneRows.filter((d) => d.done_by === me.id).length;

  const pickLang = async (l: Lang) => {
    // saved on the account, so the phone shows the same language after every sign-in
    try { await adminCall('members.update', { language: l }); }
    catch { await supabase.rpc('rh_touch', { p_language: l }).then(() => undefined, () => undefined); }
    await qc.invalidateQueries({ queryKey: ['me'] });
  };

  return (
    <div className="mx-auto max-w-md">
      <header className="bg-navy-grad px-5 pb-8 pt-[max(24px,env(safe-area-inset-top))] text-white">
        <div className="flex items-center gap-4">
          <Avatar name={me.full_name} color={me.color} size={60} className="ring-4 ring-white/15" />
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold">{me.full_name}</h1>
            <p className="text-white/70" dir="ltr">{formatPhone(me.phone)}</p>
            <p className="text-sm text-white/50">{org.name}</p>
          </div>
        </div>
      </header>
      <div className="-mt-4 space-y-4 px-4 pb-6">
        <Card className="grid grid-cols-2 gap-4 p-4">
          <Stat label={t('doneToday')} value={mine} sub={t('tasks')} />
          <Stat label={t('stock')} value={`${stock.counted}/${stock.total}`} />
        </Card>
        <Card className="divide-y divide-line">
          <button onClick={() => setLangOpen(true)} className="flex w-full items-center gap-3 p-4 text-start">
            <Globe className="h-5 w-5 text-navy-500" />
            <span className="flex-1 font-semibold">{t('language')}</span>
            <span className="text-muted">{LANGS.find((l) => l.code === lang)?.native}</span>
            <ChevronRight className="h-5 w-5 text-navy-200 flip-rtl" />
          </button>
          <button onClick={() => setInstallOpen(true)} className="flex w-full items-center gap-3 p-4 text-start">
            <Smartphone className="h-5 w-5 text-navy-500" />
            <span className="flex-1 font-semibold">{t('installApp')}</span>
            <ChevronRight className="h-5 w-5 text-navy-200 flip-rtl" />
          </button>
          {manager && (
            <a href={`tel:${manager.phone}`} className="flex w-full items-center gap-3 p-4">
              <Phone className="h-5 w-5 text-navy-500" />
              <span className="flex-1 font-semibold">{t('callManager')}</span>
              <span className="text-muted" dir="ltr">{manager.full_name.split(' ')[0]}</span>
            </a>
          )}
          <button onClick={() => void signOut()} className="flex w-full items-center gap-3 p-4 text-start text-bad">
            <LogOut className="h-5 w-5 flip-rtl" />
            <span className="flex-1 font-semibold">{t('signOut')}</span>
          </button>
        </Card>
        <p className="text-center text-xs text-muted">RHero v1.0 · RH Aero Systems</p>
      </div>
      <LanguageSheet open={langOpen} onClose={() => setLangOpen(false)} value={lang} onPick={(l) => void pickLang(l)} />
      <Sheet open={installOpen} onClose={() => setInstallOpen(false)} title={t('installApp')}>
        <InstallSteps />
      </Sheet>
    </div>
  );
}

export function InstallSteps() {
  return (
    <div className="space-y-4 text-[15px]">
      <div className="rounded-2xl bg-sunken p-4">
        <p className="font-semibold"> iPhone (Safari)</p>
        <ol className="mt-2 list-decimal space-y-1 ps-5 text-muted">
          <li>Tap the Share button <span className="font-semibold text-ink">⬆︎</span> at the bottom.</li>
          <li>Choose <span className="font-semibold text-ink">Add to Home Screen</span>.</li>
          <li>Tap <span className="font-semibold text-ink">Add</span> — RHero opens like an app.</li>
        </ol>
      </div>
      <div className="rounded-2xl bg-sunken p-4">
        <p className="font-semibold">🤖 Android (Chrome)</p>
        <ol className="mt-2 list-decimal space-y-1 ps-5 text-muted">
          <li>Tap the menu <span className="font-semibold text-ink">⋮</span> at the top right.</li>
          <li>Choose <span className="font-semibold text-ink">Install app</span> or <span className="font-semibold text-ink">Add to Home screen</span>.</li>
        </ol>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Bell, Building2, LogOut, RotateCcw, Smartphone, UserRound } from 'lucide-react';
import { useAuth, useMe } from '../../auth/AuthProvider';
import { adminCall, errMsg, supabase } from '../../lib/supabase';
import { toast } from '../../lib/toast';
import { WEEKDAYS } from '../../lib/time';
import { Button, Card, Field, Input, SectionTitle, cx, useConfirm } from '../../components/ui';
import { PageBody, PageTop } from './common';
import { InstallSteps } from '../cleaner/CleanerMe';
import { PushToggle } from '../../components/PushToggle';

export default function SettingsPage() {
  const { me, org } = useMe();
  const { signOut, reloadMe } = useAuth();
  const qc = useQueryClient();
  const s = org.settings;
  const [name, setName] = useState(org.name);
  const [reportTime, setReportTime] = useState(s.report_time ?? '16:00');
  const [shiftStart, setShiftStart] = useState(s.shift_start ?? '08:30');
  const [shiftEnd, setShiftEnd] = useState(s.shift_end ?? '17:30');
  const [days, setDays] = useState<number[]>(s.work_days ?? [1, 2, 3, 4, 5]);
  const [busy, setBusy] = useState<string | null>(null);
  const [myName, setMyName] = useState(me.full_name);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { ask, node } = useConfirm();

  const saveOrg = async () => {
    setBusy('org');
    const { error } = await supabase.from('rh_orgs').update({ name, settings: { ...s, report_time: reportTime, shift_start: shiftStart, shift_end: shiftEnd, work_days: days } }).eq('id', org.id);
    setBusy(null);
    if (error) return toast(errMsg(error), 'bad');
    reloadMe();
    toast('Workspace settings saved');
  };
  const saveMe = async () => {
    setBusy('me');
    try {
      await adminCall('members.update', { id: me.id, full_name: myName, ...(email ? { email } : {}), ...(password ? { password } : {}) });
      setEmail(''); setPassword('');
      reloadMe();
      void qc.invalidateQueries({ queryKey: ['team'] });
      toast('Account updated');
    } catch (e) { toast(errMsg(e), 'bad'); } finally { setBusy(null); }
  };
  const resetDemo = async () => {
    if (!(await ask('Reset the demo data?', { body: 'Rebuilds two weeks of sample history for today. Everyone using the demo will see the reset.', confirm: 'Reset demo' }))) return;
    setBusy('demo');
    const { error } = await supabase.rpc('rh_demo_refresh', { p_force: true });
    setBusy(null);
    if (error) return toast(errMsg(error), 'bad');
    await qc.invalidateQueries();
    toast('Demo data rebuilt');
  };

  return (
    <div>
      <PageTop title="Settings" />
      <PageBody className="max-w-3xl">
        <SectionTitle><span className="flex items-center gap-2"><Building2 className="h-4 w-4" />Workspace</span></SectionTitle>
        <Card className="space-y-4 p-4">
          <Field label="Company / office name"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Daily report at"><Input type="time" value={reportTime} onChange={(e) => setReportTime(e.target.value)} /></Field>
            <Field label="Shift starts"><Input type="time" value={shiftStart} onChange={(e) => setShiftStart(e.target.value)} /></Field>
            <Field label="Shift ends"><Input type="time" value={shiftEnd} onChange={(e) => setShiftEnd(e.target.value)} /></Field>
          </div>
          <Field label="Working days (daily report is sent on these days)">
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS.map((d) => {
                const on = days.includes(d.n);
                return <button key={d.n} type="button" onClick={() => setDays(on ? days.filter((x) => x !== d.n) : [...days, d.n].sort())}
                  className={cx('h-10 w-12 rounded-xl border text-sm font-semibold', on ? 'border-navy-700 bg-navy-700 text-white' : 'border-line bg-surface')}>{d.short}</button>;
              })}
            </div>
          </Field>
          <p className="text-[13px] text-muted">Time zone: {org.timezone}. Round times are edited in Cleaning → Setup.</p>
          <Button loading={busy === 'org'} onClick={() => void saveOrg()}>Save workspace</Button>
        </Card>

        <SectionTitle><span className="flex items-center gap-2"><Bell className="h-4 w-4" />Notifications</span></SectionTitle>
        <Card className="p-4">
          <PushToggle />
          <p className="mt-3 text-[13px] text-muted">You always get in-app alerts (bell icon) for: items turning red, problems reported by the cleaners, unfinished rounds, new requests & gate passes, and the daily report.</p>
        </Card>

        <SectionTitle><span className="flex items-center gap-2"><UserRound className="h-4 w-4" />My account</span></SectionTitle>
        <Card className="space-y-4 p-4">
          <Field label="Name"><Input value={myName} onChange={(e) => setMyName(e.target.value)} /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="New sign-in email" hint="optional"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={me.email ?? ''} /></Field>
            <Field label="New password" hint="optional, min 8"><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button loading={busy === 'me'} onClick={() => void saveMe()}>Update account</Button>
            <Button variant="ghost" icon={<LogOut className="h-4 w-4" />} onClick={() => void signOut()}>Sign out</Button>
          </div>
        </Card>

        <SectionTitle><span className="flex items-center gap-2"><Smartphone className="h-4 w-4" />Install on your phone</span></SectionTitle>
        <Card className="p-4"><InstallSteps /></Card>

        {org.is_demo && (
          <>
            <SectionTitle>Demo</SectionTitle>
            <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
              <p className="text-sm text-muted">Sample data is rebuilt automatically every day. You can also reset it now.</p>
              <Button variant="secondary" loading={busy === 'demo'} icon={<RotateCcw className="h-4 w-4" />} onClick={() => void resetDemo()}>Reset demo data</Button>
            </Card>
          </>
        )}
        <p className="mt-8 text-center text-xs text-muted">RHero v1.0 · Phase 1 · Built for RH Aero Systems, Dubai South</p>
      </PageBody>
      {node}
    </div>
  );
}

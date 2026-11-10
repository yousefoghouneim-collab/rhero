import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Copy, KeyRound, MessageCircle, Plus, RefreshCw, UserPlus } from 'lucide-react';
import { useMe } from '../../auth/AuthProvider';
import { useTeam } from '../../lib/data';
import { adminCall, errMsg } from '../../lib/supabase';
import { toast } from '../../lib/toast';
import { ago } from '../../lib/time';
import { formatPhone, localPhone, maskPhoneInput, normalizePhone } from '../../lib/phone';
import { LANGS, langLabel } from '../../i18n/strings';
import type { Lang, Profile, Role } from '../../lib/types';
import { Avatar, Badge, Button, Card, Field, Input, Segmented, Select, Sheet, Skeleton, Toggle, useConfirm } from '../../components/ui';
import { copyText, PageBody, PageTop, whatsappUrl } from './common';

const randomPin = () => String(Math.floor(1000 + Math.random() * 9000));

export function loginMessage(name: string, phone: string, pin: string, lang: Lang) {
  const url = window.location.origin;
  const p = formatPhone(phone);
  // English first (like the app), then the cleaner's own language
  const en = {
    hello: `Hi ${name}! This is the RHero app for your daily cleaning tasks and stock count.`,
    open: 'Open', phone: 'Phone',
    tip: 'Tip: in Safari/Chrome choose “Add to Home Screen” to keep the app on your phone.',
  };
  const full: Partial<Record<Lang, typeof en>> = {
    lg: {
      hello: `Oli otya ${name}! Eno ye app ya RHero ey'emirimu gy'okuyonja egya buli lunaku n'okubala sitooka.`,
      open: 'Ggulawo', phone: "Ennamba y'essimu",
      tip: 'Amagezi: mu Safari/Chrome londa “Add to Home Screen” app esigale ku ssimu yo.',
    },
    sw: {
      hello: `Habari ${name}! Hii ni programu ya RHero kwa kazi zako za usafi za kila siku na hesabu ya bidhaa.`,
      open: 'Fungua', phone: 'Namba ya simu',
      tip: 'Kidokezo: kwenye Safari/Chrome chagua “Add to Home Screen” ili programu ibaki kwenye simu yako.',
    },
  };
  const greet: Partial<Record<Lang, string>> = {
    hi: `नमस्ते ${name}! यह RHero ऐप है — रोज़ के सफ़ाई काम और स्टॉक गिनती के लिए।`,
    ur: `السلام علیکم ${name}! یہ RHero ایپ ہے — روزانہ صفائی کے کام اور اسٹاک کی گنتی کے لیے۔`,
    bn: `নমস্কার ${name}! এটি RHero অ্যাপ — প্রতিদিনের পরিষ্কারের কাজ ও স্টক গণনার জন্য।`,
    ml: `നമസ്കാരം ${name}! ഇത് RHero ആപ്പ് ആണ് — ദിവസേനയുള്ള ശുചീകരണ ജോലികൾക്കും സ്റ്റോക്ക് എണ്ണലിനും.`,
    tl: `Hi ${name}! Ito ang RHero app — para sa araw-araw na paglilinis at bilang ng stock.`,
    ar: `مرحباً ${name}! هذا تطبيق RHero — لمهام التنظيف اليومية وجرد المخزون.`,
  };
  const o = full[lang];
  const hello = [en.hello, o?.hello ?? greet[lang]].filter(Boolean).join('\n');
  const open = o ? `${en.open} / ${o.open}` : en.open;
  const phoneLabel = o ? `${en.phone} / ${o.phone}` : en.phone;
  const tip = [en.tip, o?.tip].filter(Boolean).join('\n');
  return `${hello}\n\n1) ${open}: ${url}\n2) ${phoneLabel}: ${p}\n3) PIN: ${pin}\n\n${tip}`;
}

export default function Team() {
  const { me } = useMe();
  const team = useTeam();
  const [sel, setSel] = useState<Profile | null>(null);
  const [adding, setAdding] = useState(false);
  const list = team.data ?? [];
  return (
    <div>
      <PageTop title="Team" sub="Cleaners sign in with their phone number + PIN"
        actions={<Button size="sm" icon={<UserPlus className="h-4 w-4" />} onClick={() => setAdding(true)}>Add</Button>} />
      <PageBody>
        {team.isLoading ? <Skeleton className="h-60" /> : (
          <>
            {(['cleaner', 'manager'] as Role[]).map((role) => (
              <section key={role} className="mb-6">
                <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wider text-muted">{role === 'cleaner' ? 'Cleaners' : 'Office managers'}</h2>
                <Card className="divide-y divide-line">
                  {list.filter((p) => p.role === role).map((p) => {
                    const active = p.last_seen_at && Date.now() - new Date(p.last_seen_at).getTime() < 15 * 60_000;
                    return (
                      <button key={p.id} onClick={() => setSel(p)} className="flex w-full items-center gap-3 p-3.5 text-start hover:bg-sunken/60">
                        <div className="relative"><Avatar name={p.full_name} color={p.color} size={42} />
                          <span className={`absolute -bottom-0.5 -end-0.5 h-3.5 w-3.5 rounded-full border-2 border-white ${active ? 'bg-ok' : 'bg-line'}`} /></div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold">{p.full_name} {!p.active && <Badge tone="bad">Disabled</Badge>}</p>
                          <p className="truncate text-[13px] text-muted">{p.phone ? formatPhone(p.phone) : p.email}{p.role === 'cleaner' ? ` · ${langLabel(p.language)}` : ''}</p>
                        </div>
                        <span className="text-[12px] text-muted">{p.id === me.id ? 'You' : active ? 'Active now' : ago(p.last_seen_at)}</span>
                      </button>
                    );
                  })}
                  {list.filter((p) => p.role === role).length === 0 && (
                    <div className="p-4 text-sm text-muted">{role === 'cleaner' ? 'No cleaners yet — add your two cleaners to start.' : '—'}</div>
                  )}
                </Card>
              </section>
            ))}
            <Card className="p-4 text-sm text-muted">
              <p className="font-semibold text-ink">How sign-in works</p>
              <p className="mt-1">Cleaners don't need an email. They open the app, type their mobile number and a 4-digit PIN you give them, and stay signed in. You can reset a PIN or disable an account any time.</p>
            </Card>
          </>
        )}
      </PageBody>
      {adding && <AddSheet onClose={() => setAdding(false)} />}
      {sel && <EditSheet person={(team.data ?? []).find((p) => p.id === sel.id) ?? sel} onClose={() => setSel(null)} />}
    </div>
  );
}

function SharePanel({ name, phone, pin, lang }: { name: string; phone: string; pin: string; lang: Lang }) {
  const msg = loginMessage(name.split(' ')[0], phone, pin, lang);
  return (
    <div className="space-y-3 rounded-2xl border border-ok/30 bg-ok-soft/50 p-4">
      <p className="font-semibold text-ok-ink">Send {name.split(' ')[0]} their login</p>
      <pre className="whitespace-pre-wrap rounded-xl bg-white p-3 text-[13px] leading-relaxed">{msg}</pre>
      <div className="flex flex-wrap gap-2">
        <a href={whatsappUrl(msg, phone)} target="_blank" rel="noreferrer"><Button size="sm" variant="success" icon={<MessageCircle className="h-4 w-4" />}>Send on WhatsApp</Button></a>
        <Button size="sm" variant="secondary" icon={<Copy className="h-4 w-4" />} onClick={async () => { await copyText(msg); toast('Copied'); }}>Copy</Button>
      </div>
    </div>
  );
}

function AddSheet({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [role, setRole] = useState<Role>('cleaner');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState(randomPin());
  const [lang, setLang] = useState<Lang>('en');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<null | { name: string; phone: string; pin: string; lang: Lang }>(null);
  const submit = async () => {
    setBusy(true);
    try {
      await adminCall('members.create', role === 'cleaner'
        ? { role, full_name: name, phone: normalizePhone(phone) ?? phone, pin, language: lang }
        : { role, full_name: name, email, password, phone: phone ? normalizePhone(phone) ?? phone : undefined });
      void qc.invalidateQueries({ queryKey: ['team'] });
      toast(`${name} added`);
      if (role === 'cleaner') setDone({ name, phone: normalizePhone(phone) ?? phone, pin, lang }); else onClose();
    } catch (e) { toast(errMsg(e), 'bad'); } finally { setBusy(false); }
  };
  return (
    <Sheet open onClose={onClose} title={done ? 'Account ready' : 'Add a person'}
      footer={done ? <Button block variant="secondary" onClick={onClose}>Done</Button> : <Button block loading={busy} onClick={() => void submit()} icon={<Plus className="h-4 w-4" />}>Create account</Button>}>
      {done ? <SharePanel {...done} /> : (
        <div className="space-y-4">
          <Segmented<Role> value={role} onChange={setRole} options={[{ value: 'cleaner', label: 'Cleaner' }, { value: 'manager', label: 'Office manager' }]} />
          <Field label="Full name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Grace Nakato" /></Field>
          <Field label="Mobile number" hint={role === 'cleaner' ? 'used to sign in · UAE 05… or Uganda 07… / +256' : 'optional'}><Input type="tel" inputMode="tel" dir="ltr" value={phone} onChange={(e) => setPhone(maskPhoneInput(e.target.value))} placeholder="050 123 4567" /></Field>
          {role === 'cleaner' ? (
            <>
              <Field label="PIN" hint="4–8 digits — share it with them">
                <div className="flex gap-2"><Input inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))} className="text-lg tracking-[.3em]" />
                  <Button variant="secondary" icon={<RefreshCw className="h-4 w-4" />} onClick={() => setPin(randomPin())}>New</Button></div>
              </Field>
              <Field label="App language" hint="English is always shown"><Select value={lang} onChange={(e) => setLang(e.target.value as Lang)}>{LANGS.map((l) => <option key={l.code} value={l.code}>{l.code === 'en' ? 'English only' : `English + ${l.name}${l.native !== l.name ? ` (${l.native})` : ''}`}</option>)}</Select></Field>
            </>
          ) : (
            <>
              <Field label="Email (sign-in)"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
              <Field label="Temporary password" hint="min 8 characters"><Input value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}

function EditSheet({ person, onClose }: { person: Profile; onClose: () => void }) {
  const { me } = useMe();
  const qc = useQueryClient();
  const [name, setName] = useState(person.full_name);
  const [phone, setPhone] = useState(localPhone(person.phone));
  const [lang, setLang] = useState<Lang>(person.language);
  const [newPin, setNewPin] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shared, setShared] = useState<null | { pin: string }>(null);
  const { ask, node } = useConfirm();
  const isSelf = person.id === me.id;
  const phoneChanged = (normalizePhone(phone) ?? '') !== (person.phone ?? '');
  const save = async () => {
    setBusy(true);
    try {
      const payload: Record<string, unknown> = { id: person.id, full_name: name, language: lang };
      if (person.role === 'cleaner') {
        if (phoneChanged || newPin) { payload.phone = normalizePhone(phone) ?? phone; payload.pin = newPin ?? ''; }
      } else if (phoneChanged) payload.phone = normalizePhone(phone) ?? phone;
      await adminCall('members.update', payload);
      void qc.invalidateQueries({ queryKey: ['team'] });
      toast('Saved');
      if (newPin) setShared({ pin: newPin }); else onClose();
    } catch (e) { toast(errMsg(e), 'bad'); } finally { setBusy(false); }
  };
  const setActive = async (active: boolean) => {
    if (!active && !(await ask(`Disable ${person.full_name}?`, { body: 'They will be signed out and can no longer use the app. You can enable them again later.', confirm: 'Disable', danger: true }))) return;
    try { await adminCall('members.update', { id: person.id, active }); void qc.invalidateQueries({ queryKey: ['team'] }); toast(active ? 'Enabled' : 'Disabled'); } catch (e) { toast(errMsg(e), 'bad'); }
  };
  return (
    <Sheet open onClose={onClose} title={person.full_name}
      footer={shared ? <Button block variant="secondary" onClick={onClose}>Done</Button> : <Button block loading={busy} onClick={() => void save()}>Save</Button>}>
      {shared ? <SharePanel name={name} phone={normalizePhone(phone) ?? phone} pin={shared.pin} lang={lang} /> : (
        <div className="space-y-4">
          <Field label="Full name"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Mobile number"><Input type="tel" dir="ltr" value={phone} onChange={(e) => setPhone(maskPhoneInput(e.target.value))} /></Field>
          {person.role === 'cleaner' && (
            <>
              <Field label="App language" hint="English is always shown"><Select value={lang} onChange={(e) => setLang(e.target.value as Lang)}>{LANGS.map((l) => <option key={l.code} value={l.code}>{l.code === 'en' ? 'English only' : `English + ${l.name}${l.native !== l.name ? ` (${l.native})` : ''}`}</option>)}</Select></Field>
              <div className="rounded-2xl border border-line p-3">
                {newPin ? (
                  <Field label="New PIN"><div className="flex gap-2"><Input inputMode="numeric" value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 8))} className="text-lg tracking-[.3em]" /><Button variant="ghost" onClick={() => setNewPin(null)}>Cancel</Button></div></Field>
                ) : (
                  <Button variant="soft" block icon={<KeyRound className="h-4 w-4" />} onClick={() => setNewPin(randomPin())}>Reset PIN</Button>
                )}
                {phoneChanged && !newPin && <p className="mt-2 text-[13px] text-warn-ink">Changing the phone number needs a new PIN.</p>}
              </div>
            </>
          )}
          {!isSelf && (
            <div className="flex items-center justify-between rounded-xl bg-sunken p-3">
              <span><span className="font-medium">Account enabled</span><span className="block text-[13px] text-muted">Disable if someone leaves</span></span>
              <Toggle checked={person.active} onChange={(a) => void setActive(a)} />
            </div>
          )}
        </div>
      )}
      {node}
    </Sheet>
  );
}

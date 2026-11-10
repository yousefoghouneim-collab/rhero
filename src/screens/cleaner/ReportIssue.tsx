import { useRef, useState } from 'react';
import { Camera, CheckCircle2, X } from 'lucide-react';
import { useMe } from '../../auth/AuthProvider';
import { Bi, BiName, useI18n } from '../../i18n';
import { useAreas, useIssues } from '../../lib/data';
import { enqueue } from '../../lib/outbox';
import { compressImage } from '../../lib/image';
import { ago } from '../../lib/time';
import { toast } from '../../lib/toast';
import type { IssueKind } from '../../lib/types';
import type { StrKey } from '../../i18n/strings';
import { Badge, Button, Card, Textarea, cx } from '../../components/ui';

export const ISSUE_KINDS: { kind: IssueKind; emoji: string; key: StrKey }[] = [
  { kind: 'supply', emoji: '🧴', key: 'kSupply' },
  { kind: 'broken', emoji: '🔧', key: 'kBroken' },
  { kind: 'spill', emoji: '💧', key: 'kSpill' },
  { kind: 'pest', emoji: '🐜', key: 'kPest' },
  { kind: 'other', emoji: '💬', key: 'kOther' },
];

export default function ReportIssue() {
  const { me, org } = useMe();
  const { t, tb } = useI18n();
  const areas = useAreas();
  const issues = useIssues();
  const [kind, setKind] = useState<IssueKind | null>(null);
  const [area, setArea] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const mine = (issues.data ?? []).filter((i) => i.reported_by === me.id).slice(0, 8);

  const onFile = async (f?: File) => {
    if (!f) return;
    try { setPhoto(await compressImage(f)); toast(tb('photoAdded')); } catch { toast('Photo could not be read', 'bad'); }
  };
  const submit = () => {
    if (!kind) return;
    setBusy(true);
    enqueue({ kind: 'issue', org_id: org.id, area_id: area, issue_kind: kind, note: note.trim() || null, photo, at: new Date().toISOString() });
    setBusy(false);
    setSent(true);
    setKind(null); setArea(null); setNote(''); setPhoto(null);
    toast(tb('sentOk'));
    setTimeout(() => setSent(false), 4000);
  };

  return (
    <div className="mx-auto max-w-md">
      <header className="sticky top-0 z-20 border-b border-line bg-surface/95 px-5 pb-3 pt-[max(14px,env(safe-area-inset-top))] backdrop-blur">
        <h1 className="text-xl font-semibold leading-tight">⚠️ <Bi k="reportProblem" sub="block text-[13px] font-medium text-muted" /></h1>
      </header>
      <div className="space-y-5 p-4">
        {sent && (
          <div className="flex items-center gap-3 rounded-2xl bg-ok-soft p-4 font-semibold text-ok-ink animate-fadeup">
            <CheckCircle2 className="h-6 w-6 shrink-0" /><span><Bi k="sentOk" sub="block text-[13px] font-medium opacity-85" /></span>
          </div>
        )}
        <section>
          <h2 className="mb-2 px-1 font-semibold"><Bi k="whatsWrong" sub="block text-[13px] font-medium text-muted" /></h2>
          <div className="grid grid-cols-2 gap-2.5">
            {ISSUE_KINDS.map((k) => (
              <button key={k.kind} onClick={() => setKind(k.kind)}
                className={cx('focus-ring flex min-h-24 flex-col items-center justify-center gap-1.5 rounded-2xl border bg-surface px-2 py-2.5 text-center shadow-card transition active:scale-[.98]',
                  kind === k.kind ? 'border-navy-700 ring-4 ring-navy-100' : 'border-line', k.kind === 'other' && 'col-span-2 min-h-16 flex-row gap-3')}>
                <span className="text-3xl leading-none">{k.emoji}</span>
                <span className="text-[15px] font-semibold leading-tight"><Bi k={k.key} sub="mt-0.5 block text-[12.5px] font-medium text-muted" /></span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-2 px-1 font-semibold"><Bi k="where" sub="block text-[13px] font-medium text-muted" /></h2>
          <div className="flex flex-wrap gap-2">
            {(areas.data ?? []).filter((a) => a.active).map((a) => (
              <button key={a.id} onClick={() => setArea(area === a.id ? null : a.id)}
                className={cx('focus-ring flex min-h-11 items-center gap-2 rounded-full border px-4 py-1.5 text-start text-[15px] font-medium transition',
                  area === a.id ? 'border-navy-700 bg-navy-700 text-white' : 'border-line bg-surface')}>
                <span>{a.icon}</span><BiName base={a.name} i18n={a.name_i18n} stack sub="text-[11.5px] font-medium opacity-75" />
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={tb('note')} rows={3} />
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
          {photo ? (
            <div className="relative overflow-hidden rounded-2xl border border-line">
              <img src={photo} alt="" className="max-h-64 w-full object-cover" />
              <button onClick={() => setPhoto(null)} className="absolute end-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white" aria-label="remove"><X className="h-5 w-5" /></button>
            </div>
          ) : (
            <Button variant="secondary" size="lg" block icon={<Camera className="h-5 w-5" />} onClick={() => fileRef.current?.click()}><Bi k="addPhoto" stack="center" sub="text-[12px] font-medium opacity-70" /></Button>
          )}
        </section>

        <Button size="xl" block disabled={!kind} loading={busy} onClick={submit}><Bi k="send" stack="center" sub="text-[13px] font-medium opacity-80" /></Button>

        {mine.length > 0 && (
          <section>
            <h2 className="mb-2 mt-2 px-1 text-[13px] font-semibold uppercase tracking-wider text-muted"><Bi k="myReports" sub="block text-[11px] font-medium normal-case tracking-normal opacity-80" /></h2>
            <Card className="divide-y divide-line">
              {mine.map((i) => {
                const k = ISSUE_KINDS.find((x) => x.kind === i.kind)!;
                const a = (areas.data ?? []).find((x) => x.id === i.area_id);
                return (
                  <div key={i.id} className="flex items-center gap-3 p-3.5">
                    <span className="text-2xl">{k.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{i.note || t(k.key)}</p>
                      <p className="text-[13px] text-muted">{a ? `${a.icon} ${a.name} · ` : ''}{ago(i.created_at)}</p>
                    </div>
                    <Badge tone={i.status === 'open' ? 'warn' : 'ok'}>{i.status === 'open' ? t('issueOpen') : t('issueFixed')}</Badge>
                  </div>
                );
              })}
            </Card>
          </section>
        )}
      </div>
    </div>
  );
}

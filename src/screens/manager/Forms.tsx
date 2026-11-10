import { useMemo } from 'react';
import qrcode from 'qrcode-generator';
import { Copy, ExternalLink, MessageCircle, Printer, ShoppingBag, IdCard } from 'lucide-react';
import { useMe } from '../../auth/AuthProvider';
import { toast } from '../../lib/toast';
import { Button, Card } from '../../components/ui';
import { copyText, PageBody, PageTop, whatsappUrl } from './common';

function Qr({ text, size = 148 }: { text: string; size?: number }) {
  const src = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    return qr.createDataURL(6, 2);
  }, [text]);
  return <img src={src} width={size} height={size} alt="QR code" className="rounded-xl border border-line bg-white p-1" />;
}

export default function Forms() {
  const { org } = useMe();
  const base = window.location.origin;
  const forms = [
    {
      kind: 'request', icon: ShoppingBag, title: 'Item request (shopping list)',
      body: 'Employees ask for what they need — what, why, when, how many, specs and a link. Requests land in “Requests & orders” and notify you.',
      share: (url: string) => `Hi team 👋\nNeed something for work (monitor, chair, dock, stationery…)? Please send your request here so nothing gets lost:\n${url}\nThank you — Dina, Office Manager`,
    },
    {
      kind: 'pass', icon: IdCard, title: 'Gate pass request',
      body: 'For anyone expecting a visitor or interviewee: visitor name, Emirates ID / passport, contact, reason, date & time, host and team.',
      share: (url: string) => `Hi team 👋\nExpecting a visitor at Dubai South? Please fill in the visitor's details at least 24 hours before the visit:\n${url}\nThank you — Dina, Office Manager`,
    },
  ];
  return (
    <div>
      <PageTop title="Forms & templates" sub="Share with employees — no login needed" />
      <PageBody>
        <div className="grid gap-4 lg:grid-cols-2">
          {forms.map((f) => {
            const url = `${base}/f/${org.form_token}/${f.kind}`;
            return (
              <Card key={f.kind} className="p-5">
                <div className="flex items-start gap-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-navy-50 text-navy-700"><f.icon className="h-6 w-6" /></span>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-semibold">{f.title}</h2>
                    <p className="mt-1 text-sm text-muted">{f.body}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
                  <Qr text={url} />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="truncate rounded-xl bg-sunken px-3 py-2 font-mono text-[13px]" title={url}>{url}</div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" icon={<Copy className="h-4 w-4" />} onClick={async () => { await copyText(url); toast('Link copied'); }}>Copy link</Button>
                      <a href={whatsappUrl(f.share(url))} target="_blank" rel="noreferrer"><Button size="sm" variant="secondary" icon={<MessageCircle className="h-4 w-4" />}>Share</Button></a>
                      <a href={url} target="_blank" rel="noreferrer"><Button size="sm" variant="secondary" icon={<ExternalLink className="h-4 w-4" />}>Open</Button></a>
                      <a href={`/print/${f.kind}`} target="_blank" rel="noreferrer"><Button size="sm" variant="secondary" icon={<Printer className="h-4 w-4" />}>Printable blank</Button></a>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
        <Card className="mt-4 p-5">
          <h2 className="font-semibold">Tips</h2>
          <ul className="mt-2 list-disc space-y-1 ps-5 text-sm text-muted">
            <li>Print the QR codes and stick them in the kitchen and at reception — staff scan and fill the form on their phone.</li>
            <li>Add the links to the team's Teams/WhatsApp group description.</li>
            <li>Gate pass requests come with everything building security needs — open one and tap “Copy for security”.</li>
          </ul>
        </Card>
      </PageBody>
    </div>
  );
}

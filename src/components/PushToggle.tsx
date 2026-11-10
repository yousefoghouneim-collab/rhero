import { useEffect, useState } from 'react';
import { BellRing, Send } from 'lucide-react';
import { useMe } from '../auth/AuthProvider';
import { currentSubscription, disablePush, enablePush, pushSupport, sendTestPush } from '../lib/push';
import { errMsg } from '../lib/supabase';
import { toast } from '../lib/toast';
import { Button, Toggle } from './ui';

export function PushToggle() {
  const { me } = useMe();
  const support = pushSupport();
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { void currentSubscription().then((s) => setOn(!!s)); }, []);
  const change = async (v: boolean) => {
    setBusy(true);
    try {
      if (v) { await enablePush(me.id); setOn(true); toast('Phone notifications on'); }
      else { await disablePush(); setOn(false); toast('Phone notifications off'); }
    } catch (e) { toast(errMsg(e), 'bad'); } finally { setBusy(false); }
  };
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-start gap-3">
          <BellRing className="mt-0.5 h-5 w-5 text-navy-500" />
          <span><span className="block font-semibold">Phone notifications</span><span className="block text-[13px] text-muted">Daily report at 4 PM, red stock, issues — even when the app is closed.</span></span>
        </span>
        <Toggle checked={on} onChange={(v) => void change(v)} disabled={!support.ok || busy} label="Phone notifications" />
      </div>
      {!support.ok && <p className="mt-2 rounded-xl bg-amber-50 p-3 text-[13px] text-amber-800">{support.reason}</p>}
      {on && <Button size="sm" variant="soft" className="mt-3" icon={<Send className="h-4 w-4" />} onClick={async () => { try { const n = await sendTestPush(); toast(n ? 'Test sent — check your phone' : 'No device registered', n ? 'ok' : 'bad'); } catch (e) { toast(errMsg(e), 'bad'); } }}>Send a test</Button>}
    </div>
  );
}

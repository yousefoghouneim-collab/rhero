import { Check } from 'lucide-react';
import { LANGS } from '../i18n/strings';
import type { Lang } from '../lib/types';
import { Sheet, cx } from './ui';
import { useI18n } from '../i18n';

export function LanguageSheet({ open, onClose, value, onPick }: { open: boolean; onClose: () => void; value: Lang; onPick: (l: Lang) => void }) {
  const { tb } = useI18n();
  return (
    <Sheet open={open} onClose={onClose} title={tb('language')}>
      <div className="grid gap-2">
        {LANGS.map((l) => (
          <button key={l.code} onClick={() => { onPick(l.code); onClose(); }}
            className={cx('focus-ring flex h-14 items-center justify-between rounded-2xl border px-4 text-start transition',
              value === l.code ? 'border-navy-700 bg-navy-50' : 'border-line bg-surface hover:border-navy-200')}>
            <span className="flex items-baseline gap-3">
              <span className="text-lg font-semibold" dir={l.dir}>{l.native}</span>
              <span className="text-sm text-muted">{l.code === 'en' ? 'English only' : `${l.native !== l.name ? `${l.name} · ` : ''}with English`}</span>
            </span>
            {value === l.code && <Check className="h-5 w-5 text-navy-700" />}
          </button>
        ))}
      </div>
    </Sheet>
  );
}

import { forwardRef, useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { Check, Loader2, Minus, Plus, X } from 'lucide-react';
import { toastStore, dismissToast } from '../lib/toast';
import { useStore } from '../lib/store';
import type { StockStatus } from '../lib/stock';
import { STATUS_LABEL } from '../lib/stock';

export const cx = clsx;

// ---------------------------------------------------------------- Button
type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'soft' | 'white';
type BtnSize = 'sm' | 'md' | 'lg' | 'xl';
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant; size?: BtnSize; loading?: boolean; icon?: ReactNode; block?: boolean;
}
const btnBase = 'focus-ring inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition active:scale-[.98] disabled:opacity-50 disabled:pointer-events-none select-none whitespace-nowrap';
const btnVariant: Record<BtnVariant, string> = {
  primary: 'bg-navy-700 text-white hover:bg-navy-600 shadow-sm',
  secondary: 'bg-surface text-ink border border-line hover:bg-sunken shadow-card',
  ghost: 'text-navy-700 hover:bg-navy-50',
  danger: 'bg-bad text-white hover:bg-red-700',
  success: 'bg-ok text-white hover:bg-green-800',
  soft: 'bg-navy-50 text-navy-700 hover:bg-navy-100',
  white: 'bg-white text-navy-700 hover:bg-navy-50 shadow-sm',
};
const btnSize: Record<BtnSize, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-4 text-[15px]',
  lg: 'h-12 px-5 text-base',
  xl: 'h-14 px-6 text-lg rounded-2xl',
};
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, icon, block, className, children, disabled, ...rest }, ref,
) {
  return (
    <button ref={ref} className={cx(btnBase, btnVariant[variant], btnSize[size], block && 'w-full', className)} disabled={disabled || loading} {...rest}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
});

export function IconButton({ label, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button aria-label={label} title={label} className={cx('focus-ring inline-flex h-10 w-10 items-center justify-center rounded-xl text-navy-700 hover:bg-navy-50 active:scale-95 transition', className)} {...rest}>
      {children}
    </button>
  );
}

// ---------------------------------------------------------------- Card
export function Card({ className, children, onClick, as = 'div' }: { className?: string; children: ReactNode; onClick?: () => void; as?: 'div' | 'button' | 'section' }) {
  const C = as as 'div';
  return (
    <C onClick={onClick} className={cx('rounded-2xl bg-surface border border-line shadow-card', onClick && 'cursor-pointer text-start w-full transition hover:border-navy-200 active:scale-[.995]', className)}>
      {children}
    </C>
  );
}
export function SectionTitle({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cx('flex items-center justify-between gap-3 mb-2.5 mt-6 first:mt-0', className)}>
      <h2 className="text-[13px] font-semibold uppercase tracking-wider text-muted">{children}</h2>
      {action}
    </div>
  );
}

// ---------------------------------------------------------------- Badges
type Tone = 'ok' | 'warn' | 'bad' | 'neutral' | 'navy' | 'red' | 'violet' | 'teal' | 'amber';
const toneCls: Record<Tone, string> = {
  ok: 'bg-ok-soft text-ok-ink',
  warn: 'bg-warn-soft text-warn-ink',
  bad: 'bg-bad-soft text-bad-ink',
  neutral: 'bg-sunken text-muted border border-line',
  navy: 'bg-navy-50 text-navy-700',
  red: 'bg-brand-redSoft text-brand-red',
  violet: 'bg-violet-50 text-violet-700',
  teal: 'bg-teal-50 text-teal-700',
  amber: 'bg-amber-50 text-amber-700',
};
export function Badge({ tone = 'neutral', children, className, dot }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap', toneCls[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
const statusTone: Record<StockStatus, Tone> = { red: 'bad', orange: 'warn', green: 'ok', none: 'neutral' };
export function StatusPill({ status, label, className }: { status: StockStatus; label?: string; className?: string }) {
  return <Badge tone={statusTone[status]} dot className={className}>{label ?? STATUS_LABEL[status]}</Badge>;
}
export const statusBar: Record<StockStatus, string> = { red: 'bg-bad', orange: 'bg-warn', green: 'bg-ok', none: 'bg-line' };
export const statusText: Record<StockStatus, string> = { red: 'text-bad', orange: 'text-warn', green: 'text-ok', none: 'text-muted' };

// ---------------------------------------------------------------- Progress
export function ProgressRing({ value, size = 56, stroke = 6, track = 'stroke-line', bar = 'stroke-navy-700', children, className }: {
  value: number; size?: number; stroke?: number; track?: string; bar?: string; children?: ReactNode; className?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value || 0));
  return (
    <div className={cx('relative inline-flex items-center justify-center shrink-0', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className={track} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round" className={cx(bar, 'transition-[stroke-dashoffset] duration-500')}
          strokeDasharray={c} strokeDashoffset={c * (1 - v)} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}
export function ProgressBar({ value, className, bar = 'bg-navy-700', height = 'h-2' }: { value: number; className?: string; bar?: string; height?: string }) {
  const v = Math.max(0, Math.min(1, value || 0));
  return (
    <div className={cx('w-full overflow-hidden rounded-full bg-line/70', height, className)}>
      <div className={cx('h-full rounded-full transition-[width] duration-500', bar)} style={{ width: `${v * 100}%` }} />
    </div>
  );
}

// ---------------------------------------------------------------- Inputs
export function Label({ children, hint, htmlFor }: { children: ReactNode; hint?: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 flex items-baseline justify-between gap-2 text-sm font-semibold text-ink">
      <span>{children}</span>
      {hint && <span className="text-xs font-normal text-muted">{hint}</span>}
    </label>
  );
}
const inputCls = 'w-full rounded-xl border border-line bg-surface px-3.5 h-12 text-[16px] text-ink placeholder:text-muted/70 outline-none transition focus:border-navy-400 focus:ring-4 focus:ring-navy-100 disabled:bg-sunken';
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cx(inputCls, className)} {...rest} />;
});
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cx(inputCls, 'h-auto min-h-[96px] py-3 leading-snug', className)} {...rest} />;
});
export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(inputCls, 'appearance-none bg-[url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2716%27 height=%2716%27 fill=%27none%27 stroke=%27%23646e8a%27 stroke-width=%272%27%3E%3Cpath d=%27m4 6 4 4 4-4%27/%3E%3C/svg%3E")] bg-no-repeat bg-[right_12px_center] pe-9', className)} {...rest}>
      {children}
    </select>
  );
}
export function Field({ label, hint, children, error }: { label: ReactNode; hint?: ReactNode; children: ReactNode; error?: string | null }) {
  return (
    <div>
      <Label hint={hint}>{label}</Label>
      {children}
      {error && <p className="mt-1 text-sm text-bad">{error}</p>}
    </div>
  );
}
export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}
      className={cx('focus-ring relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition', checked ? 'bg-navy-700' : 'bg-line', disabled && 'opacity-50')}>
      <span className={cx('inline-block h-5 w-5 transform rounded-full bg-white shadow transition', checked ? 'translate-x-6 rtl:-translate-x-6' : 'translate-x-1 rtl:-translate-x-1')} />
    </button>
  );
}

/** Big +/- number control for counting stock with one thumb */
export function Stepper({ value, onChange, min = 0, max = 9999, label, sub, size = 'lg', changed }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number; label?: string; sub?: string | null; size?: 'md' | 'lg'; changed?: boolean;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const set = (v: number) => onChange(Math.max(min, Math.min(max, v)));
  const h = size === 'lg' ? 'h-12' : 'h-10';
  const w = size === 'lg' ? 'w-12' : 'w-10';
  return (
    <div className="flex flex-col items-center gap-1">
      {label && <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</span>}
      {sub && <span className="-mt-1 text-[10.5px] font-medium leading-none text-muted/90">{sub}</span>}
      <div className={cx('flex items-stretch overflow-hidden rounded-xl border bg-surface', changed ? 'border-navy-500 ring-2 ring-navy-100' : 'border-line')}>
        <button type="button" aria-label="minus" onClick={() => set(value - 1)} className={cx(w, h, 'flex items-center justify-center text-navy-700 active:bg-navy-50 disabled:opacity-30')} disabled={value <= min}>
          <Minus className="h-5 w-5" />
        </button>
        <input
          inputMode="numeric" pattern="[0-9]*" value={text} aria-label={label}
          onChange={(e) => { const t = e.target.value.replace(/[^\d]/g, ''); setText(t); if (t !== '') set(Number(t)); }}
          onBlur={() => { if (text === '') setText(String(value)); }}
          onFocus={(e) => e.target.select()}
          className={cx(h, 'w-12 border-x border-line text-center text-lg font-semibold tnum outline-none focus:bg-navy-50')}
        />
        <button type="button" aria-label="plus" onClick={() => set(value + 1)} className={cx(w, h, 'flex items-center justify-center text-navy-700 active:bg-navy-50')}>
          <Plus className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Segmented / Tabs
export function Segmented<T extends string>({ value, onChange, options, className, size = 'md' }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode; count?: number }[]; className?: string; size?: 'sm' | 'md';
}) {
  return (
    <div className={cx('flex rounded-xl bg-sunken p-1 border border-line', className)}>
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)}
          className={cx('focus-ring flex-1 rounded-lg px-3 font-semibold transition whitespace-nowrap flex items-center justify-center gap-1.5',
            size === 'sm' ? 'h-8 text-[13px]' : 'h-10 text-sm',
            value === o.value ? 'bg-surface text-navy-700 shadow-card' : 'text-muted hover:text-ink')}>
          {o.label}
          {o.count !== undefined && <span className={cx('rounded-full px-1.5 text-[11px] tnum', value === o.value ? 'bg-navy-50' : 'bg-line/60')}>{o.count}</span>}
        </button>
      ))}
    </div>
  );
}
export function Chips<T extends string>({ value, onChange, options, className }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode; count?: number; tone?: string }[]; className?: string;
}) {
  return (
    <div className={cx('flex gap-2 overflow-x-auto scrollbar-none -mx-4 px-4 pb-1', className)}>
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)}
          className={cx('focus-ring shrink-0 rounded-full border px-3.5 h-9 text-sm font-semibold transition flex items-center gap-1.5',
            value === o.value ? 'bg-navy-700 border-navy-700 text-white' : 'bg-surface border-line text-ink hover:border-navy-200')}>
          {o.tone && <span className={cx('h-2 w-2 rounded-full', o.tone)} />}
          {o.label}
          {o.count !== undefined && <span className={cx('tnum text-xs', value === o.value ? 'text-white/80' : 'text-muted')}>{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- Sheet (bottom sheet / dialog)
export function Sheet({ open, onClose, title, children, footer, wide }: {
  open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-navy-900/45 backdrop-blur-[2px] animate-fadeup" onClick={onClose} />
      <div className={cx('relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl bg-surface shadow-lift animate-sheet sm:rounded-3xl', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}>
        <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-line sm:hidden" />
        {title && (
          <div className="flex items-center justify-between gap-3 px-5 pt-3 pb-2 sm:pt-5">
            <h3 className="text-lg font-semibold leading-tight">{title}</h3>
            <IconButton label="Close" onClick={onClose} className="-me-2"><X className="h-5 w-5" /></IconButton>
          </div>
        )}
        <div className="overflow-y-auto px-5 pb-5 pt-1">{children}</div>
        {footer && <div className="border-t border-line px-5 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function useConfirm() {
  const [state, setState] = useState<null | { title: string; body?: string; confirm: string; danger?: boolean; resolve: (v: boolean) => void }>(null);
  const ask = (title: string, opts: { body?: string; confirm?: string; danger?: boolean } = {}) =>
    new Promise<boolean>((resolve) => setState({ title, body: opts.body, confirm: opts.confirm ?? 'Confirm', danger: opts.danger, resolve }));
  const node = state ? (
    <Sheet open onClose={() => { state.resolve(false); setState(null); }} title={state.title}
      footer={<div className="flex gap-2"><Button variant="secondary" block onClick={() => { state.resolve(false); setState(null); }}>Cancel</Button>
        <Button variant={state.danger ? 'danger' : 'primary'} block onClick={() => { state.resolve(true); setState(null); }}>{state.confirm}</Button></div>}>
      {state.body && <p className="text-muted">{state.body}</p>}
    </Sheet>
  ) : null;
  return { ask, node };
}

// ---------------------------------------------------------------- misc
export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cx('h-5 w-5 animate-spin text-navy-400', className)} />;
}
export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-xl bg-line/60', className)} />;
}
export function PageLoader() {
  return (
    <div className="space-y-3 p-4">
      <Skeleton className="h-24" /><Skeleton className="h-16" /><Skeleton className="h-16" /><Skeleton className="h-16" />
    </div>
  );
}
export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-surface/60 px-6 py-10 text-center">
      {icon && <div className="mb-3 text-navy-300">{icon}</div>}
      <p className="font-semibold">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-muted">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
export function Avatar({ name, color, size = 36, className }: { name: string; color?: string | null; size?: number; className?: string }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join('');
  return (
    <span className={cx('inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white', className)}
      style={{ width: size, height: size, background: color || '#202854', fontSize: size * 0.38 }}>
      {initials}
    </span>
  );
}
export function CheckCircle({ checked, pending, size = 30 }: { checked: boolean; pending?: boolean; size?: number }) {
  return (
    <span className={cx('inline-flex shrink-0 items-center justify-center rounded-full border-2 transition',
      checked ? 'border-ok bg-ok text-white animate-pop' : 'border-navy-200 bg-white')} style={{ width: size, height: size }}>
      {checked && <Check className="h-[60%] w-[60%]" strokeWidth={3.2} />}
      {pending && !checked && <span className="h-2 w-2 rounded-full bg-navy-300 animate-pulse2" />}
    </span>
  );
}
export function Stat({ label, value, sub, tone, className }: { label: ReactNode; value: ReactNode; sub?: ReactNode; tone?: string; className?: string }) {
  return (
    <div className={className}>
      <div className="text-[12px] font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className={cx('mt-0.5 text-2xl font-semibold tnum leading-tight', tone)}>{value}</div>
      {sub && <div className="text-[13px] text-muted">{sub}</div>}
    </div>
  );
}

export function Toaster() {
  const toasts = useStore(toastStore);
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-3 pt-[max(12px,env(safe-area-inset-top))]">
      {toasts.map((t) => (
        <div key={t.id} className={cx('pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl px-4 py-3 text-[15px] font-medium shadow-lift animate-fadeup',
          t.tone === 'bad' ? 'bg-bad text-white' : t.tone === 'info' ? 'bg-navy-700 text-white' : 'bg-ink text-white')}>
          {t.tone === 'ok' && <Check className="h-5 w-5 shrink-0 text-green-300" />}
          <span className="min-w-0">{t.text}</span>
          {t.action && <button className="ms-1 shrink-0 font-semibold underline underline-offset-2" onClick={() => { t.action!.run(); dismissToast(t.id); }}>{t.action.label}</button>}
        </div>
      ))}
    </div>,
    document.body,
  );
}

import logo from '../assets/brand/rhero-logo.svg';
import logoDark from '../assets/brand/rhero-logo-dark.svg';
import mark from '../assets/brand/rhero-mark.svg';
import markWhite from '../assets/brand/rhero-mark-white.svg';
import { cx } from './ui';

export function Logo({ dark, className }: { dark?: boolean; className?: string }) {
  return <img src={dark ? logoDark : logo} alt="RHero" className={cx('h-8 w-auto select-none', className)} draggable={false} />;
}
export function Mark({ white, className }: { white?: boolean; className?: string }) {
  return <img src={white ? markWhite : mark} alt="" aria-hidden className={cx('h-7 w-7 select-none', className)} draggable={false} />;
}
export function hideBootSplash() {
  const el = document.getElementById('boot');
  if (!el) return;
  el.style.opacity = '0';
  setTimeout(() => el.remove(), 260);
}

import { useEffect, useState } from 'react';

export const DEFAULT_TZ = 'Asia/Dubai';

export type OrgNow = { date: string; minutes: number; dow: number; hhmm: string };
const dowMap: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

/** Current date/time in the org's time zone (Dubai by default). */
export function orgNow(tz = DEFAULT_TZ, at: Date = new Date()): OrgNow {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short',
  }).formatToParts(at);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const hour = Number(g('hour')) % 24;
  const minute = Number(g('minute'));
  return {
    date: `${g('year')}-${g('month')}-${g('day')}`,
    minutes: hour * 60 + minute,
    dow: dowMap[g('weekday')] ?? 1,
    hhmm: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
  };
}

/** Re-renders every `ms` so time-based status (rounds) stays fresh. */
export function useOrgNow(tz = DEFAULT_TZ, ms = 30_000): OrgNow {
  const [now, setNow] = useState(() => orgNow(tz));
  useEffect(() => {
    const id = setInterval(() => setNow(orgNow(tz)), ms);
    const onVis = () => document.visibilityState === 'visible' && setNow(orgNow(tz));
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVis); };
  }, [tz, ms]);
  return now;
}

/** "08:30:00" → 510 */
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}
/** "08:30:00" → "08:30" */
export const hhmm = (t?: string | null) => (t ? t.slice(0, 5) : '');

/** Format an ISO timestamp as HH:MM in the org time zone */
export function clock(iso?: string | null, tz = DEFAULT_TZ): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
}
/** minutes since midnight (org tz) of an ISO timestamp */
export function isoMinutes(iso: string, tz = DEFAULT_TZ): number {
  const p = orgNow(tz, new Date(iso));
  return p.minutes;
}
/** "2026-11-10" → "Tue 10 Nov" */
export function prettyDate(d: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }, locale = 'en-GB'): string {
  const [y, m, day] = d.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, { ...opts, timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, day)));
}
export function addDays(d: string, n: number): string {
  const [y, m, day] = d.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, day + n));
  return t.toISOString().slice(0, 10);
}
export function dowOf(d: string): number {
  const [y, m, day] = d.split('-').map(Number);
  const w = new Date(Date.UTC(y, m - 1, day)).getUTCDay();
  return w === 0 ? 7 : w;
}
export function ago(iso?: string | null): string {
  if (!iso) return 'never';
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return `${d} day${d > 1 ? 's' : ''} ago`;
}
export function durationLabel(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
export const WEEKDAYS = [
  { n: 1, short: 'Mon' }, { n: 2, short: 'Tue' }, { n: 3, short: 'Wed' }, { n: 4, short: 'Thu' },
  { n: 5, short: 'Fri' }, { n: 6, short: 'Sat' }, { n: 7, short: 'Sun' },
];

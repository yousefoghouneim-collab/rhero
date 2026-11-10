import type { Item } from './types';

export type StockStatus = 'red' | 'orange' | 'green' | 'none';

/** Status uses the sealed stock in store (opened packs are already in use). */
export function itemStatus(i: Pick<Item, 'qty_store' | 'warn_qty' | 'min_qty' | 'last_counted_at'>): StockStatus {
  if (!i.last_counted_at) return 'none';
  if (i.qty_store <= i.min_qty) return 'red';
  if (i.qty_store <= i.warn_qty) return 'orange';
  return 'green';
}
export function available(i: Pick<Item, 'qty_store' | 'qty_opened'>): number {
  return Number(i.qty_store) + Number(i.qty_opened);
}
/** How many to buy to get back to the target (par) level. */
export function needQty(i: Pick<Item, 'par_qty' | 'qty_store' | 'qty_opened'>): number {
  return Math.max(Math.ceil(Number(i.par_qty) - available(i)), 0);
}
export const STATUS_LABEL: Record<StockStatus, string> = { red: 'Order now', orange: 'Running low', green: 'In stock', none: 'Not counted' };
export const STATUS_RANK: Record<StockStatus, number> = { red: 0, orange: 1, green: 2, none: 3 };
export function fmtQty(n: number | null | undefined): string {
  if (n === null || n === undefined) return '–';
  const v = Number(n);
  return Number.isInteger(v) ? String(v) : v.toFixed(1).replace(/\.0$/, '');
}
export function money(n: number | null | undefined, currency = 'AED'): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '–';
  return `${currency} ${Number(n).toLocaleString('en-AE', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
}
export function plural(n: number, one: string, many?: string): string {
  return `${n} ${n === 1 ? one : many ?? one + 's'}`;
}

import { describe, expect, it } from 'vitest';
import { normalizePhone, phoneEmail, pinPassword, formatPhone, maskPhoneInput, localPhone } from '../lib/phone';
import { STRINGS, LANGS, langLabel } from '../i18n/strings';
import { longDate } from '../i18n/locale';
import catalog from '../../supabase/seed/catalog.json';
import { itemStatus, needQty, available, fmtQty } from '../lib/stock';
import { orgNow, timeToMinutes, addDays, dowOf } from '../lib/time';
import { buildDay, routineState } from '../lib/data';
import { mergeOps, pendingTaskState, pendingCounts, viewOps, type Op } from '../lib/outbox';
import type { Area, Routine, Task, TaskDone } from '../lib/types';

describe('phone sign-in', () => {
  it('normalizes the usual UAE formats', () => {
    expect(normalizePhone('050 111 1111')).toBe('+971501111111');
    expect(normalizePhone('0501111111')).toBe('+971501111111');
    expect(normalizePhone('501111111')).toBe('+971501111111');
    expect(normalizePhone('+971 50 111 1111')).toBe('+971501111111');
    expect(normalizePhone('00971501111111')).toBe('+971501111111');
    expect(normalizePhone('971501111111')).toBe('+971501111111');
    expect(normalizePhone('(050) 111-1111')).toBe('+971501111111');
  });
  it('accepts international numbers with + and rejects junk', () => {
    expect(normalizePhone('+91 98765 43210')).toBe('+919876543210');
    expect(normalizePhone('12345')).toBeNull();
    expect(normalizePhone('abc')).toBeNull();
    expect(normalizePhone('')).toBeNull();
  });
  it('understands Ugandan numbers (+256)', () => {
    expect(normalizePhone('0772 123 456')).toBe('+256772123456');
    expect(normalizePhone('0772123456')).toBe('+256772123456');
    expect(normalizePhone('772123456')).toBe('+256772123456');
    expect(normalizePhone('+256 772 123 456')).toBe('+256772123456');
    expect(normalizePhone('256772123456')).toBe('+256772123456');
    expect(normalizePhone('00256772123456')).toBe('+256772123456');
    // UAE numbers are unchanged
    expect(normalizePhone('050 222 2222')).toBe('+971502222222');
    expect(formatPhone('+256772123456')).toBe('+256 772 123 456');
    expect(maskPhoneInput('0772123456')).toBe('0772 123 456');
    expect(localPhone('+256772123456')).toBe('0772 123 456');
    expect(localPhone('+971501112222')).toBe('050 111 2222');
  });
  it('derives the private login deterministically', () => {
    expect(phoneEmail('+971501111111')).toBe('971501111111@phone.rhero.app');
    expect(pinPassword('1111', '+971501111111')).toBe('rh-1111-971501111111');
    expect(formatPhone('+971501112222')).toBe('+971 50 111 2222');
    expect(maskPhoneInput('0501112222')).toBe('050 111 2222');
  });
});

describe('stock status (red / orange / green)', () => {
  const base = { warn_qty: 3, min_qty: 1, par_qty: 8, last_counted_at: '2026-11-10T10:00:00Z' };
  it('uses sealed stock in store', () => {
    expect(itemStatus({ ...base, qty_store: 0 })).toBe('red');
    expect(itemStatus({ ...base, qty_store: 1 })).toBe('red');
    expect(itemStatus({ ...base, qty_store: 2 })).toBe('orange');
    expect(itemStatus({ ...base, qty_store: 3 })).toBe('orange');
    expect(itemStatus({ ...base, qty_store: 4 })).toBe('green');
  });
  it('shows "not counted" until the first count', () => {
    expect(itemStatus({ ...base, qty_store: 0, last_counted_at: null })).toBe('none');
  });
  it('computes what to order to get back to target', () => {
    expect(available({ qty_store: 2, qty_opened: 1 })).toBe(3);
    expect(needQty({ par_qty: 8, qty_store: 2, qty_opened: 1 })).toBe(5);
    expect(needQty({ par_qty: 8, qty_store: 9, qty_opened: 1 })).toBe(0);
    expect(fmtQty(2.5)).toBe('2.5');
    expect(fmtQty(3)).toBe('3');
  });
});

describe('Dubai time helpers', () => {
  it('converts UTC to Asia/Dubai (UTC+4)', () => {
    const n = orgNow('Asia/Dubai', new Date('2026-11-09T20:30:00Z'));
    expect(n.date).toBe('2026-11-10');
    expect(n.hhmm).toBe('00:30');
    expect(n.dow).toBe(2); // Tuesday
  });
  it('handles dates and times', () => {
    expect(timeToMinutes('08:30:00')).toBe(510);
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(dowOf('2026-11-15')).toBe(7);
  });
});

describe('rounds', () => {
  it('derives round status from time and progress', () => {
    expect(routineState(510, 570, 500, 10, 0)).toBe('upcoming');
    expect(routineState(510, 570, 530, 10, 3)).toBe('active');
    expect(routineState(510, 570, 600, 10, 9)).toBe('overdue');
    expect(routineState(510, 570, 600, 10, 10)).toBe('done');
    expect(routineState(510, 570, 400, 10, 10)).toBe('done');
  });

  const routine = (id: string, start: string, end: string, days = [1, 2, 3, 4, 5]): Routine => ({
    id, org_id: 'o', name: id, name_i18n: {}, description: null, kind: 'cleaning', start_time: start, end_time: end, days, color: 'navy', icon: '🧹', sort: 1, active: true,
  });
  const task = (id: string, routine_id: string, days: number[] | null = null): Task => ({
    id, org_id: 'o', routine_id, area_id: 'a', title: id, title_i18n: {}, days, assignee_id: null, sort: 1, active: true,
  });
  const area: Area = { id: 'a', org_id: 'o', name: 'Kitchen', name_i18n: {}, icon: '☕', sort: 1, active: true };

  it('builds the day, honours weekly tasks and merges the offline queue', () => {
    const routines = [routine('morning', '08:30:00', '09:30:00'), routine('weekend', '10:00:00', '11:00:00', [6])];
    const tasks = [task('t1', 'morning'), task('t2', 'morning'), task('t3', 'morning', [5])];
    const done: TaskDone[] = [{ id: 'd1', org_id: 'o', task_id: 't1', routine_id: 'morning', day: '2026-11-10', done_by: 'u', done_at: '2026-11-10T05:00:00Z', note: null, photo_path: null }];
    const ops: Op[] = [{ kind: 'done', id: 'x', task_id: 't2', day: '2026-11-10', done_at: '2026-11-10T05:10:00Z' }];
    const day = buildDay({ routines, tasks, areas: [area], done, ops, day: '2026-11-10', dow: 2, nowMin: 545, tz: 'Asia/Dubai' });
    expect(day).toHaveLength(1);                       // weekend routine not on Tuesday
    expect(day[0].tasks.map((t) => t.id)).toEqual(['t1', 't2']); // Friday-only task hidden
    expect(day[0].doneCount).toBe(2);                  // one from server + one queued offline
    expect(day[0].tasks[1].pending).toBe(true);
    expect(day[0].state).toBe('done');
  });
});

describe('offline queue', () => {
  const tick = (task_id: string, id = task_id): Op => ({ kind: 'done', id, task_id, day: 'd', done_at: 'now' });
  const untick = (task_id: string, id = 'u' + task_id): Op => ({ kind: 'undone', id, task_id, day: 'd' });
  it('a tick then untick of the same task cancels out', () => {
    let ops: Op[] = [];
    ops = mergeOps(ops, tick('t1'));
    ops = mergeOps(ops, untick('t1'));
    expect(ops).toHaveLength(0);
  });
  it('keeps independent tasks and the last state per task', () => {
    let ops: Op[] = [];
    ops = mergeOps(ops, tick('t1'));
    ops = mergeOps(ops, tick('t2'));
    ops = mergeOps(ops, tick('t1', 'again'));
    expect(ops.map((o) => o.id)).toEqual(['t2', 'again']);
    expect(pendingTaskState(ops, 'd').get('t1')).toBe(true);
  });
  it('merges stock counts for the same day', () => {
    let ops: Op[] = [];
    ops = mergeOps(ops, { kind: 'counts', id: 'c1', day: 'd', at: 'x', rows: [{ item_id: 'a', qty_opened: 1, qty_store: 2 }, { item_id: 'b', qty_opened: 0, qty_store: 5 }] });
    ops = mergeOps(ops, { kind: 'counts', id: 'c2', day: 'd', at: 'y', rows: [{ item_id: 'a', qty_opened: 1, qty_store: 1 }] });
    expect(ops).toHaveLength(1);
    const m = pendingCounts(ops, 'd');
    expect(m.get('a')?.qty_store).toBe(1);
    expect(m.get('b')?.qty_store).toBe(5);
  });
});

describe('languages for the Ugandan team', () => {
  it('offers English, Luganda and Kiswahili first', () => {
    expect(LANGS.slice(0, 3).map((l) => l.code)).toEqual(['en', 'lg', 'sw']);
  });
  it('always pairs another language with English', () => {
    expect(langLabel('en')).toBe('English');
    expect(langLabel('lg')).toBe('English + Luganda');
    expect(langLabel('sw')).toBe('English + Swahili');
    expect(langLabel(null)).toBe('English');
  });
  it('has every app text in every language, with the same {placeholders}', () => {
    const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');
    for (const [key, row] of Object.entries(STRINGS)) {
      for (const l of LANGS) {
        const v = (row as Record<string, string>)[l.code];
        expect(v, `${key}.${l.code}`).toBeTruthy();
        expect(vars(v), `${key}.${l.code}`).toBe(vars(row.en));
      }
    }
  });
  it('translates every area, round and task of the default catalog', () => {
    for (const x of [...catalog.areas, ...catalog.routines, ...catalog.tasks] as { i18n: Record<string, string> }[]) {
      expect(x.i18n.lg).toBeTruthy();
      expect(x.i18n.sw).toBeTruthy();
    }
  });
  it('writes the date in Luganda and Kiswahili', () => {
    expect(longDate('2026-11-10', 'lg')).toBe('Lwakubiri, 10 Novemba');
    expect(longDate('2026-11-10', 'sw')).toBe('Jumanne, 10 Novemba');
    expect(longDate('2026-11-10', 'en')).toBe('Tuesday 10 November');
  });
});

describe('no flicker after a tick is confirmed', () => {
  const done = { kind: 'done', id: '1', task_id: 't1', day: 'd', done_at: 'x' } as Op;
  it('keeps a confirmed tick on screen until fresh data arrives', () => {
    expect(pendingTaskState(viewOps({ ops: [], settled: [{ ...done, settledAt: Date.now() }] }), 'd').get('t1')).toBe(true);
  });
  it('forgets old confirmations', () => {
    expect(pendingTaskState(viewOps({ ops: [], settled: [{ ...done, settledAt: Date.now() - 60_000 }] }), 'd').get('t1')).toBeUndefined();
  });
  it('a newer queued untick wins over a confirmed tick', () => {
    const undo = { kind: 'undone', id: '2', task_id: 't1', day: 'd' } as Op;
    expect(pendingTaskState(viewOps({ ops: [undo], settled: [{ ...done, settledAt: Date.now() }] }), 'd').get('t1')).toBe(false);
  });
});

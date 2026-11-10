import { useMemo } from 'react';
import { useMe } from '../auth/AuthProvider';
import { buildDay, useAreas, useCounts, useDone, useItems, useRoutines, useTasks, type DayTask } from './data';
import { enqueue, pendingCounts, useOutbox } from './outbox';
import { useOrgNow } from './time';

/** Everything the "today" screens need, merged with the offline queue. */
export function useToday() {
  const { org } = useMe();
  const now = useOrgNow(org.timezone);
  const routinesQ = useRoutines();
  const tasksQ = useTasks();
  const areasQ = useAreas();
  const doneQ = useDone(now.date);
  const itemsQ = useItems();
  const countsQ = useCounts(now.date);
  const { ops } = useOutbox();

  const stock = useMemo(() => {
    const pantry = (itemsQ.data ?? []).filter((i) => i.section === 'pantry' && i.active);
    const counted = new Set((countsQ.data ?? []).map((c) => c.item_id));
    pendingCounts(ops, now.date).forEach((_v, k) => counted.add(k));
    return { total: pantry.length, counted: pantry.filter((i) => counted.has(i.id)).length };
  }, [itemsQ.data, countsQ.data, ops, now.date]);

  const rounds = useMemo(() => buildDay({
    routines: routinesQ.data ?? [], tasks: tasksQ.data ?? [], areas: areasQ.data ?? [], done: doneQ.data ?? [],
    ops, day: now.date, dow: now.dow, nowMin: now.minutes, tz: org.timezone, stock,
  }), [routinesQ.data, tasksQ.data, areasQ.data, doneQ.data, ops, now.date, now.dow, now.minutes, org.timezone, stock]);

  const cleaningRounds = rounds.filter((r) => r.kind !== 'stock');
  const total = cleaningRounds.reduce((s, r) => s + r.total, 0);
  const done = cleaningRounds.reduce((s, r) => s + r.doneCount, 0);
  const loading = routinesQ.isLoading || tasksQ.isLoading || areasQ.isLoading || doneQ.isLoading;

  const toggle = (task: DayTask) => {
    if (task.done) enqueue({ kind: 'undone', task_id: task.id, day: now.date });
    else enqueue({ kind: 'done', task_id: task.id, day: now.date, done_at: new Date().toISOString() });
    try { navigator.vibrate?.(task.done ? 8 : 18); } catch { /* not supported */ }
  };

  return { now, rounds, total, done, stock, loading, toggle, doneRows: doneQ.data ?? [] };
}

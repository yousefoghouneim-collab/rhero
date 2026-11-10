import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import { useMe } from '../auth/AuthProvider';
import type {
  Area, DailyReport, Issue, Item, Notification, Order, Profile, PurchaseRequest, ReportData, Routine, StockCount, Task, TaskDone, VisitorPass,
} from './types';
import { isoMinutes, timeToMinutes } from './time';
import { pendingTaskState, type Op } from './outbox';

async function rows<T>(q: PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export function useAreas() {
  const { org } = useMe();
  return useQuery({ queryKey: ['areas', org.id], queryFn: () => rows<Area>(supabase.from('rh_areas').select('*').eq('org_id', org.id).order('sort')) });
}
export function useRoutines() {
  const { org } = useMe();
  return useQuery({ queryKey: ['routines', org.id], queryFn: () => rows<Routine>(supabase.from('rh_routines').select('*').eq('org_id', org.id).order('sort')) });
}
export function useTasks() {
  const { org } = useMe();
  return useQuery({ queryKey: ['tasks', org.id], queryFn: () => rows<Task>(supabase.from('rh_tasks').select('*').eq('org_id', org.id).order('sort')) });
}
export function useDone(day: string) {
  const { org } = useMe();
  return useQuery({
    queryKey: ['done', org.id, day],
    queryFn: () => rows<TaskDone>(supabase.from('rh_task_done').select('*').eq('org_id', org.id).eq('day', day)),
  });
}
export function useItems() {
  const { org } = useMe();
  return useQuery({
    queryKey: ['items', org.id],
    queryFn: async () => (await rows<Item>(supabase.from('rh_items').select('*').eq('org_id', org.id).order('sort')))
      .map((i) => ({ ...i, qty_store: Number(i.qty_store), qty_opened: Number(i.qty_opened), par_qty: Number(i.par_qty), warn_qty: Number(i.warn_qty), min_qty: Number(i.min_qty) })),
  });
}
export function useCounts(day: string) {
  const { org } = useMe();
  return useQuery({
    queryKey: ['counts', org.id, day],
    queryFn: () => rows<StockCount>(supabase.from('rh_stock_counts').select('*').eq('org_id', org.id).eq('day', day)),
  });
}
export function useItemHistory(itemId: string | undefined, days = 30) {
  const { org } = useMe();
  return useQuery({
    queryKey: ['itemHistory', org.id, itemId, days],
    enabled: !!itemId,
    queryFn: () => rows<StockCount>(supabase.from('rh_stock_counts').select('*').eq('item_id', itemId!).order('day', { ascending: false }).limit(days)),
  });
}
export function useStockMoves(itemId: string | undefined) {
  const { org } = useMe();
  return useQuery({
    queryKey: ['moves', org.id, itemId],
    enabled: !!itemId,
    queryFn: () => rows<{ id: string; kind: string; qty: number; note: string | null; created_at: string; order_id: string | null }>(
      supabase.from('rh_stock_moves').select('id,kind,qty,note,created_at,order_id').eq('item_id', itemId!).order('created_at', { ascending: false }).limit(20)),
  });
}
export function useIssues() {
  const { org } = useMe();
  return useQuery({
    queryKey: ['issues', org.id],
    queryFn: () => rows<Issue>(supabase.from('rh_issues').select('*').eq('org_id', org.id).order('created_at', { ascending: false }).limit(100)),
  });
}
export function useNotifications() {
  const { me } = useMe();
  return useQuery({
    queryKey: ['notifications', me.id],
    queryFn: () => rows<Notification>(supabase.from('rh_notifications').select('*').eq('user_id', me.id).order('created_at', { ascending: false }).limit(60)),
  });
}
export function useTeam() {
  const { org } = useMe();
  return useQuery({
    queryKey: ['team', org.id],
    queryFn: () => rows<Profile>(supabase.from('rh_profiles').select('*').eq('org_id', org.id).order('created_at')),
  });
}
export function useOrders() {
  const { org } = useMe();
  return useQuery({
    queryKey: ['orders', org.id],
    queryFn: async () => (await rows<Order>(supabase.from('rh_orders').select('*, lines:rh_order_lines(*)').eq('org_id', org.id).order('created_at', { ascending: false }).limit(100)))
      .map((o) => ({ ...o, lines: (o.lines ?? []).map((l) => ({ ...l, qty: Number(l.qty), received_qty: Number(l.received_qty), unit_price: l.unit_price === null ? null : Number(l.unit_price) })) })),
  });
}
export function useRequests() {
  const { org } = useMe();
  return useQuery({
    queryKey: ['requests', org.id],
    queryFn: () => rows<PurchaseRequest>(supabase.from('rh_requests').select('*').eq('org_id', org.id).order('created_at', { ascending: false }).limit(300)),
  });
}
export function usePasses() {
  const { org } = useMe();
  return useQuery({
    queryKey: ['passes', org.id],
    queryFn: () => rows<VisitorPass>(supabase.from('rh_visitor_passes').select('*').eq('org_id', org.id).order('visit_date', { ascending: false }).limit(300)),
  });
}
export function useReports() {
  const { org } = useMe();
  return useQuery({
    queryKey: ['reports', org.id],
    queryFn: () => rows<DailyReport>(supabase.from('rh_daily_reports').select('*').eq('org_id', org.id).order('day', { ascending: false }).limit(60)),
  });
}
export function useReportPreview(day: string, enabled = true) {
  const { org } = useMe();
  return useQuery({
    queryKey: ['reportPreview', org.id, day],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('rh_report_preview', { p_day: day });
      if (error) throw error;
      return data as ReportData;
    },
  });
}

// ---------------------------------------------------------------------------
// Today's schedule (rounds + tasks + completions), merged with offline queue
// ---------------------------------------------------------------------------
export type RoutineState = 'upcoming' | 'active' | 'done' | 'overdue';
export type DayTask = Task & { area: Area | null; doneRow: TaskDone | null; done: boolean; pending: boolean; late: boolean };
export type DayRoutine = Routine & {
  tasks: DayTask[]; total: number; doneCount: number; state: RoutineState; startMin: number; endMin: number; lateCount: number;
};

export function routineState(startMin: number, endMin: number, now: number, total: number, done: number): RoutineState {
  if (total > 0 && done >= total) return 'done';
  if (now < startMin) return 'upcoming';
  if (now <= endMin) return 'active';
  return 'overdue';
}

export function buildDay(opts: {
  routines: Routine[]; tasks: Task[]; areas: Area[]; done: TaskDone[]; ops: Op[]; day: string; dow: number; nowMin: number; tz: string;
  stock?: { total: number; counted: number };
}): DayRoutine[] {
  const { routines, tasks, areas, done, ops, day, dow, nowMin, tz, stock } = opts;
  const areaMap = new Map(areas.map((a) => [a.id, a]));
  const doneMap = new Map(done.map((d) => [d.task_id, d]));
  const pend = pendingTaskState(ops, day);
  return routines
    .filter((r) => r.active && r.days.includes(dow))
    .map((r) => {
      const startMin = timeToMinutes(r.start_time);
      const endMin = timeToMinutes(r.end_time);
      const list: DayTask[] = tasks
        .filter((t) => t.routine_id === r.id && t.active && (!t.days || t.days.length === 0 || t.days.includes(dow)))
        .sort((a, b) => a.sort - b.sort)
        .map((t) => {
          const row = doneMap.get(t.id) ?? null;
          const p = pend.get(t.id);
          const isDone = p === undefined ? !!row : p;
          const late = !!row && isoMinutes(row.done_at, tz) > endMin;
          return { ...t, area: t.area_id ? areaMap.get(t.area_id) ?? null : null, doneRow: isDone ? row : null, done: isDone, pending: p !== undefined, late };
        });
      let total = list.length;
      let doneCount = list.filter((t) => t.done).length;
      if (r.kind === 'stock' && stock) { total = stock.total; doneCount = stock.counted; }
      return {
        ...r, tasks: list, total, doneCount, startMin, endMin,
        lateCount: list.filter((t) => t.late).length,
        state: routineState(startMin, endMin, nowMin, total, doneCount),
      };
    })
    .sort((a, b) => a.startMin - b.startMin || a.sort - b.sort);
}

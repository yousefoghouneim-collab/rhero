// Offline-first queue for the cleaners' actions (task ticks, stock counts, issues).
// Every action is saved locally first, shown instantly, then sent to the server.
// If there is no connection it stays in the queue and is retried automatically.
import { supabase } from './supabase';
import { createStore, useStore } from './store';

export type CountRow = { item_id: string; qty_opened: number; qty_store: number };
export type Op =
  | { kind: 'done'; id: string; task_id: string; day: string; done_at: string }
  | { kind: 'undone'; id: string; task_id: string; day: string }
  | { kind: 'counts'; id: string; day: string; rows: CountRow[]; at: string }
  | { kind: 'issue'; id: string; org_id: string; area_id: string | null; issue_kind: string; note: string | null; photo?: string | null; at: string };

type State = { ops: Op[]; syncing: boolean; online: boolean; lastError: string | null };
const KEY = 'rhero-outbox-v1';

function load(): Op[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}
export const outbox = createStore<State>({ ops: load(), syncing: false, online: typeof navigator === 'undefined' ? true : navigator.onLine, lastError: null });
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(outbox.get().ops)); } catch { /* storage full or blocked */ }
}
export const useOutbox = () => useStore(outbox);
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));

type Listener = (op: Op, ok: boolean, err?: string) => void;
const listeners = new Set<Listener>();
export function onOpSettled(l: Listener) { listeners.add(l); return () => { listeners.delete(l); }; }

type DistOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** Pure queue merge: a tick + untick of the same task cancel out; counts for a day merge. */
export function mergeOps(ops: Op[], full: Op): Op[] {
  if (full.kind === 'done' || full.kind === 'undone') {
    const opposite = full.kind === 'done' ? 'undone' : 'done';
    const idx = ops.findIndex((o) => o.kind === opposite && 'task_id' in o && o.task_id === full.task_id && o.day === full.day);
    if (idx >= 0) return ops.filter((_, i) => i !== idx);
    const rest = ops.filter((o) => !(o.kind === full.kind && 'task_id' in o && o.task_id === full.task_id && o.day === full.day));
    return [...rest, full];
  }
  if (full.kind === 'counts') {
    const prev = ops.find((o) => o.kind === 'counts' && o.day === full.day) as Extract<Op, { kind: 'counts' }> | undefined;
    if (prev) {
      const map = new Map(prev.rows.map((r) => [r.item_id, r]));
      full.rows.forEach((r) => map.set(r.item_id, r));
      return [...ops.filter((o) => o !== prev), { ...full, rows: [...map.values()] }];
    }
  }
  return [...ops, full];
}

export function enqueue(op: DistOmit<Op, 'id'> & { id?: string }) {
  const full = { ...op, id: op.id ?? uid() } as Op;
  outbox.set((s) => ({ ...s, ops: mergeOps(s.ops, full) }));
  persist();
  void flush();
  return full.id;
}

function isNetworkError(e: unknown): boolean {
  const err = e as { message?: string; code?: string; status?: number } | null;
  const m = (err?.message ?? String(e ?? '')).toLowerCase();
  return !err?.code && (m.includes('fetch') || m.includes('network') || m.includes('load failed') || m.includes('timeout') || err?.status === 0);
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [head, b64] = dataUrl.split(',');
  const mime = head.match(/data:(.*?);/)?.[1] ?? 'image/jpeg';
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

async function run(op: Op) {
  if (op.kind === 'done') {
    const { error } = await supabase.from('rh_task_done')
      .upsert({ task_id: op.task_id, day: op.day, done_at: op.done_at }, { onConflict: 'task_id,day', ignoreDuplicates: true });
    if (error) throw error;
  } else if (op.kind === 'undone') {
    const { error } = await supabase.from('rh_task_done').delete().eq('task_id', op.task_id).eq('day', op.day);
    if (error) throw error;
  } else if (op.kind === 'counts') {
    const rows = op.rows.map((r) => ({ item_id: r.item_id, day: op.day, qty_opened: r.qty_opened, qty_store: r.qty_store }));
    for (let i = 0; i < rows.length; i += 100) {
      const { error } = await supabase.from('rh_stock_counts').upsert(rows.slice(i, i + 100), { onConflict: 'item_id,day' });
      if (error) throw error;
    }
  } else if (op.kind === 'issue') {
    let photo_path: string | null = null;
    if (op.photo) {
      photo_path = `${op.org_id}/${op.id}.jpg`;
      const { error: ue } = await supabase.storage.from('rhero').upload(photo_path, dataUrlToBlob(op.photo), { contentType: 'image/jpeg', upsert: true });
      if (ue) throw ue;
    }
    const { error } = await supabase.from('rh_issues').upsert(
      { id: op.id, area_id: op.area_id, kind: op.issue_kind, note: op.note, photo_path },
      { onConflict: 'id', ignoreDuplicates: true });
    if (error) throw error;
  }
}

let flushing: Promise<void> | null = null;
export function flush(): Promise<void> {
  if (flushing) return flushing;
  const run1 = (async () => {
    await Promise.resolve(); // always async, so the guard below is set before work starts
    outbox.set((s) => ({ ...s, syncing: true }));
    try {
      while (outbox.get().ops.length) {
        const op = outbox.get().ops[0];
        try {
          await run(op);
          outbox.set((s) => ({ ...s, ops: s.ops.filter((o) => o.id !== op.id), online: true, lastError: null }));
          persist();
          listeners.forEach((l) => l(op, true));
        } catch (e) {
          if (isNetworkError(e)) {
            outbox.set((s) => ({ ...s, online: false }));
            break;
          }
          // permanent failure (e.g. task deleted) — drop it so the queue never gets stuck
          const msg = (e as { message?: string })?.message ?? 'Failed';
          outbox.set((s) => ({ ...s, ops: s.ops.filter((o) => o.id !== op.id), lastError: msg }));
          persist();
          listeners.forEach((l) => l(op, false, msg));
        }
      }
    } finally {
      outbox.set((s) => ({ ...s, syncing: false }));
    }
  })();
  flushing = run1;
  void run1.finally(() => {
    if (flushing === run1) flushing = null;
    // something was queued while we were finishing → go again
    if (outbox.get().ops.length && outbox.get().online) setTimeout(() => void flush(), 50);
  });
  return run1;
}

export function startOutbox() {
  const setOnline = (v: boolean) => outbox.set((s) => ({ ...s, online: v }));
  window.addEventListener('online', () => { setOnline(true); void flush(); });
  window.addEventListener('offline', () => setOnline(false));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void flush(); });
  setInterval(() => { if (outbox.get().ops.length) void flush(); }, 15_000);
  void flush();
}

/** Pending task state for a day: task_id → true (ticked) / false (unticked) */
export function pendingTaskState(ops: Op[], day: string): Map<string, boolean> {
  const m = new Map<string, boolean>();
  for (const o of ops) {
    if ((o.kind === 'done' || o.kind === 'undone') && o.day === day) m.set(o.task_id, o.kind === 'done');
  }
  return m;
}
export function pendingCounts(ops: Op[], day: string): Map<string, CountRow> {
  const m = new Map<string, CountRow>();
  for (const o of ops) if (o.kind === 'counts' && o.day === day) o.rows.forEach((r) => m.set(r.item_id, r));
  return m;
}
export function clearOutbox() {
  outbox.set((s) => ({ ...s, ops: [] }));
  persist();
}

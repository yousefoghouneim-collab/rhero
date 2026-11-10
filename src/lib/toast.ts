import { createStore } from './store';

export type Toast = { id: number; text: string; tone: 'ok' | 'bad' | 'info'; action?: { label: string; run: () => void } };
export const toastStore = createStore<Toast[]>([]);
let seq = 1;
export function toast(text: string, tone: Toast['tone'] = 'ok', action?: Toast['action'], ms = 3200) {
  const id = seq++;
  toastStore.set((list) => [...list.slice(-2), { id, text, tone, action }]);
  setTimeout(() => toastStore.set((list) => list.filter((t) => t.id !== id)), ms);
  return id;
}
export const dismissToast = (id: number) => toastStore.set((l) => l.filter((t) => t.id !== id));

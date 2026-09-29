import { useSyncExternalStore } from 'react';

/**
 * A single shared clock aligned to whole seconds, so every live readout on
 * the page ticks in unison from one timer.
 */
const listeners = new Set<() => void>();
let now = Date.now();
let timer = 0;

function schedule(): void {
  const delay = 1000 - (Date.now() % 1000) + 5;
  timer = window.setTimeout(() => {
    now = Date.now();
    listeners.forEach((l) => l());
    schedule();
  }, delay);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) {
    now = Date.now();
    schedule();
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.clearTimeout(timer);
  };
}

export function useNow(): number {
  return useSyncExternalStore(
    subscribe,
    () => now,
    () => now,
  );
}

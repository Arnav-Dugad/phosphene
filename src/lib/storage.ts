import type { StateStorage } from 'zustand/middleware';

/**
 * localStorage wrapper that never throws: private windows, blocked cookies and
 * quota errors all degrade to an in-memory store for the session.
 */
const memory = new Map<string, string>();

function available(): Storage | null {
  try {
    const probe = '__phosphene_probe__';
    window.localStorage.setItem(probe, probe);
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

let resolved: Storage | null | undefined;
const backend = (): Storage | null => {
  if (resolved === undefined) resolved = typeof window === 'undefined' ? null : available();
  return resolved;
};

export function readItem(name: string): string | null {
  try {
    return backend()?.getItem(name) ?? memory.get(name) ?? null;
  } catch {
    return memory.get(name) ?? null;
  }
}

export function writeItem(name: string, value: string): void {
  memory.set(name, value);
  try {
    backend()?.setItem(name, value);
  } catch {
    /* quota or privacy mode — the in-memory copy still serves this session */
  }
}

export function removeItem(name: string): void {
  memory.delete(name);
  try {
    backend()?.removeItem(name);
  } catch {
    /* ignore */
  }
}

/** Adapter for zustand's persist middleware. */
export const safeStorage: StateStorage = {
  getItem: readItem,
  setItem: writeItem,
  removeItem,
};

export const STORAGE_KEYS = {
  settings: 'phosphene:settings',
  progress: 'phosphene:progress',
  commands: 'phosphene:recent-commands',
} as const;

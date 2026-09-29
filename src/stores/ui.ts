import { create } from 'zustand';
import type { SpectralKey } from '../design/tokens.ts';

export type ToastTone = 'info' | 'success' | 'fragment' | 'warning';

export interface Toast {
  id: number;
  tone: ToastTone;
  title: string;
  body?: string;
  line?: SpectralKey;
  /** Milliseconds before auto-dismissal. */
  ttl: number;
}

export type IntroPhase = 'boot' | 'definition' | 'opening' | 'done';

interface UiStore {
  menuOpen: boolean;
  paletteOpen: boolean;
  terminalOpen: boolean;
  /** The terminal's code loads the first time it opens, then stays mounted. */
  terminalMounted: boolean;
  introPhase: IntroPhase;
  /** Increments to replay the intro in full. */
  introRun: number;
  toasts: Toast[];
  setMenu: (open: boolean) => void;
  setPalette: (open: boolean) => void;
  setTerminal: (open: boolean) => void;
  setIntroPhase: (phase: IntroPhase) => void;
  replayIntro: () => void;
  toast: (toast: Omit<Toast, 'id' | 'ttl'> & { ttl?: number }) => number;
  dismissToast: (id: number) => void;
}

let toastId = 0;

export const useUi = create<UiStore>()((set) => ({
  menuOpen: false,
  paletteOpen: false,
  terminalOpen: false,
  terminalMounted: false,
  introPhase: 'boot',
  introRun: 0,
  toasts: [],
  setMenu: (menuOpen) => set({ menuOpen, paletteOpen: false }),
  setPalette: (paletteOpen) => set({ paletteOpen, menuOpen: false }),
  setTerminal: (terminalOpen) =>
    set((s) => ({ terminalOpen, terminalMounted: s.terminalMounted || terminalOpen, paletteOpen: false, menuOpen: false })),
  setIntroPhase: (introPhase) => set({ introPhase }),
  replayIntro: () => set((s) => ({ introRun: s.introRun + 1, introPhase: 'boot', menuOpen: false, paletteOpen: false })),
  toast: (toast) => {
    const id = ++toastId;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { ttl: 5200, ...toast, id }] }));
    return id;
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Imperative helper for non-React code (audio, engine, easter eggs). */
export const toast = (t: Omit<Toast, 'id' | 'ttl'> & { ttl?: number }): number => useUi.getState().toast(t);

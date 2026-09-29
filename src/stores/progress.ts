import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { safeStorage, STORAGE_KEYS } from '../lib/storage.ts';

/** Fragment ids are the roman-numeral lines of Transmission Zero: 1…12. */
export type FragmentId = number;

const PATH_LIMIT = 96;

export interface ProgressState {
  firstVisit: number | null;
  lastVisit: number | null;
  /** The visit before this session began — used for "welcome back" copy. */
  previousVisit: number | null;
  visits: number;
  introSeen: boolean;
  /** fragment id → unlock timestamp */
  fragments: Record<string, number>;
  /** Ordered observation path of route ids (consecutive duplicates collapsed). */
  path: string[];
  relicsViewed: string[];
  /** Text the observer inscribed in the Glyph Synthesizer. */
  sigil: string | null;
}

interface ProgressStore extends ProgressState {
  /** Unlocks a fragment; returns true only the first time. */
  unlock: (id: FragmentId) => boolean;
  hasFragment: (id: FragmentId) => boolean;
  visit: (routeId: string) => void;
  viewRelic: (relicId: string) => void;
  setSigil: (text: string | null) => void;
  markIntroSeen: () => void;
  beginSession: () => void;
  reset: () => void;
}

const INITIAL: ProgressState = {
  firstVisit: null,
  lastVisit: null,
  previousVisit: null,
  visits: 0,
  introSeen: false,
  fragments: {},
  path: [],
  relicsViewed: [],
  sigil: null,
};

export const useProgress = create<ProgressStore>()(
  persist(
    (set, get) => ({
      ...INITIAL,
      unlock: (id) => {
        const key = String(id);
        if (get().fragments[key]) return false;
        set((s) => ({ fragments: { ...s.fragments, [key]: Date.now() } }));
        return true;
      },
      hasFragment: (id) => Boolean(get().fragments[String(id)]),
      visit: (routeId) =>
        set((s) => {
          if (s.path[s.path.length - 1] === routeId) return s;
          const path = [...s.path, routeId];
          return { path: path.length > PATH_LIMIT ? path.slice(path.length - PATH_LIMIT) : path };
        }),
      viewRelic: (relicId) =>
        set((s) => (s.relicsViewed.includes(relicId) ? s : { relicsViewed: [...s.relicsViewed, relicId] })),
      setSigil: (text) => set({ sigil: text?.trim() ? text.trim().slice(0, 32) : null }),
      markIntroSeen: () => set({ introSeen: true }),
      beginSession: () =>
        set((s) => ({
          firstVisit: s.firstVisit ?? Date.now(),
          previousVisit: s.lastVisit,
          lastVisit: Date.now(),
          visits: s.visits + 1,
        })),
      reset: () => set({ ...INITIAL, firstVisit: Date.now(), lastVisit: Date.now(), visits: 1 }),
    }),
    {
      name: STORAGE_KEYS.progress,
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: (s): ProgressState => ({
        firstVisit: s.firstVisit,
        lastVisit: s.lastVisit,
        previousVisit: s.previousVisit,
        visits: s.visits,
        introSeen: s.introSeen,
        fragments: s.fragments,
        path: s.path,
        relicsViewed: s.relicsViewed,
        sigil: s.sigil,
      }),
    },
  ),
);

export const fragmentCount = (fragments: Record<string, number>): number => Object.keys(fragments).length;

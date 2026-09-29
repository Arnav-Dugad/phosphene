import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { prefersMoreContrast, prefersReducedMotion } from '../lib/device.ts';
import { safeStorage, STORAGE_KEYS } from '../lib/storage.ts';

export type QualityTier = 'ultra' | 'high' | 'balanced' | 'eco';
export const QUALITY_TIERS: readonly QualityTier[] = ['ultra', 'high', 'balanced', 'eco'];

export type MotionPreference = 'system' | 'full' | 'gentle' | 'still';
export type ResolvedMotion = 'full' | 'gentle' | 'still';
export type QualityPreference = 'auto' | QualityTier;
export type ThemePreference = 'nocturne' | 'plate';
export type ContrastPreference = 'system' | 'standard' | 'high';
export type CursorPreference = 'instrument' | 'system';
export type IntroPreference = 'first-visit' | 'always' | 'never';

export interface Settings {
  motion: MotionPreference;
  quality: QualityPreference;
  sound: boolean;
  volume: number;
  theme: ThemePreference;
  contrast: ContrastPreference;
  cursor: CursorPreference;
  grain: boolean;
  intro: IntroPreference;
  /** Alternate "spectral vision" mode — an easter egg. */
  spectral: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  motion: 'system',
  quality: 'auto',
  sound: false,
  volume: 0.7,
  theme: 'nocturne',
  contrast: 'system',
  cursor: 'instrument',
  grain: true,
  intro: 'first-visit',
  spectral: false,
};

interface SettingsStore extends Settings {
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  reset: () => void;
}

export const useSettings = create<SettingsStore>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      set: (key, value) => set({ [key]: value } as Pick<Settings, typeof key>),
      reset: () => set({ ...DEFAULT_SETTINGS }),
    }),
    {
      name: STORAGE_KEYS.settings,
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: ({ set: _set, reset: _reset, ...rest }) => rest,
    },
  ),
);

export function resolveMotion(pref: MotionPreference): ResolvedMotion {
  if (pref !== 'system') return pref;
  return prefersReducedMotion() ? 'still' : 'full';
}

export function resolveContrast(pref: ContrastPreference): 'standard' | 'high' {
  if (pref !== 'system') return pref;
  return prefersMoreContrast() ? 'high' : 'standard';
}

/** Non-reactive snapshot for engine code running outside React. */
export const settingsSnapshot = (): Settings => useSettings.getState();

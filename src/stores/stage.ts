import { create } from 'zustand';
import type { SceneKey } from '../content/types.ts';
import type { QualityTier } from './settings.ts';

export type SceneParams = Readonly<Record<string, unknown>>;

export type StageStatus = 'booting' | 'loading' | 'ready' | 'error' | 'unsupported';

interface StageStore {
  scene: SceneKey;
  params: SceneParams;
  /** Increments whenever a route requests a scene, so identical requests still propagate. */
  revision: number;
  status: StageStatus;
  /** Tier currently rendering (after auto-detection and adaptation). */
  tier: QualityTier;
  /** Tier the device was classified as on boot. */
  detectedTier: QualityTier;
  gpu: string;
  fps: number;
  /** Boot progress in [0, 1]. */
  loadProgress: number;
  setScene: (scene: SceneKey, params?: SceneParams) => void;
  patchParams: (params: SceneParams) => void;
  setStatus: (status: StageStatus) => void;
  setTier: (tier: QualityTier) => void;
  setDetected: (tier: QualityTier, gpu: string) => void;
  setFps: (fps: number) => void;
  setLoadProgress: (value: number) => void;
}

export const useStage = create<StageStore>()((set) => ({
  scene: 'lacuna',
  params: { mode: 'ambient' },
  revision: 0,
  status: 'booting',
  tier: 'balanced',
  detectedTier: 'balanced',
  gpu: 'unknown',
  fps: 0,
  loadProgress: 0,
  setScene: (scene, params = {}) => set((s) => ({ scene, params, revision: s.revision + 1 })),
  patchParams: (params) => set((s) => ({ params: { ...s.params, ...params }, revision: s.revision + 1 })),
  setStatus: (status) => set({ status }),
  setTier: (tier) => set({ tier }),
  setDetected: (detectedTier, gpu) => set({ detectedTier, gpu }),
  setFps: (fps) => set({ fps }),
  setLoadProgress: (value) => set((s) => ({ loadProgress: Math.max(s.loadProgress, Math.min(1, value)) })),
}));

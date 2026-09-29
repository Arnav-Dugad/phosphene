import type { SceneKey } from '../../content/types.ts';
import type { SceneFactory } from '../types.ts';

type Loader = () => Promise<{ default: SceneFactory }>;

/**
 * Each scene is its own chunk: the stage only downloads the geometry and
 * shaders for places the visitor actually goes.
 */
export const sceneLoaders: Partial<Record<SceneKey, Loader>> = {
  lacuna: () => import('./lacuna/LacunaScene.ts'),
  orrery: () => import('./orrery/OrreryScene.ts'),
  relic: () => import('./relic/RelicScene.ts'),
  interference: () => import('./interference/InterferenceScene.ts'),
  resonance: () => import('./resonance/ResonanceScene.ts'),
  gravity: () => import('./gravity/GravityScene.ts'),
  terrain: () => import('./terrain/TerrainScene.ts'),
  aurora: () => import('./aurora/AuroraScene.ts'),
};

export function loaderFor(key: SceneKey): Loader {
  const loader = sceneLoaders[key] ?? sceneLoaders.lacuna;
  if (!loader) throw new Error(`No scene loader registered for "${key}"`);
  return loader;
}

/** Warm a scene chunk (e.g. on link hover) without instantiating it. */
export function prefetchScene(key: SceneKey): void {
  void loaderFor(key)().catch(() => undefined);
}

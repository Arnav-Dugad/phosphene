import { useEffect, useState } from 'react';
import type { SceneKey } from '../content/types.ts';
import { onEngine } from '../engine/handle.ts';
import type { StageScene } from '../engine/types.ts';

/**
 * The live scene instance for `key` once the stage has mounted it, so pages
 * can talk to their scene (e.g. read label anchors, register callbacks).
 */
export function useStageApi<T extends StageScene>(key: SceneKey): T | null {
  const [scene, setScene] = useState<T | null>(null);
  useEffect(() => {
    let offScene: (() => void) | undefined;
    const offEngine = onEngine((engine) => {
      offScene?.();
      offScene = engine?.onSceneReady((next) => setScene(engine.sceneKey === key ? (next as T) : null));
    });
    return () => {
      offEngine();
      offScene?.();
      setScene(null);
    };
  }, [key]);
  return scene;
}

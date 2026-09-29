import { useLayoutEffect } from 'react';
import type { SceneKey } from '../content/types.ts';
import { useStage, type SceneParams } from '../stores/stage.ts';

/**
 * Declares which scene the persistent stage should show for the current page.
 * Params are compared by value so inline objects don't cause churn.
 */
export function useStageScene(scene: SceneKey, params: SceneParams = {}): void {
  const key = JSON.stringify(params);
  useLayoutEffect(() => {
    useStage.getState().setScene(scene, JSON.parse(key) as SceneParams);
  }, [scene, key]);
}

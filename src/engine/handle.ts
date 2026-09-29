import type { SceneKey } from '../content/types.ts';
import type { StageScene } from './types.ts';

/**
 * A three.js-free handle to the running engine. React code imports this
 * module — never Engine.ts — so no page chunk drags the renderer into the
 * initial bundle.
 */
export interface EngineHandle {
  readonly sceneKey: SceneKey | null;
  readonly activeScene: StageScene | null;
  onSceneReady(listener: (scene: StageScene) => void): () => void;
  dispatchPointer(kind: 'down' | 'move' | 'up', e: PointerEvent): void;
  dispatchWheel(e: WheelEvent): void;
  dispatchZoom(factor: number): void;
  dispatchKey(key: string): boolean;
  invalidate(): void;
}

let instance: EngineHandle | null = null;
const listeners = new Set<(engine: EngineHandle | null) => void>();

export const getEngine = (): EngineHandle | null => instance;

export function setEngine(engine: EngineHandle | null): void {
  instance = engine;
  for (const listener of listeners) listener(engine);
}

/** Subscribes to engine availability; fires immediately if already running. */
export function onEngine(listener: (engine: EngineHandle | null) => void): () => void {
  listeners.add(listener);
  if (instance) listener(instance);
  return () => listeners.delete(listener);
}

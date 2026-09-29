import { useEffect, useRef } from 'react';
import { supportsWebGL2 } from '../../lib/device.ts';
import { setEngine } from '../../engine/handle.ts';
import { useStage } from '../../stores/stage.ts';
import styles from './Stage.module.css';

/**
 * The persistent WebGL stage behind every page. The engine (and three.js with
 * it) is loaded lazily so the boot screen paints before any 3D code arrives.
 */
export function Stage() {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const status = useStage((s) => s.status);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    const stage = useStage.getState();
    if (!supportsWebGL2()) {
      stage.setStatus('unsupported');
      stage.setLoadProgress(1);
      return;
    }

    let disposed = false;
    let cleanup: (() => void) | null = null;
    stage.setLoadProgress(0.12);

    void import('../../engine/Engine.ts')
      .then(({ Engine }) => {
        if (disposed) return;
        useStage.getState().setLoadProgress(0.45);
        const engine = new Engine(canvas, host);
        setEngine(engine);

        const apply = (): void => {
          const { scene, params } = useStage.getState();
          void engine.setScene(scene, params);
        };
        const offReady = engine.onSceneReady(() => useStage.getState().setLoadProgress(1));
        const unsubscribe = useStage.subscribe((s, prev) => {
          if (s.revision !== prev.revision) apply();
        });
        apply();

        cleanup = () => {
          offReady();
          unsubscribe();
          engine.dispose();
          setEngine(null);
        };
      })
      .catch((error: unknown) => {
        console.error('[stage] engine failed to start', error);
        useStage.getState().setStatus('error');
        useStage.getState().setLoadProgress(1);
      });

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);

  return (
    <div ref={hostRef} className={styles.stage} data-status={status} aria-hidden="true">
      <canvas ref={canvasRef} className={styles.canvas} />
      {(status === 'unsupported' || status === 'error') && <div className={styles.fallback} />}
    </div>
  );
}

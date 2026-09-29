import { useLayoutEffect, useRef, type RefObject } from 'react';
import { registerTransitionElements } from './director.ts';
import styles from './TransitionLayer.module.css';

/** The iris edge and the phosphene bloom, drawn above the clipped world. */
export function TransitionLayer({ worldRef }: { worldRef: RefObject<HTMLElement | null> }) {
  const ringRef = useRef<HTMLDivElement>(null);
  const bloomRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const world = worldRef.current;
    const ring = ringRef.current;
    const bloom = bloomRef.current;
    if (!world || !ring || !bloom) return;
    registerTransitionElements({ world, ring, bloom });
    return () => registerTransitionElements(null);
  }, [worldRef]);

  return (
    <div className={styles.layer} aria-hidden="true">
      <div ref={bloomRef} className={styles.bloom}>
        <span className={styles.blobA} />
        <span className={styles.blobB} />
      </div>
      <div ref={ringRef} className={styles.ring} />
    </div>
  );
}

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { getEngine } from '../../engine/handle.ts';
import styles from './InteractionSurface.module.css';

interface InteractionSurfaceProps {
  /** Accessible name for the interactive region. */
  label: string;
  /** Visible-to-assistive-tech instructions. */
  instructions: string;
  /** Cursor mode while over the surface. */
  cursor?: 'drag' | 'crosshair';
  cursorLabel?: string;
  /** Capture wheel for zooming (full-screen experiences only). */
  captureWheel?: boolean;
  className?: string;
  children?: ReactNode;
  onKey?: (key: string) => boolean;
  /** Fill the parent (position: absolute) instead of the whole viewport. */
  contained?: boolean;
}

/**
 * The layer through which the visitor touches the WebGL stage. It forwards
 * pointer, pinch, wheel and keyboard input to the active scene, and is
 * itself a focusable application region with instructions for screen readers.
 */
export function InteractionSurface({
  label,
  instructions,
  cursor = 'drag',
  cursorLabel,
  captureWheel = true,
  className,
  children,
  onKey,
  contained = false,
}: InteractionSurfaceProps) {
  const ref = useRef<HTMLDivElement>(null);
  const instructionsId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const pointers = new Map<number, { x: number; y: number }>();
    let pinch = 0;

    const onDown = (e: PointerEvent): void => {
      el.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) getEngine()?.dispatchPointer('down', e);
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()] as [{ x: number; y: number }, { x: number; y: number }];
        pinch = Math.hypot(a.x - b.x, a.y - b.y);
        getEngine()?.dispatchPointer('up', e);
      }
    };
    const onMove = (e: PointerEvent): void => {
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()] as [{ x: number; y: number }, { x: number; y: number }];
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch > 0 && distance > 0) getEngine()?.dispatchZoom(pinch / distance);
        pinch = distance;
        return;
      }
      getEngine()?.dispatchPointer('move', e);
    };
    const onUp = (e: PointerEvent): void => {
      const wasSingle = pointers.size === 1;
      pointers.delete(e.pointerId);
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      if (wasSingle) getEngine()?.dispatchPointer('up', e);
      if (pointers.size < 2) pinch = 0;
    };
    const onWheel = (e: WheelEvent): void => {
      if (!captureWheel) return;
      e.preventDefault();
      getEngine()?.dispatchWheel(e);
    };

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      el.removeEventListener('wheel', onWheel);
    };
  }, [captureWheel]);

  return (
    <div
      ref={ref}
      className={`${styles.surface} ${contained ? styles.contained : ''} ${className ?? ''}`}
      role="application"
      aria-label={label}
      aria-describedby={instructionsId}
      tabIndex={0}
      data-cursor={cursor}
      data-cursor-label={cursorLabel}
      data-lenis-prevent
      onKeyDown={(e) => {
        const used = onKey?.(e.key) ?? getEngine()?.dispatchKey(e.key) ?? false;
        if (used) e.preventDefault();
      }}
    >
      <p id={instructionsId} className="sr-only">
        {instructions}
      </p>
      {children}
    </div>
  );
}

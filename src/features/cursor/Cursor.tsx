import { useEffect, useRef } from 'react';
import { spring } from '../../design/tokens.ts';
import { useMediaQuery } from '../../hooks/useMediaQuery.ts';
import { useResolvedMotion } from '../../hooks/useResolvedMotion.ts';
import { Spring, Spring2 } from '../../lib/spring.ts';
import { useSettings } from '../../stores/settings.ts';
import styles from './Cursor.module.css';

type Mode = 'default' | 'link' | 'label' | 'drag' | 'crosshair' | 'text' | 'hidden';

const LINKISH = 'a[href], button, [role="button"], [role="option"], [role="tab"], label, summary, select, [data-cursor-label]';
const TEXTISH = 'input:not([type="range"]):not([type="checkbox"]):not([type="radio"]), textarea, [contenteditable="true"]';

function classify(target: Element | null): { mode: Mode; label: string; magnet: HTMLElement | null } {
  const explicit = target?.closest<HTMLElement>('[data-cursor]');
  const magnet = target?.closest<HTMLElement>('[data-magnetic]') ?? null;
  if (explicit) {
    const kind = explicit.dataset.cursor;
    if (kind === 'drag' || kind === 'crosshair' || kind === 'hidden') {
      return { mode: kind, label: explicit.dataset.cursorLabel ?? '', magnet: null };
    }
  }
  if (target?.closest(TEXTISH)) return { mode: 'text', label: '', magnet: null };
  const link = target?.closest<HTMLElement>(LINKISH);
  if (link) {
    const label = link.dataset.cursorLabel ?? '';
    return { mode: label ? 'label' : 'link', label, magnet };
  }
  return { mode: 'default', label: '', magnet: null };
}

/**
 * The instrument cursor. A dot that is exactly where the pointer is, and a
 * ring that follows on a spring — stretching with speed, drawn toward
 * magnetic controls, and becoming a label, a drag handle or a crosshair
 * depending on what it is over. All motion is written straight to the DOM.
 */
export function Cursor() {
  const pref = useSettings((s) => s.cursor);
  const motion = useResolvedMotion();
  const fine = useMediaQuery('(hover: hover) and (pointer: fine)');
  const enabled = pref === 'instrument' && fine;

  const rootRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const readoutRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const ring = ringRef.current;
    const dot = dotRef.current;
    const labelEl = labelRef.current;
    const readout = readoutRef.current;
    if (!enabled || !root || !ring || !dot || !labelEl || !readout) return;

    const still = motion === 'still';
    const pos = new Spring2(-100, -100, still ? { stiffness: 4000, damping: 120, mass: 1 } : spring.cursor);
    const scale = new Spring(1, spring.snappy);
    const magnetOffset = new Spring2(0, 0, spring.magnetic);
    let px = -100;
    let py = -100;
    let visible = false;
    let pressed = false;
    let mode: Mode = 'default';
    let magnet: HTMLElement | null = null;
    let lastMagnet: HTMLElement | null = null;
    let raf = 0;
    let last = performance.now();

    const setMode = (next: Mode, label: string): void => {
      if (next !== mode) {
        mode = next;
        root.dataset.mode = next;
      }
      if (labelEl.textContent !== label) labelEl.textContent = label;
    };

    const onMove = (e: PointerEvent): void => {
      if (e.pointerType !== 'mouse') return;
      px = e.clientX;
      py = e.clientY;
      if (!visible) {
        visible = true;
        root.dataset.visible = 'true';
        pos.snap(px, py);
      }
    };
    const onOver = (e: PointerEvent): void => {
      const info = classify(e.target as Element);
      setMode(info.mode, info.label);
      magnet = still ? null : info.magnet;
    };
    const onDown = (): void => {
      pressed = true;
    };
    const onUp = (): void => {
      pressed = false;
    };
    const onLeave = (): void => {
      visible = false;
      root.dataset.visible = 'false';
    };

    const tick = (now: number): void => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      let tx = px;
      let ty = py;
      if (magnet) {
        const r = magnet.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        tx = px + (cx - px) * 0.3;
        ty = py + (cy - py) * 0.3;
        magnetOffset.setTarget((px - cx) * 0.22, (py - cy) * 0.28);
      } else {
        magnetOffset.setTarget(0, 0);
      }
      if (magnet !== lastMagnet) {
        if (lastMagnet) lastMagnet.style.translate = '';
        lastMagnet = magnet;
      }
      magnetOffset.step(dt);
      if (magnet) magnet.style.translate = `${magnetOffset.x.value.toFixed(2)}px ${magnetOffset.y.value.toFixed(2)}px`;

      pos.setTarget(tx, ty);
      pos.step(dt);
      const vx = pos.x.velocity;
      const vy = pos.y.velocity;
      const speed = Math.hypot(vx, vy);
      const stretch = still || mode === 'label' ? 0 : Math.min(speed / 2600, 0.45);
      const angle = Math.atan2(vy, vx);

      const base = mode === 'link' ? 1.75 : mode === 'drag' ? 2.1 : mode === 'crosshair' ? 0.6 : 1;
      scale.target = pressed ? base * 0.78 : base;
      const s = scale.step(dt);

      ring.style.transform = `translate3d(${pos.x.value}px, ${pos.y.value}px, 0) rotate(${angle}rad) scale(${(s * (1 + stretch)).toFixed(3)}, ${(s * (1 - stretch * 0.45)).toFixed(3)})`;
      dot.style.transform = `translate3d(${px}px, ${py}px, 0)`;
      if (mode === 'crosshair') {
        const nx = (px / window.innerWidth) * 2 - 1;
        const ny = -((py / window.innerHeight) * 2 - 1);
        readout.textContent = `${nx >= 0 ? '+' : '−'}${Math.abs(nx).toFixed(3)} · ${ny >= 0 ? '+' : '−'}${Math.abs(ny).toFixed(3)}`;
      }
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerover', onOver, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      if (lastMagnet) lastMagnet.style.translate = '';
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerover', onOver);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      document.documentElement.removeEventListener('pointerleave', onLeave);
    };
  }, [enabled, motion]);

  if (!enabled) return null;

  return (
    <div ref={rootRef} className={styles.cursor} data-mode="default" data-visible="false" aria-hidden="true">
      <div ref={ringRef} className={styles.ring}>
        <span className={styles.arrows} />
      </div>
      <div ref={dotRef} className={styles.dot}>
        <span ref={labelRef} className={styles.label} />
        <span className={styles.cross} />
        <span ref={readoutRef} className={styles.readout} />
      </div>
    </div>
  );
}

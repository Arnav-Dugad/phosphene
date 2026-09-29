/**
 * The shared, mutable input channel between the DOM world and the WebGL
 * stage. DOM code writes; scenes read once per frame. Nothing here triggers a
 * React render, which keeps pointer- and scroll-linked visuals at full rate.
 */

export interface PointerInput {
  /** Normalised device coordinates, [-1, 1], y up. */
  x: number;
  y: number;
  /** CSS pixels. */
  px: number;
  py: number;
  /** Smoothed velocity in NDC units per second. */
  vx: number;
  vy: number;
  down: boolean;
  /** Pointer is over the page (not left the window). */
  inside: boolean;
  /** performance.now() of last movement. */
  lastMove: number;
  kind: 'mouse' | 'pen' | 'touch';
}

export interface ScrollInput {
  y: number;
  /** Whole-document progress, [0, 1]. */
  progress: number;
  /** px per second, signed. */
  velocity: number;
}

export interface Impulse {
  /** NDC position. */
  x: number;
  y: number;
  /** performance.now() */
  t: number;
  strength: number;
}

export const stageInput = {
  pointer: {
    x: 0,
    y: 0,
    px: 0,
    py: 0,
    vx: 0,
    vy: 0,
    down: false,
    inside: false,
    lastMove: 0,
    kind: 'mouse',
  } as PointerInput,
  scroll: { y: 0, progress: 0, velocity: 0 } satisfies ScrollInput,
  /** Named scalar channels written by pages (e.g. `home.progress`). */
  channels: new Map<string, number>(),
  /** Queue of discrete pointer impulses (clicks/taps) consumed by scenes. */
  impulses: [] as Impulse[],
};

export function setChannel(name: string, value: number): void {
  stageInput.channels.set(name, value);
}

export function getChannel(name: string, fallback = 0): number {
  return stageInput.channels.get(name) ?? fallback;
}

let attached = false;

/** Attaches global pointer listeners once. Idempotent. */
export function attachPointerInput(): () => void {
  if (attached) return () => undefined;
  attached = true;
  const p = stageInput.pointer;
  let lastX = 0;
  let lastY = 0;
  let lastT = performance.now();

  const onMove = (e: PointerEvent): void => {
    const now = performance.now();
    const w = window.innerWidth;
    const h = window.innerHeight;
    const nx = (e.clientX / w) * 2 - 1;
    const ny = -((e.clientY / h) * 2 - 1);
    const dt = Math.max(1, now - lastT) / 1000;
    const k = 0.25;
    p.vx = p.vx * (1 - k) + ((nx - lastX) / dt) * k;
    p.vy = p.vy * (1 - k) + ((ny - lastY) / dt) * k;
    p.x = nx;
    p.y = ny;
    p.px = e.clientX;
    p.py = e.clientY;
    p.inside = true;
    p.lastMove = now;
    p.kind = e.pointerType === 'touch' || e.pointerType === 'pen' ? e.pointerType : 'mouse';
    lastX = nx;
    lastY = ny;
    lastT = now;
  };
  const onDown = (e: PointerEvent): void => {
    onMove(e);
    p.down = true;
    stageInput.impulses.push({ x: p.x, y: p.y, t: performance.now(), strength: 1 });
    if (stageInput.impulses.length > 16) stageInput.impulses.shift();
  };
  const onUp = (): void => {
    p.down = false;
  };
  const onLeave = (): void => {
    p.inside = false;
    p.down = false;
  };

  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerdown', onDown, { passive: true });
  window.addEventListener('pointerup', onUp, { passive: true });
  window.addEventListener('pointercancel', onUp, { passive: true });
  document.documentElement.addEventListener('pointerleave', onLeave);

  return () => {
    attached = false;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerdown', onDown);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    document.documentElement.removeEventListener('pointerleave', onLeave);
  };
}

/** Decays pointer velocity when the pointer is idle (called by the engine each frame). */
export function decayPointer(dt: number): void {
  const p = stageInput.pointer;
  if (performance.now() - p.lastMove > 50) {
    const f = Math.exp(-8 * dt);
    p.vx *= f;
    p.vy *= f;
  }
}

import { cssEase } from '../../design/motion.ts';
import type { SpectralKey } from '../../design/tokens.ts';
import type { ResolvedMotion } from '../../stores/settings.ts';
import { useStage } from '../../stores/stage.ts';
import { scrollToTop } from '../scroll/scroller.ts';

/**
 * The blink.
 *
 * Closing your eyes is when phosphenes appear — so that is how PHOSPHENE moves
 * between places. The world (stage + page) is clipped by an aperture that
 * closes on the point you clicked; in the dark a phosphene blooms in the
 * destination's spectral colour while the route and its scene load; then the
 * aperture opens on the new place. The header stays outside the world, so the
 * interface persists while the world changes.
 */

interface Elements {
  world: HTMLElement;
  ring: HTMLElement;
  bloom: HTMLElement;
}

let elements: Elements | null = null;
let busy = false;
let externalNavigation = true;

export function registerTransitionElements(next: Elements | null): void {
  elements = next;
}

/** True while the director is driving a navigation (so POP handling can skip it). */
export const isDirectorNavigating = (): boolean => !externalNavigation;

const TIMINGS: Record<Exclude<ResolvedMotion, 'still'>, { close: number; dark: number; open: number }> = {
  full: { close: 380, dark: 180, open: 720 },
  gentle: { close: 240, dark: 90, open: 420 },
};

const frames = (n = 2): Promise<void> =>
  new Promise((resolve) => {
    const step = (left: number): void => {
      if (left <= 0) resolve();
      else requestAnimationFrame(() => step(left - 1));
    };
    step(n);
  });

const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Resolves once the stage reports its scene ready (or after `timeout`). */
function stageReady(timeout: number): Promise<void> {
  return new Promise((resolve) => {
    const status = useStage.getState().status;
    if (status === 'ready' || status === 'unsupported' || status === 'error') {
      resolve();
      return;
    }
    const timer = setTimeout(done, timeout);
    const unsubscribe = useStage.subscribe((s) => {
      if (s.status !== 'loading') done();
    });
    function done(): void {
      clearTimeout(timer);
      unsubscribe();
      resolve();
    }
  });
}

export interface BlinkRequest {
  x: number;
  y: number;
  line: SpectralKey;
  motion: ResolvedMotion;
  navigate: () => void | Promise<void>;
  onDark?: () => void;
}

export async function blink(request: BlinkRequest): Promise<void> {
  const el = elements;
  if (busy || !el || request.motion === 'still' || typeof el.world.animate !== 'function') {
    externalNavigation = false;
    try {
      await request.navigate();
      scrollToTop();
    } finally {
      externalNavigation = true;
    }
    return;
  }

  busy = true;
  externalNavigation = false;
  const { world, ring, bloom } = el;
  const timing = TIMINGS[request.motion];
  const w = window.innerWidth;
  const h = window.innerHeight;
  const x = Math.min(w, Math.max(0, request.x));
  const y = Math.min(h, Math.max(0, request.y));
  const radius = Math.hypot(Math.max(x, w - x), Math.max(y, h - y)) + 4;
  const color = `var(--line-${request.line})`;

  ring.style.setProperty('--blink-color', color);
  bloom.style.setProperty('--blink-color', color);
  ring.style.width = ring.style.height = `${radius * 2}px`;
  const place = (scale: number): string => `translate(${x - radius}px, ${y - radius}px) scale(${scale})`;
  const circle = (r: number): string => `circle(${r}px at ${x}px ${y}px)`;

  try {
    // Close.
    const closing = world.animate([{ clipPath: circle(radius) }, { clipPath: circle(0) }], {
      duration: timing.close,
      easing: cssEase.aperture,
      fill: 'forwards',
    });
    ring.animate(
      [
        { transform: place(1), opacity: 0 },
        { transform: place(0.55), opacity: 1, offset: 0.4 },
        { transform: place(0.001), opacity: 1 },
      ],
      { duration: timing.close, easing: cssEase.aperture, fill: 'forwards' },
    );
    await closing.finished;

    // Dark: the phosphene blooms while the destination loads.
    // `translate` composes outside `scale`, so the bloom grows in place.
    bloom.style.translate = `${x}px ${y}px`;
    const bloomAnimation = bloom.animate(
      [
        { opacity: 0, scale: '0.15' },
        { opacity: 1, scale: '1', offset: 0.3 },
        { opacity: 0.75, scale: '1.25', offset: 0.7 },
        { opacity: 0, scale: '1.7' },
      ],
      { duration: timing.dark + 900, easing: cssEase.soft },
    );
    request.onDark?.();
    await Promise.all([
      (async () => {
        await request.navigate();
        scrollToTop();
        await stageReady(1400);
        await frames(2);
      })(),
      delay(timing.dark),
    ]);

    // Open.
    const opening = world.animate([{ clipPath: circle(0) }, { clipPath: circle(radius) }], {
      duration: timing.open,
      easing: cssEase.out,
      fill: 'forwards',
    });
    ring.animate(
      [
        { transform: place(0.001), opacity: 1 },
        { transform: place(0.7), opacity: 0.9, offset: 0.55 },
        { transform: place(1.02), opacity: 0 },
      ],
      { duration: timing.open, easing: cssEase.out, fill: 'forwards' },
    );
    await opening.finished;
    bloomAnimation.cancel();
  } finally {
    for (const animation of [...world.getAnimations(), ...ring.getAnimations()]) animation.cancel();
    world.style.clipPath = '';
    busy = false;
    externalNavigation = true;
  }
}

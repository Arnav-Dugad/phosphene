import Lenis from 'lenis';
import { stageInput } from '../../engine/input.ts';
import { gsap, ScrollTrigger } from '../../lib/gsap.ts';
import type { ResolvedMotion } from '../../stores/settings.ts';

/**
 * Scroll is a shared resource: Lenis smooths it (unless motion is 'still'),
 * GSAP's ScrollTrigger follows it, and the WebGL stage reads position and
 * velocity through `stageInput.scroll`.
 */
let lenis: Lenis | null = null;
let tickerFn: ((time: number) => void) | null = null;
let nativeListener: (() => void) | null = null;
let lastNativeY = 0;
let lastNativeT = 0;

function writeScroll(y: number, velocity: number): void {
  const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  stageInput.scroll.y = y;
  stageInput.scroll.progress = Math.min(1, Math.max(0, y / max));
  stageInput.scroll.velocity = velocity;
}

export function startScroller(motion: ResolvedMotion): void {
  stopScroller();
  if (motion === 'still') {
    lastNativeY = window.scrollY;
    lastNativeT = performance.now();
    nativeListener = () => {
      const now = performance.now();
      const y = window.scrollY;
      const v = ((y - lastNativeY) / Math.max(1, now - lastNativeT)) * 1000;
      lastNativeY = y;
      lastNativeT = now;
      writeScroll(y, v);
    };
    window.addEventListener('scroll', nativeListener, { passive: true });
    writeScroll(window.scrollY, 0);
    return;
  }

  lenis = new Lenis({
    lerp: motion === 'gentle' ? 0.22 : 0.095,
    wheelMultiplier: 0.95,
    smoothWheel: true,
    syncTouch: false,
    autoResize: true,
  });
  lenis.on('scroll', (instance: Lenis) => {
    // Lenis reports velocity in px per frame; convert to px per second.
    writeScroll(instance.scroll, instance.velocity * 60);
    ScrollTrigger.update();
  });
  tickerFn = (time: number) => lenis?.raf(time * 1000);
  gsap.ticker.add(tickerFn);
  gsap.ticker.lagSmoothing(0);
  writeScroll(window.scrollY, 0);
}

export function stopScroller(): void {
  if (tickerFn) gsap.ticker.remove(tickerFn);
  tickerFn = null;
  lenis?.destroy();
  lenis = null;
  if (nativeListener) window.removeEventListener('scroll', nativeListener);
  nativeListener = null;
}

/** Jump without animation (used while the aperture is closed). */
export function scrollToTop(): void {
  if (lenis) lenis.scrollTo(0, { immediate: true, force: true });
  else window.scrollTo(0, 0);
  writeScroll(0, 0);
}

export function scrollToY(y: number, immediate = false): void {
  if (lenis) lenis.scrollTo(y, { immediate, force: true, duration: 1.4 });
  else window.scrollTo({ top: y, behavior: immediate ? 'instant' : 'smooth' });
}

export function scrollToElement(target: HTMLElement, offset = 0): void {
  if (lenis) lenis.scrollTo(target, { offset, duration: 1.6, force: true });
  else target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/** Freeze page scroll while an overlay owns the viewport. */
export function lockScroll(locked: boolean): void {
  if (lenis) {
    if (locked) lenis.stop();
    else lenis.start();
  }
  document.documentElement.style.overflow = locked ? 'hidden' : '';
}

export const getLenis = (): Lenis | null => lenis;

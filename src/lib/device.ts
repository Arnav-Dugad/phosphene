/** Feature and preference detection. All functions are safe to call during SSR-less boot. */

const media = (query: string): boolean =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches;

export const prefersReducedMotion = (): boolean => media('(prefers-reduced-motion: reduce)');
export const prefersMoreContrast = (): boolean => media('(prefers-contrast: more)');
export const prefersLight = (): boolean => media('(prefers-color-scheme: light)');

/** A precise pointer that can hover — the custom cursor only activates here. */
export const hasFinePointer = (): boolean => media('(hover: hover) and (pointer: fine)');
export const isCoarsePointer = (): boolean => media('(pointer: coarse)');

export const supportsViewTransitions = (): boolean =>
  typeof document !== 'undefined' && 'startViewTransition' in document;

export const isMac = (): boolean =>
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);

export const saveDataRequested = (): boolean => {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return connection?.saveData === true;
};

export function supportsWebGL2(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    const ok = gl !== null;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return ok;
  } catch {
    return false;
  }
}

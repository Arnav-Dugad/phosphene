import { useLayoutEffect, type DependencyList, type RefObject } from 'react';
import { gsap } from '../lib/gsap.ts';

/**
 * Runs GSAP setup inside a context scoped to `scope`; every tween,
 * ScrollTrigger and SplitText created within is reverted on unmount or when
 * dependencies change.
 */
export function useGsap(
  setup: (context: gsap.Context) => void | (() => void),
  scope: RefObject<HTMLElement | null>,
  deps: DependencyList = [],
): void {
  useLayoutEffect(() => {
    const element = scope.current;
    if (!element) return;
    let cleanup: void | (() => void);
    const ctx = gsap.context((self) => {
      cleanup = setup(self);
    }, element);
    return () => {
      if (typeof cleanup === 'function') cleanup();
      ctx.revert();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

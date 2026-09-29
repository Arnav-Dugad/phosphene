import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { placeForPath } from '../../content/routes.ts';
import { useResolvedMotion } from '../../hooks/useResolvedMotion.ts';
import { supportsViewTransitions } from '../../lib/device.ts';
import { blink } from './director.ts';
import type { SpectralKey } from '../../design/tokens.ts';

export type TransitionKind = 'blink' | 'morph' | 'none';

export interface TransitionOptions {
  /** Viewport point the aperture closes on (defaults to the centre). */
  x?: number;
  y?: number;
  transition?: TransitionKind;
  replace?: boolean;
  /** Override the destination's spectral colour. */
  line?: SpectralKey;
}

/** Programmatic navigation through the blink (or a view-transition morph). */
export function useTransitionNavigate(): (to: string, options?: TransitionOptions) => void {
  const navigate = useNavigate();
  const location = useLocation();
  const motion = useResolvedMotion();

  return useCallback(
    (to: string, options: TransitionOptions = {}) => {
      const here = `${location.pathname}${location.search}`;
      if (to === here) return;
      const kind = options.transition ?? 'blink';
      if (kind === 'none' || motion === 'still') {
        void navigate(to, { replace: options.replace });
        return;
      }
      if (kind === 'morph' && supportsViewTransitions()) {
        void navigate(to, { replace: options.replace, viewTransition: true });
        return;
      }
      const line = options.line ?? placeForPath(to)?.line ?? 'na';
      void blink({
        x: options.x ?? window.innerWidth / 2,
        y: options.y ?? window.innerHeight / 2,
        line,
        motion,
        navigate: () => navigate(to, { replace: options.replace }),
      });
    },
    [location.pathname, location.search, motion, navigate],
  );
}

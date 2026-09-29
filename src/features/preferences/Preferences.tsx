import { useLayoutEffect } from 'react';
import { neutrals } from '../../design/tokens.ts';
import { useMediaQuery } from '../../hooks/useMediaQuery.ts';
import { useResolvedMotion } from '../../hooks/useResolvedMotion.ts';
import { useSettings } from '../../stores/settings.ts';

/** Mirrors visitor preferences onto <html> data attributes that CSS keys off. */
export function Preferences() {
  const theme = useSettings((s) => s.theme);
  const contrastPref = useSettings((s) => s.contrast);
  const cursorPref = useSettings((s) => s.cursor);
  const motion = useResolvedMotion();
  const osContrast = useMediaQuery('(prefers-contrast: more)');
  const finePointer = useMediaQuery('(hover: hover) and (pointer: fine)');

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.dataset.motion = motion;
    root.dataset.contrast = contrastPref === 'system' ? (osContrast ? 'high' : 'standard') : contrastPref;
    root.dataset.cursor = cursorPref === 'instrument' && finePointer ? 'instrument' : 'system';
    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute('content', theme === 'plate' ? neutrals.plate.void : neutrals.nocturne.void);
  }, [theme, motion, contrastPref, osContrast, cursorPref, finePointer]);

  return null;
}

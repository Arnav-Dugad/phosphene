import { useSettings, type ResolvedMotion } from '../stores/settings.ts';
import { useMediaQuery } from './useMediaQuery.ts';

/** The motion level actually in effect: explicit setting, else the OS preference. */
export function useResolvedMotion(): ResolvedMotion {
  const pref = useSettings((s) => s.motion);
  const osReduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  if (pref !== 'system') return pref;
  return osReduced ? 'still' : 'full';
}

import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { placeForPath } from '../../content/routes.ts';
import { useSettings } from '../../stores/settings.ts';
import { audio } from './AudioEngine.ts';

const INTERACTIVE = 'a[href], button, [role="button"], [role="option"], input[type="range"], summary';

/**
 * Keeps the audio engine in step with preferences and place. If sound was left
 * on in a previous visit, it waits for the visitor's first gesture — the
 * browser's autoplay rule, and ours.
 */
export function AudioController() {
  const sound = useSettings((s) => s.sound);
  const volume = useSettings((s) => s.volume);
  const location = useLocation();

  useEffect(() => {
    if (!sound) {
      void audio.disable();
      return;
    }
    const start = (): void => {
      void audio.enable().catch(() => undefined);
    };
    if (navigator.userActivation?.hasBeenActive) {
      start();
      return;
    }
    const once = { once: true, capture: true } as const;
    window.addEventListener('pointerdown', start, once);
    window.addEventListener('keydown', start, once);
    return () => {
      window.removeEventListener('pointerdown', start, once);
      window.removeEventListener('keydown', start, once);
    };
  }, [sound]);

  useEffect(() => audio.setVolume(volume), [volume]);

  useEffect(() => {
    audio.setLine(placeForPath(location.pathname)?.line ?? 'na');
  }, [location.pathname]);

  useEffect(() => {
    const onVisibility = (): void => {
      if (document.hidden) audio.sleep();
      else void audio.wake();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // Quiet interface voices for hover and press, via delegation.
  useEffect(() => {
    let last: Element | null = null;
    const onOver = (e: PointerEvent): void => {
      if (e.pointerType !== 'mouse') return;
      const target = (e.target as Element | null)?.closest(INTERACTIVE) ?? null;
      if (target && target !== last) audio.play('hover');
      last = target;
    };
    const onClick = (e: MouseEvent): void => {
      if ((e.target as Element | null)?.closest(INTERACTIVE)) audio.play('click');
    };
    document.addEventListener('pointerover', onOver, { passive: true });
    document.addEventListener('click', onClick, { passive: true, capture: true });
    return () => {
      document.removeEventListener('pointerover', onOver);
      document.removeEventListener('click', onClick, { capture: true });
    };
  }, []);

  return null;
}

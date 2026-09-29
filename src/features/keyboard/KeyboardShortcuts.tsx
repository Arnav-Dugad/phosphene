import { useEffect } from 'react';
import { useSettings } from '../../stores/settings.ts';
import { toast, useUi } from '../../stores/ui.ts';
import { unlockFragment } from '../fragments/unlock.ts';
import { useTransitionNavigate } from '../transition/useTransitionNavigate.ts';

/** "G then letter" jumps, in the spirit of mail clients and editors. */
const JUMPS: Record<string, string> = {
  h: '/',
  a: '/atlas',
  c: '/chronicle',
  r: '/archive',
  t: '/transmissions',
  i: '/instruments',
  y: '/array',
  m: '/map',
  u: '/institute',
  s: '/settings',
};

const KONAMI = [
  'arrowup',
  'arrowup',
  'arrowdown',
  'arrowdown',
  'arrowleft',
  'arrowright',
  'arrowleft',
  'arrowright',
  'b',
  'a',
];

const isTyping = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable || /^(input|textarea|select)$/i.test(target.tagName));

export function KeyboardShortcuts() {
  const go = useTransitionNavigate();

  useEffect(() => {
    let gAt = 0;
    let konami = 0;

    const onKey = (e: KeyboardEvent): void => {
      const key = e.key.toLowerCase();
      const ui = useUi.getState();

      if ((e.metaKey || e.ctrlKey) && key === 'k') {
        e.preventDefault();
        ui.setPalette(!ui.paletteOpen);
        return;
      }

      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;

      konami = key === KONAMI[konami] ? konami + 1 : key === KONAMI[0] ? 1 : 0;
      if (konami === KONAMI.length) {
        konami = 0;
        const settings = useSettings.getState();
        settings.set('spectral', !settings.spectral);
        unlockFragment(12);
        toast({
          tone: 'info',
          title: settings.spectral ? 'Spectral vision released' : 'Spectral vision engaged',
          body: settings.spectral
            ? undefined
            : 'Luminance is now wavelength. Enter the sequence again to return.',
          line: 'o3',
        });
        return;
      }

      if (ui.paletteOpen || ui.menuOpen || ui.terminalOpen) return;

      if (e.key === '`') {
        e.preventDefault();
        ui.setTerminal(true);
        return;
      }

      const now = performance.now();
      if (gAt && now - gAt < 1000) {
        gAt = 0;
        const path = JUMPS[key];
        if (path) {
          e.preventDefault();
          go(path);
        }
        return;
      }
      if (key === 'g') gAt = now;
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  return null;
}

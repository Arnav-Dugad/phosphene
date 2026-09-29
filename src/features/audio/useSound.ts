import { useCallback } from 'react';
import type { SpectralKey } from '../../design/tokens.ts';
import { useSettings } from '../../stores/settings.ts';
import { audio, type Cue } from './AudioEngine.ts';

export function useSound(): {
  enabled: boolean;
  play: (cue: Cue, line?: SpectralKey) => void;
  toggle: () => void;
} {
  const enabled = useSettings((s) => s.sound);
  const set = useSettings((s) => s.set);
  const play = useCallback((cue: Cue, line?: SpectralKey) => audio.play(cue, line), []);
  const toggle = useCallback(() => {
    const next = !useSettings.getState().sound;
    set('sound', next);
    // The toggle itself is the user gesture that unlocks audio.
    if (next) void audio.enable().then(() => audio.play('success'));
  }, [set]);
  return { enabled, play, toggle };
}

import { useUi } from '../../stores/ui.ts';

/** Plays the full arrival sequence again (from the console or Settings). */
export function replayIntro(): void {
  useUi.getState().replayIntro();
}

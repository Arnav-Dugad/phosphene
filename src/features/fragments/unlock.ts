import { FRAGMENT_TOTAL, fragmentById } from '../../content/fragments.ts';
import { fragmentCount, useProgress } from '../../stores/progress.ts';
import { toast } from '../../stores/ui.ts';
import { audio } from '../audio/AudioEngine.ts';

/**
 * Decodes a fragment of Transmission Zero. Idempotent: only the first unlock
 * announces itself.
 */
export function unlockFragment(id: number): void {
  const fragment = fragmentById(id);
  if (!fragment) return;
  if (!useProgress.getState().unlock(id)) return;
  audio.play('fragment', fragment.line);
  toast({
    tone: 'fragment',
    title: `Fragment ${fragment.numeral} decoded`,
    body: `“${fragment.text}”`,
    line: fragment.line,
    ttl: 7600,
  });
  if (fragmentCount(useProgress.getState().fragments) === FRAGMENT_TOTAL) {
    window.setTimeout(() => {
      toast({
        tone: 'success',
        title: 'Transmission Zero is whole',
        body: 'Every fragment is decoded. The message is waiting for you.',
        line: 'ca',
        ttl: 9000,
      });
    }, 1800);
  }
}

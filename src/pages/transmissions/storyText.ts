import { observatoryTime, yearsListening } from '../../lib/time.ts';
import { numberToWords } from '../../lib/words.ts';

/** Resolves the time-sensitive tokens stories may contain (see content/stories.ts). */
export function resolveStoryText(text: string): string {
  return text
    .replaceAll('{years}', numberToWords(Math.floor(yearsListening())))
    .replaceAll('{year}', String(observatoryTime().year));
}

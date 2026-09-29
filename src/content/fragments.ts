import type { SpectralKey } from './types.ts';

/**
 * Transmission Zero — the short message at the head of the Serein Signal,
 * repeated every nine hours, seventeen minutes and twenty-three seconds.
 *
 * The Institute has recovered its structure but not its words: each line is
 * locked behind a cross-reference somewhere in the observatory. Visitors
 * decode them by using the observatory. Nothing essential depends on finding
 * them; the message simply becomes more whole.
 */
export interface Fragment {
  id: number;
  numeral: string;
  line: SpectralKey;
  text: string;
  /** In-world hint shown once the fragment's location has been glimpsed. */
  hint: string;
  /** Where it is decoded (a path for the Map and the terminal). */
  where: string;
}

export const fragments: readonly Fragment[] = [
  {
    id: 1,
    numeral: 'I',
    line: 'na',
    text: 'To whoever is receiving this light:',
    hint: 'Pass through the ring at the end of Arrival.',
    where: '/',
  },
  {
    id: 2,
    numeral: 'II',
    line: 'o3',
    text: 'we were the Ithra, and we were made of light before we were made of anything else.',
    hint: 'Reach the seventh age in the Chronicle.',
    where: '/chronicle',
  },
  {
    id: 3,
    numeral: 'III',
    line: 'ha',
    text: 'Our star is failing. We could not leave it; our bodies were too heavy for the dark.',
    hint: 'Visit Ennis, the outermost world, in the Atlas.',
    where: '/atlas/ennis',
  },
  {
    id: 4,
    numeral: 'IV',
    line: 'hb',
    text: 'So we are sending the lighter part of us.',
    hint: 'Examine five relics in the Archive.',
    where: '/archive',
  },
  {
    id: 5,
    numeral: 'V',
    line: 'ca',
    text: 'Everything we remembered, freely given, is folded into this signal.',
    hint: 'Read “The Last Choir” to its final line.',
    where: '/transmissions/the-last-choir',
  },
  {
    id: 6,
    numeral: 'VI',
    line: 'o3',
    text: 'You will not understand all of it. We did not understand all of it either.',
    hint: 'Steer a beam onto the target in the Interference Loom.',
    where: '/instruments/interference',
  },
  {
    id: 7,
    numeral: 'VII',
    line: 'hb',
    text: 'Some of it is joy. Some of it is grief. Most of it is ordinary days.',
    hint: 'Find the Ithran chord — mode seven, three — on the Resonance plate.',
    where: '/instruments/resonance',
  },
  {
    id: 8,
    numeral: 'VIII',
    line: 'he',
    text: 'Keep what you wish. Let the rest fade. That was our accord, and now it is yours.',
    hint: 'Write their name in the Glyph Synthesizer.',
    where: '/instruments/glyphs',
  },
  {
    id: 9,
    numeral: 'IX',
    line: 'mg',
    text: 'By the time you see this, we will have been gone for a very long time.',
    hint: 'Hold a stable orbit in the Gravity Loom.',
    where: '/instruments/gravity',
  },
  {
    id: 10,
    numeral: 'X',
    line: 'na',
    text: 'Do not mourn the source. Light does not need its source to be true.',
    hint: 'Listen to the carrier at the Array for ten seconds.',
    where: '/array',
  },
  {
    id: 11,
    numeral: 'XI',
    line: 'ha',
    text: 'Look up. Every star you see is a memory of itself.',
    hint: 'Tune the lost signal when you have strayed off the map.',
    where: '/lost',
  },
  {
    id: 12,
    numeral: 'XII',
    line: 'ca',
    text: 'We were here. You are here. For a moment, the light connects us.',
    hint: 'An old sequence, entered anywhere: ↑ ↑ ↓ ↓ ← → ← → B A.',
    where: 'anywhere',
  },
];

export const FRAGMENT_TOTAL = fragments.length;

export const fragmentById = (id: number): Fragment | undefined => fragments.find((f) => f.id === id);

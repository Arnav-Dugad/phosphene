import type { SpectralKey } from './types.ts';

/**
 * The Phosphene Institute: who receives the Serein Signal, how a stream of
 * light becomes a memory, the principles the Institute keeps, and the
 * questions visitors ask most.
 */

export interface PipelineStep {
  id: string;
  name: string;
  where: string;
  text: string;
  line: SpectralKey;
}

export const pipeline: readonly PipelineStep[] = [
  {
    id: 'receive',
    name: 'Receive',
    where: 'The Array, Daedalus Crater',
    text: 'Sixty-four light-gathering dishes on the far side of the Moon hold the Lacuna in their sights, day and night, and count every photon that arrives in its seven narrow lines.',
    line: 'he',
  },
  {
    id: 'correlate',
    name: 'Correlate',
    where: 'Hertzsprung Station',
    text: 'Transmission Zero repeats every nine hours, seventeen minutes and twenty-three seconds. That heartbeat is the clock everything else is aligned to.',
    line: 'na',
  },
  {
    id: 'separate',
    name: 'Separate',
    where: 'Hertzsprung Station',
    text: 'Each spectral line carries its own layer of the stream. The correlator splits the seven apart and strips away the noise of thirty-six thousand years in transit.',
    line: 'o3',
  },
  {
    id: 'transliterate',
    name: 'Transliterate',
    where: 'The Reading Rooms, Valparaíso',
    text: 'The symbols are rosettes of light — the aperture script. Translators work a cluster at a time, and sign every reading with their confidence.',
    line: 'mg',
  },
  {
    id: 'reconstruct',
    name: 'Reconstruct',
    where: 'The Archive, Mare Crisium',
    text: 'The Ithra sent descriptions of things, not pictures. The Archive rebuilds each object from its description and measures how much of it survived the crossing.',
    line: 'hb',
  },
  {
    id: 'keep',
    name: 'Keep',
    where: 'Everywhere, freely',
    text: 'What asked to fade is withheld. Everything else is published here, for anyone, for as long as there is anyone to read it.',
    line: 'ca',
  },
];

export interface Principle {
  title: string;
  text: string;
}

/** The Accord of Dusk, as the Institute practises it. */
export const principles: readonly Principle[] = [
  {
    title: 'Memory may be kept.',
    text: 'Every bit the Array receives is stored three times, on two worlds, and never deleted — including the parts we cannot yet read.',
  },
  {
    title: 'Memory must be given, never taken.',
    text: 'We decode what was offered. We do not reconstruct segments their senders sealed, however much we might learn from them.',
  },
  {
    title: 'What asked to fade, fades.',
    text: 'Some Ithra asked to be released rather than remembered. Their segments are logged as withheld and go no further.',
  },
  {
    title: 'Mark the seams.',
    text: 'Every reconstruction shows its integrity, and every translation its confidence. Nothing missing is ever filled in quietly.',
  },
  {
    title: 'Nothing is sold.',
    text: 'The stream was a gift. Everything the Institute publishes is free to everyone, and always will be.',
  },
  {
    title: 'Listen before speaking.',
    text: 'The Institute has never transmitted toward the Lacuna. There is no one left there to hear, and we would rather listen.',
  },
];

export interface Keeper {
  name: string;
  role: string;
  years: string;
  line: SpectralKey;
  text: string;
}

export const keepers: readonly Keeper[] = [
  {
    name: 'Aster Halden',
    role: 'Founder',
    years: '2178 – 2259',
    line: 'na',
    text: 'Commissioned Dish 1 and heard the first repetition on the night of 14 March 2236. Kept the night watch for twenty-three years afterwards, and never once missed her shift.',
  },
  {
    name: 'Rosa Castellanos-Ferro',
    role: 'Signal',
    years: '2203 – 2280',
    line: 'he',
    text: 'Found the second layer underneath the carrier in 2241 — the part that does not repeat. Every relic in the Archive arrived through the correlator she designed.',
  },
  {
    name: 'Ifeoma Okoro-Vance',
    role: 'Translation',
    years: '2239 – 2318',
    line: 'mg',
    text: 'First read the Accord of Dusk, after thirty hours awake. Her grammar of the aperture script is still the one every new translator learns.',
  },
  {
    name: 'Jun Takeda-Mirza',
    role: 'The Archive',
    years: '2262 –',
    line: 'hb',
    text: 'Reconstructs objects from their descriptions. Received the living lantern in 2290 and argued, successfully, that it should never be grown.',
  },
  {
    name: 'Nadia Serrat-Oyelaran',
    role: 'Director',
    years: '2268 –',
    line: 'ca',
    text: 'The Institute’s fourth director. Wrote “What the Silence Said”, and answers every letter the Institute receives, which is more letters than it sounds.',
  },
];

export interface Question {
  q: string;
  a: string;
}

export const questions: readonly Question[] = [
  {
    q: 'Is the Serein Signal real?',
    a: 'Within these pages, completely. Outside them, PHOSPHENE is a work of fiction: the Institute, the Ithra and their signal are invented. The sky around them is not — the spectral lines, the far side’s quiet and Daedalus Crater are all real.',
  },
  {
    q: 'Why doesn’t anyone reply?',
    a: 'The light left the Lacuna thirty-six thousand years ago, and the Ithra ended with their star. A reply would arrive, if it arrived anywhere, at a silence. The Institute listens instead.',
  },
  {
    q: 'How long will the stream last?',
    a: 'At the rate it is arriving, about eleven hundred years. We have received a little over eight per cent of it. None of us will hear the end, and nobody we will ever meet will either.',
  },
  {
    q: 'What does “phosphene” mean?',
    a: 'The light you see without light entering the eye — the colours behind closed eyelids. It seemed the right name for an observatory whose subject no longer exists.',
  },
  {
    q: 'Why are some records withheld?',
    a: 'Because their senders asked. The Accord of Dusk lets any Ithra release their memory instead of sending it on. The decoder log marks those segments as withheld, and there they stay.',
  },
  {
    q: 'Does this site track me?',
    a: 'No. There are no analytics, cookies or accounts. Your settings and your progress through Transmission Zero live only in your browser’s storage, and you can erase them from Calibration at any time.',
  },
  {
    q: 'Why does it sound like this?',
    a: 'Every tone here is a colour. Each spectral line’s light frequency, transposed down forty octaves, lands in the audible range — so the sodium-amber of the interface is also a note, and so is every line of the carrier.',
  },
];

export interface ColophonEntry {
  label: string;
  value: string;
}

export const colophon: readonly ColophonEntry[] = [
  { label: 'Display type', value: 'Cormorant, by Christian Thalmann' },
  { label: 'Text type', value: 'Mona Sans, by GitHub' },
  { label: 'Data type', value: 'Martian Mono, by Evil Martians' },
  { label: 'Colour', value: 'Seven emission lines: H-α, Na D, Mg b, O III, H-β, He I, Ca II K' },
  { label: 'Sound', value: 'Synthesised live; each tone is a line’s light, forty octaves down' },
  { label: 'Images', value: 'None. Every star, relic, world and glyph is generated in the browser' },
  { label: 'Built with', value: 'React, three.js, GSAP, Lenis, zustand and Vite' },
];

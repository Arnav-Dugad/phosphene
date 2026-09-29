import type { SpectralKey } from './types.ts';

/**
 * The Vael system, reconstructed from the Atlas of Near Stars (SR-0092) and
 * the evacuation records. Orbital values are in astronomical units and
 * Earth years so visitors can compare them with home.
 */
export type WorldSurface = 'star' | 'ocean' | 'desert' | 'gas' | 'ice' | 'dark' | 'belt';

export interface WorldFact {
  label: string;
  value: string;
}

export interface World {
  id: string;
  name: string;
  epithet: string;
  surface: WorldSurface;
  line: SpectralKey;
  /** Orbit radius in AU (0 for the star). Rendered on a compressed scale. */
  orbit: number;
  /** Orbital period in Earth years. */
  period: number;
  /** Visual radius in scene units. */
  size: number;
  /** Axial tilt, degrees. */
  tilt: number;
  rings?: boolean;
  moons: number;
  facts: readonly WorldFact[];
  summary: string;
  body: readonly string[];
  /** Relics associated with the world. */
  relics: readonly string[];
  /** Base colours for the surface shader (sRGB hex). */
  palette: readonly [string, string, string];
}

export const worlds: readonly World[] = [
  {
    id: 'vael',
    name: 'Vael',
    epithet: 'The patient star',
    surface: 'star',
    line: 'ha',
    orbit: 0,
    period: 0,
    size: 2.4,
    tilt: 0,
    moons: 0,
    facts: [
      { label: 'Class', value: 'K1 → red giant' },
      { label: 'Mass', value: '0.93 solar' },
      { label: 'Age at Encoding', value: '10.4 billion years' },
      { label: 'Radius at Encoding', value: '31 solar' },
    ],
    summary: 'An old orange star that swelled into a red giant over the Reddening, boiling Ithris and swallowing Carrow.',
    body: [
      'For most of Ithran history Vael was a steady orange sun, a little smaller and a little older than ours. The Ithra called it the patient star, because it never flared and never changed.',
      'Then it changed. Over three thousand turns it left its long middle age and began to swell. By the Encoding it was thirty times its old size and a deep, tired red. The Choir drew its power from that light.',
    ],
    relics: ['sr-0110'],
    palette: ['#ff9a4d', '#ff5a2e', '#fff0c8'],
  },
  {
    id: 'carrow',
    name: 'Carrow',
    epithet: 'The world of the twilight band',
    surface: 'desert',
    line: 'na',
    orbit: 0.42,
    period: 0.28,
    size: 0.38,
    tilt: 0,
    moons: 0,
    facts: [
      { label: 'Orbit', value: '0.42 AU' },
      { label: 'Year', value: '102 days' },
      { label: 'Day', value: 'Tidally locked' },
      { label: 'Fate', value: 'Engulfed, 640 BE' },
    ],
    summary: 'A tidally locked world, one face burning and one frozen — and between them, the observatories.',
    body: [
      'Carrow always showed Vael the same face. The day side was molten; the night side was colder than anything on Ithris. Between them ran a band of permanent twilight, where the ground never moved and the sky never changed.',
      'The Ithra built their great telescopes on that band and charted every star within four hundred light-years from it. It was the first world the star took.',
    ],
    relics: ['sr-0097', 'sr-0110'],
    palette: ['#c9853e', '#6b3a1f', '#ffd8a0'],
  },
  {
    id: 'ithris',
    name: 'Ithris',
    epithet: 'The homeworld of tides',
    surface: 'ocean',
    line: 'o3',
    orbit: 1.1,
    period: 1.21,
    size: 0.62,
    tilt: 23,
    moons: 2,
    facts: [
      { label: 'Orbit', value: '1.10 AU' },
      { label: 'Year (a “turn”)', value: '1.21 Earth years' },
      { label: 'Day', value: '31.4 hours' },
      { label: 'Moons', value: 'Ennet and Lir' },
    ],
    summary: 'An ocean world with two moons, forty-metre tides and archipelagos that glowed at night.',
    body: [
      'Ithris was mostly sea. Its two moons, Ennet and Lir, dragged tides across it that could rise forty metres in a night, and the shallows those tides kept emptying and refilling were where life — and light — began.',
      'For sixty thousand turns its archipelagos were lit every night by living lanterns. From orbit, the Ithra said, you could read the coastlines like a letter. The Reddening boiled its seas into the sky.',
    ],
    relics: ['sr-0004', 'sr-0021', 'sr-0121'],
    palette: ['#1b6f8a', '#0a2a3d', '#d4c9a0'],
  },
  {
    id: 'sollen',
    name: 'Sollen',
    epithet: 'The ringed giant of gardens',
    surface: 'gas',
    line: 'mg',
    orbit: 4.3,
    period: 9.4,
    size: 1.25,
    tilt: 18,
    rings: true,
    moons: 14,
    facts: [
      { label: 'Orbit', value: '4.3 AU' },
      { label: 'Year', value: '9.4 Earth years' },
      { label: 'Rings', value: '3 major, 1 garden gap' },
      { label: 'Garden population', value: '1 in 5 Ithra' },
    ],
    summary: 'A banded gas giant whose rings held the orbital gardens of the Long Noon.',
    body: [
      'Sollen was a gas giant banded in cream and ochre, with rings wide enough to farm. In the Long Noon the Ithra seeded gardens into a gap in the rings, and a fifth of their civilization lived there for eleven thousand turns.',
      'The gardens were bred to glow faintly at night. From Ithris they appeared as a thin bright thread drawn across the sky.',
    ],
    relics: ['sr-0086', 'sr-0103'],
    palette: ['#d9b77f', '#8a5a33', '#f3e2c0'],
  },
  {
    id: 'scatter',
    name: 'The Scatter',
    epithet: 'Debris of an unmade world',
    surface: 'belt',
    line: 'he',
    orbit: 6.2,
    period: 15.4,
    size: 0.05,
    tilt: 0,
    moons: 0,
    facts: [
      { label: 'Orbit', value: '5.8 – 6.9 AU' },
      { label: 'Bodies', value: '≈ 2 million charted' },
      { label: 'Use', value: 'Mining, mirror stock' },
      { label: 'Notable', value: 'Source of the Choir’s glass' },
    ],
    summary: 'A belt of rock and ice that never became a world, mined for the glass of the Choir.',
    body: [
      'Between Sollen and Mereth lay the Scatter — the rubble of a world that never formed. The Ithra mined it lightly through the Long Noon and heavily during the Great Encoding.',
      'Nearly every mirror of the Choir was cast from Scatter glass. The belt, they said, finally became something.',
    ],
    relics: ['sr-0128'],
    palette: ['#8c8478', '#4a4540', '#c9c0b0'],
  },
  {
    id: 'mereth',
    name: 'Mereth',
    epithet: 'The ice that remembers',
    surface: 'ice',
    line: 'hb',
    orbit: 7.8,
    period: 22.6,
    size: 0.5,
    tilt: 6,
    moons: 1,
    facts: [
      { label: 'Orbit', value: '7.8 AU' },
      { label: 'Year', value: '22.6 Earth years' },
      { label: 'Surface', value: '−190 °C, water ice' },
      { label: 'Libraries', value: '4,112 chambers' },
    ],
    summary: 'A frozen world whose cold kept the Resonant Libraries still for twenty thousand turns.',
    body: [
      'Mereth was ice over a small rocky heart, cracked in long pale lines. Its cold was its gift: crystal kept at those temperatures barely moves, and a crystal that does not move does not forget.',
      'The Resonant Libraries were cut into its ice during the Resonance and filled for twenty thousand turns. During the Encoding they were read, chamber by chamber, into the Choir.',
    ],
    relics: ['sr-0052', 'sr-0061', 'sr-0044'],
    palette: ['#bfe3f2', '#5d8aa6', '#ffffff'],
  },
  {
    id: 'ennis',
    name: 'Ennis',
    epithet: 'The dark world that sang',
    surface: 'dark',
    line: 'ca',
    orbit: 19.4,
    period: 88,
    size: 0.56,
    tilt: 31,
    moons: 0,
    facts: [
      { label: 'Orbit', value: '19.4 AU' },
      { label: 'Year', value: '88 Earth years' },
      { label: 'Structure', value: 'The Choir lattice' },
      { label: 'Last voice', value: '0 BE' },
    ],
    summary: 'The outermost world, girdled by the Choir: the lattice that turned a civilization into light.',
    body: [
      'Ennis was dark and cold and far from everything, which is why the Ithra chose it. Over three hundred turns they wrapped it in a lattice of mirrors and resonant crystal: the Choir.',
      'The last Ithra gathered here. When they fell silent, the Choir went on singing for eleven hundred turns, fed by the red light of its dying star. We are listening to that song.',
    ],
    relics: ['sr-0128', 'sr-0134', 'sr-0140'],
    palette: ['#1a1330', '#05030c', '#c29bff'],
  },
];

export const worldById = (id: string): World | undefined => worlds.find((w) => w.id === id);

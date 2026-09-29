import type { SceneKey, SpectralKey } from './types.ts';

/**
 * The Instruments: working tools of the Phosphene Institute. Each one is a
 * real simulation, and each is tied to how the Serein Signal was decoded.
 */
export interface Instrument {
  slug: string;
  name: string;
  epithet: string;
  line: SpectralKey;
  scene: SceneKey;
  /** The physics or mathematics it runs, in one sentence. */
  principle: string;
  summary: string;
  lore: string;
  /** Short operating instructions, shown in the instrument panel. */
  controls: readonly string[];
}

export const instruments: readonly Instrument[] = [
  {
    slug: 'interference',
    name: 'Interference Loom',
    epithet: 'Weave coherent light into fringes and beams',
    line: 'o3',
    scene: 'interference',
    principle: 'Coherent waves add: where crests meet crests the light doubles, where crests meet troughs it vanishes.',
    summary:
      'Place up to eight coherent emitters and watch their waves interfere. Arrange them in a line and shift their phases to steer a beam — the way the Array points sixty-four dishes without moving one.',
    lore: 'The Choir on Ennis was a phased array the size of a world. Reproducing its beam-forming was the Institute’s first proof that the signal was made, not found.',
    controls: [
      'Click or tap empty space to add an emitter.',
      'Drag an emitter to move it; double-click to remove it.',
      'With the phased array, steer the beam onto the target.',
    ],
  },
  {
    slug: 'resonance',
    name: 'Resonance Plate',
    epithet: 'Make a plate sing and watch sand find its silence',
    line: 'hb',
    scene: 'resonance',
    principle:
      'A vibrating plate has lines that never move — nodal lines — and loose grains travel across the plate until they come to rest on them.',
    summary:
      'Tens of thousands of simulated grains on a singing plate. Change its mode and the sand abandons its old pattern and walks, grain by grain, to the new one.',
    lore: 'The Ithra saw the shape of a sound before trusting a crystal with it. The Resonance Plate in the Archive is one of theirs, its figure fixed in glaze.',
    controls: [
      'Choose the plate’s two mode numbers; the sand re-forms.',
      'Drag across the plate to bow it — adding energy where you touch.',
      'With sound on, you can hear the plate’s tone.',
    ],
  },
  {
    slug: 'gravity',
    name: 'Gravity Loom',
    epithet: 'Spin a disk of dust around masses you place',
    line: 'mg',
    scene: 'gravity',
    principle: 'Every grain feels every mass, pulled by the inverse square of the distance, and keeps its momentum.',
    summary:
      'A disk of luminous dust, simulated on your graphics card, orbiting masses you create and move. Trails persist like afterimages — phosphenes of where the light has been.',
    lore: 'The Institute reconstructs the Vael system’s debris from the Atlas of Near Stars with a loom like this one, running for months at a time.',
    controls: [
      'Click or tap to place a mass (up to six); drag masses to move them.',
      'Double-click a mass to remove it.',
      'Hold still — stable orbits reward patience.',
    ],
  },
  {
    slug: 'glyphs',
    name: 'Glyph Synthesizer',
    epithet: 'Write any name in the Ithran aperture script',
    line: 'he',
    scene: 'lacuna',
    principle: 'Each letter maps to a fixed set of strokes on an eight-spoked aperture: vowels ring closed, consonants break open.',
    summary:
      'Transliterate text into Ithran glyphs, as a threaded line or a rosette sigil, then export it as a vector image. Whatever you keep becomes your sigil across the observatory.',
    lore: 'Names, and anything the Ithra held sacred, were written as rosettes — letters arranged around a circle like a crowd around a fire.',
    controls: ['Type up to 32 letters or numbers.', 'Choose line or rosette, stroke and colour.', 'Export SVG or PNG, or keep it as your sigil.'],
  },
  {
    slug: 'terrain',
    name: 'Spectral Terrain',
    epithet: 'Turn sound into a landscape of light',
    line: 'na',
    scene: 'terrain',
    principle: 'A Fourier transform splits a sound into its frequencies; stacked through time, they rise into a landscape.',
    summary:
      'The carrier of the Serein Signal — or your own voice — decomposed into frequencies sixty times a second and laid out as ridgelines scrolling toward you.',
    lore: 'Every colour in PHOSPHENE has a tone: its light frequency, forty octaves down. This is what those tones look like when they are allowed to rise.',
    controls: [
      'Choose a source: the synthesised carrier, or your microphone.',
      'Microphone audio is analysed on your device and never leaves it.',
      'Freeze the terrain to study a moment.',
    ],
  },
  {
    slug: 'aurora',
    name: 'Aurora Engine',
    epithet: 'Grow the skies of Ithris from a single seed',
    line: 'ca',
    scene: 'aurora',
    principle: 'Particles follow the curl of a noise field — a flow with no sources or sinks, which is why it curls like smoke and light.',
    summary:
      'A generative sky: thousands of luminous particles drifting through a divergence-free flow field. Change the seed and palette to grow a new aurora, then save the frame.',
    lore: 'The Long Noon’s descriptions of the sky over the rings of Sollen are the most repeated passages in the stream. This is the Institute’s attempt to paint one.',
    controls: ['Choose a palette of spectral lines.', 'Shape the flow with scale, speed and turbulence.', 'Reseed for a new sky; save the frame as an image.'],
  },
];

/** Limits and presets shared by the instrument scenes and their panels. */
export const MAX_EMITTERS = 8;
export const MAX_MASSES = 6;

export const AURORA_PALETTES: Record<string, { label: string; top: SpectralKey; bottom: SpectralKey }> = {
  oxygen: { label: 'Oxygen', top: 'ha', bottom: 'o3' },
  sollen: { label: 'Sollen night', top: 'mg', bottom: 'hb' },
  lanterns: { label: 'Lanterns', top: 'na', bottom: 'ha' },
  encoding: { label: 'Encoding', top: 'ca', bottom: 'he' },
};

export const instrumentBySlug = (slug: string): Instrument | undefined => instruments.find((i) => i.slug === slug);

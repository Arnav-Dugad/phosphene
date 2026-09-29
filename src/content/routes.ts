import type { SceneKey, SpectralKey } from './types.ts';

/**
 * The top-level geography of PHOSPHENE. One registry feeds the navigation,
 * the command palette, the Map, page metadata and the build-time prerender,
 * so a place can never exist in one and be missing from another.
 */
export type RouteKind = 'primary' | 'utility' | 'hidden';

export interface PlaceMeta {
  id: string;
  path: string;
  /** Short navigation label. */
  label: string;
  /** Full document title (without the site suffix). */
  title: string;
  /** Meta description, ≤ 160 characters. */
  description: string;
  /** One-line in-world gloss shown in menus and the Map. */
  gloss: string;
  line: SpectralKey;
  scene: SceneKey;
  kind: RouteKind;
  /** Two-digit index used in menus ("03"). */
  index: number;
  keywords: readonly string[];
}

export const places: readonly PlaceMeta[] = [
  {
    id: 'arrival',
    path: '/',
    label: 'Arrival',
    title: 'The Observatory of Remembered Light',
    description:
      'PHOSPHENE is an observatory for light that remembers: decode the Serein Signal, the last transmission of a civilization that ended 36,000 years ago.',
    gloss: 'Where the light comes in',
    line: 'na',
    scene: 'lacuna',
    kind: 'primary',
    index: 0,
    keywords: ['home', 'start', 'serein signal', 'lacuna', 'ring'],
  },
  {
    id: 'atlas',
    path: '/atlas',
    label: 'Atlas',
    title: 'Atlas of the Vael System',
    description:
      'Fly through the Vael system — the dying star of the Ithra and the six worlds that orbited it — reconstructed from the Serein Signal.',
    gloss: 'The star Vael and its worlds',
    line: 'ha',
    scene: 'orrery',
    kind: 'primary',
    index: 1,
    keywords: ['worlds', 'planets', 'orrery', 'vael', 'star system', 'map'],
  },
  {
    id: 'chronicle',
    path: '/chronicle',
    label: 'Chronicle',
    title: 'The Chronicle of the Seven Ages',
    description:
      'Three million turns of Ithran history in seven ages, from the tidal seas to the Great Encoding, told as light.',
    gloss: 'Seven ages, one light',
    line: 'mg',
    scene: 'lacuna',
    kind: 'primary',
    index: 2,
    keywords: ['timeline', 'history', 'eras', 'ages'],
  },
  {
    id: 'archive',
    path: '/archive',
    label: 'Archive',
    title: 'The Archive of Decoded Relics',
    description:
      'A searchable catalogue of Ithran relics reconstructed from the Serein Signal, each rendered as a holographic reconstruction.',
    gloss: 'What survived the crossing',
    line: 'hb',
    scene: 'lacuna',
    kind: 'primary',
    index: 3,
    keywords: ['relics', 'artifacts', 'collection', 'catalogue', 'objects'],
  },
  {
    id: 'transmissions',
    path: '/transmissions',
    label: 'Transmissions',
    title: 'Transmissions',
    description:
      'Translated stories from the Serein Signal and from the people who spent their lives receiving it.',
    gloss: 'Stories carried by light',
    line: 'ca',
    scene: 'lacuna',
    kind: 'primary',
    index: 4,
    keywords: ['stories', 'translations', 'essays', 'reading'],
  },
  {
    id: 'instruments',
    path: '/instruments',
    label: 'Instruments',
    title: 'Instruments',
    description:
      'Six working instruments used to decode the Serein Signal: interference, resonance, gravity, glyphs, spectral terrain and aurora.',
    gloss: 'The tools of listening',
    line: 'o3',
    scene: 'lacuna',
    kind: 'primary',
    index: 5,
    keywords: ['lab', 'experiments', 'simulations', 'play', 'shaders'],
  },
  {
    id: 'array',
    path: '/array',
    label: 'Array',
    title: 'The Halden Deep Array — Live',
    description:
      'Live telemetry from the Halden Deep Array on the lunar far side: a real-time spectrogram of the Serein Signal and 64 dishes tracking the Lacuna.',
    gloss: 'Sixty-four dishes, listening now',
    line: 'he',
    scene: 'array',
    kind: 'primary',
    index: 6,
    keywords: ['system', 'telemetry', 'monitor', 'live', 'dishes', 'spectrogram', 'moon'],
  },
  {
    id: 'institute',
    path: '/institute',
    label: 'Institute',
    title: 'The Phosphene Institute',
    description:
      'Who receives the Serein Signal, how it is decoded, and the principles that govern keeping another civilization’s memory.',
    gloss: 'The keepers of the signal',
    line: 'na',
    scene: 'lacuna',
    kind: 'primary',
    index: 7,
    keywords: ['about', 'story', 'faq', 'principles', 'team', 'colophon'],
  },
  {
    id: 'map',
    path: '/map',
    label: 'Map',
    title: 'The Chart of Everything Received',
    description:
      'Every place in PHOSPHENE as a navigable constellation, linked by meaning — with your own path of observation traced in light.',
    gloss: 'Everything, as a constellation',
    line: 'o3',
    scene: 'constellation',
    kind: 'utility',
    index: 8,
    keywords: ['sitemap', 'graph', 'constellation', 'navigate', 'overview'],
  },
  {
    id: 'settings',
    path: '/settings',
    label: 'Settings',
    title: 'Calibration',
    description: 'Tune motion, graphics quality, sound, theme and contrast. Everything stays on your device.',
    gloss: 'Tune the instrument to you',
    line: 'hb',
    scene: 'lacuna',
    kind: 'utility',
    index: 9,
    keywords: ['preferences', 'options', 'quality', 'sound', 'theme', 'accessibility', 'motion'],
  },
  {
    id: 'transmission-zero',
    path: '/transmission-zero',
    label: 'Transmission Zero',
    title: 'Transmission Zero',
    description: 'The message at the beginning of the Serein Signal — decoded one fragment at a time.',
    gloss: 'The message they left for us',
    line: 'ca',
    scene: 'lacuna',
    kind: 'hidden',
    index: 10,
    keywords: ['final', 'message', 'fragments', 'secret', 'ending'],
  },
  {
    id: 'credits',
    path: '/credits',
    label: 'Credits',
    title: 'Credits',
    description: 'The people, fictional and real, and the open tools behind PHOSPHENE.',
    gloss: 'Everyone who kept the light',
    line: 'na',
    scene: 'lacuna',
    kind: 'hidden',
    index: 11,
    keywords: ['credits', 'colophon', 'thanks', 'open source'],
  },
];

export const primaryPlaces = places.filter((p) => p.kind === 'primary');
export const utilityPlaces = places.filter((p) => p.kind === 'utility');

export function placeById(id: string): PlaceMeta {
  const place = places.find((p) => p.id === id);
  if (!place) throw new Error(`Unknown place "${id}"`);
  return place;
}

/** The top-level place that owns a pathname (e.g. /archive/sr-004 → archive). */
export function placeForPath(pathname: string): PlaceMeta | null {
  if (pathname === '/') return placeById('arrival');
  const first = `/${pathname.split('/').filter(Boolean)[0] ?? ''}`;
  return places.find((p) => p.path === first) ?? null;
}

export const SITE_TITLE_SUFFIX = 'PHOSPHENE';

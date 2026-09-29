/**
 * PHOSPHENE design tokens — the single source of truth.
 *
 * Every value here is emitted as a CSS custom property by `build/tokens-plugin.ts`
 * (imported in CSS land as `virtual:phosphene-tokens.css`) and is also importable
 * from TypeScript, so WebGL scenes, GSAP timelines and CSS never drift apart.
 *
 * The colour system is derived from real emission spectra: each accent is a
 * spectral line an astronomer would recognise, and each line also has a tone
 * (its light frequency transposed down forty octaves — see `lib/spectral.ts`).
 */

/* ────────────────────────────────────────────────────────────────────────────
 * Spectral lines
 * ──────────────────────────────────────────────────────────────────────────── */

export interface SpectralLine {
  /** Stable key used across content, CSS (`--line-<key>`) and shaders. */
  readonly key: SpectralKey;
  /** Rest wavelength in nanometres. */
  readonly nm: number;
  /** Short notation as it appears on a spectrograph plate. */
  readonly notation: string;
  /** Human name of the transition. */
  readonly name: string;
  /** Luminous rendition for the Nocturne (dark) theme. */
  readonly nocturne: string;
  /** Ink rendition for the Plate (light) theme. */
  readonly plate: string;
}

export type SpectralKey = 'ha' | 'na' | 'mg' | 'o3' | 'hb' | 'he' | 'ca';

export const spectralLines: Record<SpectralKey, SpectralLine> = {
  ha: {
    key: 'ha',
    nm: 656.28,
    notation: 'H-α',
    name: 'Hydrogen-alpha',
    nocturne: '#ff6a55',
    plate: '#b8321f',
  },
  na: {
    key: 'na',
    nm: 589.0,
    notation: 'Na D',
    name: 'Sodium D',
    nocturne: '#ffb45e',
    plate: '#9a5a0c',
  },
  mg: {
    key: 'mg',
    nm: 518.36,
    notation: 'Mg b',
    name: 'Magnesium b',
    nocturne: '#b4f06e',
    plate: '#4d7a12',
  },
  o3: {
    key: 'o3',
    nm: 500.68,
    notation: 'O III',
    name: 'Doubly-ionised oxygen',
    nocturne: '#5cf2d2',
    plate: '#0b7a66',
  },
  hb: {
    key: 'hb',
    nm: 486.13,
    notation: 'H-β',
    name: 'Hydrogen-beta',
    nocturne: '#62c9ff',
    plate: '#11628f',
  },
  he: {
    key: 'he',
    nm: 447.15,
    notation: 'He I',
    name: 'Neutral helium',
    nocturne: '#8c96ff',
    plate: '#3a43a8',
  },
  ca: {
    key: 'ca',
    nm: 393.37,
    notation: 'Ca II K',
    name: 'Ionised calcium K',
    nocturne: '#c29bff',
    plate: '#6a3bb0',
  },
};

export const spectralOrder: readonly SpectralKey[] = ['ha', 'na', 'mg', 'o3', 'hb', 'he', 'ca'];

/* ────────────────────────────────────────────────────────────────────────────
 * Neutral palette
 * ──────────────────────────────────────────────────────────────────────────── */

export const neutrals = {
  nocturne: {
    void: '#040406',
    ink0: '#07080b',
    ink1: '#0c0d12',
    ink2: '#13151c',
    ink3: '#1c1f28',
    bone: '#ece6da',
    boneDim: '#aaa498',
    boneFaint: '#77736b',
    hairline: 'rgba(236, 230, 218, 0.11)',
    hairlineStrong: 'rgba(236, 230, 218, 0.22)',
    veil: 'rgba(7, 8, 11, 0.62)',
    veilStrong: 'rgba(7, 8, 11, 0.86)',
  },
  plate: {
    void: '#e4ded1',
    ink0: '#ece6da',
    ink1: '#e5dfd2',
    ink2: '#dcd5c6',
    ink3: '#cfc7b6',
    bone: '#17150f',
    boneDim: '#4b473e',
    boneFaint: '#6d685c',
    hairline: 'rgba(23, 21, 15, 0.14)',
    hairlineStrong: 'rgba(23, 21, 15, 0.3)',
    veil: 'rgba(236, 230, 218, 0.7)',
    veilStrong: 'rgba(236, 230, 218, 0.9)',
  },
} as const;

/** The two signature accents: ember (the Ithra's lantern light) and signal (our instruments). */
export const signature = {
  ember: spectralLines.na,
  signal: spectralLines.o3,
} as const;

/* ────────────────────────────────────────────────────────────────────────────
 * Typography
 * ──────────────────────────────────────────────────────────────────────────── */

export const fontFamily = {
  /** The voice of the Ithra: high-contrast display serif. */
  display: "'Cormorant', 'Cormorant Garamond', 'Iowan Old Style', 'Palatino Linotype', Georgia, serif",
  /** The voice of the Institute: variable-width grotesk. */
  sans: "'Mona Sans', 'Segoe UI Variable', 'Segoe UI', system-ui, -apple-system, sans-serif",
  /** Instrument readouts. */
  mono: "'Martian Mono', ui-monospace, 'Cascadia Mono', 'SF Mono', Menlo, Consolas, monospace",
} as const;

/** Fluid type scale. Values are CSS `clamp()` expressions. */
export const typeScale = {
  mega: 'clamp(4.25rem, 1rem + 13.5vw, 17rem)',
  display: 'clamp(3.25rem, 1.2rem + 8.2vw, 10rem)',
  h1: 'clamp(2.6rem, 1.4rem + 4.6vw, 6rem)',
  h2: 'clamp(2.05rem, 1.35rem + 2.9vw, 4.1rem)',
  h3: 'clamp(1.55rem, 1.2rem + 1.25vw, 2.35rem)',
  h4: 'clamp(1.2rem, 1.05rem + 0.6vw, 1.55rem)',
  lead: 'clamp(1.15rem, 1.02rem + 0.55vw, 1.5rem)',
  body: 'clamp(1rem, 0.96rem + 0.18vw, 1.125rem)',
  small: '0.875rem',
  micro: '0.6875rem',
  nano: '0.625rem',
} as const;

export const leading = {
  none: '0.86',
  tight: '0.98',
  snug: '1.15',
  normal: '1.5',
  relaxed: '1.68',
} as const;

export const tracking = {
  tighter: '-0.045em',
  tight: '-0.022em',
  normal: '0',
  wide: '0.06em',
  wider: '0.14em',
  widest: '0.28em',
} as const;

/* ────────────────────────────────────────────────────────────────────────────
 * Space, grid, radii, layers, materials
 * ──────────────────────────────────────────────────────────────────────────── */

export const space = {
  '0': '0',
  '1': '0.25rem',
  '2': '0.5rem',
  '3': '0.75rem',
  '4': '1rem',
  '5': '1.5rem',
  '6': '2rem',
  '7': '3rem',
  '8': '4rem',
  '9': '6rem',
  '10': '8rem',
  '11': '12rem',
  gutter: 'clamp(1rem, 0.35rem + 3.2vw, 4rem)',
  section: 'clamp(6rem, 3rem + 12vw, 15rem)',
  block: 'clamp(3rem, 2rem + 5vw, 7rem)',
} as const;

export const grid = {
  columns: 12,
  maxWidth: '1680px',
  measure: '64ch',
  measureNarrow: '46ch',
} as const;

/** Breakpoints in px. Media queries in CSS use these literal values. */
export const breakpoints = {
  xs: 360,
  sm: 480,
  md: 768,
  lg: 1024,
  xl: 1440,
  xxl: 1920,
} as const;

export const radius = {
  none: '0',
  hair: '2px',
  soft: '6px',
  card: '10px',
  round: '999px',
} as const;

export const layer = {
  stage: 0,
  grain: 2,
  content: 10,
  hud: 80,
  chrome: 100,
  overlay: 200,
  palette: 300,
  toast: 400,
  transition: 500,
  cursor: 600,
  boot: 700,
} as const;

export const blur = {
  glass: '18px',
  heavy: '42px',
} as const;

/* ────────────────────────────────────────────────────────────────────────────
 * Motion
 * ──────────────────────────────────────────────────────────────────────────── */

export type Bezier = readonly [number, number, number, number];

/**
 * Named easing curves. Light does not "slide": it resolves, emits and settles,
 * so most curves are strongly decelerating.
 */
export const ease = {
  /** Arrivals, reveals, anything resolving into focus. */
  out: [0.16, 1, 0.3, 1],
  /** Gentle secondary settle. */
  soft: [0.33, 1, 0.68, 1],
  /** Departures. */
  in: [0.7, 0, 0.84, 0],
  /** Spatial camera moves. */
  inOut: [0.83, 0, 0.17, 1],
  /** The aperture blink. */
  aperture: [0.76, 0, 0.24, 1],
  /** Material-style emphasis for UI state changes. */
  emphasized: [0.2, 0, 0, 1],
  /** Linear, for scrubbed timelines. */
  linear: [0, 0, 1, 1],
} as const satisfies Record<string, Bezier>;

export type EaseName = keyof typeof ease;

/** Durations in milliseconds, grouped by motion category. */
export const duration = {
  /** micro — hovers, presses, toggles */
  micro: 160,
  quick: 240,
  /** navigation — menus, palette, the blink */
  nav: 520,
  /** reveal — text and media entering */
  reveal: 1100,
  /** spatial — camera travel */
  spatial: 1800,
  /** cinematic — intro beats */
  cinematic: 3200,
  /** ambient — idle loops */
  ambient: 14000,
} as const;

export interface SpringConfig {
  readonly stiffness: number;
  readonly damping: number;
  readonly mass: number;
}

/** Spring presets for the physics layer (`lib/spring.ts`). */
export const spring = {
  /** Cursor ring trailing the pointer. */
  cursor: { stiffness: 520, damping: 38, mass: 0.6 },
  /** Buttons and toggles. */
  snappy: { stiffness: 420, damping: 30, mass: 1 },
  /** Magnetic hover attraction. */
  magnetic: { stiffness: 240, damping: 19, mass: 1 },
  /** Panels and larger surfaces. */
  gentle: { stiffness: 170, damping: 26, mass: 1 },
  /** Camera and orbital motion. */
  orbital: { stiffness: 48, damping: 14, mass: 1 },
} as const satisfies Record<string, SpringConfig>;

export const cssBezier = (b: Bezier): string => `cubic-bezier(${b.join(', ')})`;

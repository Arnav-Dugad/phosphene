import { createRng } from './random.ts';
import { TAU } from './math.ts';

/**
 * The Ithran script.
 *
 * Every Ithran glyph is drawn inside an "aperture" — a unit circle with eight
 * spokes and three radii (core, mid, rim). A glyph is a small set of strokes on
 * that lattice: a rim that may be broken by a gap, arcs on the mid ring, rays
 * along spokes, chords across the rim and luminous dots. Vowels close the rim
 * and light the core.
 *
 * The mapping from Latin characters is deterministic, so a name always yields
 * the same sigil — on every device, for every visitor.
 */

export const SPOKES = 8;
const RADII = { core: 0.26, mid: 0.6, rim: 1 } as const;
const VOWELS = new Set(['a', 'e', 'i', 'o', 'u', 'y']);
const GAP_HALF = 0.3;

export type Stroke =
  | { kind: 'rim'; gap: number | null }
  | { kind: 'arc'; radius: number; from: number; span: number }
  | { kind: 'ray'; spoke: number; inner: number; outer: number }
  | { kind: 'chord'; a: number; b: number }
  | { kind: 'dot'; spoke: number; radius: number }
  | { kind: 'core'; filled: boolean };

export interface GlyphDef {
  char: string;
  strokes: Stroke[];
}

const spokeAngle = (k: number): number => -Math.PI / 2 + (k * TAU) / SPOKES;

const cache = new Map<string, GlyphDef>();

/** Deterministic glyph definition for a single character. */
export function glyphFor(char: string): GlyphDef {
  const key = char.toLowerCase();
  const cached = cache.get(key);
  if (cached) return cached;

  const rng = createRng(`ithra:${key}`);
  const strokes: Stroke[] = [];
  const vowel = VOWELS.has(key);
  const isDigit = /[0-9]/.test(key);

  if (isDigit) {
    // Numerals: an open rim whose gap faces down, with n+1 dots around the mid ring.
    const n = Number(key);
    strokes.push({ kind: 'rim', gap: 4 });
    for (let i = 0; i <= n; i++) strokes.push({ kind: 'dot', spoke: i % SPOKES, radius: RADII.mid });
    if (n === 9) strokes.push({ kind: 'core', filled: true });
  } else {
    strokes.push({ kind: 'rim', gap: vowel ? null : rng.int(0, SPOKES - 1) });

    const arcFrom = rng.int(0, SPOKES - 1);
    strokes.push({ kind: 'arc', radius: RADII.mid, from: arcFrom, span: rng.int(1, 3) });
    if (rng.chance(0.45)) {
      strokes.push({
        kind: 'arc',
        radius: RADII.core + 0.08,
        from: (arcFrom + 4) % SPOKES,
        span: rng.int(2, 4),
      });
    }

    const rays = rng.int(0, 2);
    const used = new Set<number>();
    for (let i = 0; i < rays; i++) {
      let spoke = rng.int(0, SPOKES - 1);
      while (used.has(spoke)) spoke = (spoke + 3) % SPOKES;
      used.add(spoke);
      const outward = rng.chance(0.35);
      strokes.push({
        kind: 'ray',
        spoke,
        inner: outward ? RADII.rim : RADII.core,
        outer: outward ? 1.28 : RADII.mid,
      });
    }

    if (rng.chance(0.3)) {
      const a = rng.int(0, SPOKES - 1);
      strokes.push({ kind: 'chord', a, b: (a + 3) % SPOKES });
    }

    if (rng.chance(0.55)) strokes.push({ kind: 'dot', spoke: rng.int(0, SPOKES - 1), radius: RADII.mid });
    if (vowel) strokes.push({ kind: 'core', filled: key === 'a' || key === 'o' });
  }

  const def: GlyphDef = { char: key, strokes };
  cache.set(key, def);
  return def;
}

const fmt = (n: number): string => (Math.round(n * 1000) / 1000).toString();

function polar(cx: number, cy: number, r: number, angle: number): [number, number] {
  return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
}

function arcPath(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const [x0, y0] = polar(cx, cy, r, a0);
  const [x1, y1] = polar(cx, cy, r, a1);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${fmt(x0)} ${fmt(y0)}A${fmt(r)} ${fmt(r)} 0 ${large} 1 ${fmt(x1)} ${fmt(y1)}`;
}

export interface GlyphDot {
  cx: number;
  cy: number;
  r: number;
}

export interface RenderedGlyph {
  /** Stroke path data. */
  d: string;
  /** Filled dots. */
  dots: GlyphDot[];
}

/**
 * Renders a glyph definition at a position and scale.
 * `rotation` rotates the whole aperture (used by rosette layouts).
 */
export function renderGlyph(def: GlyphDef, cx: number, cy: number, size: number, rotation = 0): RenderedGlyph {
  const s = size / 2;
  const parts: string[] = [];
  const dots: GlyphDot[] = [];
  const angle = (k: number): number => spokeAngle(k) + rotation;

  for (const stroke of def.strokes) {
    switch (stroke.kind) {
      case 'rim': {
        if (stroke.gap === null) {
          parts.push(arcPath(cx, cy, s, rotation - Math.PI / 2, rotation + Math.PI / 2));
          parts.push(arcPath(cx, cy, s, rotation + Math.PI / 2, rotation + (3 * Math.PI) / 2));
        } else {
          const g = angle(stroke.gap);
          parts.push(arcPath(cx, cy, s, g + GAP_HALF, g + TAU - GAP_HALF));
        }
        break;
      }
      case 'arc': {
        const a0 = angle(stroke.from);
        parts.push(arcPath(cx, cy, s * stroke.radius, a0, a0 + (stroke.span * TAU) / SPOKES));
        break;
      }
      case 'ray': {
        const a = angle(stroke.spoke);
        const [x0, y0] = polar(cx, cy, s * stroke.inner, a);
        const [x1, y1] = polar(cx, cy, s * stroke.outer, a);
        parts.push(`M${fmt(x0)} ${fmt(y0)}L${fmt(x1)} ${fmt(y1)}`);
        break;
      }
      case 'chord': {
        const [x0, y0] = polar(cx, cy, s, angle(stroke.a));
        const [x1, y1] = polar(cx, cy, s, angle(stroke.b));
        parts.push(`M${fmt(x0)} ${fmt(y0)}L${fmt(x1)} ${fmt(y1)}`);
        break;
      }
      case 'dot': {
        const [x, y] = polar(cx, cy, s * stroke.radius, angle(stroke.spoke));
        dots.push({ cx: x, cy: y, r: s * 0.085 });
        break;
      }
      case 'core': {
        if (stroke.filled) dots.push({ cx, cy, r: s * 0.13 });
        else {
          const r = s * 0.14;
          parts.push(arcPath(cx, cy, r, 0, Math.PI));
          parts.push(arcPath(cx, cy, r, Math.PI, TAU));
        }
        break;
      }
    }
  }
  return { d: parts.join(''), dots };
}

export type WordLayoutMode = 'line' | 'rosette';

export interface WordLayout {
  width: number;
  height: number;
  glyphs: (RenderedGlyph & { char: string; index: number })[];
  /** Connecting ligatures ("the thread of light"). */
  thread: string;
}

/**
 * Lays out a phrase in Ithran.
 * - `line`: glyphs strung on a horizontal thread, words separated by a wider gap.
 * - `rosette`: glyphs arranged around a circle, facing outward — used for sigils.
 */
export function layoutWord(text: string, mode: WordLayoutMode = 'line', size = 40): WordLayout {
  const chars = Array.from(text.toLowerCase()).filter((c) => /[a-z0-9 ]/.test(c));
  const glyphs: WordLayout['glyphs'] = [];

  if (mode === 'line') {
    const gap = size * 0.34;
    const wordGap = size * 0.9;
    let x = size / 2 + size * 0.2;
    const cy = size / 2 + size * 0.2;
    const thread: string[] = [];
    let prevRight: number | null = null;
    chars.forEach((char, index) => {
      if (char === ' ') {
        x += wordGap - gap;
        prevRight = null;
        return;
      }
      const rendered = renderGlyph(glyphFor(char), x, cy, size);
      glyphs.push({ ...rendered, char, index });
      if (prevRight !== null) thread.push(`M${fmt(prevRight)} ${fmt(cy)}L${fmt(x - size / 2)} ${fmt(cy)}`);
      prevRight = x + size / 2;
      x += size + gap;
    });
    return { width: x - gap + size * 0.2 - size / 2, height: size * 1.4, glyphs, thread: thread.join('') };
  }

  const letters = chars.filter((c) => c !== ' ');
  const count = Math.max(1, letters.length);
  const orbit = Math.max(size * 1.1, (count * size * 1.18) / TAU);
  const extent = orbit + size * 0.75;
  const c = extent;
  letters.forEach((char, index) => {
    const a = -Math.PI / 2 + (index * TAU) / count;
    const [x, y] = polar(c, c, orbit, a);
    const rendered = renderGlyph(glyphFor(char), x, y, size, a + Math.PI / 2);
    glyphs.push({ ...rendered, char, index });
  });
  const innerR = Math.max(0, orbit - size * 0.72);
  const threadR = orbit + size * 0.62;
  const thread = innerR > size * 0.2
    ? `${arcPath(c, c, innerR, 0, Math.PI)}${arcPath(c, c, innerR, Math.PI, TAU)}${arcPath(c, c, threadR, 0, Math.PI)}${arcPath(c, c, threadR, Math.PI, TAU)}`
    : `${arcPath(c, c, threadR, 0, Math.PI)}${arcPath(c, c, threadR, Math.PI, TAU)}`;
  return { width: extent * 2, height: extent * 2, glyphs, thread };
}

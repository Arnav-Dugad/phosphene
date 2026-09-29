/**
 * Deterministic randomness. Everything procedural in PHOSPHENE — relic geometry,
 * telemetry, glyphs, star fields — is derived from seeds so that every visitor
 * observes the same world.
 */

/** cyrb53: a fast, well-distributed 53-bit string hash. */
export function hashString(input: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/** Integer hash for lattice coordinates (used by value-noise style lookups). */
export function hash2i(x: number, y: number, seed = 0): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform float in [min, max). */
  range(min: number, max: number): number;
  /** Uniform integer in [min, max]. */
  int(min: number, max: number): number;
  /** Standard normal sample (Box–Muller). */
  gaussian(mean?: number, deviation?: number): number;
  /** True with probability p. */
  chance(p: number): boolean;
  /** Random element of a non-empty array. */
  pick<T>(items: readonly T[]): T;
  /** Fisher–Yates shuffle into a new array. */
  shuffle<T>(items: readonly T[]): T[];
  /** Uniform point on the unit sphere. */
  onSphere(): [number, number, number];
}

/**
 * sfc32 — small fast counter PRNG with a 128-bit state; passes PractRand to
 * large sizes and is plenty for visual procedural work.
 */
export function createRng(seed: number | string): Rng {
  const s = typeof seed === 'string' ? hashString(seed) : seed;
  let a = s >>> 0;
  let b = Math.floor(s / 4294967296) >>> 0 || 0x9e3779b9;
  let c = 0x243f6a88 ^ a;
  let d = 1;

  const next = (): number => {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };

  // Warm up so nearby seeds diverge immediately.
  for (let i = 0; i < 12; i++) next();

  let spare: number | null = null;

  const rng: Rng = {
    next,
    range: (min, max) => min + (max - min) * next(),
    int: (min, max) => Math.floor(min + (max - min + 1) * next()),
    gaussian(mean = 0, deviation = 1) {
      if (spare !== null) {
        const value = spare;
        spare = null;
        return mean + deviation * value;
      }
      let u = 0;
      let v = 0;
      while (u === 0) u = next();
      while (v === 0) v = next();
      const mag = Math.sqrt(-2 * Math.log(u));
      spare = mag * Math.sin(2 * Math.PI * v);
      return mean + deviation * mag * Math.cos(2 * Math.PI * v);
    },
    chance: (p) => next() < p,
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new Error('pick() called with an empty array');
      return items[Math.floor(next() * items.length)] as T;
    },
    shuffle<T>(items: readonly T[]): T[] {
      const out = items.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j] as T, out[i] as T];
      }
      return out;
    },
    onSphere() {
      const z = 2 * next() - 1;
      const t = 2 * Math.PI * next();
      const r = Math.sqrt(1 - z * z);
      return [r * Math.cos(t), r * Math.sin(t), z];
    },
  };
  return rng;
}

import { createRng } from './random.ts';

/**
 * Seeded simplex noise (after Stefan Gustavson's reference implementation).
 * CPU-side counterpart to the GLSL noise used in shaders; drives procedural
 * geometry, terrain and simulated telemetry.
 */

const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;
const F3 = 1 / 3;
const G3 = 1 / 6;

const GRAD3 = new Float32Array([
  1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0, 1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1, 0, 1, 1, 0, -1, 1, 0, 1, -1,
  0, -1, -1,
]);

export interface Noise {
  noise2(x: number, y: number): number;
  noise3(x: number, y: number, z: number): number;
  /** Fractal Brownian motion over 2D simplex noise, normalised to about [-1, 1]. */
  fbm2(x: number, y: number, octaves?: number, lacunarity?: number, gain?: number): number;
  fbm3(x: number, y: number, z: number, octaves?: number, lacunarity?: number, gain?: number): number;
}

export function createNoise(seed: number | string = 'phosphene'): Noise {
  const rng = createRng(seed);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    const tmp = p[i] as number;
    p[i] = p[j] as number;
    p[j] = tmp;
  }
  const perm = new Uint8Array(512);
  const permMod12 = new Uint8Array(512);
  for (let i = 0; i < 512; i++) {
    perm[i] = p[i & 255] as number;
    permMod12[i] = (perm[i] as number) % 12;
  }

  const g = (i: number, k: number): number => GRAD3[i * 3 + k] as number;

  function noise2(xin: number, yin: number): number {
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const x0 = xin - (i - t);
    const y0 = yin - (j - t);
    const i1 = x0 > y0 ? 1 : 0;
    const j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;
    const ii = i & 255;
    const jj = j & 255;
    let n = 0;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) {
      const gi = permMod12[ii + (perm[jj] as number)] as number;
      t0 *= t0;
      n += t0 * t0 * (g(gi, 0) * x0 + g(gi, 1) * y0);
    }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) {
      const gi = permMod12[ii + i1 + (perm[jj + j1] as number)] as number;
      t1 *= t1;
      n += t1 * t1 * (g(gi, 0) * x1 + g(gi, 1) * y1);
    }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 >= 0) {
      const gi = permMod12[ii + 1 + (perm[jj + 1] as number)] as number;
      t2 *= t2;
      n += t2 * t2 * (g(gi, 0) * x2 + g(gi, 1) * y2);
    }
    return 70 * n;
  }

  function noise3(xin: number, yin: number, zin: number): number {
    const s = (xin + yin + zin) * F3;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const k = Math.floor(zin + s);
    const t = (i + j + k) * G3;
    const x0 = xin - (i - t);
    const y0 = yin - (j - t);
    const z0 = zin - (k - t);
    let i1: number, j1: number, k1: number, i2: number, j2: number, k2: number;
    if (x0 >= y0) {
      if (y0 >= z0) [i1, j1, k1, i2, j2, k2] = [1, 0, 0, 1, 1, 0];
      else if (x0 >= z0) [i1, j1, k1, i2, j2, k2] = [1, 0, 0, 1, 0, 1];
      else [i1, j1, k1, i2, j2, k2] = [0, 0, 1, 1, 0, 1];
    } else if (y0 < z0) [i1, j1, k1, i2, j2, k2] = [0, 0, 1, 0, 1, 1];
    else if (x0 < z0) [i1, j1, k1, i2, j2, k2] = [0, 1, 0, 0, 1, 1];
    else [i1, j1, k1, i2, j2, k2] = [0, 1, 0, 1, 1, 0];

    const x1 = x0 - i1 + G3;
    const y1 = y0 - j1 + G3;
    const z1 = z0 - k1 + G3;
    const x2 = x0 - i2 + 2 * G3;
    const y2 = y0 - j2 + 2 * G3;
    const z2 = z0 - k2 + 2 * G3;
    const x3 = x0 - 1 + 3 * G3;
    const y3 = y0 - 1 + 3 * G3;
    const z3 = z0 - 1 + 3 * G3;
    const ii = i & 255;
    const jj = j & 255;
    const kk = k & 255;

    const corner = (x: number, y: number, z: number, gi: number): number => {
      let tt = 0.6 - x * x - y * y - z * z;
      if (tt < 0) return 0;
      tt *= tt;
      return tt * tt * (g(gi, 0) * x + g(gi, 1) * y + g(gi, 2) * z);
    };

    const pk = (o: number): number => perm[kk + o] as number;
    const pj = (o: number, kk2: number): number => perm[jj + o + kk2] as number;

    const n0 = corner(x0, y0, z0, permMod12[ii + pj(0, pk(0))] as number);
    const n1 = corner(x1, y1, z1, permMod12[ii + i1 + pj(j1, pk(k1))] as number);
    const n2 = corner(x2, y2, z2, permMod12[ii + i2 + pj(j2, pk(k2))] as number);
    const n3 = corner(x3, y3, z3, permMod12[ii + 1 + pj(1, pk(1))] as number);
    return 32 * (n0 + n1 + n2 + n3);
  }

  function fbm2(x: number, y: number, octaves = 5, lacunarity = 2, gain = 0.5): number {
    let amp = 0.5;
    let freq = 1;
    let sum = 0;
    let norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += amp * noise2(x * freq, y * freq);
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return sum / norm;
  }

  function fbm3(x: number, y: number, z: number, octaves = 5, lacunarity = 2, gain = 0.5): number {
    let amp = 0.5;
    let freq = 1;
    let sum = 0;
    let norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += amp * noise3(x * freq, y * freq, z * freq);
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return sum / norm;
  }

  return { noise2, noise3, fbm2, fbm3 };
}

import {
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  NoColorSpace,
  RepeatWrapping,
  RGBAFormat,
  UnsignedByteType,
} from 'three';
import { hash2i } from '../../lib/random.ts';

/**
 * A tileable, four-channel value-noise texture shared by every scene.
 *
 * Sampling a texture is far cheaper than evaluating simplex noise per pixel,
 * and — just as important — it keeps shaders small. The Direct3D shader
 * compiler behind ANGLE on Windows unrolls and inlines aggressively; large
 * procedural-noise shaders can stall the GPU process long enough for the
 * watchdog to kill the context. Texture noise sidesteps that entirely.
 *
 * Each channel is an independent fbm octave stack with its own seed, so a
 * shader can combine channels as decorrelated octaves.
 */
const SIZE = 256;

const fade = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10);

/** Periodic value noise: the lattice wraps every `period` cells, so the result tiles. */
function periodicValueNoise(x: number, y: number, period: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const wrap = (v: number): number => ((v % period) + period) % period;
  const x0 = wrap(xi);
  const y0 = wrap(yi);
  const x1 = wrap(xi + 1);
  const y1 = wrap(yi + 1);
  const a = hash2i(x0, y0, seed);
  const b = hash2i(x1, y0, seed);
  const c = hash2i(x0, y1, seed);
  const d = hash2i(x1, y1, seed);
  const u = fade(xf);
  const v = fade(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function channel(u: number, v: number, basePeriod: number, seed: number): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let period = basePeriod;
  for (let octave = 0; octave < 5; octave++) {
    sum += amp * periodicValueNoise(u * period, v * period, period, seed + octave * 101);
    norm += amp;
    amp *= 0.5;
    period *= 2;
  }
  return sum / norm;
}

let shared: DataTexture | null = null;

export function getNoiseTexture(): DataTexture {
  if (shared) return shared;
  const data = new Uint8Array(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const u = x / SIZE;
      const v = y / SIZE;
      const i = (y * SIZE + x) * 4;
      data[i] = Math.round(channel(u, v, 4, 11) * 255);
      data[i + 1] = Math.round(channel(u, v, 6, 23) * 255);
      data[i + 2] = Math.round(channel(u, v, 8, 37) * 255);
      data[i + 3] = Math.round(channel(u, v, 12, 53) * 255);
    }
  }
  const texture = new DataTexture(data, SIZE, SIZE, RGBAFormat, UnsignedByteType);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.colorSpace = NoColorSpace;
  texture.needsUpdate = true;
  shared = texture;
  return texture;
}

/** Called when the GL context is rebuilt: the texture must be re-uploaded. */
export function resetNoiseTexture(): void {
  shared = null;
}

/** GLSL helpers for sampling the shared noise texture (declares `uNoise`). */
export const noiseTextureGlsl = /* glsl */ `
  uniform sampler2D uNoise;
  float noiseFbm(vec2 uv) {
    vec4 a = texture2D(uNoise, uv);
    vec4 b = texture2D(uNoise, uv * 2.03 + vec2(0.37, 0.71));
    return a.r * 0.45 + a.g * 0.27 + b.b * 0.18 + b.a * 0.1;
  }
`;

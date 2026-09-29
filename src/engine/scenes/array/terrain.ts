import { dishes } from '../../../content/array.ts';
import { smoothstep } from '../../../lib/math.ts';
import { createRng, hash2i } from '../../../lib/random.ts';

/**
 * The floor of Daedalus Crater around the Array: a deterministic heightfield
 * (gentle regolith swells, a population of simple impact craters, levelled
 * pads under every dish) generated on the CPU once, plus the per-vertex sun
 * visibility that gives the lunar light its hard, long shadows.
 */

/** Half the side of the modelled patch, in scene units (10 m). Beyond it, the sky shader draws the plain. */
export const TERRAIN_HALF = 320;
/** Height above its pad at which each dish's elevation axis sits. */
export const DISH_PIVOT = 2.05;
const PAD_RADIUS = 2.3;
const PAD_BLEND = 4.6;

interface Crater {
  x: number;
  z: number;
  r: number;
  depth: number;
  rim: number;
}

const fade = (t: number): number => t * t * (3 - 2 * t);

function valueNoise(x: number, z: number, seed: number): number {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const u = fade(x - xi);
  const v = fade(z - zi);
  const a = hash2i(xi, zi, seed);
  const b = hash2i(xi + 1, zi, seed);
  const c = hash2i(xi, zi + 1, seed);
  const d = hash2i(xi + 1, zi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function swell(x: number, z: number): number {
  let sum = 0;
  let amp = 1;
  let freq = 1 / 70;
  for (let octave = 0; octave < 4; octave++) {
    sum += (valueNoise(x * freq, z * freq, 17 + octave * 31) - 0.5) * amp;
    amp *= 0.45;
    freq *= 2.1;
  }
  return sum * 2.6;
}

function buildCraters(): Crater[] {
  const rng = createRng('daedalus-floor');
  const craters: Crater[] = [];
  const clearOfArray = (x: number, z: number, r: number): boolean =>
    dishes.every((d) => Math.hypot(d.x - x, d.z - z) > r * 1.25 + PAD_BLEND + 2);
  let attempts = 0;
  while (craters.length < 90 && attempts < 3000) {
    attempts++;
    const big = craters.length < 4;
    const r = big ? rng.range(38, 70) : 2.5 + 30 * Math.pow(rng.next(), 3.2);
    const x = rng.range(-TERRAIN_HALF * 0.9, TERRAIN_HALF * 0.9);
    const z = rng.range(-TERRAIN_HALF * 0.9, TERRAIN_HALF * 0.9);
    if (big && Math.hypot(x, z) < 150 + r) continue;
    if (!clearOfArray(x, z, r)) continue;
    craters.push({ x, z, r, depth: r * rng.range(0.16, 0.24), rim: r * rng.range(0.035, 0.06) });
  }
  return craters;
}

function craterProfile(d: number, c: Crater): number {
  // Inside: a bowl rising to the rim crest. Outside: an ejecta blanket falling away.
  if (d < 1) return -c.depth * (1 - d * d) + c.rim * Math.exp(-((d - 1) * (d - 1)) / 0.02);
  return c.rim * Math.exp(-((d - 1) * (d - 1)) / 0.02) + c.rim * 0.35 * Math.pow(d, -3);
}

export class Heightfield {
  readonly segments: number;
  readonly size: number;
  readonly cell: number;
  readonly heights: Float32Array;
  /** Pad height under each dish, by dish index. */
  readonly pads: Float32Array;

  constructor(segments: number) {
    this.segments = segments;
    this.size = segments + 1;
    this.cell = (TERRAIN_HALF * 2) / segments;
    this.heights = new Float32Array(this.size * this.size);
    const craters = buildCraters();

    const raw = (x: number, z: number): number => {
      let h = swell(x, z);
      for (const c of craters) {
        const dx = x - c.x;
        const dz = z - c.z;
        const reach = c.r * 3;
        if (dx > reach || dx < -reach || dz > reach || dz < -reach) continue;
        h += craterProfile(Math.sqrt(dx * dx + dz * dz) / c.r, c);
      }
      return h;
    };

    this.pads = new Float32Array(dishes.map((d) => raw(d.x, d.z)));
    for (let j = 0; j < this.size; j++) {
      for (let i = 0; i < this.size; i++) {
        const x = -TERRAIN_HALF + i * this.cell;
        const z = -TERRAIN_HALF + j * this.cell;
        let h = raw(x, z);
        for (const dish of dishes) {
          const dx = x - dish.x;
          const dz = z - dish.z;
          if (dx > PAD_BLEND || dx < -PAD_BLEND || dz > PAD_BLEND || dz < -PAD_BLEND) continue;
          const w = 1 - smoothstep(PAD_RADIUS, PAD_BLEND, Math.sqrt(dx * dx + dz * dz));
          h += ((this.pads[dish.index] as number) - h) * w;
        }
        // Taper to the plain the sky shader continues to the horizon.
        const edge = smoothstep(0.7, 0.97, Math.max(Math.abs(x), Math.abs(z)) / TERRAIN_HALF);
        this.heights[j * this.size + i] = h * (1 - edge);
      }
    }
  }

  /** Bilinear height at a scene position (0 outside the patch). */
  heightAt(x: number, z: number): number {
    const fx = (x + TERRAIN_HALF) / this.cell;
    const fz = (z + TERRAIN_HALF) / this.cell;
    if (fx < 0 || fz < 0 || fx >= this.segments || fz >= this.segments) return 0;
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const u = fx - i;
    const v = fz - j;
    const s = this.size;
    const h = this.heights;
    const a = h[j * s + i] as number;
    const b = h[j * s + i + 1] as number;
    const c = h[(j + 1) * s + i] as number;
    const d = h[(j + 1) * s + i + 1] as number;
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }

  /** Grid positions and smooth normals for a mesh. */
  buildAttributes(): { positions: Float32Array; normals: Float32Array; indices: Uint32Array } {
    const s = this.size;
    const positions = new Float32Array(s * s * 3);
    const normals = new Float32Array(s * s * 3);
    const h = (i: number, j: number): number =>
      this.heights[Math.min(s - 1, Math.max(0, j)) * s + Math.min(s - 1, Math.max(0, i))] as number;
    for (let j = 0; j < s; j++) {
      for (let i = 0; i < s; i++) {
        const k = (j * s + i) * 3;
        positions[k] = -TERRAIN_HALF + i * this.cell;
        positions[k + 1] = h(i, j);
        positions[k + 2] = -TERRAIN_HALF + j * this.cell;
        const nx = h(i - 1, j) - h(i + 1, j);
        const nz = h(i, j - 1) - h(i, j + 1);
        const ny = 2 * this.cell;
        const len = Math.hypot(nx, ny, nz);
        normals[k] = nx / len;
        normals[k + 1] = ny / len;
        normals[k + 2] = nz / len;
      }
    }
    const indices = new Uint32Array(this.segments * this.segments * 6);
    let n = 0;
    for (let j = 0; j < this.segments; j++) {
      for (let i = 0; i < this.segments; i++) {
        const a = j * s + i;
        indices[n++] = a;
        indices[n++] = a + s;
        indices[n++] = a + 1;
        indices[n++] = a + 1;
        indices[n++] = a + s;
        indices[n++] = a + s + 1;
      }
    }
    return { positions, normals, indices };
  }

  /**
   * Sun visibility per vertex, in [0, 1]: a march toward the sun through the
   * heightfield, soft-edged so penumbrae read as the Moon's hard-but-not-
   * aliased shadows. (The dishes' own shadows are traced separately, at
   * finer resolution, by `bakeDishShadows`.)
   */
  bakeShadows(sun: readonly [number, number, number], out: Float32Array): void {
    const [sx, sy, sz] = sun;
    const s = this.size;
    if (sy <= 0.002) {
      out.fill(0);
      return;
    }
    const horizontal = Math.hypot(sx, sz) || 1;
    const dx = sx / horizontal;
    const dz = sz / horizontal;
    const slope = sy / horizontal;
    const reach = Math.min(260, 24 / Math.max(slope, 0.02));
    const steps = 40;
    const step = reach / steps;
    for (let j = 0; j < s; j++) {
      for (let i = 0; i < s; i++) {
        const x = -TERRAIN_HALF + i * this.cell;
        const z = -TERRAIN_HALF + j * this.cell;
        const h0 = (this.heights[j * s + i] as number) + 0.08;
        let light = 1;
        for (let k = 1; k <= steps && light > 0; k++) {
          const d = k * step;
          const clearance = h0 + d * slope - this.heightAt(x + dx * d, z + dz * d);
          light = Math.min(light, (clearance / d) * 14 + 0.5);
        }
        out[j * s + i] = Math.max(0, Math.min(1, light));
      }
    }
  }
}

export interface DishPose {
  /** Pad position. */
  x: number;
  z: number;
  pad: number;
  /** Unit normal of the reflector (its pointing direction). */
  nx: number;
  ny: number;
  nz: number;
}

/** Distance from the pivot to the plane of the reflector's rim. */
const RIM_OFFSET = 0.49;
const PEDESTAL_RADIUS = 0.38;

/**
 * The dishes' shadows on the ground, traced per texel of the site map: each
 * reflector as the disc of its rim, facing wherever the dish points, and each
 * pedestal as a vertical cylinder. Written into `out` (R8, SITE_SIZE²) as
 * sun visibility.
 */
export function bakeDishShadows(
  sun: readonly [number, number, number],
  poses: readonly DishPose[],
  rimRadius: number,
  out: Uint8Array,
): void {
  out.fill(255);
  const [sx, sy, sz] = sun;
  if (sy <= 0.01) return;
  const texel = (SITE_HALF * 2) / SITE_SIZE;
  const horizontal = Math.hypot(sx, sz) || 1;
  const reach = Math.min(70, ((DISH_PIVOT + rimRadius + 0.6) * horizontal) / sy);
  const ex = (-sx / horizontal) * reach;
  const ez = (-sz / horizontal) * reach;
  const toTexel = (v: number): number => (v + SITE_HALF) / texel;
  const edge = 0.1;
  for (const pose of poses) {
    const cx = pose.x + pose.nx * RIM_OFFSET;
    const cy = pose.pad + DISH_PIVOT + pose.ny * RIM_OFFSET;
    const cz = pose.z + pose.nz * RIM_OFFSET;
    const denom = sx * pose.nx + sy * pose.ny + sz * pose.nz;
    const minI = Math.max(0, Math.floor(toTexel(Math.min(pose.x, pose.x + ex) - rimRadius - 1)));
    const maxI = Math.min(SITE_SIZE - 1, Math.ceil(toTexel(Math.max(pose.x, pose.x + ex) + rimRadius + 1)));
    const minJ = Math.max(0, Math.floor(toTexel(Math.min(pose.z, pose.z + ez) - rimRadius - 1)));
    const maxJ = Math.min(SITE_SIZE - 1, Math.ceil(toTexel(Math.max(pose.z, pose.z + ez) + rimRadius + 1)));
    for (let j = minJ; j <= maxJ; j++) {
      for (let i = minI; i <= maxI; i++) {
        const px = -SITE_HALF + (i + 0.5) * texel;
        const pz = -SITE_HALF + (j + 0.5) * texel;
        const py = pose.pad;
        let shade = 0;
        // The reflector: where does the sunward ray from this ground point cross the rim's plane?
        if (Math.abs(denom) > 1e-4) {
          const t = ((cx - px) * pose.nx + (cy - py) * pose.ny + (cz - pz) * pose.nz) / denom;
          if (t > 0) {
            const r = Math.hypot(px + sx * t - cx, py + sy * t - cy, pz + sz * t - cz);
            shade = 1 - smoothstep(rimRadius - edge, rimRadius + edge, r);
          }
        }
        // The pedestal: closest approach of the same ray to the dish's vertical axis.
        const ax = pose.x - px;
        const az = pose.z - pz;
        const t = (ax * sx + az * sz) / (horizontal * horizontal);
        const height = sy * t;
        if (t > 0 && height < DISH_PIVOT) {
          const miss = Math.hypot(ax - sx * t, az - sz * t);
          shade = Math.max(shade, 1 - smoothstep(PEDESTAL_RADIUS - edge, PEDESTAL_RADIUS + edge, miss));
        }
        const k = j * SITE_SIZE + i;
        out[k] = Math.min(out[k] as number, Math.round((1 - shade) * 255));
      }
    }
  }
}

/** Texels per side of the site map (lamp pools, dish ground shadow, service roads). */
export const SITE_SIZE = 512;
/** Half the side of the area the site map covers, in scene units. */
export const SITE_HALF = 160;

/**
 * An RGBA8 map of the Array's footprint: R = sodium work-lamp pools,
 * G = ambient occlusion under each dish, B = compacted service roads.
 */
export function buildSiteMap(): Uint8Array {
  const data = new Uint8Array(SITE_SIZE * SITE_SIZE * 4);
  const lamp = new Float32Array(SITE_SIZE * SITE_SIZE);
  const occlusion = new Float32Array(SITE_SIZE * SITE_SIZE).fill(1);
  const road = new Float32Array(SITE_SIZE * SITE_SIZE);
  const texel = (SITE_HALF * 2) / SITE_SIZE;
  const toTexel = (v: number): number => (v + SITE_HALF) / texel;
  const toWorld = (t: number): number => -SITE_HALF + (t + 0.5) * texel;

  for (const dish of dishes) {
    const cx = toTexel(dish.x);
    const cz = toTexel(dish.z);
    const radius = Math.ceil(10 / texel);
    for (let j = Math.max(0, Math.floor(cz - radius)); j < Math.min(SITE_SIZE, Math.ceil(cz + radius)); j++) {
      for (
        let i = Math.max(0, Math.floor(cx - radius));
        i < Math.min(SITE_SIZE, Math.ceil(cx + radius));
        i++
      ) {
        const d = Math.hypot(toWorld(i) - dish.x, toWorld(j) - dish.z);
        const k = j * SITE_SIZE + i;
        lamp[k] = (lamp[k] as number) + Math.exp(-(d * d) / 3.2) * 0.95 + Math.exp(-(d * d) / 16) * 0.14;
        occlusion[k] = Math.min(occlusion[k] as number, 1 - 0.55 * Math.exp(-(d * d) / 1.6));
      }
    }
  }

  // Service roads: each arm's dishes in sequence, and the core ring to the arms' roots.
  const segments: [number, number, number, number][] = [];
  const groups = ['Arm I', 'Arm II', 'Arm III'] as const;
  for (const group of groups) {
    const arm = dishes.filter((d) => d.group === group);
    let prev = { x: 0, z: 0 };
    for (const dish of arm) {
      segments.push([prev.x, prev.z, dish.x, dish.z]);
      prev = dish;
    }
  }
  for (const [x0, z0, x1, z1] of segments) {
    const minI = Math.max(0, Math.floor(toTexel(Math.min(x0, x1)) - 4));
    const maxI = Math.min(SITE_SIZE, Math.ceil(toTexel(Math.max(x0, x1)) + 4));
    const minJ = Math.max(0, Math.floor(toTexel(Math.min(z0, z1)) - 4));
    const maxJ = Math.min(SITE_SIZE, Math.ceil(toTexel(Math.max(z0, z1)) + 4));
    const lx = x1 - x0;
    const lz = z1 - z0;
    const len2 = lx * lx + lz * lz || 1;
    for (let j = minJ; j < maxJ; j++) {
      for (let i = minI; i < maxI; i++) {
        const px = toWorld(i) - x0;
        const pz = toWorld(j) - z0;
        const t = Math.max(0, Math.min(1, (px * lx + pz * lz) / len2));
        const d = Math.hypot(px - lx * t, pz - lz * t);
        const k = j * SITE_SIZE + i;
        road[k] = Math.max(road[k] as number, 1 - smoothstep(0.35, 0.9, d));
      }
    }
  }

  for (let k = 0; k < SITE_SIZE * SITE_SIZE; k++) {
    data[k * 4] = Math.round(Math.min(1, lamp[k] as number) * 255);
    data[k * 4 + 1] = Math.round((occlusion[k] as number) * 255);
    data[k * 4 + 2] = Math.round((road[k] as number) * 255);
    data[k * 4 + 3] = 255;
  }
  return data;
}

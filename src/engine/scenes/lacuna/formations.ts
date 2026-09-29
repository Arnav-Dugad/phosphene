import { TAU } from '../../../lib/math.ts';
import { createNoise } from '../../../lib/noise.ts';
import { createRng, type Rng } from '../../../lib/random.ts';

/**
 * Procedural formations for the Lacuna motes. Each generator fills `n`
 * positions (xyz) around the ring; the motes morph between formations on the
 * GPU. All formations are deterministic for a given count.
 */

export const RING = {
  center: [0, 3.6, -16] as const,
  radius: 3.3,
};

export type FormationKey =
  | 'drift'
  | 'signal'
  | 'tidal'
  | 'lanterns'
  | 'resonance'
  | 'schism'
  | 'noon'
  | 'reddening'
  | 'encoding'
  | 'field'
  | 'choir'
  | 'constellation';

/** The seven ages, in order, as formations. */
export const ERA_FORMATIONS: readonly FormationKey[] = [
  'tidal',
  'lanterns',
  'resonance',
  'schism',
  'noon',
  'reddening',
  'encoding',
];

type Generator = (out: Float32Array, n: number, rng: Rng) => void;

const [CX, CY, CZ] = RING.center;
const R = RING.radius;

const set = (out: Float32Array, i: number, x: number, y: number, z: number): void => {
  out[i * 3] = x;
  out[i * 3 + 1] = y;
  out[i * 3 + 2] = z;
};

const generators: Record<FormationKey, Generator> = {
  /** A slow galaxy of motes circling the ring, thinning with distance, plus dust over the water. */
  drift(out, n, rng) {
    for (let i = 0; i < n; i++) {
      if (rng.chance(0.78)) {
        const a = rng.next() * TAU;
        const radius = R * (1.12 + Math.pow(rng.next(), 1.8) * 5.5);
        const thickness = 0.25 + (radius - R) * 0.12;
        set(
          out,
          i,
          CX + Math.cos(a) * radius,
          CY + Math.sin(a) * radius * 0.92 + rng.gaussian(0, 0.15),
          CZ + rng.gaussian(0, thickness),
        );
      } else {
        set(out, i, rng.range(-26, 26), 0.2 + Math.pow(rng.next(), 2) * 4.5, rng.range(-34, 6));
      }
    }
  },

  /** The received signal: a luminous trace strung across the horizon. */
  signal(out, n, rng) {
    for (let i = 0; i < n; i++) {
      const u = rng.next();
      const x = (u - 0.5) * 64;
      const envelope = Math.exp(-Math.pow(x / 16, 2));
      const carrier = Math.sin(x * 1.7) * 0.55 * envelope + Math.sin(x * 0.37) * 0.25;
      const burst = Math.sin(x * 9.0) * 0.18 * Math.max(0, Math.sin(x * 0.45)) * envelope;
      set(
        out,
        i,
        x,
        CY + carrier + burst + rng.gaussian(0, 0.03 + 0.05 * (1 - envelope)),
        CZ + 3 + rng.gaussian(0, 0.12),
      );
    }
  },

  /** Age I — a breathing tidal sheet. */
  tidal(out, n, rng) {
    for (let i = 0; i < n; i++) {
      const x = rng.range(-10, 10);
      const z = rng.range(-7, 7);
      const y = 1.2 + Math.sin(x * 0.75 + z * 0.35) * 0.7 + Math.sin(z * 1.4) * 0.25 + rng.gaussian(0, 0.05);
      set(out, i, CX + x, y, CZ + z);
    }
  },

  /** Age II — lantern clusters drifting above the archipelago. */
  lanterns(out, n, rng) {
    const clusters = 90;
    const centers: [number, number, number][] = [];
    for (let c = 0; c < clusters; c++) {
      centers.push([rng.range(-12, 12), rng.range(0.8, 7.5), rng.range(-9, 7)]);
    }
    for (let i = 0; i < n; i++) {
      const center = centers[i % clusters] as [number, number, number];
      const [dx, dy, dz] = rng.onSphere();
      const r = Math.pow(rng.next(), 2.2) * 0.32;
      set(out, i, CX + center[0] + dx * r, center[1] + dy * r * 1.3, CZ + center[2] + dz * r);
    }
  },

  /** Age III — a Chladni figure: matter gathering on the nodal lines of a standing wave. */
  resonance(out, n, rng) {
    const m = 5;
    const k = 3;
    const size = 5.2;
    let i = 0;
    let guard = 0;
    while (i < n && guard < n * 60) {
      guard++;
      const x = rng.range(-1, 1);
      const y = rng.range(-1, 1);
      const v =
        Math.cos(m * Math.PI * x) * Math.cos(k * Math.PI * y) - Math.cos(k * Math.PI * x) * Math.cos(m * Math.PI * y);
      if (Math.abs(v) < 0.06 || rng.chance(0.004)) {
        set(out, i, CX + x * size, CY + y * size, CZ + rng.gaussian(0, 0.06));
        i++;
      }
    }
    for (; i < n; i++) set(out, i, CX + rng.range(-size, size), CY + rng.range(-size, size), CZ);
  },

  /** Age IV — two spirals turned away from each other: the Quiet Schism. */
  schism(out, n, rng) {
    for (let i = 0; i < n; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const t = Math.pow(rng.next(), 0.7);
      const arm = rng.int(0, 2);
      const a = t * 9 + (arm * TAU) / 3 + side * 0.4;
      const r = 0.2 + t * 4.2;
      const spread = 0.12 + t * 0.35;
      set(
        out,
        i,
        CX + side * 6.2 + Math.cos(a * side) * r + rng.gaussian(0, spread),
        CY + Math.sin(a * side) * r * 0.62 + rng.gaussian(0, spread),
        CZ + rng.gaussian(0, 0.25 + t * 0.4),
      );
    }
  },

  /** Age V — Sollen and its garden rings: the Long Noon. */
  noon(out, n, rng) {
    const tilt = 0.42;
    for (let i = 0; i < n; i++) {
      if (rng.chance(0.42)) {
        const [x, y, z] = rng.onSphere();
        const r = 2.1 + rng.gaussian(0, 0.03);
        set(out, i, CX + x * r, CY + y * r, CZ + z * r);
      } else {
        const a = rng.next() * TAU;
        const r = 3.0 + Math.pow(rng.next(), 0.8) * 3.2;
        const gap = r > 4.3 && r < 4.6 ? 0 : 1;
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        const yy = rng.gaussian(0, 0.03) * gap;
        set(out, i, CX + x, CY + z * Math.sin(tilt) + yy, CZ + z * Math.cos(tilt));
      }
    }
  },

  /** Age VI — the star swelling: a turbulent, expanding shell. */
  reddening(out, n, rng) {
    const noise = createNoise('reddening');
    for (let i = 0; i < n; i++) {
      const [x, y, z] = rng.onSphere();
      const turbulence = noise.fbm3(x * 1.6, y * 1.6, z * 1.6, 4) * 0.9;
      const r = 5.2 + turbulence + (rng.chance(0.12) ? rng.range(0, 2.5) : rng.gaussian(0, 0.08));
      set(out, i, CX + x * r, CY + y * r, CZ + z * r);
    }
  },

  /** Age VII — the Great Encoding: memory wound into a beam and cast into the dark. */
  encoding(out, n, rng) {
    for (let i = 0; i < n; i++) {
      const t = rng.next();
      const strand = i % 3;
      const a = t * 38 + (strand * TAU) / 3;
      const radius = 0.35 + t * 0.5 + (rng.chance(0.15) ? rng.range(0, 2) * t : 0);
      set(
        out,
        i,
        CX + Math.cos(a) * radius + rng.gaussian(0, 0.03),
        CY + Math.sin(a) * radius + rng.gaussian(0, 0.03),
        CZ + 6 - t * 60,
      );
    }
  },

  /** A lantern field over the whole sea (used by "The Lamplighters"). */
  field(out, n, rng) {
    for (let i = 0; i < n; i++) {
      set(out, i, rng.range(-30, 30), 0.25 + Math.pow(rng.next(), 1.5) * 6, rng.range(-40, 8));
    }
  },

  /** The Choir on Ennis: a planet girdled by a transmitting lattice. */
  choir(out, n, rng) {
    const lat = 9;
    const lon = 18;
    for (let i = 0; i < n; i++) {
      const onLine = rng.chance(0.7);
      let theta = rng.next() * TAU;
      let phi = Math.acos(2 * rng.next() - 1);
      if (onLine) {
        if (rng.chance(0.5)) phi = (Math.round((phi / Math.PI) * lat) / lat) * Math.PI;
        else theta = (Math.round((theta / TAU) * lon) / lon) * TAU;
      }
      const r = onLine ? 2.8 : 2.8 + rng.gaussian(0, 0.9);
      set(
        out,
        i,
        CX + r * Math.sin(phi) * Math.cos(theta),
        CY + r * Math.cos(phi),
        CZ + r * Math.sin(phi) * Math.sin(theta),
      );
    }
  },

  /** Loose constellations: bright knots joined by faint filaments. */
  constellation(out, n, rng) {
    const stars: [number, number, number][] = [];
    for (let s = 0; s < 40; s++) stars.push([rng.range(-14, 14), rng.range(1, 9), rng.range(-10, 4)]);
    for (let i = 0; i < n; i++) {
      const a = stars[rng.int(0, stars.length - 1)] as [number, number, number];
      if (rng.chance(0.55)) {
        const r = Math.pow(rng.next(), 3) * 0.25;
        const [dx, dy, dz] = rng.onSphere();
        set(out, i, CX + a[0] + dx * r, a[1] + dy * r, CZ + a[2] + dz * r);
      } else {
        const b = stars[(stars.indexOf(a) + 1) % stars.length] as [number, number, number];
        const t = rng.next();
        set(
          out,
          i,
          CX + a[0] + (b[0] - a[0]) * t,
          a[1] + (b[1] - a[1]) * t,
          CZ + a[2] + (b[2] - a[2]) * t,
        );
      }
    }
  },
};

const cache = new Map<string, Float32Array>();

/** Returns (and caches) the positions for a formation at a given particle count. */
export function formation(key: FormationKey, n: number): Float32Array {
  const id = `${key}:${n}`;
  let out = cache.get(id);
  if (!out) {
    out = new Float32Array(n * 3);
    generators[key](out, n, createRng(`formation:${key}`));
    cache.set(id, out);
  }
  return out;
}

export function clearFormationCache(): void {
  cache.clear();
}

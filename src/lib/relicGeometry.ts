import { createNoise } from './noise.ts';
import { TAU } from './math.ts';
import { createRng, type Rng } from './random.ts';

/**
 * Procedural reconstructions of Ithran relics.
 *
 * Every relic is generated from its kind and seed, so its form is identical
 * everywhere it appears: as a holographic point cloud (computed in a worker)
 * and as an engraved plate (projected to SVG). Pure module — no DOM, no GL.
 */

export type RelicKind =
  | 'vessel'
  | 'lantern'
  | 'bell'
  | 'spire'
  | 'lens'
  | 'ring'
  | 'lattice'
  | 'seed'
  | 'tablet'
  | 'map'
  | 'instrument'
  | 'mask';

export interface RelicForm {
  /** Engraving lines: each polyline is a flat [x, y, z, x, y, z, …] array. */
  polylines: number[][];
  /** Surface samples, xyz triples. */
  points: Float32Array;
  /** Per-point weight in [0, 1]: 1 for structural lines, lower for surface dust. */
  weights: Float32Array;
}

type Profile = [number, number][];

/* ── Profiles for turned (lathe) forms, as (radius, height) pairs ─────────── */

function smoothProfile(keys: Profile, steps = 64): Profile {
  const out: Profile = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / (steps - 1)) * (keys.length - 1);
    const k = Math.floor(t);
    const f = t - k;
    const p0 = keys[Math.max(0, k - 1)] as [number, number];
    const p1 = keys[k] as [number, number];
    const p2 = keys[Math.min(keys.length - 1, k + 1)] as [number, number];
    const p3 = keys[Math.min(keys.length - 1, k + 2)] as [number, number];
    const cr = (a: number, b: number, c: number, d: number): number =>
      0.5 * (2 * b + (-a + c) * f + (2 * a - 5 * b + 4 * c - d) * f * f + (-a + 3 * b - 3 * c + d) * f * f * f);
    out.push([Math.max(0, cr(p0[0], p1[0], p2[0], p3[0])), cr(p0[1], p1[1], p2[1], p3[1])]);
  }
  return out;
}

function profileFor(kind: RelicKind, rng: Rng): Profile {
  switch (kind) {
    case 'vessel': {
      const belly = rng.range(0.62, 0.86);
      const neck = rng.range(0.18, 0.3);
      return smoothProfile([
        [0.0, -1],
        [0.34, -1],
        [0.42, -0.9],
        [belly, -0.35],
        [belly * 0.94, 0.1],
        [neck, 0.52],
        [neck * 0.92, 0.72],
        [neck * 1.5, 0.92],
        [neck * 1.35, 1],
      ]);
    }
    case 'lantern': {
      const body = rng.range(0.52, 0.7);
      return smoothProfile([
        [0.0, -1],
        [0.28, -1],
        [0.3, -0.84],
        [body * 0.8, -0.62],
        [body, -0.1],
        [body * 0.86, 0.42],
        [0.3, 0.72],
        [0.34, 0.82],
        [0.12, 0.96],
        [0.05, 1],
      ]);
    }
    case 'bell': {
      const flare = rng.range(0.78, 0.95);
      return smoothProfile([
        [0.0, 1],
        [0.18, 0.98],
        [0.32, 0.86],
        [0.4, 0.5],
        [0.5, 0.0],
        [0.68, -0.6],
        [flare, -0.92],
        [flare * 1.02, -1],
      ]);
    }
    case 'spire':
    default: {
      const base = rng.range(0.34, 0.46);
      return smoothProfile([
        [0.0, -1],
        [base, -1],
        [base * 0.96, -0.86],
        [base * 0.55, -0.7],
        [base * 0.62, -0.4],
        [base * 0.32, -0.1],
        [base * 0.4, 0.2],
        [base * 0.18, 0.62],
        [base * 0.1, 0.9],
        [0.0, 1.12],
      ]);
    }
  }
}

/* ── Builders ─────────────────────────────────────────────────────────────── */

class FormBuilder {
  readonly polylines: number[][] = [];
  private readonly pts: number[] = [];
  private readonly w: number[] = [];

  line(points: number[]): void {
    if (points.length >= 6) this.polylines.push(points);
  }

  point(x: number, y: number, z: number, weight: number): void {
    this.pts.push(x, y, z);
    this.w.push(weight);
  }

  /** Scatters points densely along every polyline so structure reads in 3D. */
  sampleLines(budget: number, rng: Rng): void {
    const lengths = this.polylines.map((pl) => {
      let len = 0;
      for (let i = 3; i < pl.length; i += 3) {
        len += Math.hypot(
          (pl[i] as number) - (pl[i - 3] as number),
          (pl[i + 1] as number) - (pl[i - 2] as number),
          (pl[i + 2] as number) - (pl[i - 1] as number),
        );
      }
      return len;
    });
    const total = lengths.reduce((a, b) => a + b, 0) || 1;
    this.polylines.forEach((pl, index) => {
      const n = Math.max(2, Math.round((budget * (lengths[index] ?? 0)) / total));
      const segments = pl.length / 3 - 1;
      for (let k = 0; k < n; k++) {
        const t = rng.next() * segments;
        const s = Math.min(segments - 1, Math.floor(t));
        const f = t - s;
        const i = s * 3;
        this.point(
          (pl[i] as number) + ((pl[i + 3] as number) - (pl[i] as number)) * f,
          (pl[i + 1] as number) + ((pl[i + 4] as number) - (pl[i + 1] as number)) * f,
          (pl[i + 2] as number) + ((pl[i + 5] as number) - (pl[i + 2] as number)) * f,
          1,
        );
      }
    });
  }

  build(): RelicForm {
    return { polylines: this.polylines, points: new Float32Array(this.pts), weights: new Float32Array(this.w) };
  }
}

function circle(r: number, y: number, segments = 64, tilt = 0, yaw = 0): number[] {
  const out: number[] = [];
  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * TAU;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    // tilt about X, then yaw about Y
    const y1 = y * ct - z * st;
    const z1 = y * st + z * ct;
    out.push(x * cy + z1 * sy, y1, -x * sy + z1 * cy);
  }
  return out;
}

function lathe(b: FormBuilder, profile: Profile, rng: Rng, surface: number, meridians: number, parallels: number): void {
  for (let m = 0; m < meridians; m++) {
    const a = (m / meridians) * TAU;
    b.line(profile.flatMap(([r, y]) => [Math.cos(a) * r, y, Math.sin(a) * r]));
  }
  for (let p = 1; p < parallels; p++) {
    const [r, y] = profile[Math.round((p / parallels) * (profile.length - 1))] as [number, number];
    if (r > 0.02) b.line(circle(r, y, 72));
  }
  for (let i = 0; i < surface; i++) {
    const [r, y] = profile[Math.floor(rng.next() * profile.length)] as [number, number];
    const a = rng.next() * TAU;
    b.point(Math.cos(a) * r, y, Math.sin(a) * r, 0.35);
  }
}

/* ── Kinds ────────────────────────────────────────────────────────────────── */

function buildKind(kind: RelicKind, b: FormBuilder, rng: Rng, surface: number): void {
  switch (kind) {
    case 'vessel':
    case 'bell':
    case 'spire':
      lathe(b, profileFor(kind, rng), rng, surface, kind === 'spire' ? 10 : 18, kind === 'spire' ? 14 : 9);
      break;

    case 'lantern': {
      const profile = profileFor(kind, rng);
      lathe(b, profile, rng, surface, 12, 6);
      // The living light inside: a dense luminous core.
      for (let i = 0; i < surface * 0.5; i++) {
        const [x, y, z] = rng.onSphere();
        const r = Math.pow(rng.next(), 2.2) * 0.36;
        b.point(x * r, y * r - 0.1, z * r, 0.9);
      }
      break;
    }

    case 'lens': {
      const rings = rng.int(5, 9);
      for (let k = 1; k <= rings; k++) {
        const r = k / rings;
        const bulge = 0.12 * (1 - r * r);
        b.line(circle(r, bulge, 96, Math.PI / 2));
        b.line(circle(r, -bulge, 96, Math.PI / 2));
      }
      const spokes = rng.int(3, 8) * 2;
      for (let s = 0; s < spokes; s++) {
        const a = (s / spokes) * TAU;
        b.line([Math.cos(a) * 0.1, Math.sin(a) * 0.1, 0, Math.cos(a), Math.sin(a), 0]);
      }
      for (let i = 0; i < surface; i++) {
        const a = rng.next() * TAU;
        const r = Math.sqrt(rng.next());
        const bulge = 0.12 * (1 - r * r) * (rng.chance(0.5) ? 1 : -1);
        b.point(Math.cos(a) * r, Math.sin(a) * r, bulge, 0.3);
      }
      break;
    }

    case 'ring': {
      const R = 0.82;
      const r = 0.16;
      for (let m = 0; m < 24; m++) {
        const u = (m / 24) * TAU;
        const pts: number[] = [];
        for (let k = 0; k <= 32; k++) {
          const v = (k / 32) * TAU;
          pts.push((R + r * Math.cos(v)) * Math.cos(u), r * Math.sin(v), (R + r * Math.cos(v)) * Math.sin(u));
        }
        b.line(pts);
      }
      b.line(circle(R + r, 0, 128));
      b.line(circle(R - r, 0, 128));
      // An engraved band of pulses along the outer face.
      const pulses = rng.int(18, 36);
      for (let p = 0; p < pulses; p++) {
        const u = (p / pulses) * TAU;
        const h = rng.range(0.03, 0.12);
        b.line([
          (R + r) * Math.cos(u),
          -h,
          (R + r) * Math.sin(u),
          (R + r) * Math.cos(u),
          h,
          (R + r) * Math.sin(u),
        ]);
      }
      for (let i = 0; i < surface; i++) {
        const u = rng.next() * TAU;
        const v = rng.next() * TAU;
        b.point((R + r * Math.cos(v)) * Math.cos(u), r * Math.sin(v), (R + r * Math.cos(v)) * Math.sin(u), 0.3);
      }
      break;
    }

    case 'lattice': {
      const n = rng.int(3, 4);
      const hex = rng.chance(0.5);
      const nodes: [number, number, number][] = [];
      for (let i = -n; i <= n; i++) {
        for (let j = -n; j <= n; j++) {
          for (let k = -n; k <= n; k++) {
            const x = (i + (hex && j % 2 ? 0.5 : 0)) / n;
            const y = (j * (hex ? 0.866 : 1)) / n;
            const z = k / n;
            if (x * x * 0.9 + y * y + z * z * 1.2 <= 1.02) nodes.push([x * 0.9, y * 0.95, z * 0.8]);
          }
        }
      }
      const step = 1 / n;
      for (let a = 0; a < nodes.length; a++) {
        for (let c = a + 1; c < nodes.length; c++) {
          const p = nodes[a] as [number, number, number];
          const q = nodes[c] as [number, number, number];
          const d = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
          if (d < step * 1.05) b.line([...p, ...q]);
        }
      }
      for (const [x, y, z] of nodes) {
        for (let i = 0; i < 6; i++) b.point(x + rng.gaussian(0, 0.01), y + rng.gaussian(0, 0.01), z + rng.gaussian(0, 0.01), 1);
      }
      for (let i = 0; i < surface * 0.4; i++) {
        const [x, y, z] = rng.onSphere();
        const r = Math.pow(rng.next(), 0.5) * 0.95;
        b.point(x * r, y * r, z * r * 0.85, 0.2);
      }
      break;
    }

    case 'seed': {
      const golden = Math.PI * (3 - Math.sqrt(5));
      const count = 340;
      const elong = rng.range(1.15, 1.5);
      const spiral: number[] = [];
      for (let i = 0; i < count; i++) {
        const y = 1 - (i / (count - 1)) * 2;
        const r = Math.sqrt(1 - y * y);
        const a = i * golden;
        const x = Math.cos(a) * r * 0.78;
        const z = Math.sin(a) * r * 0.78;
        spiral.push(x, y * elong * 0.8, z);
        for (let k = 0; k < 10; k++) b.point(x + rng.gaussian(0, 0.012), y * elong * 0.8 + rng.gaussian(0, 0.012), z + rng.gaussian(0, 0.012), 0.95);
      }
      b.line(spiral);
      for (let m = 0; m < 8; m++) {
        const a = (m / 8) * TAU;
        const pts: number[] = [];
        for (let k = 0; k <= 40; k++) {
          const y = 1 - (k / 40) * 2;
          const r = Math.sqrt(Math.max(0, 1 - y * y)) * 0.78;
          pts.push(Math.cos(a) * r, y * elong * 0.8, Math.sin(a) * r);
        }
        b.line(pts);
      }
      for (let i = 0; i < surface * 0.5; i++) {
        const [x, y, z] = rng.onSphere();
        b.point(x * 0.78, y * elong * 0.8, z * 0.78, 0.25);
      }
      break;
    }

    case 'tablet': {
      const w = 0.78;
      const h = 1;
      const d = 0.09;
      const face = (z: number): number[] => [-w, -h, z, w, -h, z, w, h, z, -w, h, z, -w, -h, z];
      b.line(face(d));
      b.line(face(-d));
      for (const [x, y] of [
        [-w, -h],
        [w, -h],
        [w, h],
        [-w, h],
      ] as const) {
        b.line([x, y, d, x, y, -d]);
      }
      // Rows of pulse marks: the oldest way to write in light.
      const rows = rng.int(9, 14);
      for (let r = 0; r < rows; r++) {
        const y = h * 0.82 - (r / (rows - 1)) * h * 1.64;
        let x = -w * 0.82;
        while (x < w * 0.8) {
          const len = rng.chance(0.3) ? rng.range(0.12, 0.26) : rng.range(0.02, 0.06);
          const end = Math.min(w * 0.82, x + len);
          b.line([x, y, d + 0.002, end, y, d + 0.002]);
          x = end + rng.range(0.03, 0.08);
        }
      }
      for (let i = 0; i < surface; i++) {
        const side = rng.chance(0.5) ? d : -d;
        b.point(rng.range(-w, w), rng.range(-h, h), side, 0.25);
      }
      break;
    }

    case 'map': {
      for (let lat = -60; lat <= 60; lat += 30) {
        const y = Math.sin((lat * Math.PI) / 180);
        b.line(circle(Math.cos((lat * Math.PI) / 180), y, 96));
      }
      for (let m = 0; m < 12; m++) {
        const a = (m / 12) * TAU;
        const pts: number[] = [];
        for (let k = 0; k <= 48; k++) {
          const phi = (k / 48) * Math.PI - Math.PI / 2;
          pts.push(Math.cos(phi) * Math.cos(a), Math.sin(phi), Math.cos(phi) * Math.sin(a));
        }
        b.line(pts);
      }
      // Coastlines and routes: points where the terrain noise crosses sea level.
      const noise = createNoise(`map:${rng.next()}`);
      for (let i = 0; i < surface * 2.5; i++) {
        const [x, y, z] = rng.onSphere();
        const v = noise.fbm3(x * 1.8, y * 1.8, z * 1.8, 4);
        if (Math.abs(v) < 0.035) b.point(x * 1.004, y * 1.004, z * 1.004, 1);
        else if (v > 0.1 && rng.chance(0.08)) b.point(x, y, z, 0.35);
      }
      break;
    }

    case 'instrument': {
      const rings = rng.int(3, 5);
      for (let r = 0; r < rings; r++) {
        const radius = 1 - r * 0.14;
        b.line(circle(radius, 0, 128, rng.range(0.2, 1.4), rng.range(0, TAU)));
      }
      b.line([0, -1.15, 0, 0, 1.15, 0]);
      b.line(circle(0.12, 0, 32));
      b.line(circle(0.12, 0, 32, Math.PI / 2));
      for (let i = 0; i < surface * 0.3; i++) {
        const [x, y, z] = rng.onSphere();
        b.point(x * 0.13, y * 0.13, z * 0.13, 0.9);
      }
      break;
    }

    case 'mask': {
      const pts = (cx: number, cy: number, r: number): number[] => {
        const out: number[] = [];
        for (let k = 0; k <= 40; k++) {
          const a = (k / 40) * TAU;
          const x = cx + Math.cos(a) * r;
          const y = cy + Math.sin(a) * r;
          out.push(x, y, 0.5 * Math.sqrt(Math.max(0, 1 - x * x * 1.2 - y * y * 0.62)));
        }
        return out;
      };
      for (let k = 1; k <= 6; k++) {
        const s = k / 6;
        const out: number[] = [];
        for (let i = 0; i <= 80; i++) {
          const a = (i / 80) * TAU;
          const x = Math.cos(a) * 0.86 * s;
          const y = Math.sin(a) * 1.22 * s;
          out.push(x, y, 0.5 * Math.sqrt(Math.max(0, 1 - (x * x) / 0.74 - (y * y) / 1.49)));
        }
        b.line(out);
      }
      b.line(pts(-0.32, 0.22, 0.14));
      b.line(pts(0.32, 0.22, 0.14));
      b.line(pts(0, -0.42, 0.08));
      b.line([0, 1.18, 0.05, 0, -1.1, 0.12]);
      for (let i = 0; i < surface; i++) {
        const x = rng.range(-0.86, 0.86);
        const y = rng.range(-1.22, 1.22);
        const q = 1 - (x * x) / 0.74 - (y * y) / 1.49;
        if (q > 0) b.point(x, y, 0.5 * Math.sqrt(q), 0.3);
      }
      break;
    }
  }
}

/**
 * Generates a relic's form. `detail` scales point budgets (quality tiers);
 * polylines are identical at every detail level.
 */
export function generateRelicForm(kind: RelicKind, seed: number, detail = 1): RelicForm {
  const rng = createRng(`relic:${kind}:${seed}`);
  const b = new FormBuilder();
  const surface = Math.round(9000 * detail);
  buildKind(kind, b, rng, surface);
  b.sampleLines(Math.round(26000 * detail), rng);
  return b.build();
}

/* ── Plate projection (SVG engraving) ─────────────────────────────────────── */

export interface PlateLine {
  d: string;
  /** Mean depth in [0, 1]; 0 is nearest. Used for line weight and opacity. */
  depth: number;
}

/**
 * Projects a form's polylines into an engraving: an oblique orthographic view
 * fitted into a square of `size`, returned as SVG path strings sorted back to
 * front.
 */
export function projectPlate(form: RelicForm, size = 240, yaw = 0.62, pitch = 0.34): PlateLine[] {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const project = (x: number, y: number, z: number): [number, number, number] => {
    const x1 = x * cy - z * sy;
    const z1 = x * sy + z * cy;
    const y2 = y * cp - z1 * sp;
    const z2 = y * sp + z1 * cp;
    return [x1, y2, z2];
  };

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  const projected = form.polylines.map((pl) => {
    const out: [number, number, number][] = [];
    for (let i = 0; i < pl.length; i += 3) {
      const p = project(pl[i] as number, pl[i + 1] as number, pl[i + 2] as number);
      minX = Math.min(minX, p[0]);
      maxX = Math.max(maxX, p[0]);
      minY = Math.min(minY, p[1]);
      maxY = Math.max(maxY, p[1]);
      minZ = Math.min(minZ, p[2]);
      maxZ = Math.max(maxZ, p[2]);
      out.push(p);
    }
    return out;
  });

  const span = Math.max(maxX - minX, maxY - minY) || 1;
  const scale = (size * 0.84) / span;
  const ox = size / 2 - ((minX + maxX) / 2) * scale;
  const oy = size / 2 + ((minY + maxY) / 2) * scale;
  const zSpan = maxZ - minZ || 1;
  const fmt = (n: number): string => (Math.round(n * 10) / 10).toString();

  return projected
    .map((pts) => {
      let depth = 0;
      const d = pts
        .map(([x, y, z], i) => {
          depth += (z - minZ) / zSpan;
          return `${i === 0 ? 'M' : 'L'}${fmt(ox + x * scale)} ${fmt(oy - y * scale)}`;
        })
        .join('');
      return { d, depth: 1 - depth / pts.length };
    })
    .sort((a, b) => b.depth - a.depth);
}

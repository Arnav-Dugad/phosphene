import type { LacunaMode } from '../../../content/types.ts';
import { clamp } from '../../../lib/math.ts';
import { RING } from './formations.ts';

export type Vec3 = readonly [number, number, number];

export interface Pose {
  pos: Vec3;
  look: Vec3;
  fov: number;
}

const [CX, CY, CZ] = RING.center;

/**
 * The home page's flight path, keyed by chapter value (chapter index plus
 * progress through it). The page writes `home.chapter`; the scene samples this
 * spline, so the DOM layout and the camera choreography stay decoupled.
 */
export const HOME_PATH: readonly (Pose & { at: number })[] = [
  { at: 0.0, pos: [0, 1.3, 11.5], look: [0, 3.1, CZ], fov: 36 },
  { at: 0.85, pos: [0, 1.05, 8.2], look: [0, 3.0, CZ], fov: 36 },
  { at: 1.3, pos: [0.9, 0.45, 3.5], look: [0, 2.4, CZ], fov: 40 },
  { at: 1.9, pos: [1.4, 0.32, 0.6], look: [-0.5, 2.1, CZ], fov: 42 },
  { at: 2.15, pos: [-3.5, 2.6, -1.5], look: [CX, CY, CZ], fov: 40 },
  { at: 2.6, pos: [-9, 4.6, -6], look: [CX, CY, CZ], fov: 38 },
  { at: 2.95, pos: [-8.5, 5.2, -10], look: [CX, CY - 0.2, CZ], fov: 38 },
  { at: 3.3, pos: [0, 10.5, -3], look: [0, 0, -13], fov: 42 },
  { at: 3.85, pos: [0, 9.5, -1], look: [0, 0.2, -12], fov: 40 },
  { at: 4.15, pos: [0, CY, 5], look: [CX, CY, CZ], fov: 36 },
  { at: 4.6, pos: [0, CY, CZ + 1.2], look: [CX, CY, CZ - 20], fov: 58 },
  { at: 4.8, pos: [0, CY, CZ - 5], look: [CX, CY + 0.3, CZ - 40], fov: 44 },
  { at: 5.2, pos: [0, CY + 0.4, CZ - 9], look: [CX, CY + 0.8, CZ - 40], fov: 40 },
];

/** Static poses for the non-scrolling modes. */
export const MODE_POSES: Record<Exclude<LacunaMode, 'home'>, Pose> = {
  ambient: { pos: [0, 1.5, 12.5], look: [0, 3.0, CZ], fov: 36 },
  chronicle: { pos: [-9.5, 4.4, -5], look: [CX, CY, CZ], fov: 40 },
  dusk: { pos: [2.2, 0.8, 9], look: [0, 2.6, CZ], fov: 38 },
  finale: { pos: [0, CY, 3], look: [CX, CY, CZ], fov: 40 },
  credits: { pos: [0, 2.2, 14], look: [CX, CY, CZ], fov: 36 },
  lanterns: { pos: [0, 1.4, 9], look: [0, 2.2, -20], fov: 44 },
  choir: { pos: [5, 4.5, -5], look: [CX, CY, CZ], fov: 42 },
};

const catmull = (p0: number, p1: number, p2: number, p3: number, t: number): number => {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
};

/** Samples a keyed path with Catmull–Rom interpolation (writes into `out`). */
export function samplePath(path: readonly (Pose & { at: number })[], at: number, out: Pose): Pose {
  const first = path[0];
  const last = path[path.length - 1];
  if (!first || !last) return out;
  const v = clamp(at, first.at, last.at);
  let i = 0;
  while (i < path.length - 2 && (path[i + 1] as Pose & { at: number }).at < v) i++;
  const a = path[Math.max(0, i - 1)] as Pose & { at: number };
  const b = path[i] as Pose & { at: number };
  const c = path[Math.min(path.length - 1, i + 1)] as Pose & { at: number };
  const d = path[Math.min(path.length - 1, i + 2)] as Pose & { at: number };
  const t = c.at === b.at ? 0 : (v - b.at) / (c.at - b.at);
  const lerp3 = (key: 'pos' | 'look'): Vec3 => [
    catmull(a[key][0], b[key][0], c[key][0], d[key][0], t),
    catmull(a[key][1], b[key][1], c[key][1], d[key][1], t),
    catmull(a[key][2], b[key][2], c[key][2], d[key][2], t),
  ];
  return { pos: lerp3('pos'), look: lerp3('look'), fov: catmull(a.fov, b.fov, c.fov, d.fov, t) };
}

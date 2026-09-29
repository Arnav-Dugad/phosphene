export const TAU = Math.PI * 2;

export const clamp = (v: number, min = 0, max = 1): number => (v < min ? min : v > max ? max : v);

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const invLerp = (a: number, b: number, v: number): number => (a === b ? 0 : (v - a) / (b - a));

export const remap = (v: number, inMin: number, inMax: number, outMin: number, outMax: number): number =>
  lerp(outMin, outMax, invLerp(inMin, inMax, v));

export const clampedRemap = (
  v: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number => lerp(outMin, outMax, clamp(invLerp(inMin, inMax, v)));

export const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = clamp((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

/** Wraps v into [min, max). */
export const wrap = (v: number, min: number, max: number): number => {
  const range = max - min;
  return ((((v - min) % range) + range) % range) + min;
};

/**
 * Frame-rate independent exponential approach. `lambda` is the decay rate per
 * second: higher values converge faster. Equivalent to lerp with a factor of
 * 1 - e^(-λ·dt), which is stable at any frame time.
 */
export const damp = (current: number, target: number, lambda: number, dt: number): number =>
  lerp(current, target, 1 - Math.exp(-lambda * dt));

/** Shortest signed angular distance from a to b, in radians. */
export const angleDelta = (a: number, b: number): number => wrap(b - a + Math.PI, 0, TAU) - Math.PI;

export const dampAngle = (current: number, target: number, lambda: number, dt: number): number =>
  current + angleDelta(current, target) * (1 - Math.exp(-lambda * dt));

export const degToRad = (d: number): number => (d * Math.PI) / 180;
export const radToDeg = (r: number): number => (r * 180) / Math.PI;

/**
 * Cubic-bezier easing solver matching CSS `cubic-bezier()` semantics, so JS
 * driven motion uses exactly the curves declared in the design tokens.
 */
export function bezierEasing(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const ax = 3 * x1 - 3 * x2 + 1;
  const bx = 3 * x2 - 6 * x1;
  const cx = 3 * x1;
  const ay = 3 * y1 - 3 * y2 + 1;
  const by = 3 * y2 - 6 * y1;
  const cy = 3 * y1;

  const sampleX = (t: number): number => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number): number => ((ay * t + by) * t + cy) * t;
  const slopeX = (t: number): number => (3 * ax * t + 2 * bx) * t + cx;

  const solveT = (x: number): number => {
    // Newton–Raphson first; fall back to bisection where the slope flattens.
    let t = x;
    for (let i = 0; i < 8; i++) {
      const err = sampleX(t) - x;
      if (Math.abs(err) < 1e-6) return t;
      const d = slopeX(t);
      if (Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    let lo = 0;
    let hi = 1;
    t = x;
    for (let i = 0; i < 32; i++) {
      const v = sampleX(t);
      if (Math.abs(v - x) < 1e-6) break;
      if (v < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return t;
  };

  if (x1 === y1 && x2 === y2) return (t) => t;
  return (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : sampleY(solveT(t)));
}

export interface Vec2 {
  x: number;
  y: number;
}

export const length2 = (x: number, y: number): number => Math.sqrt(x * x + y * y);

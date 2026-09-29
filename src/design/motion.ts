import { bezierEasing } from '../lib/math.ts';
import { cssBezier, duration, ease, type EaseName } from './tokens.ts';

/**
 * The motion language, derived from tokens. Components never declare their own
 * curves or durations — they reach for a category here.
 *
 *   micro       hovers, presses, toggles               (duration.micro / quick)
 *   navigation  menus, the command palette, the blink  (duration.nav)
 *   reveal      text and media resolving into view     (duration.reveal)
 *   spatial     camera travel                          (duration.spatial)
 *   cinematic   intro beats                            (duration.cinematic)
 *   physics     springs — see `lib/spring.ts`
 *   ambient     idle loops                             (duration.ambient)
 */

const names = Object.keys(ease) as EaseName[];

/** JS easing functions matching the CSS curves exactly. */
export const easing = Object.fromEntries(
  names.map((name) => {
    const [x1, y1, x2, y2] = ease[name];
    return [name, bezierEasing(x1, y1, x2, y2)];
  }),
) as Record<EaseName, (t: number) => number>;

/** CSS / WAAPI easing strings. */
export const cssEase = Object.fromEntries(names.map((name) => [name, cssBezier(ease[name])])) as Record<
  EaseName,
  string
>;

/** GSAP ease names registered by `registerGsapEases`. */
export const gsapEase = Object.fromEntries(names.map((name) => [name, `phos.${name}`])) as Record<
  EaseName,
  string
>;

interface CustomEaseLike {
  create(id: string, data: string): unknown;
}

/** Registers every token curve with GSAP's CustomEase under `phos.<name>`. */
export function registerGsapEases(customEase: CustomEaseLike): void {
  for (const name of names) {
    const [x1, y1, x2, y2] = ease[name];
    customEase.create(gsapEase[name], `M0,0 C${x1},${y1} ${x2},${y2} 1,1`);
  }
}

/** Duration in seconds (GSAP convention). */
export const seconds = (key: keyof typeof duration): number => duration[key] / 1000;

export { duration };

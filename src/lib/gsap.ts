import { gsap } from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import { Flip } from 'gsap/Flip';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { registerGsapEases } from '../design/motion.ts';

/**
 * One place where GSAP is configured: plugins are registered and every easing
 * curve from the design tokens becomes available as `phos.<name>`.
 */
gsap.registerPlugin(ScrollTrigger, SplitText, CustomEase, Flip);
registerGsapEases(CustomEase);
gsap.defaults({ ease: 'phos.out', duration: 1.1 });
ScrollTrigger.config({ ignoreMobileResize: true });

/**
 * SplitText's `onSplit` may return the animation it builds, so `autoSplit`
 * can revert and replay it when lines re-flow; its typings declare `void`.
 */
export function splitAnimation(build: (self: SplitText) => gsap.core.Animation): (self: SplitText) => void {
  // A tween is thenable, not a promise: SplitText keeps it to replay after re-splitting.
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  return build;
}

export { gsap, ScrollTrigger, SplitText, Flip };

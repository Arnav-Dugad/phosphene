import { SplitText } from 'gsap/SplitText';
import { gsap } from './gsap.ts';

gsap.registerPlugin(SplitText);

/**
 * SplitText's `onSplit` may return the animation it builds, so `autoSplit`
 * can revert and replay it when lines re-flow; its typings declare `void`.
 */
export function splitAnimation(build: (self: SplitText) => gsap.core.Animation): (self: SplitText) => void {
  // A tween is thenable, not a promise: SplitText keeps it to replay after re-splitting.
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  return build;
}

export { SplitText };

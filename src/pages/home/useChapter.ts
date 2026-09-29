import type { RefObject } from 'react';
import { setChannel } from '../../engine/input.ts';
import { ScrollTrigger } from '../../lib/gsap.ts';

/**
 * Reports a chapter's scroll progress to the stage as `home.chapter`
 * (index + progress). The Lacuna scene samples its camera path from it.
 */
export function chapterTrigger(
  ref: RefObject<HTMLElement | null>,
  index: number,
  vars: ScrollTrigger.Vars = {},
): ScrollTrigger | null {
  if (!ref.current) return null;
  return ScrollTrigger.create({
    trigger: ref.current,
    start: 'top top',
    end: 'bottom top',
    ...vars,
    onUpdate: (self) => setChannel('home.chapter', index + self.progress),
    onEnter: () => setChannel('home.chapter', index),
    onLeaveBack: () => setChannel('home.chapter', index),
  });
}

import { gsap } from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { registerGsapEases } from '../design/motion.ts';

/**
 * One place where GSAP is configured: plugins are registered and every easing
 * curve from the design tokens becomes available as `phos.<name>`. Plugins
 * only some pages need live in their own modules (gsapText, gsapFlip) so the
 * shell never downloads them.
 */
gsap.registerPlugin(ScrollTrigger, CustomEase);
registerGsapEases(CustomEase);
gsap.defaults({ ease: 'phos.out', duration: 1.1 });
ScrollTrigger.config({ ignoreMobileResize: true });

export { gsap, ScrollTrigger };

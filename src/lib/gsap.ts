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

export { gsap, ScrollTrigger, SplitText, Flip };

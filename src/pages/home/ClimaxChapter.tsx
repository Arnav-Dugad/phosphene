import { useRef } from 'react';
import { Button } from '../../components/Button.tsx';
import { setChannel } from '../../engine/input.ts';
import { unlockFragment } from '../../features/fragments/unlock.ts';
import { useGsap } from '../../hooks/useGsap.ts';
import { useMediaQuery } from '../../hooks/useMediaQuery.ts';
import { useResolvedMotion } from '../../hooks/useResolvedMotion.ts';
import { gsap } from '../../lib/gsap.ts';
import { chapterTrigger } from './useChapter.ts';
import styles from './Home.module.css';

/**
 * The climax: the camera flies through the ring. Crossing it decodes the
 * first line of Transmission Zero.
 */
export function ClimaxChapter({ index }: { index: number }) {
  const ref = useRef<HTMLElement>(null);
  const motion = useResolvedMotion();
  const compact = useMediaQuery('(max-width: 768px)');

  useGsap(
    () => {
      const section = ref.current;
      if (!section) return;
      if (motion === 'still') {
        chapterTrigger(ref, index, { onLeave: () => unlockFragment(1) });
        return;
      }
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: compact ? '+=200%' : '+=300%',
          pin: true,
          scrub: 0.6,
          onUpdate: (self) => {
            setChannel('home.chapter', index + self.progress);
            if (self.progress > 0.62) unlockFragment(1);
          },
        },
      });
      tl.fromTo(
        '[data-climax-a]',
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 1, ease: 'phos.out' },
        0,
      )
        .to('[data-climax-a]', { opacity: 0, y: -30, duration: 0.8, ease: 'phos.in' }, 1.6)
        .fromTo(
          '[data-climax-b]',
          { opacity: 0, y: 30 },
          { opacity: 1, y: 0, duration: 1, ease: 'phos.out' },
          2.2,
        )
        .to(
          '[data-climax-b]',
          { opacity: 0, scale: 1.08, filter: 'blur(12px)', duration: 0.9, ease: 'phos.in' },
          3.6,
        )
        .fromTo('[data-flash]', { opacity: 0 }, { opacity: 1, duration: 0.5, ease: 'phos.in' }, 4.0)
        .to('[data-flash]', { opacity: 0, duration: 1.4, ease: 'phos.out' }, 4.6)
        .fromTo(
          '[data-climax-c]',
          { opacity: 0, y: 40, filter: 'blur(10px)' },
          { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.4, ease: 'phos.out' },
          5.0,
        )
        .fromTo(
          '[data-climax-cta]',
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: 1, ease: 'phos.out' },
          5.6,
        )
        .to({}, { duration: 1.2 });
    },
    ref,
    [motion, compact, index],
  );

  return (
    <section
      ref={ref}
      className={styles.climax}
      aria-labelledby="climax-title"
      data-static={motion === 'still'}
    >
      <div className={styles.climaxInner}>
        <p className={styles.climaxLine} data-climax-a>
          They could not leave.
        </p>
        <p className={styles.climaxLine} data-climax-b>
          So they sent the <em>lighter part</em> of themselves.
        </p>
        <div className={styles.climaxEnd}>
          <h2 id="climax-title" className={styles.climaxTitle} data-climax-c>
            Thirty-six thousand years later, it arrived. <em>So did you.</em>
          </h2>
          <div className={styles.climaxActions} data-climax-cta>
            <Button to="/map" line="o3" cursorLabel="Enter">
              Enter the observatory
            </Button>
            <Button to="/transmission-zero" variant="ghost" line="ca" icon="arrowUpRight">
              Read Transmission Zero
            </Button>
          </div>
        </div>
      </div>
      <div className={styles.flash} data-flash aria-hidden="true" />
    </section>
  );
}

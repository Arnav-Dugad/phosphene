import { useRef } from 'react';
import { Button } from '../../components/Button.tsx';
import { ScrambleText } from '../../components/ScrambleText.tsx';
import { world } from '../../content/world.ts';
import { scrollToElement } from '../../features/scroll/scroller.ts';
import { useGsap } from '../../hooks/useGsap.ts';
import { useNow } from '../../hooks/useNow.ts';
import { useResolvedMotion } from '../../hooks/useResolvedMotion.ts';
import { fixed } from '../../lib/format.ts';
import { gsap } from '../../lib/gsap.ts';
import { SplitText, splitAnimation } from '../../lib/gsapText.ts';
import { cadencePhase, yearsListening } from '../../lib/time.ts';
import { capitalize, numberToWords } from '../../lib/words.ts';
import { useUi } from '../../stores/ui.ts';
import { chapterTrigger } from './useChapter.ts';
import styles from './Home.module.css';

function SignalReadout() {
  const now = new Date(useNow());
  const phase = cadencePhase(now);
  // A smoothly wandering SNR, derived from the carrier phase so every visitor reads the same value.
  const snr = 14.2 + Math.sin(phase * Math.PI * 2 * 31) * 0.9 + Math.sin(phase * Math.PI * 2 * 7) * 0.4;
  return (
    <p className={styles.readout}>
      <span className={styles.live} aria-hidden="true" />
      <span>Signal</span>
      <span className="t-numeric">{fixed(snr, 1)} dB</span>
      <span>Locked</span>
      <span className={styles.readoutFaint}>Cadence {fixed(phase * 100, 1)}%</span>
    </p>
  );
}

export function Hero({ index }: { index: number }) {
  const ref = useRef<HTMLElement>(null);
  // Enter as the intro's aperture begins to open, not after it has finished.
  const revealed = useUi((s) => s.introPhase === 'opening' || s.introPhase === 'done');
  const motion = useResolvedMotion();
  const years = Math.floor(yearsListening());

  useGsap(
    () => {
      chapterTrigger(ref, index);
      if (motion === 'still') return;
      gsap.to('[data-hero-fade]', {
        yPercent: -18,
        opacity: 0,
        ease: 'none',
        scrollTrigger: { trigger: ref.current, start: 'top top', end: '70% top', scrub: true },
      });
    },
    ref,
    [motion],
  );

  useGsap(
    () => {
      if (!revealed) return;
      gsap.set('[data-hero-title]', { visibility: 'visible' });
      if (motion === 'still') {
        gsap.set('[data-hero-reveal]', { opacity: 1 });
        return;
      }
      const split = SplitText.create('[data-hero-title]', {
        type: 'lines',
        mask: 'lines',
        autoSplit: true,
        onSplit: splitAnimation((self) =>
          gsap.from(self.lines, {
            yPercent: 115,
            duration: 1.8,
            stagger: 0.14,
            ease: 'phos.out',
            delay: 0.15,
          }),
        ),
      });
      gsap.fromTo(
        '[data-hero-reveal]',
        { opacity: 0, y: 18, filter: 'blur(8px)' },
        { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.6, stagger: 0.12, ease: 'phos.out', delay: 0.9 },
      );
      return () => split.revert();
    },
    ref,
    [revealed, motion],
  );

  return (
    <section ref={ref} className={styles.hero} aria-labelledby="hero-title">
      <div className={`container ${styles.heroGrid}`} data-hero-fade>
        <p className={`t-kicker ${styles.heroKicker}`} data-hero-reveal>
          <ScrambleText text={`${world.institute} · ${world.array} · Channel 7`} stagger={16} once />
        </p>
        <h1 id="hero-title" className={styles.heroTitle} data-hero-title>
          <span className={styles.heroLine}>Light,</span>
          <span className={styles.heroLine}>
            <em>remembered.</em>
          </span>
        </h1>
        <div className={styles.heroFoot}>
          <p className={styles.heroLead} data-hero-reveal>
            {capitalize(`for ${numberToWords(years)} years`)} we have been receiving the memory of a
            civilization that ended thirty-six thousand years ago. This is the observatory where it is
            decoded.
          </p>
          <div className={styles.heroActions} data-hero-reveal>
            <Button
              onClick={() => {
                const next = ref.current?.nextElementSibling;
                if (next instanceof HTMLElement) scrollToElement(next);
              }}
              icon="arrowDown"
              cursorLabel="Descend"
            >
              Begin the descent
            </Button>
            <Button to="/archive" variant="ghost" icon="arrowUpRight" line="hb">
              Enter the Archive
            </Button>
          </div>
        </div>
        <div className={styles.heroMeta} data-hero-reveal>
          <SignalReadout />
        </div>
      </div>
    </section>
  );
}

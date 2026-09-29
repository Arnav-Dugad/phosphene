import { useRef, type CSSProperties } from 'react';
import { TransitionLink } from '../../components/TransitionLink.tsx';
import { eras } from '../../content/eras.ts';
import { setChannel } from '../../engine/input.ts';
import { useGsap } from '../../hooks/useGsap.ts';
import { useResolvedMotion } from '../../hooks/useResolvedMotion.ts';
import { gsap, ScrollTrigger } from '../../lib/gsap.ts';
import styles from './Home.module.css';

export function AgesChapter({ index }: { index: number }) {
  const ref = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const railLabelRef = useRef<HTMLSpanElement>(null);
  const railFillRef = useRef<HTMLSpanElement>(null);
  const motion = useResolvedMotion();

  useGsap(
    () => {
      const section = ref.current;
      const track = trackRef.current;
      if (!section || !track) return;

      const report = (progress: number): void => {
        setChannel('home.chapter', index + progress);
        const era = eras[Math.min(eras.length - 1, Math.floor(progress * eras.length * 0.999))];
        if (railLabelRef.current && era && railLabelRef.current.textContent !== era.name) {
          railLabelRef.current.textContent = `${era.numeral} · ${era.name}`;
        }
        railFillRef.current?.style.setProperty('--p', progress.toFixed(4));
      };

      const mm = gsap.matchMedia();
      mm.add({ wide: '(min-width: 900px)', narrow: '(max-width: 899px)' }, (context) => {
        const { wide } = context.conditions as { wide: boolean };
        if (wide && motion !== 'still') {
          const distance = (): number => track.scrollWidth - window.innerWidth;
          const slide = gsap.to(track, {
            x: () => -distance(),
            ease: 'none',
            scrollTrigger: {
              trigger: section,
              start: 'top top',
              end: () => `+=${distance()}`,
              pin: true,
              scrub: 0.5,
              invalidateOnRefresh: true,
              onUpdate: (self) => report(self.progress),
            },
          });
          // Panels resolve as they cross into view.
          gsap.utils.toArray<HTMLElement>('[data-era-panel]', track).forEach((panel) => {
            gsap.fromTo(
              panel.querySelectorAll('[data-era-reveal]'),
              { opacity: 0.08, y: 30 },
              {
                opacity: 1,
                y: 0,
                stagger: 0.06,
                ease: 'phos.out',
                scrollTrigger: {
                  trigger: panel,
                  containerAnimation: slide,
                  start: 'left 85%',
                  end: 'left 40%',
                  scrub: true,
                },
              },
            );
          });
        } else {
          ScrollTrigger.create({
            trigger: track,
            start: 'top 70%',
            end: 'bottom 30%',
            onUpdate: (self) => report(self.progress),
            onLeave: () => setChannel('home.chapter', index + 1),
            onLeaveBack: () => setChannel('home.chapter', index),
          });
        }
      });
      return () => mm.revert();
    },
    ref,
    [motion, index],
  );

  return (
    <section ref={ref} className={styles.ages} aria-labelledby="ages-title">
      <div ref={trackRef} className={styles.agesTrack}>
        <header className={styles.agesIntro}>
          <p className={`t-kicker ${styles.chapterKicker}`}>
            <span className={styles.numeral}>II</span> The Seven Ages
          </p>
          <h2 id="ages-title" className={styles.agesTitle}>
            Three million turns, <em>told as light.</em>
          </h2>
          <p className={styles.agesLead}>
            The stream is ordered like a life: from the first flashes in the tidal shallows to the night they
            cast themselves into the dark. Scroll through their history — the motes above the sea will take
            its shapes.
          </p>
        </header>

        {eras.map((era) => (
          <article
            key={era.id}
            className={styles.era}
            data-era-panel
            style={{ '--era-line': `var(--line-${era.line})` } as CSSProperties}
            aria-labelledby={`era-${era.id}`}
          >
            <span className={styles.eraNumeral} aria-hidden="true">
              {era.numeral}
            </span>
            <p className={styles.eraSpan} data-era-reveal>
              <span className={styles.eraDot} aria-hidden="true" />
              {era.span}
            </p>
            <h3 id={`era-${era.id}`} className={styles.eraName} data-era-reveal>
              {era.name}
            </h3>
            <p className={styles.eraSubtitle} data-era-reveal>
              {era.subtitle}
            </p>
            <p className={styles.eraSummary} data-era-reveal>
              {era.summary}
            </p>
            <blockquote className={styles.eraVoice} data-era-reveal>
              <p>“{era.voice}”</p>
            </blockquote>
            <TransitionLink
              to={`/chronicle#${era.id}`}
              className={styles.eraLink}
              data-era-reveal
              line={era.line}
            >
              Enter the age <span aria-hidden="true">→</span>
            </TransitionLink>
          </article>
        ))}
      </div>

      <div className={styles.rail} aria-hidden="true">
        <span ref={railLabelRef} className={styles.railLabel}>
          I · The Tidal Age
        </span>
        <span className={styles.railTrack}>
          <span ref={railFillRef} className={styles.railFill} />
          {eras.map((era, i) => (
            <span
              key={era.id}
              className={styles.railTick}
              style={
                {
                  left: `${(i / eras.length) * 100}%`,
                  '--era-line': `var(--line-${era.line})`,
                } as CSSProperties
              }
            />
          ))}
        </span>
      </div>
    </section>
  );
}

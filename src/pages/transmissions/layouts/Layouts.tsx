import { useRef, type CSSProperties } from 'react';
import type { Story } from '../../../content/stories.ts';
import { setChannel } from '../../../engine/input.ts';
import { unlockFragment } from '../../../features/fragments/unlock.ts';
import { useGsap } from '../../../hooks/useGsap.ts';
import { useResolvedMotion } from '../../../hooks/useResolvedMotion.ts';
import { pad } from '../../../lib/format.ts';
import { gsap, ScrollTrigger } from '../../../lib/gsap.ts';
import { Block } from './Blocks.tsx';
import styles from '../Story.module.css';

const LANTERNS = 406;

/**
 * The Lamplighters — the count. A sticky panel counts the Senn Reach's
 * lanterns as you read, and the lanterns over the sea brighten with it.
 */
export function LamplightersLayout({ story }: { story: Story }) {
  const ref = useRef<HTMLDivElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  useGsap(
    () => {
      let lit = 0;
      const dots = gridRef.current ? Array.from(gridRef.current.children) : [];
      ScrollTrigger.create({
        trigger: '[data-column]',
        start: 'top 60%',
        end: 'bottom 70%',
        onUpdate: (self) => {
          setChannel('story.progress', self.progress);
          const next = Math.round(self.progress * LANTERNS);
          if (next === lit) return;
          const [from, to, on] = next > lit ? [lit, next, true] : [next, lit, false];
          for (let i = from; i < to; i++) dots[i]?.classList.toggle(styles.lit ?? 'lit', on);
          lit = next;
          if (countRef.current) countRef.current.textContent = String(lit).padStart(3, '0');
        },
      });
      return () => setChannel('story.progress', 1);
    },
    ref,
    [],
  );

  return (
    <div ref={ref} className={styles.lampGrid}>
      <aside className={styles.lampSide} aria-hidden="true">
        <p className={styles.lampLabel}>Lanterns counted</p>
        <p className={styles.lampCount}>
          <span ref={countRef}>000</span>
          <span className={styles.lampOf}>/ {LANTERNS}</span>
        </p>
        <div ref={gridRef} className={styles.lampDots}>
          {Array.from({ length: LANTERNS }, (_, i) => (
            <span key={i} />
          ))}
        </div>
      </aside>
      <div className={styles.column} data-column>
        {story.blocks.map((block, i) => (
          <Block key={i} block={block} />
        ))}
      </div>
    </div>
  );
}

/** A Grammar of Light — an essay column with glyph figures breaking out of the measure. */
export function GrammarLayout({ story }: { story: Story }) {
  return (
    <div className={`${styles.column} ${styles.essay}`}>
      {story.blocks.map((block, i) => (
        <Block key={i} block={block} />
      ))}
    </div>
  );
}

/**
 * The Last Choir — one thought at a time. Each block holds the centre of the
 * screen, resolving in and dissolving out; the final line decodes a fragment.
 */
export function ChoirLayout({ story }: { story: Story }) {
  const ref = useRef<HTMLDivElement>(null);
  const motion = useResolvedMotion();

  useGsap(
    () => {
      const scenes = gsap.utils.toArray<HTMLElement>('[data-choir]');
      scenes.forEach((scene, i) => {
        const content = scene.firstElementChild;
        if (motion !== 'still' && content) {
          gsap
            .timeline({
              scrollTrigger: { trigger: scene, start: 'top bottom', end: 'bottom top', scrub: 0.5 },
            })
            .fromTo(
              content,
              { opacity: 0, y: 60, filter: 'blur(12px)' },
              { opacity: 1, y: 0, filter: 'blur(0px)', ease: 'phos.out', duration: 0.4 },
            )
            .to(
              content,
              {
                opacity: i === scenes.length - 1 ? 1 : 0,
                y: -60,
                filter: 'blur(10px)',
                ease: 'phos.in',
                duration: 0.4,
              },
              0.6,
            );
        }
        if (i === scenes.length - 1) {
          ScrollTrigger.create({ trigger: scene, start: 'top 55%', onEnter: () => unlockFragment(5) });
        }
      });
    },
    ref,
    [motion],
  );

  return (
    <div ref={ref} className={styles.choir}>
      {story.blocks.map((block, i) => (
        <section key={i} className={styles.choirScene} data-choir>
          <div>
            <Block block={block} />
          </div>
        </section>
      ))}
    </div>
  );
}

/** The Listening Years — a logbook with a time gutter. */
export function JournalLayout({ story }: { story: Story }) {
  const ref = useRef<HTMLDivElement>(null);
  const motion = useResolvedMotion();
  useGsap(
    () => {
      if (motion === 'still') return;
      gsap.utils.toArray<HTMLElement>('[data-entry]').forEach((entry) => {
        gsap.from(entry, {
          opacity: 0,
          x: -24,
          duration: 1,
          ease: 'phos.out',
          scrollTrigger: { trigger: entry, start: 'top 85%' },
        });
      });
    },
    ref,
    [motion],
  );
  return (
    <div ref={ref} className={styles.journal}>
      {story.blocks.map((block, i) => (
        <div key={i} data-entry className={block.type === 'entry' ? styles.journalItem : styles.journalIntro}>
          {block.type === 'entry' && <span className={styles.journalIndex}>{pad(i, 3)}</span>}
          <Block block={block} />
        </div>
      ))}
    </div>
  );
}

/** What the Silence Said — words adrift in space, silences given their full weight. */
export function SilenceLayout({ story }: { story: Story }) {
  const ref = useRef<HTMLDivElement>(null);
  const motion = useResolvedMotion();
  useGsap(
    () => {
      if (motion === 'still') return;
      gsap.utils.toArray<HTMLElement>('[data-drift]').forEach((el) => {
        const depth = Number(el.dataset.drift ?? 0);
        gsap.fromTo(
          el,
          { y: 120 * depth, opacity: 0 },
          {
            y: -120 * depth,
            opacity: 1,
            ease: 'none',
            scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true },
          },
        );
      });
    },
    ref,
    [motion],
  );
  return (
    <div ref={ref} className={styles.silence}>
      {story.blocks.map((block, i) => {
        const align = block.type === 'gap' ? 'center' : (['start', 'end', 'center'] as const)[i % 3];
        return (
          <div
            key={i}
            className={styles.silenceItem}
            data-drift={((i % 4) + 1) / 4}
            data-kind={block.type}
            style={{ '--align': align } as CSSProperties}
          >
            <Block block={block} />
          </div>
        );
      })}
    </div>
  );
}

import { useRef, type CSSProperties } from 'react';
import { TransitionLink } from '../../components/TransitionLink.tsx';
import { Waveform } from '../../components/Waveform.tsx';
import { eraById } from '../../content/eras.ts';
import { stories } from '../../content/stories.ts';
import { useGsap } from '../../hooks/useGsap.ts';
import { usePageMeta } from '../../hooks/usePageMeta.ts';
import { useResolvedMotion } from '../../hooks/useResolvedMotion.ts';
import { useStageScene } from '../../hooks/useStageScene.ts';
import { pad } from '../../lib/format.ts';
import { gsap } from '../../lib/gsap.ts';
import styles from './Transmissions.module.css';

export default function TransmissionsPage() {
  usePageMeta('transmissions');
  useStageScene('lacuna', { mode: 'dusk', tint: 'ca' });
  const ref = useRef<HTMLDivElement>(null);
  const motion = useResolvedMotion();

  useGsap(
    () => {
      if (motion === 'still') return;
      gsap.from('[data-row]', {
        opacity: 0,
        y: 50,
        stagger: 0.1,
        duration: 1.3,
        ease: 'phos.out',
        delay: 0.15,
      });
    },
    ref,
    [motion],
  );

  return (
    <div ref={ref} className={`container ${styles.page}`}>
      <header className={styles.head}>
        <p className="t-kicker">04 · Transmissions</p>
        <h1 className={styles.title}>
          Stories <em>carried by light</em>
        </h1>
        <p className={styles.lead}>
          Four translations from the stream, and one record kept by the people who received it. Confidence is
          the translators’ own estimate of how much they got right.
        </p>
      </header>

      <ol role="list" className={styles.list}>
        {stories.map((story, i) => {
          const era = story.era ? eraById(story.era) : null;
          return (
            <li key={story.slug} data-row>
              <TransitionLink
                to={`/transmissions/${story.slug}`}
                className={styles.row}
                style={{ '--story-line': `var(--line-${story.line})` } as CSSProperties}
                data-cursor-label="Receive"
              >
                <span className={styles.index}>{pad(i + 1)}</span>
                <span className={styles.main}>
                  <span className={styles.kind}>
                    {story.kind}
                    {era ? ` · ${era.name}` : ''}
                  </span>
                  <span className={styles.name}>{story.title}</span>
                  <span className={styles.excerpt}>“{story.excerpt}”</span>
                </span>
                <span className={styles.side}>
                  <Waveform seed={story.slug} className={styles.wave} />
                  <span className={styles.meta}>
                    <span>{story.minutes} min</span>
                    <span>{story.confidence ? `${story.confidence}% confidence` : 'Institute record'}</span>
                  </span>
                </span>
              </TransitionLink>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

import { useRef, type CSSProperties } from 'react';
import { Icon } from '../../components/Icon.tsx';
import { IthranText } from '../../components/IthranText.tsx';
import { TransitionLink } from '../../components/TransitionLink.tsx';
import { telemetry } from '../../content/array.ts';
import { FRAGMENT_TOTAL } from '../../content/fragments.ts';
import { colophon, keepers, pipeline, principles, questions } from '../../content/institute.ts';
import { relics } from '../../content/relics.ts';
import { world } from '../../content/world.ts';
import { useGsap } from '../../hooks/useGsap.ts';
import { useNow } from '../../hooks/useNow.ts';
import { usePageMeta } from '../../hooks/usePageMeta.ts';
import { useResolvedMotion } from '../../hooks/useResolvedMotion.ts';
import { useStageScene } from '../../hooks/useStageScene.ts';
import { fixed, roman, thousands } from '../../lib/format.ts';
import { gsap, ScrollTrigger } from '../../lib/gsap.ts';
import { yearsListening } from '../../lib/time.ts';
import { fragmentCount, useProgress } from '../../stores/progress.ts';
import styles from './Institute.module.css';

function Figures() {
  const now = new Date(useNow());
  const data = telemetry(now);
  const decoded = useProgress((s) => fragmentCount(s.fragments));
  const figures = [
    { value: fixed(yearsListening(now), 2), label: 'years listening' },
    {
      value: `${fixed(data.streamFraction * 100, 3)}%`,
      label: `of an estimated ${thousands(world.streamYearsTotal)}-year stream`,
    },
    { value: thousands(data.repetitions), label: 'repetitions of Transmission Zero' },
    { value: String(relics.length), label: 'relics reconstructed and published' },
    { value: '211', label: 'people on staff, and four thousand volunteer readers' },
    { value: `${decoded} / ${FRAGMENT_TOTAL}`, label: 'fragments of Transmission Zero decoded by you' },
  ];
  return (
    <dl className={styles.figures}>
      {figures.map((figure) => (
        <div key={figure.label} className={styles.figure} data-reveal>
          <dt className={styles.figureLabel}>{figure.label}</dt>
          <dd className={styles.figureValue}>{figure.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function InstitutePage() {
  usePageMeta('institute');
  useStageScene('lacuna', { mode: 'dusk', tint: 'na' });
  const ref = useRef<HTMLDivElement>(null);
  const motion = useResolvedMotion();

  useGsap(
    () => {
      if (motion === 'still') return;
      gsap.from('[data-hero]', {
        opacity: 0,
        y: 40,
        filter: 'blur(8px)',
        stagger: 0.12,
        duration: 1.5,
        ease: 'phos.out',
        delay: 0.1,
      });
      for (const el of gsap.utils.toArray<HTMLElement>('[data-reveal]')) {
        gsap.from(el, {
          opacity: 0,
          y: 36,
          duration: 1.2,
          ease: 'phos.out',
          scrollTrigger: { trigger: el, start: 'top 88%', once: true },
        });
      }
      // The beam of light runs through the pipeline as the reader scrolls past it.
      gsap.fromTo(
        '[data-beam]',
        { scaleX: 0 },
        {
          scaleX: 1,
          ease: 'none',
          scrollTrigger: { trigger: '[data-pipeline]', start: 'top 75%', end: 'bottom 55%', scrub: 0.6 },
        },
      );
      ScrollTrigger.refresh();
    },
    ref,
    [motion],
  );

  return (
    <div ref={ref} className={`container ${styles.page}`}>
      <header className={styles.hero}>
        <p className="t-kicker" data-hero>
          07 · Institute
        </p>
        <h1 className={styles.title} data-hero>
          The Phosphene Institute
          <em>Keepers of remembered light</em>
        </h1>
        <p className={styles.lede} data-hero>
          Since 2236 we have received, decoded and kept the memory of the Ithra — a people who ended
          thirty-six thousand years ago and spent their last centuries making sure someone, someday, would
          know they had been here.
        </p>
        <figure className={styles.definition} data-hero>
          <p className={styles.word}>
            {world.definition.word} <span>{world.definition.pronunciation}</span>
          </p>
          <p className={styles.sense}>
            <i>{world.definition.partOfSpeech}.</i> {world.definition.sense}
          </p>
        </figure>
      </header>

      <section className={styles.section} aria-labelledby="institute-figures">
        <h2 id="institute-figures" className={styles.heading} data-reveal>
          The work, in numbers
        </h2>
        <Figures />
      </section>

      <section className={styles.section} aria-labelledby="institute-pipeline" data-pipeline>
        <h2 id="institute-pipeline" className={styles.heading} data-reveal>
          How light becomes a memory
        </h2>
        <p className={styles.intro} data-reveal>
          From a photon arriving in Daedalus Crater to a relic you can turn in your hands, the stream passes
          through six stages and four houses of the Institute.
        </p>
        <div className={styles.pipeline}>
          <span className={styles.beamTrack} aria-hidden="true">
            <span className={styles.beam} data-beam />
          </span>
          <ol role="list" className={styles.steps}>
            {pipeline.map((step, i) => (
              <li
                key={step.id}
                className={styles.step}
                style={{ '--step-line': `var(--line-${step.line})` } as CSSProperties}
                data-reveal
              >
                <span className={styles.stepNode} aria-hidden="true" />
                <span className={styles.stepIndex}>{String(i + 1).padStart(2, '0')}</span>
                <h3 className={styles.stepName}>{step.name}</h3>
                <p className={styles.stepWhere}>{step.where}</p>
                <p className={styles.stepText}>{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="institute-accord">
        <h2 id="institute-accord" className={styles.heading} data-reveal>
          The Accord, as we keep it
        </h2>
        <p className={styles.intro} data-reveal>
          In their last age the Ithra agreed on how memory should travel. Decoding that agreement turned the
          Institute from an observatory into the other party to it.
        </p>
        <ol role="list" className={styles.principles}>
          {principles.map((principle, i) => (
            <li key={principle.title} className={styles.principle} data-reveal>
              <span className={styles.numeral}>{roman(i + 1)}</span>
              <h3 className={styles.principleTitle}>{principle.title}</h3>
              <p className={styles.principleText}>{principle.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.section} aria-labelledby="institute-keepers">
        <h2 id="institute-keepers" className={styles.heading} data-reveal>
          Keepers
        </h2>
        <p className={styles.intro} data-reveal>
          Their names, written in the aperture script — the only portraits the Institute keeps.
        </p>
        <ul role="list" className={styles.keepers}>
          {keepers.map((keeper) => (
            <li
              key={keeper.name}
              className={styles.keeper}
              style={{ '--keeper-line': `var(--line-${keeper.line})` } as CSSProperties}
              data-reveal
            >
              <div className={styles.portrait}>
                <IthranText
                  text={keeper.name.split(' ')[0] ?? keeper.name}
                  size={30}
                  mode="rosette"
                  weight={1.2}
                  label={`${keeper.name}, in Ithran script`}
                />
              </div>
              <p className={styles.keeperRole}>
                {keeper.role} · {keeper.years}
              </p>
              <h3 className={styles.keeperName}>{keeper.name}</h3>
              <p className={styles.keeperText}>{keeper.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section} aria-labelledby="institute-questions">
        <h2 id="institute-questions" className={styles.heading} data-reveal>
          Questions people ask
        </h2>
        <div className={styles.questions}>
          {questions.map((item) => (
            <details key={item.q} className={styles.question} data-reveal>
              <summary>
                <span>{item.q}</span>
                <Icon name="plus" size={16} className={styles.questionIcon} />
              </summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="institute-colophon">
        <h2 id="institute-colophon" className={styles.heading} data-reveal>
          Colophon
        </h2>
        <dl className={styles.colophon} data-reveal>
          {colophon.map((entry) => (
            <div key={entry.label}>
              <dt>{entry.label}</dt>
              <dd>{entry.value}</dd>
            </div>
          ))}
        </dl>
        <p className={styles.onward} data-reveal>
          <TransitionLink to="/credits" className={styles.onwardLink} data-cursor-label="Credits">
            Everyone who kept the light <Icon name="arrowRight" size={16} />
          </TransitionLink>
        </p>
      </section>
    </div>
  );
}

import { useRef, type CSSProperties } from 'react';
import { Icon } from '../../components/Icon.tsx';
import { IthranText } from '../../components/IthranText.tsx';
import { ScrambleText } from '../../components/ScrambleText.tsx';
import { TransitionLink } from '../../components/TransitionLink.tsx';
import { telemetry } from '../../content/array.ts';
import { FRAGMENT_TOTAL, fragments, type Fragment } from '../../content/fragments.ts';
import { placeForPath } from '../../content/routes.ts';
import { useGsap } from '../../hooks/useGsap.ts';
import { useNow } from '../../hooks/useNow.ts';
import { usePageMeta } from '../../hooks/usePageMeta.ts';
import { useResolvedMotion } from '../../hooks/useResolvedMotion.ts';
import { useStageScene } from '../../hooks/useStageScene.ts';
import { pad } from '../../lib/format.ts';
import { gsap } from '../../lib/gsap.ts';
import { formatOstDate } from '../../lib/time.ts';
import { fragmentCount, useProgress } from '../../stores/progress.ts';
import styles from './TransmissionZero.module.css';

const countdown = (seconds: number): string => {
  const s = Math.max(0, Math.floor(seconds));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
};

/** Where a fragment is decoded, as a link when it is a place. */
function Where({ fragment }: { fragment: Fragment }) {
  if (!fragment.where.startsWith('/')) return <span className={styles.where}>{fragment.hint}</span>;
  const place = placeForPath(fragment.where);
  return (
    <span className={styles.where}>
      {fragment.hint}{' '}
      <TransitionLink to={fragment.where} className={styles.whereLink} line={fragment.line}>
        {place ? `Go to ${place.label}` : 'Stray off the chart'} <Icon name="arrowRight" size={13} />
      </TransitionLink>
    </span>
  );
}

function Line({ fragment, decodedAt }: { fragment: Fragment; decodedAt: number | undefined }) {
  const style = { '--fragment-line': `var(--line-${fragment.line})` } as CSSProperties;
  if (decodedAt) {
    return (
      <li className={styles.line} data-decoded="true" style={style} data-reveal>
        <span className={styles.numeral}>{fragment.numeral}</span>
        <p className={styles.text}>
          <ScrambleText text={fragment.text} once inView stagger={16} />
        </p>
        <p className={styles.meta}>Decoded {formatOstDate(new Date(decodedAt))}</p>
      </li>
    );
  }
  return (
    <li className={styles.line} data-decoded="false" style={style} data-reveal>
      <span className={styles.numeral}>{fragment.numeral}</span>
      <p className={styles.glyphs} aria-hidden="true">
        {fragment.text.split(' ').map((word, i) => (
          <IthranText key={`${word}-${i}`} text={word.replace(/[^a-zA-Z]/g, '') || 'a'} size={13} weight={0.9} />
        ))}
      </p>
      <p className="sr-only">Received in the aperture script; not yet decoded.</p>
      <p className={styles.meta}>
        <Where fragment={fragment} />
      </p>
    </li>
  );
}

export default function TransmissionZeroPage() {
  usePageMeta('transmission-zero');
  const decoded = useProgress((s) => s.fragments);
  const sigil = useProgress((s) => s.sigil);
  const count = fragmentCount(decoded);
  const whole = count === FRAGMENT_TOTAL;
  useStageScene('lacuna', { mode: whole ? 'finale' : 'lanterns', tint: 'ca' });
  const now = new Date(useNow());
  const next = telemetry(now).nextRepetition;
  const ref = useRef<HTMLDivElement>(null);
  const motion = useResolvedMotion();

  useGsap(
    () => {
      if (motion === 'still') return;
      gsap.from('[data-hero]', { opacity: 0, y: 30, filter: 'blur(8px)', stagger: 0.14, duration: 1.6, ease: 'phos.out', delay: 0.1 });
      for (const el of gsap.utils.toArray<HTMLElement>('[data-reveal]')) {
        gsap.from(el, { opacity: 0, y: 24, duration: 1.1, ease: 'phos.out', scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
      }
    },
    ref,
    [motion],
  );

  return (
    <div ref={ref} className={`container ${styles.page}`} data-whole={whole}>
      <header className={styles.head}>
        <p className="t-kicker" data-hero>
          The head of the signal
        </p>
        <h1 className={styles.title} data-hero>
          Transmission Zero
        </h1>
        <p className={styles.lede} data-hero>
          {whole
            ? 'Every line is decoded. This is the message the Ithra placed at the head of everything they sent — repeated, unchanged, every nine hours, seventeen minutes and twenty-three seconds, for thirty-six thousand years.'
            : 'Twelve lines, repeated at the head of the stream since before there were people to receive them. The Institute has their shape but not their words. Each line is decoded somewhere in the observatory.'}
        </p>
        <div className={styles.status} data-hero>
          <span className={styles.meter} aria-hidden="true">
            {fragments.map((f) => (
              <span key={f.id} data-on={Boolean(decoded[String(f.id)])} style={{ '--fragment-line': `var(--line-${f.line})` } as CSSProperties} />
            ))}
          </span>
          <span>
            {count} of {FRAGMENT_TOTAL} decoded
          </span>
          <span className={styles.next}>
            Next repetition in <time>{countdown(next)}</time>
          </span>
        </div>
      </header>

      <ol role="list" className={styles.message} aria-label="Transmission Zero">
        {fragments.map((fragment) => (
          <Line key={fragment.id} fragment={fragment} decodedAt={decoded[String(fragment.id)]} />
        ))}
      </ol>

      {whole && (
        <section className={styles.finale} aria-labelledby="zero-finale" data-reveal>
          <h2 id="zero-finale" className={styles.finaleTitle}>
            The light connects us
          </h2>
          <p className={styles.finaleText}>
            You found every line. The Institute would like to add your name to the logbook — in the only script the
            message was ever written in.
          </p>
          <div className={styles.sigil}>
            <IthranText text={sigil ?? 'observer'} size={46} mode="rosette" weight={1.4} draw={motion !== 'still'} />
            <p className={styles.sigilCaption}>
              {sigil ? `“${sigil}”, signed in light` : 'Inscribe your own sigil in the Glyph Synthesizer'}
            </p>
          </div>
          <div className={styles.finaleLinks}>
            <TransitionLink to="/credits" className={styles.finaleLink} line="na">
              Roll the credits <Icon name="arrowRight" size={16} />
            </TransitionLink>
            {!sigil && (
              <TransitionLink to="/instruments/glyphs" className={styles.finaleLink} line="he">
                Write your sigil <Icon name="arrowRight" size={16} />
              </TransitionLink>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

import { useMemo, useRef } from 'react';
import { IthranText } from '../../components/IthranText.tsx';
import { world } from '../../content/world.ts';
import { useGsap } from '../../hooks/useGsap.ts';
import { useMediaQuery } from '../../hooks/useMediaQuery.ts';
import { useResolvedMotion } from '../../hooks/useResolvedMotion.ts';
import { setChannel } from '../../engine/input.ts';
import { gsap } from '../../lib/gsap.ts';
import { createRng } from '../../lib/random.ts';
import { chapterTrigger } from './useChapter.ts';
import styles from './Home.module.css';

const LINES: readonly { text: string; emphasis?: boolean }[] = [
  {
    text: `In 2236 the ${world.array} turned toward a region of Cygnus that, to every instrument we had, contained nothing.`,
  },
  { text: 'Nothing — except light.', emphasis: true },
  {
    text: 'The light arrived in patterns. Every nine hours, seventeen minutes and twenty-three seconds, the patterns began again.',
  },
  { text: 'It took us forty-one years to understand that it was not a message.' },
  { text: 'It was a memory.', emphasis: true },
];

/** A received waveform: carrier, amplitude-modulated data bursts and a little noise. */
function waveformPath(width: number, height: number): string {
  const rng = createRng('serein-waveform');
  const mid = height / 2;
  const points: string[] = [];
  for (let x = 0; x <= width; x += 2) {
    const t = x / width;
    const envelope = 0.35 + 0.65 * Math.pow(Math.sin(t * Math.PI), 0.6);
    const burst = Math.max(0, Math.sin(t * 38)) ** 6 * (0.5 + 0.5 * Math.sin(t * 5.1));
    const carrier = Math.sin(t * 190) * (0.18 + burst * 0.7);
    const drift = Math.sin(t * 9.3) * 0.12;
    const noise = (rng.next() - 0.5) * 0.08;
    const y = mid - (carrier + drift + noise) * envelope * (height * 0.42);
    points.push(`${x === 0 ? 'M' : 'L'}${x} ${y.toFixed(1)}`);
  }
  return points.join('');
}

export function SignalChapter({ index }: { index: number }) {
  const ref = useRef<HTMLElement>(null);
  const motion = useResolvedMotion();
  const compact = useMediaQuery('(max-width: 768px)');
  const path = useMemo(() => waveformPath(1440, 240), []);

  useGsap(
    () => {
      const section = ref.current;
      if (!section) return;
      if (motion === 'still') {
        chapterTrigger(ref, index);
        return;
      }
      const lines = gsap.utils.toArray<HTMLElement>('[data-signal-line]', section);
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: compact ? '+=190%' : '+=280%',
          pin: true,
          scrub: 0.6,
          onUpdate: (self) => setChannel('home.chapter', index + self.progress),
        },
      });

      tl.fromTo('[data-wave]', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 6 }, 0);
      tl.fromTo('[data-wave-glow]', { opacity: 0 }, { opacity: 1, duration: 2 }, 3.5);
      lines.forEach((line, i) => {
        const at = i * 1.2;
        tl.fromTo(
          line,
          { opacity: 0, y: 40, filter: 'blur(10px)' },
          { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.5, ease: 'phos.out' },
          at,
        );
        if (i < lines.length - 1) {
          tl.to(
            line,
            { opacity: 0, y: -40, filter: 'blur(8px)', duration: 0.45, ease: 'phos.in' },
            at + 0.95,
          );
        }
      });
      tl.fromTo('[data-glyphs]', { opacity: 0 }, { opacity: 1, duration: 0.8 }, 5.2);
      tl.to('[data-wave-group]', { opacity: 0.25, duration: 0.8 }, 5.2);
    },
    ref,
    [motion, compact, index],
  );

  return (
    <section
      ref={ref}
      className={styles.signal}
      aria-labelledby="signal-title"
      data-static={motion === 'still'}
    >
      <div className={styles.signalInner}>
        <p className={`t-kicker ${styles.chapterKicker}`}>
          <span className={styles.numeral}>I</span> The Signal
        </p>
        <h2 id="signal-title" className="sr-only">
          The Serein Signal
        </h2>

        <svg className={styles.wave} viewBox="0 0 1440 240" preserveAspectRatio="none" aria-hidden="true">
          <g data-wave-group>
            <path d={path} className={styles.waveGlow} data-wave-glow pathLength={1} />
            <path d={path} className={styles.wavePath} data-wave pathLength={1} />
          </g>
        </svg>

        <div className={styles.signalLines}>
          {LINES.map((line, i) => (
            <p key={i} className={line.emphasis ? styles.signalEmphasis : styles.signalLine} data-signal-line>
              {line.text}
            </p>
          ))}
        </div>

        <div className={styles.signalGlyphs} data-glyphs>
          <IthranText text="we were here" size={26} label="“We were here”, in Ithran script" />
          <p className={styles.glyphCaption}>
            The first phrase the Institute learned to read: “we were here”.
          </p>
        </div>
      </div>
    </section>
  );
}

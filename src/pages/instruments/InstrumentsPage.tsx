import { useMemo, useRef, type CSSProperties } from 'react';
import { IthranText } from '../../components/IthranText.tsx';
import { TransitionLink } from '../../components/TransitionLink.tsx';
import { instruments, type Instrument } from '../../content/instruments.ts';
import { useGsap } from '../../hooks/useGsap.ts';
import { usePageMeta } from '../../hooks/usePageMeta.ts';
import { useResolvedMotion } from '../../hooks/useResolvedMotion.ts';
import { useStageScene } from '../../hooks/useStageScene.ts';
import { pad } from '../../lib/format.ts';
import { gsap } from '../../lib/gsap.ts';
import styles from './Instruments.module.css';

function ChladniDots() {
  const dots = useMemo(() => {
    const out: [number, number][] = [];
    for (let i = 0; i < 70; i++) {
      for (let j = 0; j < 70; j++) {
        const x = (i / 69) * 2 - 1;
        const y = (j / 69) * 2 - 1;
        const q = (v: number): number => ((v + 1) / 2) * Math.PI;
        const f = Math.cos(3 * q(x)) * Math.cos(5 * q(y)) - Math.cos(5 * q(x)) * Math.cos(3 * q(y));
        if (Math.abs(f) < 0.12) out.push([100 + x * 80, 100 + y * 80]);
      }
    }
    return out;
  }, []);
  return (
    <svg viewBox="0 0 200 200" aria-hidden="true">
      <rect x="18" y="18" width="164" height="164" className={styles.frame} />
      {dots.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="0.9" className={styles.fill} />
      ))}
    </svg>
  );
}

function Diagram({ instrument }: { instrument: Instrument }) {
  switch (instrument.slug) {
    case 'interference':
      return (
        <svg viewBox="0 0 200 200" aria-hidden="true" className={styles.waves}>
          {Array.from({ length: 8 }, (_, i) => (
            <circle key={`a${i}`} cx="75" cy="120" r={10 + i * 14} style={{ animationDelay: `${i * -0.35}s` }} />
          ))}
          {Array.from({ length: 8 }, (_, i) => (
            <circle key={`b${i}`} cx="125" cy="120" r={10 + i * 14} style={{ animationDelay: `${i * -0.35}s` }} />
          ))}
        </svg>
      );
    case 'resonance':
      return <ChladniDots />;
    case 'gravity':
      return (
        <svg viewBox="0 0 200 200" aria-hidden="true" className={styles.orbits}>
          <circle cx="100" cy="100" r="5" className={styles.fill} />
          {[30, 48, 66, 84].map((r, i) => (
            <g key={r} style={{ animationDuration: `${6 + i * 5}s` }}>
              <ellipse cx="100" cy="100" rx={r} ry={r * 0.55} />
              <circle cx={100 + r} cy="100" r="2.5" className={styles.fill} />
            </g>
          ))}
        </svg>
      );
    case 'glyphs':
      return (
        <div className={styles.glyphDiagram}>
          <IthranText text="light" mode="rosette" size={30} weight={1.1} label="The word light in Ithran script" />
        </div>
      );
    case 'terrain':
      return (
        <svg viewBox="0 0 200 200" aria-hidden="true" className={styles.ridges}>
          {Array.from({ length: 12 }, (_, row) => {
            const y = 60 + row * 10;
            let d = `M20 ${y}`;
            for (let x = 20; x <= 180; x += 4) {
              const h = Math.max(0, Math.sin(x * 0.07 + row * 0.9)) ** 3 * (18 - row) + Math.sin(x * 0.31 + row) * 1.5;
              d += ` L${x} ${y - h}`;
            }
            return <path key={row} d={d} style={{ opacity: 0.25 + (row / 12) * 0.75 }} />;
          })}
        </svg>
      );
    case 'aurora':
    default:
      return (
        <svg viewBox="0 0 200 200" aria-hidden="true" className={styles.curtains}>
          {Array.from({ length: 9 }, (_, i) => (
            <path
              key={i}
              d={`M${20 + i * 4} ${40 + i * 3} C 70 ${10 + i * 9}, 120 ${150 - i * 6}, ${180 - i * 2} ${60 + i * 8}`}
              style={{ animationDelay: `${i * -0.6}s` }}
            />
          ))}
        </svg>
      );
  }
}

export default function InstrumentsPage() {
  usePageMeta('instruments');
  useStageScene('lacuna', { mode: 'dusk', tint: 'o3' });
  const ref = useRef<HTMLDivElement>(null);
  const motion = useResolvedMotion();

  useGsap(
    () => {
      if (motion === 'still') return;
      gsap.from('[data-card]', { opacity: 0, y: 60, stagger: 0.09, duration: 1.3, ease: 'phos.out', delay: 0.1 });
    },
    ref,
    [motion],
  );

  return (
    <div ref={ref} className={`container ${styles.page}`}>
      <header className={styles.head}>
        <p className="t-kicker">05 · Instruments</p>
        <h1 className={styles.title}>
          The tools <em>of listening</em>
        </h1>
        <p className={styles.lead}>
          Six working instruments from the Institute’s bench. Each one runs a real simulation — on your graphics card,
          in your browser — and each is part of how the Serein Signal was decoded.
        </p>
      </header>

      <ol role="list" className={styles.grid}>
        {instruments.map((instrument, i) => (
          <li key={instrument.slug} data-card>
            <TransitionLink
              to={`/instruments/${instrument.slug}`}
              className={styles.card}
              style={{ '--card-line': `var(--line-${instrument.line})` } as CSSProperties}
              data-cursor-label="Operate"
            >
              <span className={styles.index}>{pad(i + 1)}</span>
              <div className={styles.diagram}>
                <Diagram instrument={instrument} />
              </div>
              <h2 className={styles.name}>{instrument.name}</h2>
              <p className={styles.epithet}>{instrument.epithet}</p>
              <p className={styles.principle}>{instrument.principle}</p>
              <span className={styles.open}>Operate →</span>
            </TransitionLink>
          </li>
        ))}
      </ol>
    </div>
  );
}

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useLocation } from 'react-router';
import { Button } from '../../components/Button.tsx';
import { RelicPlate } from '../../components/RelicPlate.tsx';
import { TransitionLink } from '../../components/TransitionLink.tsx';
import { epilogue, eras } from '../../content/eras.ts';
import { relicsByEra } from '../../content/relics.ts';
import { unlockFragment } from '../../features/fragments/unlock.ts';
import { scrollToElement } from '../../features/scroll/scroller.ts';
import { useGsap } from '../../hooks/useGsap.ts';
import { usePageMeta } from '../../hooks/usePageMeta.ts';
import { useResolvedMotion } from '../../hooks/useResolvedMotion.ts';
import { useStageScene } from '../../hooks/useStageScene.ts';
import { thousands } from '../../lib/format.ts';
import { gsap, ScrollTrigger, SplitText, splitAnimation } from '../../lib/gsap.ts';
import styles from './Chronicle.module.css';

const MAX_TURNS = eras[0]?.from ?? 3_100_000;
const LOG_MAX = Math.log10(MAX_TURNS + 100);

/** Logarithmic position of a date (turns before the Encoding) on the axis, 0 → 1. */
const axisX = (turns: number): number => 1 - Math.log10(Math.max(0, turns) + 100) / LOG_MAX;

export default function ChroniclePage() {
  usePageMeta('chronicle');
  const [active, setActive] = useState(0);
  const motion = useResolvedMotion();
  const location = useLocation();
  const rootRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const turnsRef = useRef<HTMLSpanElement>(null);
  const era = eras[active] ?? eras[0];
  useStageScene('lacuna', { mode: 'chronicle', era: active, tint: era?.line ?? 'o3' });

  useGsap(
    () => {
      const sections = gsap.utils.toArray<HTMLElement>('[data-era]');
      sections.forEach((section, i) => {
        const current = eras[i];
        if (!current) return;
        ScrollTrigger.create({
          trigger: section,
          start: 'top 55%',
          end: 'bottom 55%',
          onToggle: (self) => {
            if (self.isActive) setActive(i);
          },
          onUpdate: (self) => {
            // Interpolate the date through the age as the reader moves through it.
            const turns = current.from + (current.to - current.from) * self.progress;
            indicatorRef.current?.style.setProperty('--x', axisX(turns).toFixed(4));
            if (turnsRef.current)
              turnsRef.current.textContent = `${thousands(Math.round(turns))} turns before the Encoding`;
          },
        });
        if (motion !== 'still') {
          gsap.from(section.querySelectorAll('[data-reveal]'), {
            opacity: 0,
            y: 36,
            stagger: 0.08,
            duration: 1.2,
            ease: 'phos.out',
            scrollTrigger: { trigger: section, start: 'top 72%' },
          });
        }
      });
      if (motion !== 'still') {
        const split = SplitText.create('[data-chronicle-title]', {
          type: 'lines',
          mask: 'lines',
          autoSplit: true,
          onSplit: splitAnimation((self) =>
            gsap.from(self.lines, {
              yPercent: 110,
              stagger: 0.12,
              duration: 1.6,
              ease: 'phos.out',
              delay: 0.2,
            }),
          ),
        });
        return () => split.revert();
      }
      return undefined;
    },
    rootRef,
    [motion],
  );

  useEffect(() => {
    if (active === eras.length - 1) unlockFragment(2);
  }, [active]);

  // Honour #era deep links once the sections have laid out.
  useEffect(() => {
    const id = location.hash.slice(1);
    if (!id) return;
    const target = document.getElementById(id);
    if (!target) return;
    const t = window.setTimeout(() => scrollToElement(target, -80), 400);
    return () => window.clearTimeout(t);
  }, [location.hash]);

  return (
    <div ref={rootRef} className={styles.chronicle}>
      <header className={`container ${styles.head}`}>
        <p className="t-kicker">02 · Chronicle</p>
        <h1 className={styles.title} data-chronicle-title>
          The Chronicle of the <em>Seven Ages</em>
        </h1>
        <p className={styles.lead}>
          Three million turns of Ithran history, as the stream delivered it: in order, like a life. A turn is
          one year on Ithris — about 1.21 of ours.
        </p>
      </header>

      <div className={styles.axisWrap} aria-hidden="true">
        <div className={`container ${styles.axis}`}>
          <div className={styles.axisTrack}>
            {eras.map((e) => (
              <span
                key={e.id}
                className={styles.axisSpan}
                data-active={e.id === era?.id}
                style={
                  {
                    left: `${axisX(e.from) * 100}%`,
                    width: `${(axisX(e.to) - axisX(e.from)) * 100}%`,
                    '--span-line': `var(--line-${e.line})`,
                  } as CSSProperties
                }
              >
                <span className={styles.axisNumeral}>{e.numeral}</span>
              </span>
            ))}
            <span ref={indicatorRef} className={styles.indicator} />
          </div>
          <div className={styles.axisLegend}>
            <span>3.1 million</span>
            <span ref={turnsRef} className={styles.turns}>
              Scroll to travel through time
            </span>
            <span>The Encoding</span>
          </div>
        </div>
      </div>

      <nav className={`container ${styles.jump}`} aria-label="Ages">
        <ol role="list">
          {eras.map((e, i) => (
            <li key={e.id}>
              <a
                href={`#${e.id}`}
                aria-current={i === active ? 'true' : undefined}
                style={{ '--jump-line': `var(--line-${e.line})` } as CSSProperties}
                onClick={(ev) => {
                  ev.preventDefault();
                  const target = document.getElementById(e.id);
                  if (target) scrollToElement(target, -80);
                }}
              >
                <span>{e.numeral}</span> {e.name}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {eras.map((e) => {
        const relics = relicsByEra(e.id);
        return (
          <section
            key={e.id}
            id={e.id}
            data-era
            className={styles.era}
            style={{ '--era-line': `var(--line-${e.line})` } as CSSProperties}
            aria-labelledby={`${e.id}-title`}
          >
            <div className={`container ${styles.eraGrid}`}>
              <div className={styles.eraSide}>
                <span className={styles.numeral} aria-hidden="true">
                  {e.numeral}
                </span>
                <p className={styles.span}>{e.span}</p>
              </div>
              <div className={styles.eraMain}>
                <h2 id={`${e.id}-title`} className={styles.eraName} data-reveal>
                  {e.name}
                </h2>
                <p className={styles.subtitle} data-reveal>
                  {e.subtitle}
                </p>
                <p className={styles.summary} data-reveal>
                  {e.summary}
                </p>
                {e.body.map((p, i) => (
                  <p key={i} className={styles.body} data-reveal>
                    {p}
                  </p>
                ))}
                <blockquote className={styles.voice} data-reveal>
                  <p>“{e.voice}”</p>
                  <footer>Recovered verbatim from the stream</footer>
                </blockquote>
                <ol role="list" className={styles.events} data-reveal>
                  {e.events.map((ev) => (
                    <li key={ev.title}>
                      <span className={styles.eventAt}>{ev.at}</span>
                      <span className={styles.eventTitle}>{ev.title}</span>
                      <span className={styles.eventText}>{ev.text}</span>
                    </li>
                  ))}
                </ol>
                {relics.length > 0 && (
                  <div className={styles.relics} data-reveal>
                    <p className="t-kicker">Relics of this age</p>
                    <ul role="list">
                      {relics.map((r) => (
                        <li key={r.id}>
                          <TransitionLink
                            to={`/archive/${r.id}`}
                            className={styles.relic}
                            data-cursor-label="Examine"
                          >
                            <RelicPlate relic={r} marks={false} />
                            <span>{r.name}</span>
                          </TransitionLink>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </section>
        );
      })}

      <section className={`container ${styles.epilogue}`} aria-labelledby="epilogue-title">
        <p className="t-kicker">
          {epilogue.numeral} · {epilogue.span}
        </p>
        <h2 id="epilogue-title" className={styles.eraName}>
          {epilogue.name}
        </h2>
        <p className={styles.summary}>{epilogue.summary}</p>
        <div className={styles.epilogueActions}>
          <Button to="/array" line="he">
            Listen at the Array
          </Button>
          <Button to="/institute" variant="ghost" line="na" icon="arrowUpRight">
            Meet the Institute
          </Button>
        </div>
      </section>
    </div>
  );
}

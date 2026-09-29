import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { RelicPlate } from '../../components/RelicPlate.tsx';
import { TransitionLink } from '../../components/TransitionLink.tsx';
import { eraById } from '../../content/eras.ts';
import { FEATURED_RELICS, relicById, relics, type Relic } from '../../content/relics.ts';
import { placeById } from '../../content/routes.ts';
import { spring } from '../../design/tokens.ts';
import { useGsap } from '../../hooks/useGsap.ts';
import { useResolvedMotion } from '../../hooks/useResolvedMotion.ts';
import { pad } from '../../lib/format.ts';
import { gsap } from '../../lib/gsap.ts';
import { SplitText, splitAnimation } from '../../lib/gsapText.ts';
import { Spring2 } from '../../lib/spring.ts';
import { chapterTrigger } from './useChapter.ts';
import styles from './Home.module.css';

const WAYS = [
  { id: 'atlas', glyph: 'orbit', text: 'Fly the dying system of Vael and its six worlds.' },
  {
    id: 'archive',
    glyph: 'plate',
    text: `${relics.length} relics, rebuilt from descriptions made of light.`,
  },
  {
    id: 'instruments',
    glyph: 'waves',
    text: 'Six working instruments. Interference, resonance, gravity and more.',
  },
  { id: 'array', glyph: 'dishes', text: 'The receiver, live: a spectrogram of the signal as it arrives.' },
] as const;

function WayGlyph({ kind }: { kind: (typeof WAYS)[number]['glyph'] }) {
  switch (kind) {
    case 'orbit':
      return (
        <svg viewBox="0 0 200 200" aria-hidden="true">
          <circle cx="100" cy="100" r="18" className={styles.glyphFill} />
          {[40, 58, 76, 92].map((r, i) => (
            <ellipse
              key={r}
              cx="100"
              cy="100"
              rx={r}
              ry={r * 0.42}
              transform={`rotate(${-18 + i * 4} 100 100)`}
            />
          ))}
          <circle cx="176" cy="84" r="4" className={styles.glyphFill} />
        </svg>
      );
    case 'plate': {
      const relic = relicById('sr-0092');
      return relic ? <RelicPlate relic={relic} marks={false} /> : null;
    }
    case 'waves':
      return (
        <svg viewBox="0 0 200 200" aria-hidden="true">
          {Array.from({ length: 9 }, (_, i) => (
            <circle key={`a${i}`} cx="70" cy="100" r={12 + i * 13} />
          ))}
          {Array.from({ length: 9 }, (_, i) => (
            <circle key={`b${i}`} cx="130" cy="100" r={12 + i * 13} />
          ))}
        </svg>
      );
    case 'dishes':
      return (
        <svg viewBox="0 0 200 200" aria-hidden="true">
          {Array.from({ length: 25 }, (_, i) => {
            const x = 36 + (i % 5) * 32;
            const y = 36 + Math.floor(i / 5) * 32;
            return <path key={i} d={`M${x - 10} ${y + 4}a10 10 0 0 0 20 0M${x} ${y + 4}l6 -8`} />;
          })}
        </svg>
      );
  }
}

/** Direction-aware preview that trails the pointer across the list. */
function usePreview(listRef: RefObject<HTMLElement | null>, previewRef: RefObject<HTMLElement | null>) {
  const motion = useResolvedMotion();
  useEffect(() => {
    const list = listRef.current;
    const preview = previewRef.current;
    if (!list || !preview || motion === 'still') return;
    const s = new Spring2(0, 0, spring.gentle);
    let raf = 0;
    let active = false;
    let last = performance.now();
    const tick = (now: number): void => {
      s.step(Math.min(0.05, (now - last) / 1000));
      last = now;
      const tilt = Math.max(-12, Math.min(12, s.x.velocity * 0.012));
      preview.style.transform = `translate3d(${s.x.value}px, ${s.y.value}px, 0) rotate(${tilt}deg)`;
      if (active || !s.settled) raf = requestAnimationFrame(tick);
      else raf = 0;
    };
    const onMove = (e: PointerEvent): void => {
      const rect = list.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (!active) s.snap(x, y);
      active = true;
      s.setTarget(x, y);
      if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };
    const onLeave = (): void => {
      active = false;
    };
    list.addEventListener('pointermove', onMove);
    list.addEventListener('pointerleave', onLeave);
    return () => {
      cancelAnimationFrame(raf);
      list.removeEventListener('pointermove', onMove);
      list.removeEventListener('pointerleave', onLeave);
    };
  }, [listRef, previewRef, motion]);
}

function FeaturedRelic({ relic }: { relic: Relic }) {
  const era = eraById(relic.era);
  return (
    <TransitionLink
      to={`/archive/${relic.id}`}
      className={styles.featured}
      style={{ '--relic-line': `var(--line-${relic.line})` } as CSSProperties}
      data-cursor-label="Examine"
    >
      <div className={styles.featuredPlate}>
        <RelicPlate relic={relic} />
      </div>
      <p className={styles.featuredMeta}>
        {relic.catalog} · {era?.name}
      </p>
      <h3 className={styles.featuredName}>{relic.name}</h3>
      <p className={styles.featuredSummary}>{relic.summary}</p>
    </TransitionLink>
  );
}

export function SurvivedChapter({ index }: { index: number }) {
  const ref = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<(typeof WAYS)[number]['id'] | null>(null);
  const motion = useResolvedMotion();
  usePreview(listRef, previewRef);

  useGsap(
    () => {
      chapterTrigger(ref, index);
      if (motion === 'still') return;
      const split = SplitText.create('[data-survived-title]', {
        type: 'lines',
        mask: 'lines',
        autoSplit: true,
        onSplit: splitAnimation((self) =>
          gsap.from(self.lines, {
            yPercent: 110,
            stagger: 0.1,
            duration: 1.4,
            ease: 'phos.out',
            scrollTrigger: { trigger: '[data-survived-title]', start: 'top 80%' },
          }),
        ),
      });
      gsap.from('[data-featured]', {
        opacity: 0,
        y: 60,
        stagger: 0.14,
        duration: 1.4,
        ease: 'phos.out',
        scrollTrigger: { trigger: '[data-featured-row]', start: 'top 78%' },
      });
      gsap.from('[data-way]', {
        opacity: 0,
        x: -30,
        stagger: 0.08,
        duration: 1.1,
        ease: 'phos.out',
        scrollTrigger: { trigger: listRef.current, start: 'top 80%' },
      });
      return () => split.revert();
    },
    ref,
    [motion, index],
  );

  const featured = FEATURED_RELICS.map((id) => relicById(id)).filter((r): r is Relic => Boolean(r));

  return (
    <section ref={ref} className={styles.survived} aria-labelledby="survived-title">
      <div className="container">
        <p className={`t-kicker ${styles.chapterKicker}`}>
          <span className={styles.numeral}>III</span> What Survived
        </p>
        <h2 id="survived-title" className={styles.survivedTitle} data-survived-title>
          They did not send things. They sent <em>descriptions of things,</em> and we rebuild them in light.
        </h2>

        <div className={styles.featuredRow} data-featured-row>
          {featured.map((relic) => (
            <div key={relic.id} data-featured>
              <FeaturedRelic relic={relic} />
            </div>
          ))}
        </div>

        <div className={styles.ways}>
          <p className={`t-kicker ${styles.waysKicker}`}>Four ways in</p>
          <div ref={listRef} className={styles.waysWrap}>
            <ul role="list" className={styles.waysList} data-hovered={hovered ?? undefined}>
              {WAYS.map((way) => {
                const place = placeById(way.id);
                return (
                  <li key={way.id} data-way>
                    <TransitionLink
                      to={place.path}
                      className={styles.way}
                      style={{ '--way-line': `var(--line-${place.line})` } as CSSProperties}
                      onPointerEnter={() => setHovered(way.id)}
                      onPointerLeave={() => setHovered(null)}
                      onFocus={() => setHovered(way.id)}
                      onBlur={() => setHovered(null)}
                      data-cursor-label="Enter"
                    >
                      <span className={styles.wayIndex}>{pad(place.index)}</span>
                      <span className={styles.wayLabel}>{place.label}</span>
                      <span className={styles.wayText}>{way.text}</span>
                    </TransitionLink>
                  </li>
                );
              })}
            </ul>
            <div
              ref={previewRef}
              className={styles.preview}
              aria-hidden="true"
              data-visible={hovered !== null}
            >
              {WAYS.map((way) => (
                <div
                  key={way.id}
                  className={styles.previewCard}
                  data-active={hovered === way.id}
                  style={{ '--way-line': `var(--line-${placeById(way.id).line})` } as CSSProperties}
                >
                  <WayGlyph kind={way.glyph} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

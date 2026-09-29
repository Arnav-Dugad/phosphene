import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useSearchParams } from 'react-router';
import { Icon } from '../../components/Icon.tsx';
import { RelicPlate } from '../../components/RelicPlate.tsx';
import { Segmented } from '../../components/Segmented.tsx';
import { TransitionLink } from '../../components/TransitionLink.tsx';
import { eraById, eras } from '../../content/eras.ts';
import { RELIC_KIND_LABELS, relics, type Relic } from '../../content/relics.ts';
import { usePageMeta } from '../../hooks/usePageMeta.ts';
import { useResolvedMotion } from '../../hooks/useResolvedMotion.ts';
import { useStageScene } from '../../hooks/useStageScene.ts';
import { gsap } from '../../lib/gsap.ts';
import { Flip } from '../../lib/gsapFlip.ts';
import { rank } from '../../lib/search.ts';
import type { RelicKind } from '../../lib/relicGeometry.ts';
import styles from './Archive.module.css';

type Sort = 'catalog' | 'integrity' | 'age';
type View = 'plates' | 'catalogue';

const SORTS = [
  { value: 'catalog', label: 'Catalogue' },
  { value: 'integrity', label: 'Integrity' },
  { value: 'age', label: 'Age' },
] as const;

const VIEWS = [
  { value: 'plates', label: 'Plates' },
  { value: 'catalogue', label: 'Catalogue' },
] as const;

const KINDS = Object.keys(RELIC_KIND_LABELS) as RelicKind[];

function IntegrityBar({ value, line }: { value: number; line: string }) {
  return (
    <span className={styles.integrity} aria-label={`Integrity ${value} percent`}>
      <span className={styles.integrityTrack} aria-hidden="true">
        <span
          className={styles.integrityFill}
          style={{ width: `${value}%`, background: `var(--line-${line})` }}
        />
      </span>
      <span className={styles.integrityValue}>{value}%</span>
    </span>
  );
}

function PlateCard({ relic }: { relic: Relic }) {
  const era = eraById(relic.era);
  return (
    <TransitionLink
      to={`/archive/${relic.id}`}
      className={styles.card}
      style={{ '--relic-line': `var(--line-${relic.line})` } as CSSProperties}
      data-cursor-label="Examine"
    >
      <div className={styles.cardPlate}>
        <RelicPlate relic={relic} marks={false} />
      </div>
      <div className={styles.cardMeta}>
        <span className={styles.catalog}>{relic.catalog}</span>
        <span className={styles.era}>
          <span className={styles.eraDot} aria-hidden="true" />
          {era?.name}
        </span>
      </div>
      <h2 className={styles.cardName}>{relic.name}</h2>
      <IntegrityBar value={relic.integrity} line={relic.line} />
    </TransitionLink>
  );
}

function CatalogueRow({ relic, onHover }: { relic: Relic; onHover: (id: string | null) => void }) {
  const era = eraById(relic.era);
  return (
    <TransitionLink
      to={`/archive/${relic.id}`}
      className={styles.row}
      style={{ '--relic-line': `var(--line-${relic.line})` } as CSSProperties}
      onPointerEnter={() => onHover(relic.id)}
      onPointerLeave={() => onHover(null)}
      onFocus={() => onHover(relic.id)}
      onBlur={() => onHover(null)}
      data-cursor-label="Examine"
    >
      <span className={styles.catalog}>{relic.catalog}</span>
      <span className={styles.rowName}>{relic.name}</span>
      <span className={styles.era}>
        <span className={styles.eraDot} aria-hidden="true" />
        {era?.name}
      </span>
      <span className={styles.kind}>{RELIC_KIND_LABELS[relic.kind]}</span>
      <IntegrityBar value={relic.integrity} line={relic.line} />
    </TransitionLink>
  );
}

export default function ArchivePage() {
  usePageMeta('archive');
  useStageScene('lacuna', { mode: 'dusk', tint: 'hb' });
  const [params, setParams] = useSearchParams();
  const motion = useResolvedMotion();
  const searchRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const flipState = useRef<Flip.FlipState | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  const query = params.get('q') ?? '';
  const era = params.get('era');
  const kind = params.get('kind') as RelicKind | null;
  const sort = (params.get('sort') as Sort | null) ?? 'catalog';
  const view = (params.get('view') as View | null) ?? 'plates';

  const update = (key: string, value: string | null): void => {
    if (gridRef.current && motion !== 'still') {
      flipState.current = Flip.getState(gridRef.current.querySelectorAll('[data-flip-id]'));
    }
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true, preventScrollReset: true });
  };

  const results = useMemo(() => {
    let list = relics.filter((r) => (!era || r.era === era) && (!kind || r.kind === kind));
    if (query.trim()) {
      list = rank(
        query,
        list.map((r) => ({
          relic: r,
          title: r.name,
          keywords: [
            r.catalog,
            r.summary,
            r.material,
            r.ithran,
            RELIC_KIND_LABELS[r.kind],
            eraById(r.era)?.name ?? '',
          ],
        })),
      ).map((x) => x.item.relic);
    } else {
      const eraOrder = (r: Relic): number => eras.findIndex((e) => e.id === r.era);
      list = [...list].sort((a, b) =>
        sort === 'integrity'
          ? b.integrity - a.integrity
          : sort === 'age'
            ? eraOrder(a) - eraOrder(b)
            : a.catalog.localeCompare(b.catalog),
      );
    }
    return list;
  }, [query, era, kind, sort]);

  // Animate cards from their previous positions whenever the result set changes.
  useLayoutEffect(() => {
    const state = flipState.current;
    if (!state || !gridRef.current) return;
    flipState.current = null;
    Flip.from(state, {
      duration: 0.8,
      ease: 'phos.out',
      stagger: 0.015,
      absolute: true,
      onEnter: (els) =>
        gsap.fromTo(
          els,
          { opacity: 0, scale: 0.94, filter: 'blur(6px)' },
          { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.7, ease: 'phos.out' },
        ),
    });
  }, [results, view]);

  // "/" focuses the search, as in most catalogues.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement | null;
      if (e.key !== '/' || target?.closest('input, textarea, [contenteditable="true"]')) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const meanIntegrity = Math.round(relics.reduce((s, r) => s + r.integrity, 0) / relics.length);
  const hoveredRelic = hovered ? relics.find((r) => r.id === hovered) : null;

  return (
    <div className={`container ${styles.archive}`}>
      <header className={styles.head}>
        <p className="t-kicker">03 · Archive</p>
        <h1 className={styles.title}>
          The Archive of <em>decoded relics</em>
        </h1>
        <p className={styles.lead}>
          The Ithra sent no objects — only descriptions of objects, folded into light. Each relic here is
          rebuilt from what survived the crossing. Integrity is how much of the description arrived.
        </p>
        <dl className={styles.stats}>
          <div>
            <dt>Relics</dt>
            <dd>{relics.length}</dd>
          </div>
          <div>
            <dt>Ages</dt>
            <dd>{eras.length}</dd>
          </div>
          <div>
            <dt>Mean integrity</dt>
            <dd>{meanIntegrity}%</dd>
          </div>
        </dl>
      </header>

      <section className={styles.controls} aria-label="Search and filter the archive">
        <label className={styles.search}>
          <Icon name="search" size={17} />
          <span className="sr-only">Search relics</span>
          <input
            ref={searchRef}
            type="search"
            value={query}
            placeholder="Search by name, material, catalogue number…"
            onChange={(e) => update('q', e.target.value || null)}
            aria-keyshortcuts="/"
          />
          <kbd aria-hidden="true">/</kbd>
        </label>

        <div className={styles.filterRow} role="group" aria-label="Filter by age">
          <button
            type="button"
            className={styles.chip}
            aria-pressed={!era}
            onClick={() => update('era', null)}
          >
            All ages
          </button>
          {eras.map((e) => (
            <button
              key={e.id}
              type="button"
              className={styles.chip}
              aria-pressed={era === e.id}
              onClick={() => update('era', era === e.id ? null : e.id)}
              style={{ '--chip-line': `var(--line-${e.line})` } as CSSProperties}
            >
              <span className={styles.chipDot} aria-hidden="true" />
              {e.name.replace(/^The /, '')}
            </button>
          ))}
        </div>

        <div className={styles.toolbar}>
          <label className={styles.select}>
            <span className={styles.selectLabel}>Kind</span>
            <select value={kind ?? ''} onChange={(e) => update('kind', e.target.value || null)}>
              <option value="">Every kind</option>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {RELIC_KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </label>
          <Segmented
            label="Sort by"
            value={sort}
            options={SORTS}
            onChange={(v) => update('sort', v === 'catalog' ? null : v)}
          />
          <Segmented
            label="View"
            value={view}
            options={VIEWS}
            onChange={(v) => update('view', v === 'plates' ? null : v)}
          />
        </div>
        <p className={styles.count} role="status">
          {results.length === relics.length
            ? `All ${relics.length} relics`
            : `${results.length} of ${relics.length} relics`}
        </p>
      </section>

      {results.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>Nothing in the archive answers to that.</p>
          <p>The signal is patient. Try fewer constraints — or search for a material, like “crystal”.</p>
          <button type="button" className={styles.reset} onClick={() => setParams({}, { replace: true })}>
            <Icon name="reset" size={15} /> Clear every filter
          </button>
        </div>
      ) : view === 'plates' ? (
        <div ref={gridRef} className={styles.grid}>
          {results.map((relic) => (
            <div key={relic.id} data-flip-id={relic.id}>
              <PlateCard relic={relic} />
            </div>
          ))}
        </div>
      ) : (
        <div
          ref={gridRef}
          className={styles.catalogue}
          onPointerMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            e.currentTarget.style.setProperty('--fx', `${e.clientX - rect.left}px`);
            e.currentTarget.style.setProperty('--fy', `${e.clientY - rect.top}px`);
          }}
        >
          <div className={styles.catalogueHead} aria-hidden="true">
            <span>No.</span>
            <span>Relic</span>
            <span>Age</span>
            <span>Kind</span>
            <span>Integrity</span>
          </div>
          <ul role="list">
            {results.map((relic) => (
              <li key={relic.id} data-flip-id={relic.id}>
                <CatalogueRow relic={relic} onHover={setHovered} />
              </li>
            ))}
          </ul>
          <div className={styles.floating} data-visible={Boolean(hoveredRelic)} aria-hidden="true">
            {hoveredRelic && <RelicPlate relic={hoveredRelic} marks={false} />}
          </div>
        </div>
      )}
    </div>
  );
}

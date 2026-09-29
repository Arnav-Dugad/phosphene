import { useEffect, useState, type CSSProperties } from 'react';
import { useParams } from 'react-router';
import { Icon } from '../../components/Icon.tsx';
import { IthranText } from '../../components/IthranText.tsx';
import { RelicPlate } from '../../components/RelicPlate.tsx';
import { ScrambleText } from '../../components/ScrambleText.tsx';
import { Segmented } from '../../components/Segmented.tsx';
import { Slider } from '../../components/Slider.tsx';
import { TransitionLink } from '../../components/TransitionLink.tsx';
import { eraById } from '../../content/eras.ts';
import { RELIC_KIND_LABELS, relicById, relics } from '../../content/relics.ts';
import type { RelicScene, RelicViewMode } from '../../engine/scenes/relic/RelicScene.ts';
import { unlockFragment } from '../../features/fragments/unlock.ts';
import { InteractionSurface } from '../../features/stage/InteractionSurface.tsx';
import { usePageMeta } from '../../hooks/usePageMeta.ts';
import { useStageApi } from '../../hooks/useStageApi.ts';
import { useStageScene } from '../../hooks/useStageScene.ts';
import { useProgress } from '../../stores/progress.ts';
import styles from './Relic.module.css';

const MODES = [
  { value: 'hologram', label: 'Hologram' },
  { value: 'engraving', label: 'Engraving' },
  { value: 'spectral', label: 'Spectral' },
] as const;

const ordered = [...relics].sort((a, b) => a.catalog.localeCompare(b.catalog));

export default function RelicPage() {
  const { id = '' } = useParams<{ id: string }>();
  const relic = relicById(id);
  const [mode, setMode] = useState<RelicViewMode>('hologram');
  const [decode, setDecode] = useState(1);
  const scene = useStageApi<RelicScene>('relic');

  usePageMeta(
    relic
      ? { title: `${relic.name} (${relic.catalog}) — Archive`, description: relic.summary }
      : { title: 'Relic not found — Archive', description: 'This catalogue number is not in the Archive.' },
  );
  useStageScene(relic ? 'relic' : 'lacuna', relic ? { relic: relic.id, mode, decode } : { mode: 'dusk', tint: 'hb' });

  useEffect(() => {
    if (!relic) return;
    setDecode(1);
    const progress = useProgress.getState();
    progress.viewRelic(relic.id);
    if (useProgress.getState().relicsViewed.length >= 5) unlockFragment(4);
  }, [relic]);

  if (!relic) {
    return (
      <div className={`container ${styles.missing}`}>
        <p className="t-kicker">03 · Archive</p>
        <h1 className={styles.name}>No relic answers to “{id}”.</h1>
        <p className={styles.summary}>The catalogue has no entry with that number. It may not have arrived yet.</p>
        <TransitionLink to="/archive" className={styles.back}>
          <Icon name="arrowLeft" size={15} /> Return to the Archive
        </TransitionLink>
      </div>
    );
  }

  const era = eraById(relic.era);
  const index = ordered.findIndex((r) => r.id === relic.id);
  const prev = ordered[(index - 1 + ordered.length) % ordered.length];
  const next = ordered[(index + 1) % ordered.length];
  const related = relic.related.map((rid) => relicById(rid)).filter((r) => r !== undefined);

  return (
    <div className={styles.page} style={{ '--relic-line': `var(--line-${relic.line})` } as CSSProperties}>
      <div className={styles.viewer}>
        <InteractionSurface
          contained
          label={`Holographic reconstruction of ${relic.name}`}
          instructions="Drag to turn the reconstruction, scroll or pinch to zoom. Arrow keys rotate it and plus and minus zoom when this area is focused."
          cursorLabel="Turn"
          onKey={(key) => scene?.onKey(key) ?? false}
        />
        <div className={styles.viewerControls}>
          <Segmented label="View" value={mode} options={MODES} onChange={setMode} hideLabel />
          <Slider
            label="Reconstruction"
            value={decode}
            min={0}
            max={1}
            step={0.01}
            onChange={setDecode}
            format={(v) => `${Math.round(v * relic.integrity)}% of ${relic.integrity}%`}
          />
          <button type="button" className={styles.resetView} onClick={() => scene?.resetView()}>
            <Icon name="reset" size={14} /> Recentre
          </button>
        </div>
      </div>

      <article className={styles.record}>
        <TransitionLink to="/archive" className={styles.back}>
          <Icon name="arrowLeft" size={15} /> Archive
        </TransitionLink>
        <p className={styles.catalog}>
          <ScrambleText text={relic.catalog} stagger={45} />
          <span>{RELIC_KIND_LABELS[relic.kind]}</span>
        </p>
        <h1 className={styles.name}>{relic.name}</h1>
        <div className={styles.ithran}>
          <IthranText text={relic.ithran} size={20} draw label={`Its Ithran name, “${relic.ithran}”`} />
          <span className={styles.ithranGloss}>their word: “{relic.ithran}”</span>
        </div>
        <p className={styles.summary}>{relic.summary}</p>

        <dl className={styles.meta}>
          <div>
            <dt>Age</dt>
            <dd>
              {era ? (
                <TransitionLink to={`/chronicle#${era.id}`} className={styles.metaLink}>
                  {era.numeral} · {era.name}
                </TransitionLink>
              ) : (
                '—'
              )}
            </dd>
          </div>
          <div>
            <dt>Integrity</dt>
            <dd className={styles.integrity}>
              <span className={styles.integrityTrack} aria-hidden="true">
                <span style={{ width: `${relic.integrity}%` }} />
              </span>
              {relic.integrity}%
            </dd>
          </div>
          <div>
            <dt>Material</dt>
            <dd>{relic.material}</dd>
          </div>
          <div>
            <dt>Dimensions</dt>
            <dd>{relic.dimensions}</dd>
          </div>
          <div>
            <dt>Received</dt>
            <dd>{relic.received}</dd>
          </div>
        </dl>

        <div className={styles.description}>
          {relic.description.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>

        <aside className={styles.notes} aria-label="Decoding notes">
          <p className={styles.notesTitle}>Decoding notes</p>
          <p>{relic.notes}</p>
        </aside>

        {related.length > 0 && (
          <section className={styles.related} aria-labelledby="related-title">
            <h2 id="related-title" className="t-kicker">
              Cross-references
            </h2>
            <ul role="list">
              {related.map((r) => (
                <li key={r.id}>
                  <TransitionLink
                    to={`/archive/${r.id}`}
                    className={styles.relatedCard}
                    style={{ '--relic-line': `var(--line-${r.line})` } as CSSProperties}
                  >
                    <RelicPlate relic={r} marks={false} />
                    <span className={styles.relatedCatalog}>{r.catalog}</span>
                    <span className={styles.relatedName}>{r.name}</span>
                  </TransitionLink>
                </li>
              ))}
            </ul>
          </section>
        )}

        <nav className={styles.pager} aria-label="Neighbouring relics">
          {prev && (
            <TransitionLink to={`/archive/${prev.id}`} className={styles.pagerLink} line={prev.line}>
              <Icon name="arrowLeft" size={15} />
              <span>
                <span className={styles.pagerLabel}>Previous</span>
                {prev.name}
              </span>
            </TransitionLink>
          )}
          {next && (
            <TransitionLink to={`/archive/${next.id}`} className={`${styles.pagerLink} ${styles.pagerNext}`} line={next.line}>
              <span>
                <span className={styles.pagerLabel}>Next</span>
                {next.name}
              </span>
              <Icon name="arrowRight" size={15} />
            </TransitionLink>
          )}
        </nav>
      </article>
    </div>
  );
}

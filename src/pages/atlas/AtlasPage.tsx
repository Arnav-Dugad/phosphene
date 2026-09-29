import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Icon } from '../../components/Icon.tsx';
import { Segmented } from '../../components/Segmented.tsx';
import { Slider } from '../../components/Slider.tsx';
import { TransitionLink } from '../../components/TransitionLink.tsx';
import { eras, type Era } from '../../content/eras.ts';
import { relicById } from '../../content/relics.ts';
import { worldById, worlds } from '../../content/worlds.ts';
import type { OrreryScene } from '../../engine/scenes/orrery/OrreryScene.ts';
import { unlockFragment } from '../../features/fragments/unlock.ts';
import { InteractionSurface } from '../../features/stage/InteractionSurface.tsx';
import { usePageMeta } from '../../hooks/usePageMeta.ts';
import { useStageApi } from '../../hooks/useStageApi.ts';
import { useStageScene } from '../../hooks/useStageScene.ts';
import styles from './Atlas.module.css';

const SPEEDS = [
  { value: '0', label: 'Hold' },
  { value: '1', label: '1×' },
  { value: '8', label: '8×' },
  { value: '48', label: '48×' },
] as const;

type Speed = (typeof SPEEDS)[number]['value'];

/** Epoch 0 → 1 spans the Tidal Age to the Great Encoding. */
const eraAtEpoch = (epoch: number): Era =>
  eras[Math.min(eras.length - 1, Math.floor(epoch * eras.length * 0.9999))] ?? (eras[0] as Era);

function Labels({
  scene,
  focus,
  onPick,
}: {
  scene: OrreryScene | null;
  focus: string | null;
  onPick: (id: string) => void;
}) {
  const refs = useRef(new Map<string, HTMLButtonElement>());
  useEffect(() => {
    if (!scene) return;
    let raf = 0;
    const tick = (): void => {
      for (const label of scene.labels) {
        const el = refs.current.get(label.id);
        if (!el) continue;
        el.style.transform = `translate3d(${label.x.toFixed(1)}px, ${label.y.toFixed(1)}px, 0) scale(${label.scale.toFixed(3)})`;
        el.dataset.visible = String(label.visible);
        el.dataset.hovered = String(scene.hovered === label.id);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [scene]);

  return (
    <div className={styles.labels}>
      {worlds.map((world) => (
        <button
          key={world.id}
          ref={(el) => {
            if (el) refs.current.set(world.id, el);
            else refs.current.delete(world.id);
          }}
          type="button"
          className={styles.label}
          data-active={focus === world.id}
          data-visible="false"
          style={{ '--label-line': `var(--line-${world.line})` } as CSSProperties}
          onClick={() => onPick(world.id)}
          aria-label={`Fly to ${world.name}`}
          data-cursor-label="Visit"
        >
          <span className={styles.labelDot} aria-hidden="true" />
          <span className={styles.labelName}>{world.name}</span>
        </button>
      ))}
    </div>
  );
}

export default function AtlasPage() {
  const params = useParams<{ world?: string }>();
  const navigate = useNavigate();
  const focus = params.world && worldById(params.world) ? params.world : null;
  const world = focus ? worldById(focus) : null;
  const [epoch, setEpoch] = useState(0.62);
  const [speed, setSpeed] = useState<Speed>('1');
  const scene = useStageApi<OrreryScene>('orrery');

  usePageMeta(world ? { title: `${world.name} — Atlas`, description: world.summary } : 'atlas');
  useStageScene('orrery', { focus, epoch, speed: Number(speed) });

  const pick = useCallback(
    (id: string | null) => {
      void navigate(id ? `/atlas/${id}` : '/atlas', { replace: true, preventScrollReset: true });
    },
    [navigate],
  );

  useEffect(() => {
    if (!scene) return;
    return scene.events.on('select', (id) => {
      if (id) pick(id);
    });
  }, [scene, pick]);

  useEffect(() => {
    if (focus === 'ennis') unlockFragment(3);
  }, [focus]);

  const index = focus ? worlds.findIndex((w) => w.id === focus) : -1;
  const step = (delta: number): void => {
    const next = worlds[(index + delta + worlds.length) % worlds.length];
    if (next) pick(next.id);
  };

  const onKey = (key: string): boolean => {
    if (key === 'ArrowRight') step(1);
    else if (key === 'ArrowLeft') step(-1);
    else if (key === 'Escape') pick(null);
    else if (key === '+' || key === '=') scene?.onZoom(0.85);
    else if (key === '-') scene?.onZoom(1.18);
    else return false;
    return true;
  };

  const era = eraAtEpoch(epoch);
  const marks = useMemo(() => eras.map((e, i) => ({ value: i / eras.length, label: e.numeral })), []);

  return (
    <div className={styles.atlas}>
      <InteractionSurface
        label="The Vael system, rendered in 3D"
        instructions="Drag to orbit the system, scroll or pinch to zoom. Use the left and right arrow keys to travel between worlds, plus and minus to zoom, and Escape to return to the whole system. The list of worlds below offers the same journeys."
        cursorLabel="Orbit"
        onKey={onKey}
      />
      <Labels scene={scene} focus={focus} onPick={pick} />

      <aside className={styles.rail} aria-labelledby="atlas-title">
        <p className="t-kicker">01 · Atlas</p>
        <h1 id="atlas-title" className={styles.title}>
          The Vael <em>system</em>
        </h1>
        <nav aria-label="Worlds of the Vael system">
          <ol role="list" className={styles.worldList}>
            {worlds.map((w) => (
              <li key={w.id}>
                <button
                  type="button"
                  className={styles.worldButton}
                  aria-current={focus === w.id ? 'true' : undefined}
                  onClick={() => pick(w.id)}
                  style={{ '--world-line': `var(--line-${w.line})` } as CSSProperties}
                >
                  <span className={styles.worldDot} aria-hidden="true" />
                  <span className={styles.worldName}>{w.name}</span>
                  <span className={styles.worldOrbit}>{w.orbit ? `${w.orbit} AU` : 'star'}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>
        {focus && (
          <button type="button" className={styles.systemButton} onClick={() => pick(null)}>
            <Icon name="orbit" size={15} /> Whole system
          </button>
        )}
      </aside>

      <section className={styles.detail} aria-live="polite" data-open={Boolean(world)}>
        {world ? (
          <article
            key={world.id}
            className={styles.card}
            style={{ '--world-line': `var(--line-${world.line})` } as CSSProperties}
          >
            <p className={styles.epithet}>{world.epithet}</p>
            <h2 className={styles.worldTitle}>{world.name}</h2>
            <p className={styles.summary}>{world.summary}</p>
            <dl className={styles.facts}>
              {world.facts.map((f) => (
                <div key={f.label}>
                  <dt>{f.label}</dt>
                  <dd>{f.value}</dd>
                </div>
              ))}
            </dl>
            {world.body.map((p, i) => (
              <p key={i} className={styles.body}>
                {p}
              </p>
            ))}
            {world.relics.length > 0 && (
              <div className={styles.relics}>
                <p className="t-kicker">Relics from {world.name}</p>
                <ul role="list">
                  {world.relics.map((id) => {
                    const relic = relicById(id);
                    return relic ? (
                      <li key={id}>
                        <TransitionLink to={`/archive/${id}`} className={styles.relicLink}>
                          <span>{relic.catalog}</span> {relic.name}
                        </TransitionLink>
                      </li>
                    ) : null;
                  })}
                </ul>
              </div>
            )}
            <div className={styles.stepper}>
              <button type="button" onClick={() => step(-1)} aria-label="Previous world">
                <Icon name="chevronLeft" size={16} />
              </button>
              <span>
                {index + 1} / {worlds.length}
              </span>
              <button type="button" onClick={() => step(1)} aria-label="Next world">
                <Icon name="chevronRight" size={16} />
              </button>
            </div>
          </article>
        ) : (
          <div className={styles.overview}>
            <p className={styles.summary}>
              A patient orange star, six worlds and a belt of rubble — reconstructed from the Atlas of Near
              Stars and the records of the evacuation. Choose a world, or drag to look around.
            </p>
          </div>
        )}
      </section>

      <div className={styles.controls}>
        <Slider
          label="Epoch"
          value={epoch}
          min={0}
          max={0.999}
          step={0.001}
          onChange={setEpoch}
          format={() => `${era.numeral} · ${era.name}`}
          marks={marks}
        />
        <Segmented label="Orbital time" value={speed} options={SPEEDS} onChange={setSpeed} />
      </div>
    </div>
  );
}

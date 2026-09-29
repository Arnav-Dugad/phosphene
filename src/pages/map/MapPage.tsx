import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Icon } from '../../components/Icon.tsx';
import { TransitionLink } from '../../components/TransitionLink.tsx';
import { fragments } from '../../content/fragments.ts';
import {
  chartNodes,
  NODE_KIND_LABELS,
  NODE_KINDS,
  nodeForPath,
  type ChartNode,
  type NodeKind,
} from '../../content/graph.ts';
import type { ConstellationScene } from '../../engine/scenes/constellation/ConstellationScene.ts';
import { InteractionSurface } from '../../features/stage/InteractionSurface.tsx';
import { useTransitionNavigate } from '../../features/transition/useTransitionNavigate.ts';
import { usePageMeta } from '../../hooks/usePageMeta.ts';
import { useStageApi } from '../../hooks/useStageApi.ts';
import { useStageScene } from '../../hooks/useStageScene.ts';
import { useProgress } from '../../stores/progress.ts';
import styles from './Map.module.css';

const HIDDEN_PLACES: Record<string, (visited: Set<number>, fragmentCount: number) => boolean> = {
  'place:transmission-zero': (visited, count) => count > 0 || visited.has(indexOf('place:transmission-zero')),
  'place:credits': (visited) => visited.has(indexOf('place:credits')),
};

function indexOf(id: string): number {
  return chartNodes.find((n) => n.id === id)?.index ?? -1;
}

/** The DOM half of the chart: a real link for every star, positioned over it each frame. */
function Labels({
  scene,
  nodes,
  observed,
  hovered,
  onFocusNode,
}: {
  scene: ConstellationScene | null;
  nodes: readonly ChartNode[];
  observed: Set<number>;
  hovered: number | null;
  onFocusNode: (index: number | null) => void;
}) {
  const refs = useRef(new Map<number, HTMLElement>());
  const decodedAt = useProgress((s) => s.fragments);

  useEffect(() => {
    if (!scene) return;
    let raf = 0;
    const tick = (): void => {
      for (const [index, el] of refs.current) {
        const anchor = scene.anchors[index];
        if (!anchor) continue;
        el.style.transform = `translate3d(${anchor.x.toFixed(1)}px, ${anchor.y.toFixed(1)}px, 0)`;
        el.style.setProperty('--detail', anchor.detail.toFixed(3));
        el.dataset.detail = anchor.detail > 0.5 ? 'on' : 'off';
        el.dataset.visible = String(anchor.visible);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [scene]);

  const badges = useMemo(() => {
    const map = new Map<number, string[]>();
    for (const fragment of fragments) {
      if (!decodedAt[String(fragment.id)]) continue;
      const node = nodeForPath(fragment.where);
      if (!node) continue;
      map.set(node.index, [...(map.get(node.index) ?? []), fragment.numeral]);
    }
    return map;
  }, [decodedAt]);

  return (
    <ul className={styles.labels} role="list" aria-label="Everything on the chart">
      {nodes.map((node) => (
        <li
          key={node.id}
          ref={(el) => {
            if (el) refs.current.set(node.index, el);
            else refs.current.delete(node.index);
          }}
          className={styles.label}
          data-kind={node.kind}
          data-visible="false"
          data-hovered={hovered === node.index}
          style={{ '--label-line': `var(--line-${node.line})` } as CSSProperties}
        >
          <TransitionLink
            to={node.path}
            className={styles.labelLink}
            line={node.line}
            onFocus={() => onFocusNode(node.index)}
            onBlur={() => onFocusNode(null)}
            aria-label={`${node.label} — ${NODE_KIND_LABELS[node.kind].one}${observed.has(node.index) ? ', observed' : ''}`}
            data-cursor-label="Travel"
          >
            <span className={styles.labelName}>{node.label}</span>
            {badges.get(node.index)?.map((numeral) => (
              <span key={numeral} className={styles.badge} aria-hidden="true">
                ◆ {numeral}
              </span>
            ))}
          </TransitionLink>
        </li>
      ))}
    </ul>
  );
}

function Tooltip({
  scene,
  node,
  observed,
}: {
  scene: ConstellationScene | null;
  node: ChartNode;
  observed: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!scene) return;
    let raf = 0;
    const tick = (): void => {
      const anchor = scene.anchors[node.index];
      if (ref.current && anchor)
        ref.current.style.transform = `translate3d(${anchor.x.toFixed(1)}px, ${anchor.y.toFixed(1)}px, 0)`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [scene, node.index]);
  return (
    <div
      ref={ref}
      className={styles.tooltip}
      style={{ '--label-line': `var(--line-${node.line})` } as CSSProperties}
      aria-hidden="true"
    >
      <p className={styles.tooltipKind}>
        {NODE_KIND_LABELS[node.kind].one} · {observed ? 'observed' : 'not yet observed'}
      </p>
      <p className={styles.tooltipName}>{node.label}</p>
      <p className={styles.tooltipGloss}>{node.gloss}</p>
    </div>
  );
}

export default function MapPage() {
  usePageMeta('map');
  const path = useProgress((s) => s.path);
  const fragmentCount = useProgress((s) => Object.keys(s.fragments).length);
  const [filtered, setFiltered] = useState<NodeKind[]>([]);
  const [focus, setFocus] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const scene = useStageApi<ConstellationScene>('constellation');
  const go = useTransitionNavigate();

  const visited = useMemo(() => {
    const out: number[] = [];
    for (const pathname of path) {
      const node = nodeForPath(pathname);
      if (node && out[out.length - 1] !== node.index) out.push(node.index);
    }
    return out;
  }, [path]);
  const observed = useMemo(() => new Set(visited), [visited]);
  const revealed = useMemo(
    () =>
      chartNodes
        .filter((n) => n.hidden && HIDDEN_PLACES[n.id]?.(observed, fragmentCount))
        .map((n) => n.index),
    [observed, fragmentCount],
  );
  const shown = useMemo(() => chartNodes.filter((n) => !n.hidden || revealed.includes(n.index)), [revealed]);
  const listed = shown.filter((n) => !filtered.includes(n.kind));
  const observedCount = shown.filter((n) => observed.has(n.index)).length;

  useStageScene('constellation', {
    visited,
    observed: [...observed],
    hiddenKinds: filtered,
    revealed,
    focus: focus ?? -1,
  });

  useEffect(() => {
    if (!scene) return;
    const offHover = scene.events.on('hover', setHovered);
    const offPick = scene.events.on('pick', (index) => {
      const node = chartNodes[index];
      if (node) go(node.path, { line: node.line });
    });
    return () => {
      offHover();
      offPick();
    };
  }, [scene, go]);

  const toggleKind = (kind: NodeKind): void =>
    setFiltered((list) => (list.includes(kind) ? list.filter((k) => k !== kind) : [...list, kind]));

  const tipIndex = hovered ?? focus;
  const tipNode = tipIndex !== null ? chartNodes[tipIndex] : undefined;

  return (
    <div className={styles.page}>
      <InteractionSurface
        label="The chart of everything received"
        instructions="Drag to pan, scroll or pinch to zoom, and click a star to travel there. With this area focused, the arrow keys pan, plus and minus zoom, and 0 recentres. Every star is also a link: press Tab to move between them."
        cursor="drag"
        cursorLabel="Pan"
      />
      <Labels scene={scene} nodes={listed} observed={observed} hovered={hovered} onFocusNode={setFocus} />
      {tipNode && <Tooltip scene={scene} node={tipNode} observed={observed.has(tipNode.index)} />}

      <div className={styles.hud}>
        <header className={styles.masthead}>
          <p className="t-kicker">08 · Map</p>
          <h1 className={styles.title}>The Chart of Everything Received</h1>
          <p className={styles.lede}>
            Every place, world, age, relic and transmission as a star, linked by meaning. The bright line is
            your own path through the observatory.
          </p>
          <p className={styles.stats}>
            <span>
              <strong>{observedCount}</strong> of {shown.length} observed
            </span>
            <span>
              <strong>{Math.max(0, visited.length - 1)}</strong> steps traced
            </span>
            <span>
              <strong>{fragmentCount}</strong> of {fragments.length} fragments
            </span>
          </p>
        </header>

        <fieldset className={styles.legend}>
          <legend className={styles.legendTitle}>Show</legend>
          {NODE_KINDS.map((kind) => {
            const count = shown.filter((n) => n.kind === kind).length;
            return (
              <button
                key={kind}
                type="button"
                className={styles.chip}
                data-kind={kind}
                aria-pressed={!filtered.includes(kind)}
                onClick={() => toggleKind(kind)}
              >
                <span className={styles.chipDot} aria-hidden="true" />
                {NODE_KIND_LABELS[kind].many}
                <span className={styles.chipCount}>{count}</span>
              </button>
            );
          })}
          <p className={styles.pathKey}>
            <span className={styles.pathSwatch} aria-hidden="true" />
            {visited.length > 1 ? 'Your path of observation' : 'Your path appears as you travel'}
          </p>
        </fieldset>

        <div className={styles.controls}>
          <button
            type="button"
            className={styles.control}
            onClick={() => scene?.zoomBy(0.75)}
            aria-label="Zoom in"
          >
            <Icon name="plus" size={16} />
          </button>
          <button
            type="button"
            className={styles.control}
            onClick={() => scene?.zoomBy(1.33)}
            aria-label="Zoom out"
          >
            <Icon name="minus" size={16} />
          </button>
          <button
            type="button"
            className={styles.control}
            onClick={() => scene?.home()}
            aria-label="Recentre the chart"
          >
            <Icon name="aperture" size={16} />
          </button>
          <button
            type="button"
            className={styles.listToggle}
            aria-expanded={listOpen}
            aria-controls="chart-list"
            onClick={() => setListOpen((open) => !open)}
          >
            <Icon name={listOpen ? 'close' : 'list'} size={15} />
            {listOpen ? 'Close the list' : 'List everything'}
          </button>
        </div>

        <section
          id="chart-list"
          className={styles.list}
          hidden={!listOpen}
          aria-label="Everything, as a list"
        >
          {NODE_KINDS.map((kind) => {
            const group = shown.filter((n) => n.kind === kind);
            return (
              <div key={kind} className={styles.listGroup}>
                <h2 className={styles.listTitle}>
                  {NODE_KIND_LABELS[kind].many} <span>{group.length}</span>
                </h2>
                <ul role="list">
                  {group.map((node) => (
                    <li key={node.id} style={{ '--label-line': `var(--line-${node.line})` } as CSSProperties}>
                      <TransitionLink to={node.path} line={node.line} className={styles.listLink}>
                        <span className={styles.listName}>{node.label}</span>
                        <span className={styles.listGloss}>{node.gloss}</span>
                        {observed.has(node.index) && (
                          <span className={styles.seen}>
                            <Icon name="check" size={12} /> observed
                          </span>
                        )}
                      </TransitionLink>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
}

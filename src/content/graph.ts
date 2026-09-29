import { createRng } from '../lib/random.ts';
import { eras } from './eras.ts';
import { instruments } from './instruments.ts';
import { RELIC_KIND_LABELS, relics } from './relics.ts';
import { places } from './routes.ts';
import { stories } from './stories.ts';
import type { SpectralKey } from './types.ts';
import { worlds } from './worlds.ts';

/**
 * The Chart of Everything Received: every place, world, age, relic, story and
 * instrument as a star, linked by meaning. Built from the content modules and
 * laid out by a deterministic force simulation, so the chart is the same for
 * every visitor and can be tested.
 */
export type NodeKind = 'place' | 'world' | 'era' | 'relic' | 'story' | 'instrument';

export interface ChartNode {
  index: number;
  id: string;
  kind: NodeKind;
  label: string;
  gloss: string;
  path: string;
  line: SpectralKey;
  /** Hidden places appear once the visitor has found them. */
  hidden: boolean;
  x: number;
  y: number;
  z: number;
  size: number;
}

export type EdgeKind = 'spine' | 'branch' | 'reference';

export interface ChartEdge {
  a: number;
  b: number;
  kind: EdgeKind;
}

export const NODE_KINDS: readonly NodeKind[] = ['place', 'world', 'era', 'relic', 'story', 'instrument'];

export const NODE_KIND_LABELS: Record<NodeKind, { one: string; many: string }> = {
  place: { one: 'Place', many: 'Places' },
  world: { one: 'World', many: 'Worlds' },
  era: { one: 'Age', many: 'Ages' },
  relic: { one: 'Relic', many: 'Relics' },
  story: { one: 'Transmission', many: 'Transmissions' },
  instrument: { one: 'Instrument', many: 'Instruments' },
};

const SIZES: Record<NodeKind, number> = { place: 2.6, world: 1.8, era: 1.6, relic: 1.15, story: 1.6, instrument: 1.6 };

type Draft = Omit<ChartNode, 'index' | 'x' | 'y' | 'z' | 'size'> & { parent: string | null };

function drafts(): Draft[] {
  const out: Draft[] = places.map((p) => ({
    id: `place:${p.id}`,
    kind: 'place',
    label: p.label,
    gloss: p.gloss,
    path: p.path,
    line: p.line,
    hidden: p.kind === 'hidden',
    parent: p.id === 'arrival' ? null : 'place:arrival',
  }));
  for (const w of worlds) {
    out.push({ id: `world:${w.id}`, kind: 'world', label: w.name, gloss: w.epithet, path: `/atlas/${w.id}`, line: w.line, hidden: false, parent: 'place:atlas' });
  }
  for (const e of eras) {
    out.push({ id: `era:${e.id}`, kind: 'era', label: e.name, gloss: e.subtitle, path: `/chronicle#${e.id}`, line: e.line, hidden: false, parent: 'place:chronicle' });
  }
  for (const r of relics) {
    out.push({
      id: `relic:${r.id}`,
      kind: 'relic',
      label: r.name,
      gloss: `${r.catalog} · ${RELIC_KIND_LABELS[r.kind]}`,
      path: `/archive/${r.id}`,
      line: r.line,
      hidden: false,
      parent: 'place:archive',
    });
  }
  for (const s of stories) {
    out.push({ id: `story:${s.slug}`, kind: 'story', label: s.title, gloss: s.subtitle, path: `/transmissions/${s.slug}`, line: s.line, hidden: false, parent: 'place:transmissions' });
  }
  for (const i of instruments) {
    out.push({ id: `instrument:${i.slug}`, kind: 'instrument', label: i.name, gloss: i.epithet, path: `/instruments/${i.slug}`, line: i.line, hidden: false, parent: 'place:instruments' });
  }
  return out;
}

function buildEdges(list: Draft[], index: Map<string, number>): ChartEdge[] {
  const edges: ChartEdge[] = [];
  const seen = new Set<string>();
  const link = (from: string, to: string, kind: EdgeKind): void => {
    const a = index.get(from);
    const b = index.get(to);
    if (a === undefined || b === undefined || a === b) return;
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ a, b, kind });
  };
  for (const node of list) if (node.parent) link(node.parent, node.id, node.parent === 'place:arrival' ? 'spine' : 'branch');
  // The ages form a timeline.
  eras.forEach((era, i) => {
    const next = eras[i + 1];
    if (next) link(`era:${era.id}`, `era:${next.id}`, 'reference');
  });
  for (const r of relics) {
    link(`relic:${r.id}`, `era:${r.era}`, 'reference');
    for (const other of r.related) link(`relic:${r.id}`, `relic:${other}`, 'reference');
  }
  for (const w of worlds) for (const r of w.relics) link(`world:${w.id}`, `relic:${r}`, 'reference');
  for (const s of stories) if (s.era) link(`story:${s.slug}`, `era:${s.era}`, 'reference');
  link('place:array', 'place:transmission-zero', 'reference');
  link('place:institute', 'place:credits', 'reference');
  link('place:map', 'place:settings', 'reference');
  return edges;
}

/** Cross-references are drawn but do not pull: the chart's shape is its hierarchy. */
const STIFFNESS: Record<EdgeKind, number> = { spine: 0.02, branch: 0.06, reference: 0 };

/** Radius of the ring of places around Arrival. */
const RING = 70;

/** Ring order: families alternate with single places so no side of the chart crowds. */
const RING_ORDER = ['atlas', 'array', 'chronicle', 'institute', 'archive', 'map', 'transmissions', 'settings', 'instruments', 'transmission-zero', 'credits'];

/**
 * Seeds positions — places on a ring, each given an arc of the circle in
 * proportion to its family, with its children fanned across that arc — then
 * relaxes them with springs, repulsion and a pull back to the seed.
 */
function layout(list: Draft[], edges: ChartEdge[]): { x: number; y: number }[] {
  const rng = createRng('chart-of-everything');
  const pos = list.map(() => ({ x: 0, y: 0 }));
  const anchor = list.map(() => ({ x: 0, y: 0 }));

  const children = new Map<string, Draft[]>();
  for (const node of list) {
    if (!node.parent || node.kind === 'place') continue;
    children.set(node.parent, [...(children.get(node.parent) ?? []), node]);
  }
  const weight = (id: string): number => 1.7 + 0.55 * (children.get(`place:${id}`)?.length ?? 0);
  const total = RING_ORDER.reduce((sum, id) => sum + weight(id), 0);
  const sector = new Map<string, { center: number; width: number }>();
  let cursor = -Math.PI / 2;
  for (const id of RING_ORDER) {
    const width = (weight(id) / total) * Math.PI * 2;
    sector.set(`place:${id}`, { center: cursor + width / 2, width });
    cursor += width;
  }

  const seeded = new Map<string, { x: number; y: number }>();
  for (const node of list) {
    const arc = sector.get(node.id);
    if (!arc) continue;
    seeded.set(node.id, { x: Math.cos(arc.center) * RING, y: Math.sin(arc.center) * RING });
  }
  // Each family fans outward around its own place, in rows, like a small constellation.
  for (const [parent, family] of children) {
    const arc = sector.get(parent);
    const origin = seeded.get(parent);
    if (!arc || !origin) continue;
    const rows = family.length > 16 ? 3 : family.length > 8 ? 2 : 1;
    const perRow = Math.ceil(family.length / rows);
    family.forEach((node, k) => {
      const row = Math.floor(k / perRow);
      const slot = k % perRow;
      const spread = Math.min(Math.PI * 1.15, 0.42 * perRow);
      const stagger = row % 2 ? spread / perRow / 2 : 0;
      const angle = arc.center + (perRow === 1 ? 0 : (slot / (perRow - 1) - 0.5) * spread) + stagger;
      const radius = 19 + row * 11;
      seeded.set(node.id, {
        x: origin.x + Math.cos(angle) * radius + rng.range(-0.8, 0.8),
        y: origin.y + Math.sin(angle) * radius + rng.range(-0.8, 0.8),
      });
    });
  }
  list.forEach((node, i) => {
    const p = seeded.get(node.id) ?? { x: 0, y: 0 };
    pos[i] = { ...p };
    anchor[i] = { ...p };
  });

  // Springs rest at their seeded lengths, so relaxation untangles without reshaping.
  const rest = edges.map((e) => {
    const a = anchor[e.a] as { x: number; y: number };
    const b = anchor[e.b] as { x: number; y: number };
    return Math.hypot(b.x - a.x, b.y - a.y);
  });
  const hold = list.map((node) => (node.kind === 'place' ? 0.6 : 0.05));
  const n = list.length;
  for (let step = 0; step < 320; step++) {
    const cool = 1 - step / 320;
    const fx = new Float64Array(n);
    const fy = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = (pos[j] as { x: number }).x - (pos[i] as { x: number }).x;
        const dy = (pos[j] as { y: number }).y - (pos[i] as { y: number }).y;
        const d2 = dx * dx + dy * dy + 0.01;
        if (d2 > 1600) continue;
        const f = 38 / d2;
        const d = Math.sqrt(d2);
        fx[i] = (fx[i] as number) - (dx / d) * f;
        fy[i] = (fy[i] as number) - (dy / d) * f;
        fx[j] = (fx[j] as number) + (dx / d) * f;
        fy[j] = (fy[j] as number) + (dy / d) * f;
      }
    }
    for (const [k, e] of edges.entries()) {
      const pa = pos[e.a] as { x: number; y: number };
      const pb = pos[e.b] as { x: number; y: number };
      const dx = pb.x - pa.x;
      const dy = pb.y - pa.y;
      const d = Math.sqrt(dx * dx + dy * dy) + 1e-6;
      const f = (d - (rest[k] as number)) * STIFFNESS[e.kind];
      fx[e.a] = (fx[e.a] as number) + (dx / d) * f;
      fy[e.a] = (fy[e.a] as number) + (dy / d) * f;
      fx[e.b] = (fx[e.b] as number) - (dx / d) * f;
      fy[e.b] = (fy[e.b] as number) - (dy / d) * f;
    }
    for (let i = 0; i < n; i++) {
      if (i === 0) continue; // Arrival holds the centre.
      const p = pos[i] as { x: number; y: number };
      const a = anchor[i] as { x: number; y: number };
      const ax = (a.x - p.x) * (hold[i] as number);
      const ay = (a.y - p.y) * (hold[i] as number);
      const mx = Math.max(-3, Math.min(3, (fx[i] as number) + ax));
      const my = Math.max(-3, Math.min(3, (fy[i] as number) + ay));
      p.x += mx * cool;
      p.y += my * cool;
    }
  }
  return pos;
}

function build(): { nodes: ChartNode[]; edges: ChartEdge[] } {
  const list = drafts();
  const index = new Map(list.map((d, i) => [d.id, i]));
  const edges = buildEdges(list, index);
  const pos = layout(list, edges);
  const depth = createRng('chart-depth');
  const nodes = list.map((d, i): ChartNode => {
    const p = pos[i] as { x: number; y: number };
    return {
      index: i,
      id: d.id,
      kind: d.kind,
      label: d.label,
      gloss: d.gloss,
      path: d.path,
      line: d.line,
      hidden: d.hidden,
      x: p.x,
      y: p.y,
      z: d.kind === 'place' ? 0 : depth.range(-4, 4),
      size: d.id === 'place:arrival' ? 3.4 : SIZES[d.kind],
    };
  });
  return { nodes, edges };
}

const chart = build();
export const chartNodes: readonly ChartNode[] = chart.nodes;
export const chartEdges: readonly ChartEdge[] = chart.edges;

/** The node a pathname belongs to (a relic page → its relic; /chronicle → the Chronicle). */
export function nodeForPath(pathname: string): ChartNode | undefined {
  const clean = pathname.split(/[?#]/)[0] ?? '/';
  return chartNodes.find((n) => n.path === clean) ?? chartNodes.find((n) => n.kind === 'place' && n.path === clean);
}

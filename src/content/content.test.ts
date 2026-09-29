import { describe, expect, it } from 'vitest';
import {
  DISH_COUNT,
  decoderLog,
  dishes,
  dishStates,
  lunarLight,
  sourcePointing,
  telemetry,
} from './array.ts';
import { eras } from './eras.ts';
import { FRAGMENT_TOTAL, fragments } from './fragments.ts';
import { chartEdges, chartNodes, nodeForPath } from './graph.ts';
import { instruments } from './instruments.ts';
import { relics } from './relics.ts';
import { channels } from './receiver.ts';
import { placeForPath, places } from './routes.ts';
import { notFoundEntry, pageEntries } from './seo.ts';
import { stories } from './stories.ts';
import { worlds } from './worlds.ts';

const unique = <T>(items: readonly T[]): boolean => new Set(items).size === items.length;

describe('the universe holds together', () => {
  it('has unique identifiers everywhere', () => {
    expect(unique(places.map((p) => p.id))).toBe(true);
    expect(unique(places.map((p) => p.path))).toBe(true);
    expect(unique(relics.map((r) => r.id))).toBe(true);
    expect(unique(relics.map((r) => r.catalog))).toBe(true);
    expect(unique(worlds.map((w) => w.id))).toBe(true);
    expect(unique(eras.map((e) => e.id))).toBe(true);
    expect(unique(stories.map((s) => s.slug))).toBe(true);
    expect(unique(instruments.map((i) => i.slug))).toBe(true);
  });

  it('only cross-references things that exist', () => {
    const relicIds = new Set(relics.map((r) => r.id));
    const eraIds = new Set(eras.map((e) => e.id));
    for (const relic of relics) {
      expect(eraIds.has(relic.era), `${relic.id} era ${relic.era}`).toBe(true);
      for (const other of relic.related) expect(relicIds.has(other), `${relic.id} → ${other}`).toBe(true);
    }
    for (const world of worlds)
      for (const r of world.relics) expect(relicIds.has(r), `${world.id} → ${r}`).toBe(true);
    for (const story of stories) if (story.era) expect(eraIds.has(story.era), story.slug).toBe(true);
  });

  it('keeps meta descriptions within search-result length', () => {
    for (const place of places) expect(place.description.length, place.id).toBeLessThanOrEqual(160);
  });

  it('resolves every place path back to its place', () => {
    for (const place of places) expect(placeForPath(place.path)?.id).toBe(place.id);
    expect(placeForPath('/archive/sr-0021')?.id).toBe('archive');
  });
});

describe('Transmission Zero', () => {
  it('has twelve distinct lines, numbered in order', () => {
    expect(fragments).toHaveLength(FRAGMENT_TOTAL);
    expect(fragments.map((f) => f.id)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
    expect(unique(fragments.map((f) => f.numeral))).toBe(true);
  });

  it('points every fragment at a real place (or nowhere in particular)', () => {
    for (const fragment of fragments) {
      if (fragment.where === 'anywhere' || fragment.where === '/lost') continue;
      expect(nodeForPath(fragment.where), fragment.where).toBeDefined();
    }
  });
});

describe('the chart of everything received', () => {
  it('contains every place and content item exactly once', () => {
    expect(unique(chartNodes.map((n) => n.id))).toBe(true);
    expect(chartNodes).toHaveLength(
      places.length + worlds.length + eras.length + relics.length + stories.length + instruments.length,
    );
  });

  it('links only real nodes, never a node to itself', () => {
    for (const edge of chartEdges) {
      expect(chartNodes[edge.a]).toBeDefined();
      expect(chartNodes[edge.b]).toBeDefined();
      expect(edge.a).not.toBe(edge.b);
    }
  });

  it('lays out deterministically, with finite, distinct positions', () => {
    for (const node of chartNodes) {
      expect(Number.isFinite(node.x) && Number.isFinite(node.y)).toBe(true);
    }
    for (let i = 0; i < chartNodes.length; i++) {
      for (let j = i + 1; j < chartNodes.length; j++) {
        const a = chartNodes[i];
        const b = chartNodes[j];
        if (!a || !b) continue;
        expect(Math.hypot(a.x - b.x, a.y - b.y), `${a.id} / ${b.id}`).toBeGreaterThan(2);
      }
    }
  });
});

describe('the Halden Deep Array', () => {
  const date = new Date('2026-09-30T04:12:00Z');

  it('has sixty-four uniquely named dishes', () => {
    expect(dishes).toHaveLength(DISH_COUNT);
    expect(DISH_COUNT).toBe(64);
    expect(unique(dishes.map((d) => d.id))).toBe(true);
  });

  it('agrees with itself: the same moment gives the same state', () => {
    expect(dishStates(date)).toEqual(dishStates(new Date(date)));
    expect(decoderLog(date, 5)).toEqual(decoderLog(new Date(date), 5));
    expect(telemetry(date)).toEqual(telemetry(new Date(date)));
  });

  it('keeps the first dish always on source', () => {
    for (let h = 0; h < 72; h += 1) {
      expect(dishStates(new Date(date.getTime() + h * 3_600_000))[0]).toBe('tracking');
    }
  });

  it('reports finite, plausible telemetry', () => {
    const t = telemetry(date);
    for (const value of Object.values(t)) expect(Number.isFinite(value)).toBe(true);
    expect(t.snr).toBeGreaterThan(5);
    expect(t.streamFraction).toBeGreaterThan(0.08);
    expect(t.streamFraction).toBeLessThan(0.09);
    expect(t.tracking).toBeLessThanOrEqual(DISH_COUNT);
  });

  it('keeps the Lacuna above the horizon', () => {
    for (let d = 0; d < 28; d += 0.5) {
      expect(sourcePointing(new Date(date.getTime() + d * 86_400_000)).el).toBeGreaterThan(0);
    }
  });

  it('follows the real lunar day: noon at new Moon, night at full Moon', () => {
    // 2026-09-11 was a new Moon; 2026-09-26 a full Moon.
    const noon = lunarLight(new Date('2026-09-11T04:00:00Z'));
    const midnight = lunarLight(new Date('2026-09-26T17:00:00Z'));
    expect(noon.day).toBe(true);
    expect(noon.sun.el).toBeGreaterThan(70);
    expect(midnight.day).toBe(false);
    expect(midnight.surfaceTemperature).toBeLessThan(-100);
  });

  it('spreads the receiver channels across the visible band', () => {
    expect(channels).toHaveLength(7);
    for (const c of channels) {
      expect(c.hz).toBeGreaterThan(0);
      expect(c.hz).toBeLessThan(2048);
    }
  });
});

describe('prerendered pages', () => {
  const pages = pageEntries();

  it('covers every public route once', () => {
    expect(unique(pages.map((p) => p.path))).toBe(true);
    for (const place of places)
      expect(
        pages.some((p) => p.path === place.path),
        place.path,
      ).toBe(true);
    expect(pages).toHaveLength(
      places.length + worlds.length + relics.length + stories.length + instruments.length,
    );
  });

  it('gives every page a title, a description and real content', () => {
    for (const page of [...pages, notFoundEntry]) {
      expect(page.title.length, page.path).toBeGreaterThan(2);
      expect(page.description.length, page.path).toBeGreaterThan(20);
      expect(page.description.length, page.path).toBeLessThanOrEqual(160);
      expect(page.paragraphs.length, page.path).toBeGreaterThan(0);
      for (const p of page.paragraphs) expect(p, page.path).not.toMatch(/\{years\}|\{year\}/);
    }
  });
});

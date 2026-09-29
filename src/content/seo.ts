import { resolveStoryText } from '../lib/storyText.ts';
import { eras } from './eras.ts';
import { pipeline, principles, questions } from './institute.ts';
import { instruments } from './instruments.ts';
import { relics } from './relics.ts';
import { places, SITE_TITLE_SUFFIX } from './routes.ts';
import { stories } from './stories.ts';
import { world } from './world.ts';
import { worlds } from './worlds.ts';

/**
 * Every addressable page, with the metadata and plain text the build writes
 * into its prerendered HTML: crawlers, link previews and visitors without
 * JavaScript all receive real content, not an empty shell.
 */
export interface PageEntry {
  path: string;
  title: string;
  description: string;
  /** Plain-text content for the prerendered body: a heading, then paragraphs. */
  heading: string;
  paragraphs: readonly string[];
  /** Pages the body links to. */
  links: readonly { path: string; label: string }[];
}

const trim = (text: string, max = 160): string => (text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`);

const primaryLinks = places.filter((p) => p.kind !== 'hidden').map((p) => ({ path: p.path, label: p.label }));

function placePage(id: string, paragraphs: readonly string[], links: PageEntry['links'] = primaryLinks): PageEntry {
  const place = places.find((p) => p.id === id);
  if (!place) throw new Error(`Unknown place "${id}"`);
  return { path: place.path, title: place.title, description: place.description, heading: place.title, paragraphs, links };
}

export function pageEntries(): PageEntry[] {
  const pages: PageEntry[] = [
    placePage('arrival', [
      world.tagline,
      `${world.definition.word} (${world.definition.partOfSpeech}): ${world.definition.sense}`,
      `In 2236 the ${world.array} on the far side of the Moon turned toward a region of ${world.constellation} that contained nothing, and found light arriving in patterns: the ${world.signal}, sent by ${world.civilization} of the star ${world.star}, ${world.distanceLightYears.toLocaleString('en')} light-years away.`,
    ]),
    placePage(
      'atlas',
      worlds.map((w) => `${w.name} — ${w.epithet}. ${w.summary}`),
      worlds.map((w) => ({ path: `/atlas/${w.id}`, label: w.name })),
    ),
    placePage(
      'chronicle',
      eras.map((e) => `${e.name} (${e.span}) — ${e.summary}`),
    ),
    placePage(
      'archive',
      relics.map((r) => `${r.catalog} · ${r.name} — ${r.summary}`),
      relics.map((r) => ({ path: `/archive/${r.id}`, label: `${r.name} (${r.catalog})` })),
    ),
    placePage(
      'transmissions',
      stories.map((s) => `${s.title} — ${s.subtitle}. ${resolveStoryText(s.excerpt)}`),
      stories.map((s) => ({ path: `/transmissions/${s.slug}`, label: s.title })),
    ),
    placePage(
      'instruments',
      instruments.map((i) => `${i.name} — ${i.summary}`),
      instruments.map((i) => ({ path: `/instruments/${i.slug}`, label: i.name })),
    ),
    placePage('array', [
      `Live telemetry from the ${world.array} in ${world.arraySite}: sixty-four dishes tracking the Lacuna, a real-time spectrogram of the seven-line carrier, and a decoder log. Lunar day and night follow the real Moon.`,
    ]),
    placePage('institute', [
      ...pipeline.map((step) => `${step.name} (${step.where}): ${step.text}`),
      ...principles.map((p) => `${p.title} ${p.text}`),
      ...questions.map((q) => `${q.q} ${q.a}`),
    ]),
    placePage('map', ['Every place, world, age, relic and transmission in the observatory as a navigable constellation, with your own path of observation traced in light.']),
    placePage('settings', ['Motion, graphics quality, sound, theme, contrast, cursor and film grain — every preference stays on your device.']),
    placePage('transmission-zero', [
      'Twelve lines repeated at the head of the Serein Signal every nine hours, seventeen minutes and twenty-three seconds. Each line is decoded somewhere in the observatory.',
    ]),
    placePage('credits', [`${world.name} is a work of fiction. The Ithra, the Institute and the Serein Signal are invented; the sky they live in is real.`]),
  ];

  for (const w of worlds) {
    pages.push({
      path: `/atlas/${w.id}`,
      title: `${w.name} — Atlas`,
      description: trim(w.summary),
      heading: `${w.name}, ${w.epithet}`,
      paragraphs: [w.summary, ...w.body, ...w.facts.map((f) => `${f.label}: ${f.value}`)],
      links: [{ path: '/atlas', label: 'The Atlas of the Vael System' }],
    });
  }
  for (const r of relics) {
    pages.push({
      path: `/archive/${r.id}`,
      title: `${r.name} (${r.catalog}) — Archive`,
      description: trim(r.summary),
      heading: `${r.name} — ${r.catalog}`,
      paragraphs: [r.summary, ...r.description, r.notes, `Integrity ${r.integrity}%. ${r.material}. ${r.dimensions}.`],
      links: [{ path: '/archive', label: 'The Archive' }, ...r.related.map((id) => ({ path: `/archive/${id}`, label: id.toUpperCase() }))],
    });
  }
  for (const s of stories) {
    pages.push({
      path: `/transmissions/${s.slug}`,
      title: `${s.title} — Transmissions`,
      description: trim(resolveStoryText(s.excerpt)),
      heading: s.title,
      paragraphs: [
        s.subtitle,
        ...s.blocks.flatMap((b) => ('text' in b ? [resolveStoryText(b.text)] : 'caption' in b ? [b.caption] : [])),
      ],
      links: [{ path: '/transmissions', label: 'All transmissions' }],
    });
  }
  for (const i of instruments) {
    pages.push({
      path: `/instruments/${i.slug}`,
      title: `${i.name} — Instruments`,
      description: trim(i.summary),
      heading: `${i.name} — ${i.epithet}`,
      paragraphs: [i.summary, i.principle, i.lore],
      links: [{ path: '/instruments', label: 'All instruments' }],
    });
  }
  return pages;
}

/** The 404 page: rendered once and served for every unknown address. */
export const notFoundEntry: PageEntry = {
  path: '/404',
  title: 'Signal lost',
  description: 'Nothing in the observatory answers to this address — but something is on the frequency.',
  heading: 'Off the chart',
  paragraphs: ['Nothing in the observatory answers to this address.'],
  links: primaryLinks,
};

export const fullTitle = (title: string): string => `${title} — ${SITE_TITLE_SUFFIX}`;

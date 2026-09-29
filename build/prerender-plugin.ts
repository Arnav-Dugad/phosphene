import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';
import { fullTitle, notFoundEntry, pageEntries, type PageEntry } from '../src/content/seo.ts';
import { world } from '../src/content/world.ts';

/** The production origin; override with VITE_SITE_URL for other deployments. */
export const DEFAULT_SITE_URL = 'https://phosphene.arnavrival12.workers.dev';

const escape = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** JSON for a <script> data block: `<` is escaped so no string can close the element. */
const jsonForScript = (value: unknown): string => JSON.stringify(value).replace(/</g, '\\u003c');

export function renderHead(entry: PageEntry, site: string): string {
  const url = `${site}${entry.path === '/' ? '/' : entry.path}`;
  const title = escape(fullTitle(entry.title));
  const description = escape(entry.description);
  const image = `${site}/og.png`;
  const structured = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${site}/#website`,
        name: world.name,
        alternateName: world.tagline,
        url: `${site}/`,
        description:
          'An interactive work of science fiction: an observatory decoding the last transmission of a vanished civilization.',
        inLanguage: 'en',
      },
      {
        '@type': 'WebPage',
        '@id': `${url}#page`,
        url,
        name: fullTitle(entry.title),
        description: entry.description,
        isPartOf: { '@id': `${site}/#website` },
        genre: 'Science fiction',
        inLanguage: 'en',
        primaryImageOfPage: image,
      },
    ],
  };
  return [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}" />`,
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${world.name}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${image}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="A luminous ring of light over a black sea — the Lacuna, as the Halden Deep Array receives it." />`,
    `<meta property="og:locale" content="en_GB" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    `<meta name="twitter:image" content="${image}" />`,
    `<script type="application/ld+json">${jsonForScript(structured)}</script>`,
  ].join('\n    ');
}

/** Real content for crawlers and visitors without JavaScript; React replaces it on mount. */
export function renderBody(entry: PageEntry): string {
  const paragraphs = entry.paragraphs.map((p) => `<p>${escape(p)}</p>`).join('');
  const links = entry.links
    .map((l) => `<li><a href="${escape(l.path)}">${escape(l.label)}</a></li>`)
    .join('');
  return `<article class="prerender"><h1>${escape(entry.heading)}</h1>${paragraphs}<nav aria-label="Places"><ul>${links}</ul></nav></article>`;
}

function fileFor(path: string): string {
  // Cloudflare's asset handling and Vercel's cleanUrls both serve /a/b from a/b.html.
  return path === '/' ? 'index.html' : `${path.slice(1)}.html`;
}

/** In development, the served index.html gets the requested page's head and body too. */
export function devHead(): Plugin {
  return {
    name: 'phosphene-dev-head',
    apply: 'serve',
    transformIndexHtml(html, ctx) {
      const path = (ctx.originalUrl ?? '/').split(/[?#]/)[0] ?? '/';
      const entry = pageEntries().find((p) => p.path === path) ?? notFoundEntry;
      const site = (process.env.VITE_SITE_URL ?? DEFAULT_SITE_URL).replace(/\/$/, '');
      return html
        .replace('<!--app-head-->', renderHead(entry, site))
        .replace('<!--app-body-->', renderBody(entry));
    },
  };
}

/**
 * After the build: writes one HTML file per page (with its own title,
 * description, canonical URL, Open Graph and structured data), a 404 page,
 * the sitemap and robots.txt.
 */
export function prerender(): Plugin {
  let config: ResolvedConfig;
  return {
    name: 'phosphene-prerender',
    apply: 'build',
    configResolved(resolved) {
      config = resolved;
    },
    closeBundle() {
      const outDir = resolve(config.root, config.build.outDir);
      const site = (process.env.VITE_SITE_URL ?? DEFAULT_SITE_URL).replace(/\/$/, '');
      const template = readFileSync(resolve(outDir, 'index.html'), 'utf8');
      const render = (entry: PageEntry): string =>
        template
          .replace('<!--app-head-->', renderHead(entry, site))
          .replace('<!--app-body-->', renderBody(entry));

      const pages = pageEntries();
      for (const entry of pages) {
        const file = resolve(outDir, fileFor(entry.path));
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, render(entry));
      }
      writeFileSync(resolve(outDir, '404.html'), render(notFoundEntry));

      const today = new Date().toISOString().slice(0, 10);
      const urls = pages
        .map(
          (p) => `  <url><loc>${site}${p.path === '/' ? '/' : p.path}</loc><lastmod>${today}</lastmod></url>`,
        )
        .join('\n');
      writeFileSync(
        resolve(outDir, 'sitemap.xml'),
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
      );
      writeFileSync(
        resolve(outDir, 'robots.txt'),
        `User-agent: *\nAllow: /\n\nSitemap: ${site}/sitemap.xml\n`,
      );
      config.logger.info(
        `prerendered ${pages.length} pages, 404.html, sitemap.xml and robots.txt for ${site}`,
      );
    },
  };
}

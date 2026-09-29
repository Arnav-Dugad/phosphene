import { describe, expect, it } from 'vitest';
import type { PageEntry } from '../src/content/seo.ts';
import { renderBody, renderHead } from './prerender-plugin.ts';

const site = 'https://example.test';

const entry: PageEntry = {
  path: '/archive/sr-0021',
  title: 'The Lantern <Ossa> & “Waits”',
  description: 'A lantern that waited "sixty years".',
  heading: 'Ossa',
  paragraphs: ['<script>alert(1)</script>'],
  links: [{ path: '/archive', label: 'The Archive' }],
};

describe('prerendered head', () => {
  const head = renderHead(entry, site);

  it('writes the title, canonical and social cards', () => {
    expect(head).toContain('<title>The Lantern &lt;Ossa&gt; &amp; “Waits” — PHOSPHENE</title>');
    expect(head).toContain('<link rel="canonical" href="https://example.test/archive/sr-0021" />');
    expect(head).toContain('property="og:image" content="https://example.test/og.png"');
    expect(head).toContain('name="twitter:card" content="summary_large_image"');
  });

  it('escapes attribute values', () => {
    expect(head).toContain('content="A lantern that waited &quot;sixty years&quot;."');
  });

  it('keeps structured data inert inside its script element', () => {
    const json = /<script type="application\/ld\+json">(.*)<\/script>/.exec(head)?.[1] ?? '';
    expect(json).not.toContain('<');
    const data = JSON.parse(json) as { '@graph': { '@type': string }[] };
    expect(data['@graph'].map((n) => n['@type'])).toEqual(['WebSite', 'WebPage']);
  });

  it('canonicalises the home page with a trailing slash', () => {
    expect(renderHead({ ...entry, path: '/' }, site)).toContain('href="https://example.test/"');
  });
});

describe('prerendered body', () => {
  it('escapes content and links onward', () => {
    const body = renderBody(entry);
    expect(body).toContain('&lt;script&gt;');
    expect(body).not.toContain('<script>');
    expect(body).toContain('<a href="/archive">The Archive</a>');
  });
});

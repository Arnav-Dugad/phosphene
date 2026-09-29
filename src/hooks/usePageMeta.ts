import { useEffect } from 'react';
import { placeById, SITE_TITLE_SUFFIX } from '../content/routes.ts';

interface Meta {
  title: string;
  description?: string;
}

function setMeta(name: string, content: string, attr: 'name' | 'property' = 'name'): void {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

/**
 * Keeps the document title and descriptive meta in sync during client-side
 * navigation. (Crawlers receive the same values from the prerendered HTML.)
 */
export function usePageMeta(meta: Meta | string): void {
  const resolved: Meta = typeof meta === 'string' ? placeById(meta) : meta;
  const { title, description } = resolved;
  useEffect(() => {
    const full = `${title} — ${SITE_TITLE_SUFFIX}`;
    document.title = full;
    setMeta('og:title', full, 'property');
    if (description) {
      setMeta('description', description);
      setMeta('og:description', description, 'property');
    }
    const canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (canonical) canonical.href = new URL(window.location.pathname, canonical.href).href;
  }, [title, description]);
}

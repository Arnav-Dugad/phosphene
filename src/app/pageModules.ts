import type { ComponentType } from 'react';
import { placeForPath } from '../content/routes.ts';
import { prefetchScene } from '../engine/scenes/registry.ts';

type PageModule = () => Promise<{ default: ComponentType }>;

/**
 * Page chunks, keyed by top-level place. The router lazy-loads from here and
 * links prefetch from here on hover/focus, so intent warms the exact chunk.
 */
export const pageModules = {
  arrival: () => import('../pages/home/HomePage.tsx'),
  atlas: () => import('../pages/atlas/AtlasPage.tsx'),
  chronicle: () => import('../pages/chronicle/ChroniclePage.tsx'),
  archive: () => import('../pages/archive/ArchivePage.tsx'),
  relic: () => import('../pages/archive/RelicPage.tsx'),
  transmissions: () => import('../pages/transmissions/TransmissionsPage.tsx'),
  story: () => import('../pages/transmissions/StoryPage.tsx'),
  instruments: () => import('../pages/instruments/InstrumentsPage.tsx'),
  instrument: () => import('../pages/instruments/InstrumentPage.tsx'),
  notFound: () => import('../pages/not-found/NotFoundPage.tsx'),
} satisfies Record<string, PageModule>;

const warmed = new Set<string>();

export function prefetchPath(path: string): void {
  const place = placeForPath(path.split(/[?#]/)[0] ?? '/');
  if (!place || warmed.has(place.id)) return;
  warmed.add(place.id);
  const loader = (pageModules as Record<string, PageModule | undefined>)[place.id];
  void loader?.().catch(() => warmed.delete(place.id));
  prefetchScene(place.scene);
}

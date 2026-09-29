import type { ComponentType } from 'react';
import { createBrowserRouter, type RouteObject } from 'react-router';
import { pageModules } from './pageModules.ts';
import { RootLayout } from './RootLayout.tsx';
import { RouteFallback } from './RouteFallback.tsx';

const page =
  (load: () => Promise<{ default: ComponentType }>) =>
  async (): Promise<{ Component: ComponentType }> => ({ Component: (await load()).default });

const routes: RouteObject[] = [
  {
    path: '/',
    Component: RootLayout,
    HydrateFallback: RouteFallback,
    children: [
      { index: true, lazy: page(pageModules.arrival) },
      { path: 'atlas/:world?', lazy: page(pageModules.atlas), handle: { footer: false } },
      { path: 'chronicle', lazy: page(pageModules.chronicle) },
      { path: 'archive', lazy: page(pageModules.archive) },
      { path: 'archive/:id', lazy: page(pageModules.relic), handle: { footer: false } },
      { path: 'transmissions', lazy: page(pageModules.transmissions) },
      { path: 'transmissions/:slug', lazy: page(pageModules.story) },
      { path: 'instruments', lazy: page(pageModules.instruments) },
      { path: 'instruments/:slug', lazy: page(pageModules.instrument), handle: { footer: false } },
      { path: 'array', lazy: page(pageModules.array), handle: { footer: false } },
      { path: 'map', lazy: page(pageModules.map), handle: { footer: false } },
      { path: 'institute', lazy: page(pageModules.institute) },
      { path: 'settings', lazy: page(pageModules.settings) },
      { path: 'transmission-zero', lazy: page(pageModules['transmission-zero']) },
      { path: 'credits', lazy: page(pageModules.credits), handle: { footer: false } },
      { path: '*', lazy: page(pageModules.notFound), handle: { footer: false } },
    ],
  },
];

export const router = createBrowserRouter(routes);

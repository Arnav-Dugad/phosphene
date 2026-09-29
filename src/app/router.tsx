import type { ComponentType } from 'react';
import { createBrowserRouter, type RouteObject } from 'react-router';
import { pageModules } from './pageModules.ts';
import { RootLayout } from './RootLayout.tsx';

const page =
  (load: () => Promise<{ default: ComponentType }>) =>
  async (): Promise<{ Component: ComponentType }> => ({ Component: (await load()).default });

/** The static boot screen from index.html stays visible until the first route resolves. */
function BootHold() {
  return null;
}

const routes: RouteObject[] = [
  {
    path: '/',
    Component: RootLayout,
    HydrateFallback: BootHold,
    children: [
      { index: true, lazy: page(pageModules.arrival) },
      { path: 'atlas/:world?', lazy: page(pageModules.atlas), handle: { footer: false } },
      { path: '*', lazy: page(pageModules.notFound) },
    ],
  },
];

export const router = createBrowserRouter(routes);

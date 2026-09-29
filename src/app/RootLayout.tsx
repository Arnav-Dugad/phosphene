import { useEffect, useRef } from 'react';
import { NavigationType, Outlet, useLocation, useMatches, useNavigationType } from 'react-router';
import { placeForPath } from '../content/routes.ts';
import { RouteAnnouncer } from '../features/a11y/RouteAnnouncer.tsx';
import { AudioController } from '../features/audio/AudioController.tsx';
import { CommandPalette } from '../features/command/CommandPalette.tsx';
import { Cursor } from '../features/cursor/Cursor.tsx';
import { SiteFooter } from '../features/footer/SiteFooter.tsx';
import { Grain } from '../features/grain/Grain.tsx';
import { Hud } from '../features/hud/Hud.tsx';
import { Intro } from '../features/intro/Intro.tsx';
import { KeyboardShortcuts } from '../features/keyboard/KeyboardShortcuts.tsx';
import { Header } from '../features/nav/Header.tsx';
import { SiteIndex } from '../features/nav/SiteIndex.tsx';
import { Preferences } from '../features/preferences/Preferences.tsx';
import { startScroller, stopScroller } from '../features/scroll/scroller.ts';
import { Stage } from '../features/stage/Stage.tsx';
import { Toasts } from '../features/toasts/Toasts.tsx';
import { isDirectorNavigating } from '../features/transition/director.ts';
import { TransitionLayer } from '../features/transition/TransitionLayer.tsx';
import { useResolvedMotion } from '../hooks/useResolvedMotion.ts';
import { useProgress } from '../stores/progress.ts';
import styles from './RootLayout.module.css';

/** Route-level options, declared through React Router's `handle`. */
export interface RouteHandle {
  /** Full-screen experiences (instruments, the Map) omit the site footer. */
  footer?: boolean;
}

export function RootLayout() {
  const worldRef = useRef<HTMLDivElement>(null);
  const motion = useResolvedMotion();
  const location = useLocation();
  const navigationType = useNavigationType();
  const matches = useMatches();
  const showFooter = !matches.some((m) => (m.handle as RouteHandle | undefined)?.footer === false);

  useEffect(() => {
    useProgress.getState().beginSession();
  }, []);

  useEffect(() => {
    startScroller(motion);
    return stopScroller;
  }, [motion]);

  // Record the observation path and colour the chrome by the place's spectral line.
  useEffect(() => {
    const place = placeForPath(location.pathname);
    useProgress.getState().visit(location.pathname);
    document.documentElement.style.setProperty('--page-line', `var(--line-${place?.line ?? 'na'})`);
  }, [location.pathname]);

  // Back/forward navigations skip the blink; the world resolves in softly instead.
  useEffect(() => {
    const world = worldRef.current;
    if (!world || navigationType !== NavigationType.Pop || isDirectorNavigating() || motion === 'still') return;
    world.animate([{ opacity: 0.2, filter: 'blur(6px)' }, { opacity: 1, filter: 'blur(0px)' }], {
      duration: 520,
      easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
    });
  }, [location.pathname, navigationType, motion]);

  return (
    <>
      <Preferences />
      <AudioController />
      <KeyboardShortcuts />
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div ref={worldRef} className={styles.world}>
        <Stage />
        <main id="main" className={styles.main} tabIndex={-1}>
          <Outlet />
        </main>
        {showFooter && <SiteFooter />}
      </div>
      <Grain />
      <Hud />
      <Header />
      <SiteIndex />
      <CommandPalette />
      <Toasts />
      <TransitionLayer worldRef={worldRef} />
      <Intro />
      <Cursor />
      <RouteAnnouncer />
    </>
  );
}

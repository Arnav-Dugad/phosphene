import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigationType } from 'react-router';
import { isDirectorNavigating } from '../transition/director.ts';
import styles from './RouteAnnouncer.module.css';

/**
 * After each navigation: announce the new page title politely and move focus
 * to its first heading (never on initial load, which would steal focus).
 */
export function RouteAnnouncer() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const [message, setMessage] = useState('');
  // Compare paths rather than using a "first run" flag: StrictMode re-runs effects.
  const previous = useRef(location.pathname);

  useEffect(() => {
    if (previous.current === location.pathname) return;
    // Wait for the page to render its heading and set the title. The path is only
    // committed once this actually runs, so a cancelled StrictMode pass retries.
    const id = window.setTimeout(
      () => {
        previous.current = location.pathname;
        const heading = document.querySelector<HTMLElement>('main h1');
        setMessage(`Now viewing: ${document.title.replace(/\s+—\s+PHOSPHENE$/, '')}`);
        if (heading) {
          if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
          heading.focus({ preventScroll: true });
        }
      },
      isDirectorNavigating() ? 0 : 60,
    );
    return () => window.clearTimeout(id);
  }, [location.pathname, navigationType]);

  return (
    <div className={styles.announcer} role="status" aria-live="polite" aria-atomic="true">
      {message}
    </div>
  );
}

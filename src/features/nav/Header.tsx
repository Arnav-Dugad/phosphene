import { useEffect, useState, type CSSProperties } from 'react';
import { useLocation } from 'react-router';
import { FlareText } from '../../components/FlareText.tsx';
import { Icon } from '../../components/Icon.tsx';
import { TransitionLink } from '../../components/TransitionLink.tsx';
import { Wordmark } from '../../components/Wordmark.tsx';
import { placeForPath, primaryPlaces } from '../../content/routes.ts';
import { useNow } from '../../hooks/useNow.ts';
import { isMac } from '../../lib/device.ts';
import { formatOstClock } from '../../lib/time.ts';
import { useUi } from '../../stores/ui.ts';
import styles from './Header.module.css';
import { SoundToggle } from './SoundToggle.tsx';

const NAV = primaryPlaces.filter((p) => p.id !== 'arrival' && p.id !== 'institute');

function OstClock() {
  const now = useNow();
  return (
    <span className={styles.clock} title="Observatory Standard Time (UTC + 300 years)">
      <span className={styles.clockLabel}>OST</span>
      <time dateTime={new Date(now).toISOString()} className="t-numeric">
        {formatOstClock(new Date(now))}
      </time>
    </span>
  );
}

/** Hides on downward travel, returns on the way back up. */
function useAutoHide(disabled: boolean): boolean {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (disabled) return;
    let last = window.scrollY;
    const onScroll = (): void => {
      const y = window.scrollY;
      const delta = y - last;
      if (Math.abs(delta) < 6) return;
      setHidden(delta > 0 && y > 140);
      last = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [disabled]);
  return hidden && !disabled;
}

export function Header() {
  const location = useLocation();
  const active = placeForPath(location.pathname);
  const menuOpen = useUi((s) => s.menuOpen);
  const setMenu = useUi((s) => s.setMenu);
  const setPalette = useUi((s) => s.setPalette);
  const hidden = useAutoHide(menuOpen);
  const mac = isMac();

  return (
    <header className={styles.header} data-hidden={hidden} data-print="hide">
      <div className={styles.inner}>
        <TransitionLink to="/" className={styles.brand} aria-label="PHOSPHENE — Arrival" data-cursor-label="Arrival">
          <Wordmark />
        </TransitionLink>

        <nav className={styles.nav} aria-label="Primary">
          <ul role="list" className={styles.list}>
            {NAV.map((place) => {
              const current = active?.id === place.id;
              return (
                <li key={place.id}>
                  <TransitionLink
                    to={place.path}
                    className={styles.link}
                    aria-current={current ? 'page' : undefined}
                    data-magnetic
                    style={{ '--link-line': `var(--line-${place.line})` } as CSSProperties}
                  >
                    <FlareText text={place.label} />
                  </TransitionLink>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className={styles.tools}>
          <OstClock />
          <SoundToggle />
          <button
            type="button"
            className={styles.command}
            onClick={() => setPalette(true)}
            aria-label="Open the console (command palette)"
            aria-keyshortcuts={mac ? 'Meta+K' : 'Control+K'}
            data-cursor-label="Console"
          >
            <Icon name="command" size={15} />
            <kbd className={styles.kbd}>{mac ? '⌘K' : 'Ctrl K'}</kbd>
          </button>
          <button
            type="button"
            className={styles.menuButton}
            onClick={() => setMenu(!menuOpen)}
            aria-expanded={menuOpen}
            aria-controls="site-index"
            data-cursor-label={menuOpen ? 'Close' : 'Index'}
          >
            <span className={styles.menuLabel}>{menuOpen ? 'Close' : 'Index'}</span>
            <span className={styles.menuGlyph} data-open={menuOpen} aria-hidden="true">
              <span />
              <span />
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}

import { useEffect, useRef, type CSSProperties } from 'react';
import { useLocation } from 'react-router';
import { Icon } from '../../components/Icon.tsx';
import { TransitionLink } from '../../components/TransitionLink.tsx';
import { Wordmark } from '../../components/Wordmark.tsx';
import { FRAGMENT_TOTAL, fragments } from '../../content/fragments.ts';
import { placeForPath, primaryPlaces, utilityPlaces } from '../../content/routes.ts';
import { world } from '../../content/world.ts';
import { cssEase } from '../../design/motion.ts';
import { useResolvedMotion } from '../../hooks/useResolvedMotion.ts';
import { formatDeclination, formatRightAscension, pad } from '../../lib/format.ts';
import { useProgress } from '../../stores/progress.ts';
import { useSettings } from '../../stores/settings.ts';
import { useUi } from '../../stores/ui.ts';
import { audio } from '../audio/AudioEngine.ts';
import { lockScroll } from '../scroll/scroller.ts';
import { SoundToggle } from './SoundToggle.tsx';
import styles from './SiteIndex.module.css';

/**
 * The Index: every place in the observatory, opened like an aperture from the
 * menu button. A native modal <dialog> provides focus containment, Escape and
 * inertness of the page behind it.
 */
export function SiteIndex() {
  const open = useUi((s) => s.menuOpen);
  const setMenu = useUi((s) => s.setMenu);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const motion = useResolvedMotion();
  const location = useLocation();
  const active = placeForPath(location.pathname);
  const found = useProgress((s) => s.fragments);
  const theme = useSettings((s) => s.theme);
  const setSetting = useSettings((s) => s.set);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const origin = 'circle(0px at calc(100% - 3rem) 2.2rem)';
    const full = 'circle(150% at calc(100% - 3rem) 2.2rem)';
    if (open && !dialog.open) {
      dialog.showModal();
      lockScroll(true);
      audio.play('open');
      if (motion !== 'still') {
        dialog.animate([{ clipPath: origin }, { clipPath: full }], { duration: 820, easing: cssEase.out });
      }
    } else if (!open && dialog.open) {
      audio.play('close');
      const finish = (): void => {
        dialog.close();
        lockScroll(false);
      };
      if (motion === 'still') finish();
      else {
        dialog
          .animate([{ clipPath: full }, { clipPath: origin }], { duration: 460, easing: cssEase.in })
          .finished.then(finish, finish);
      }
    }
  }, [open, motion]);

  // Close when navigation happens from inside.
  useEffect(() => {
    setMenu(false);
  }, [location.pathname, setMenu]);

  const decoded = Object.keys(found).length;

  return (
    <dialog
      ref={dialogRef}
      id="site-index"
      className={styles.dialog}
      aria-label="Site index"
      onCancel={(e) => {
        e.preventDefault();
        setMenu(false);
      }}
    >
      <div className={styles.frame}>
        <div className={styles.top}>
          <TransitionLink to="/" className={styles.brand} aria-label="PHOSPHENE — Arrival">
            <Wordmark />
          </TransitionLink>
          <button
            type="button"
            className={styles.close}
            onClick={() => setMenu(false)}
            data-cursor-label="Close"
          >
            <span className={styles.closeLabel}>Close</span>
            <Icon name="close" size={18} />
          </button>
        </div>

        <nav className={styles.places} aria-label="All places">
          <ol role="list" className={styles.list}>
            {primaryPlaces.map((place, i) => (
              <li
                key={place.id}
                className={styles.item}
                style={{ '--item-line': `var(--line-${place.line})`, '--i': i } as CSSProperties}
              >
                <TransitionLink
                  to={place.path}
                  className={styles.link}
                  aria-current={active?.id === place.id ? 'page' : undefined}
                  onClick={() => setMenu(false)}
                >
                  <span className={styles.index}>{pad(place.index)}</span>
                  <span className={styles.label}>{place.label}</span>
                  <span className={styles.gloss}>{place.gloss}</span>
                </TransitionLink>
              </li>
            ))}
          </ol>
        </nav>

        <aside className={styles.aside} aria-label="Observatory status">
          <div className={styles.block}>
            <p className="t-kicker">Also</p>
            <ul role="list" className={styles.utilities}>
              {utilityPlaces.map((place) => (
                <li key={place.id}>
                  <TransitionLink to={place.path} className={styles.utility} onClick={() => setMenu(false)}>
                    <Icon name={place.id === 'map' ? 'map' : 'settings'} size={16} />
                    {place.label}
                    <span className={styles.utilityGloss}>{place.gloss}</span>
                  </TransitionLink>
                </li>
              ))}
            </ul>
          </div>

          <div className={styles.block}>
            <p className="t-kicker">
              Transmission Zero · {decoded}/{FRAGMENT_TOTAL} decoded
            </p>
            <div className={styles.fragments} aria-hidden="true">
              {fragments.map((f) => (
                <span
                  key={f.id}
                  className={styles.fragment}
                  data-found={Boolean(found[String(f.id)])}
                  style={{ '--frag-line': `var(--line-${f.line})` } as CSSProperties}
                />
              ))}
            </div>
            {decoded > 0 && (
              <TransitionLink to="/transmission-zero" className={styles.zero} onClick={() => setMenu(false)}>
                Read what has been decoded <Icon name="arrowRight" size={14} />
              </TransitionLink>
            )}
          </div>

          <div className={styles.block}>
            <p className="t-kicker">Instrument</p>
            <div className={styles.controls}>
              <SoundToggle />
              <button
                type="button"
                className={styles.theme}
                onClick={() => setSetting('theme', theme === 'plate' ? 'nocturne' : 'plate')}
                aria-label={
                  theme === 'plate' ? 'Switch to Nocturne (dark) theme' : 'Switch to Plate (light) theme'
                }
              >
                <Icon name={theme === 'plate' ? 'nocturne' : 'plate'} size={16} />
                {theme === 'plate' ? 'Nocturne' : 'Plate'}
              </button>
            </div>
          </div>

          <p className={styles.coords}>
            {world.source} · RA {formatRightAscension(world.rightAscension)} · Dec{' '}
            {formatDeclination(world.declination)}
          </p>
        </aside>
      </div>
    </dialog>
  );
}

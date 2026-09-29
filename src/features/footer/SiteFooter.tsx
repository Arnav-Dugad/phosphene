import { IthranText } from '../../components/IthranText.tsx';
import { Icon } from '../../components/Icon.tsx';
import { TransitionLink } from '../../components/TransitionLink.tsx';
import { FRAGMENT_TOTAL } from '../../content/fragments.ts';
import { world } from '../../content/world.ts';
import { useNow } from '../../hooks/useNow.ts';
import { fixed, thousands } from '../../lib/format.ts';
import { formatOstClock, formatOstDate, observatoryTime, streamFraction, yearsListening } from '../../lib/time.ts';
import { useProgress } from '../../stores/progress.ts';
import { useUi } from '../../stores/ui.ts';
import { scrollToY } from '../scroll/scroller.ts';
import styles from './SiteFooter.module.css';

const COLUMNS = [
  {
    title: 'Observatory',
    links: [
      { to: '/', label: 'Arrival' },
      { to: '/atlas', label: 'Atlas' },
      { to: '/chronicle', label: 'Chronicle' },
      { to: '/archive', label: 'Archive' },
    ],
  },
  {
    title: 'Received',
    links: [
      { to: '/transmissions', label: 'Transmissions' },
      { to: '/instruments', label: 'Instruments' },
      { to: '/array', label: 'Array' },
      { to: '/map', label: 'Map' },
    ],
  },
  {
    title: 'Institute',
    links: [
      { to: '/institute', label: 'About the Institute' },
      { to: '/settings', label: 'Calibration' },
      { to: '/credits', label: 'Credits' },
    ],
  },
] as const;

function LiveStatus() {
  const now = new Date(useNow());
  const fragments = useProgress((s) => Object.keys(s.fragments).length);
  return (
    <dl className={styles.status}>
      <div>
        <dt>Observatory time</dt>
        <dd className="t-numeric">
          {formatOstDate(now)} · {formatOstClock(now)}
        </dd>
      </div>
      <div>
        <dt>Listening for</dt>
        <dd className="t-numeric">{fixed(yearsListening(now), 6)} years</dd>
      </div>
      <div>
        <dt>Stream received</dt>
        <dd className="t-numeric">{fixed(streamFraction(now) * 100, 5)}%</dd>
      </div>
      <div>
        <dt>Transmission Zero</dt>
        <dd className="t-numeric">
          {fragments}/{FRAGMENT_TOTAL} fragments
        </dd>
      </div>
      <div>
        <dt>Light in transit</dt>
        <dd className="t-numeric">{thousands(world.distanceLightYears)} years</dd>
      </div>
    </dl>
  );
}

export function SiteFooter() {
  const setPalette = useUi((s) => s.setPalette);
  const year = observatoryTime().year;

  return (
    <footer className={styles.footer} data-print="hide">
      <div className={`container ${styles.inner}`}>
        <p className={styles.coda}>
          Light does not need <em>its source</em> to be true.
        </p>

        <div className={styles.grid}>
          {COLUMNS.map((column) => (
            <nav key={column.title} className={styles.column} aria-label={column.title}>
              <p className="t-kicker">{column.title}</p>
              <ul role="list">
                {column.links.map((link) => (
                  <li key={link.to}>
                    <TransitionLink to={link.to} className={styles.link}>
                      {link.label}
                    </TransitionLink>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
          <div className={styles.column}>
            <p className="t-kicker">Status</p>
            <LiveStatus />
          </div>
        </div>

        <div className={styles.base}>
          <IthranText text="phosphene" size={13} className={styles.glyphs} label="Phosphene, in Ithran script" />
          <p className={styles.fine}>
            © {year} {world.institute} — a work of fiction, rendered in real time in your browser.
          </p>
          <div className={styles.actions}>
            <button type="button" className={styles.action} onClick={() => setPalette(true)}>
              <Icon name="command" size={14} /> Console
            </button>
            <button type="button" className={styles.action} onClick={() => scrollToY(0)}>
              <Icon name="chevronUp" size={14} /> Return to the top
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}

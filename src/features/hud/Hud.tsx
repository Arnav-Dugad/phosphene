import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router';
import { placeForPath } from '../../content/routes.ts';
import { world } from '../../content/world.ts';
import { stageInput } from '../../engine/input.ts';
import { useNow } from '../../hooks/useNow.ts';
import { formatDeclination, formatRightAscension, pad } from '../../lib/format.ts';
import { formatOstDate } from '../../lib/time.ts';
import styles from './Hud.module.css';

/** Scroll gauge: a hairline with a luminous index that tracks the page. */
function ScrollGauge() {
  const indexRef = useRef<HTMLSpanElement>(null);
  const valueRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let raf = 0;
    const paint = (): void => {
      raf = 0;
      const p = stageInput.scroll.progress;
      indexRef.current?.style.setProperty('--p', p.toFixed(4));
      if (valueRef.current) valueRef.current.textContent = pad(Math.round(p * 100), 3);
    };
    const onScroll = (): void => {
      if (!raf) raf = requestAnimationFrame(paint);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    paint();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return (
    <div className={styles.gauge} aria-hidden="true">
      <span className={styles.track}>
        <span ref={indexRef} className={styles.index} />
      </span>
      <span ref={valueRef} className={styles.value}>
        000
      </span>
    </div>
  );
}

export function Hud() {
  const now = useNow();
  const location = useLocation();
  const place = placeForPath(location.pathname);

  return (
    <div className={styles.hud} aria-hidden="true" data-print="hide">
      <span className={`${styles.corner} ${styles.tl}`} />
      <span className={`${styles.corner} ${styles.tr}`} />
      <span className={`${styles.corner} ${styles.bl}`} />
      <span className={`${styles.corner} ${styles.br}`} />
      <div className={styles.status}>
        <span className={styles.dot} />
        <span>{place ? `${pad(place.index)} · ${place.label}` : 'Off the chart'}</span>
        <span className={styles.sep} />
        <span>
          RA {formatRightAscension(world.rightAscension)} · Dec {formatDeclination(world.declination)}
        </span>
        <span className={styles.sep} />
        <span>{formatOstDate(new Date(now))} OST</span>
      </div>
      <ScrollGauge />
    </div>
  );
}

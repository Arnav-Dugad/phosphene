import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Icon } from '../../components/Icon.tsx';
import { Segmented } from '../../components/Segmented.tsx';
import {
  DISH_COUNT,
  DISH_STATE_INFO,
  DISH_STATES,
  decoderLog,
  dishes,
  dishReadout,
  dishStates,
  lunarLight,
  sourcePointing,
  telemetry,
  type Dish,
} from '../../content/array.ts';
import { world } from '../../content/world.ts';
import type { ArrayScene, LightMode } from '../../engine/scenes/array/ArrayScene.ts';
import { audio } from '../../features/audio/AudioEngine.ts';
import { unlockFragment } from '../../features/fragments/unlock.ts';
import { InteractionSurface } from '../../features/stage/InteractionSurface.tsx';
import { useMediaQuery } from '../../hooks/useMediaQuery.ts';
import { useNow } from '../../hooks/useNow.ts';
import { usePageMeta } from '../../hooks/usePageMeta.ts';
import { useResolvedMotion } from '../../hooks/useResolvedMotion.ts';
import { useStageApi } from '../../hooks/useStageApi.ts';
import { useStageScene } from '../../hooks/useStageScene.ts';
import { fixed, formatBytes, pad, signed, thousands } from '../../lib/format.ts';
import { formatOstClock, formatOstDate } from '../../lib/time.ts';
import { useProgress } from '../../stores/progress.ts';
import { useSettings } from '../../stores/settings.ts';
import { DishGrid } from './DishGrid.tsx';
import { useReceiver, useRowHub } from './receiver.ts';
import { Spectrogram, SPECTROGRAM_ROWS } from './Spectrogram.tsx';
import { useCarrierVoice } from './useCarrierVoice.ts';
import styles from './Array.module.css';

const LIGHTS = [
  { value: 'live', label: 'Live' },
  { value: 'day', label: 'Day' },
  { value: 'night', label: 'Night' },
] as const;

const LISTEN_TO_DECODE = 10;

const clock = (seconds: number): string => {
  const s = Math.max(0, Math.floor(seconds));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
};

const span = (hours: number): string => {
  if (hours >= 48) return `${Math.floor(hours / 24)} d ${Math.floor(hours % 24)} h`;
  if (hours >= 1) return `${Math.floor(hours)} h ${Math.floor((hours * 60) % 60)} min`;
  return `${Math.max(1, Math.round(hours * 60))} min`;
};

function SourceMarker({ scene }: { scene: ArrayScene | null }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!scene) return;
    let raf = 0;
    const tick = (): void => {
      const el = ref.current;
      if (el) {
        const label = scene.sourceLabel;
        el.style.transform = `translate3d(${label.x.toFixed(1)}px, ${label.y.toFixed(1)}px, 0)`;
        el.dataset.visible = String(label.visible);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [scene]);
  return (
    <div ref={ref} className={styles.sourceMarker} data-visible="false" aria-hidden="true">
      <span className={styles.sourceName}>{world.source}</span>
      <span className={styles.sourceMeta}>
        {world.constellation} · {thousands(world.distanceLightYears)} ly
      </span>
    </div>
  );
}

function DishDetail({ dish, date, onClose }: { dish: Dish; date: Date; onClose: () => void }) {
  const readout = dishReadout(dish, date);
  const info = DISH_STATE_INFO[readout.state];
  return (
    <div className={styles.dishDetail} data-state={readout.state}>
      <div className={styles.dishHead}>
        <p className={styles.dishId}>
          {dish.id}
          {dish.name && <span className={styles.dishName}> “{dish.name}”</span>}
        </p>
        <button type="button" className={styles.iconButton} onClick={onClose} aria-label="Back to the whole array">
          <Icon name="close" size={14} />
        </button>
      </div>
      <p className={styles.dishMeta}>
        {dish.group} · commissioned {dish.commissioned} · {dish.channel.toUpperCase()} chain
      </p>
      <p className={styles.dishState}>
        <span className={styles.stateDot} aria-hidden="true" /> {info.label}. {info.description}
      </p>
      <dl className={styles.readouts}>
        <div>
          <dt>Azimuth</dt>
          <dd>{fixed(readout.pointing.az, 3)}°</dd>
        </div>
        <div>
          <dt>Elevation</dt>
          <dd>{fixed(readout.pointing.el, 3)}°</dd>
        </div>
        <div>
          <dt>SNR</dt>
          <dd>{readout.state === 'tracking' ? `${fixed(readout.snr, 1)} dB` : '—'}</dd>
        </div>
        <div>
          <dt>System temp.</dt>
          <dd>{fixed(readout.systemTemperature, 1)} K</dd>
        </div>
        <div>
          <dt>Feed temp.</dt>
          <dd>{fixed(readout.feedTemperature, 1)} K</dd>
        </div>
        <div>
          <dt>Uptime</dt>
          <dd>{readout.state === 'offline' ? 'with crew' : `${readout.uptimeDays} d`}</dd>
        </div>
      </dl>
      {dish.name === 'Aster' && (
        <p className={styles.note}>
          Named for Dr. Aster Halden, who heard the first repetition through this dish in 2236. It has never been taken
          out of the array.
        </p>
      )}
    </div>
  );
}

export default function ArrayPage() {
  usePageMeta('array');
  const motion = useResolvedMotion();
  const wide = useMediaQuery('(min-width: 1100px)');
  const [paused, setPaused] = useState(motion === 'still');
  const [frozenAt, setFrozenAt] = useState<number | null>(() => (motion === 'still' ? Date.now() : null));
  const [light, setLight] = useState<LightMode>('live');
  const [selected, setSelected] = useState<number | null>(null);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState(0);
  const soundOn = useSettings((s) => s.sound);
  const decoded = useProgress((s) => Boolean(s.fragments['10']));

  const hub = useRowHub();
  useReceiver(hub, !paused, SPECTROGRAM_ROWS);
  useStageScene('array', { light, focus: selected ?? -1 });
  const scene = useStageApi<ArrayScene>('array');
  useCarrierVoice(listening && soundOn, hub);

  useEffect(() => {
    if (!scene) return;
    const offPick = scene.events.on('pick', (index) => setSelected(index));
    let last = 0;
    const offRows = hub.subscribe((row) => {
      const now = performance.now();
      if (row.burst < 0 || now - last < 900) return;
      last = now;
      scene.burst();
    });
    return () => {
      offPick();
      offRows();
    };
  }, [scene, hub]);

  // Turning sound off anywhere ends the listening session.
  useEffect(
    () =>
      useSettings.subscribe((next, prev) => {
        if (prev.sound && !next.sound) setListening(false);
      }),
    [],
  );

  // Fragment X: listen to the carrier for ten seconds.
  useEffect(() => {
    if (!listening || decoded) return;
    const id = window.setInterval(() => {
      if (document.hidden) return;
      setHeard((h) => {
        const next = h + 0.25;
        if (next >= LISTEN_TO_DECODE) unlockFragment(10);
        return Math.min(LISTEN_TO_DECODE, next);
      });
    }, 250);
    return () => window.clearInterval(id);
  }, [listening, decoded]);

  const toggleListening = async (): Promise<void> => {
    if (listening) {
      setListening(false);
      return;
    }
    // The press is the gesture that unlocks audio; listening means sound on.
    if (!useSettings.getState().sound) useSettings.getState().set('sound', true);
    await audio.enable();
    setListening(true);
  };

  const togglePaused = (): void => {
    setFrozenAt(paused ? null : Date.now());
    setPaused(!paused);
  };

  const tick = useNow();
  const nowMs = paused && frozenAt !== null ? frozenAt : tick;
  const date = useMemo(() => new Date(nowMs), [nowMs]);
  const data = useMemo(() => telemetry(date), [date]);
  const states = useMemo(() => dishStates(date), [date]);
  const log = useMemo(() => decoderLog(date, 5), [date]);
  const moon = useMemo(() => lunarLight(date), [date]);
  const source = useMemo(() => sourcePointing(date), [date]);
  const counts = useMemo(
    () => DISH_STATES.map((state) => ({ state, count: states.filter((s) => s === state).length })),
    [states],
  );
  const dish = selected !== null ? dishes[selected] : undefined;

  const surface = (
    <InteractionSurface
      label="The Halden Deep Array"
      instructions="Drag to orbit the Array, scroll or pinch to zoom, and click a dish to select it. With this area focused, the arrow keys orbit, plus and minus zoom, and Escape returns to the whole array. Every dish is also listed in the Dishes panel."
      cursor="drag"
      cursorLabel="Orbit"
      contained={!wide}
    />
  );

  return (
    <div className={styles.page} data-paused={paused}>
      {wide && surface}
      {wide && <SourceMarker scene={scene} />}
      <p className="sr-only">
        A live rendering of the Array: sixty-four light-gathering dishes on the floor of {world.arraySite}, tracking the Lacuna low
        in the north-western sky, with the rim of the crater on the horizon.
      </p>

      <div className={styles.hud}>
        <div className={styles.left}>
          <header className={styles.masthead}>
            <p className="t-kicker">06 · Array · Daedalus Crater</p>
            <h1 className={styles.title}>The Halden Deep Array</h1>
            <p className={styles.lede}>
              Sixty-four dishes on the far side of the Moon, listening to the Lacuna now. Everything here is computed from
              the present moment — anyone watching sees the same sky.
            </p>
            <div className={styles.status}>
              <span className={styles.liveDot} data-live={!paused} aria-hidden="true" />
              <span>{paused ? 'Feed paused' : 'Receiving'}</span>
              <span className={styles.statusClock}>
                <time dateTime={date.toISOString()}>
                  {formatOstDate(date)} · {formatOstClock(date)}
                </time>{' '}
                OST
              </span>
            </div>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.listenButton}
                aria-pressed={listening}
                aria-describedby="array-listen-hint"
                onClick={() => void toggleListening()}
                style={{ '--heard': decoded ? 1 : heard / LISTEN_TO_DECODE } as CSSProperties}
              >
                <span className={styles.listenRing} aria-hidden="true">
                  <Icon name={listening ? 'soundOn' : 'signal'} size={14} />
                </span>
                {listening ? 'Listening to the carrier' : 'Listen to the carrier'}
              </button>
              <button type="button" className={styles.textButton} onClick={togglePaused} aria-pressed={paused}>
                <Icon name={paused ? 'play' : 'pause'} size={12} />
                {paused ? 'Resume feed' : 'Pause feed'}
              </button>
            </div>
            <p id="array-listen-hint" className={styles.hint}>
              {listening
                ? 'Seven tones — each spectral line’s light, forty-one octaves down. The ticks are data.'
                : 'Plays the signal as sound. Nothing plays until you press it.'}
            </p>
          </header>

          {!wide && <div className={styles.window}>{surface}</div>}

          <section className={styles.panel} aria-labelledby="array-signal">
            <div className={styles.panelHead}>
              <h2 id="array-signal" className={styles.panelTitle}>
                Serein carrier
              </h2>
              <span className={styles.panelMeta}>seven lines · live</span>
            </div>
            <Spectrogram
              hub={hub}
              label="Spectrogram of the Serein carrier: seven bright traces, one for each spectral line, with data bursts appearing as paired lines beside them."
            />
            <dl className={styles.readouts}>
              <div>
                <dt>Signal to noise</dt>
                <dd>{fixed(data.snr, 1)} dB</dd>
              </div>
              <div>
                <dt>Radial velocity</dt>
                <dd>{signed(data.radialVelocity, 3)} km/s</dd>
              </div>
              <div>
                <dt>Stream rate</dt>
                <dd>{fixed(data.bitsPerSecond / 1000, 2)} kbit/s</dd>
              </div>
              <div>
                <dt>Received</dt>
                <dd>{formatBytes(data.bytesReceived, 3)}</dd>
              </div>
              <div>
                <dt>Frame</dt>
                <dd>{thousands(data.frame)}</dd>
              </div>
              <div>
                <dt>Transmission Zero</dt>
                <dd title={`Repetition ${thousands(data.repetitions + 1)}`}>in {clock(data.nextRepetition)}</dd>
              </div>
            </dl>
            <div className={styles.stream}>
              <div className={styles.streamBar} aria-hidden="true">
                <span style={{ width: `${(data.streamFraction * 100).toFixed(3)}%` }} />
              </div>
              <p className={styles.streamText}>
                {fixed(data.streamFraction * 100, 4)}% of an estimated {thousands(world.streamYearsTotal)}-year stream
              </p>
            </div>
          </section>
        </div>

        <div className={styles.right}>
          <section className={styles.panel} aria-labelledby="array-dishes">
            <div className={styles.panelHead}>
              <h2 id="array-dishes" className={styles.panelTitle}>
                Dishes
              </h2>
              <span className={styles.panelMeta}>
                {data.tracking} of {DISH_COUNT} tracking
              </span>
            </div>
            <ul className={styles.legend} aria-label="Dish states">
              {counts.map(({ state, count }) => (
                <li key={state} data-state={state}>
                  <span className={styles.stateDot} aria-hidden="true" />
                  {DISH_STATE_INFO[state].label} <span className={styles.count}>{count}</span>
                </li>
              ))}
            </ul>
            <DishGrid states={states} selected={selected} onSelect={setSelected} />
            {dish ? (
              <DishDetail dish={dish} date={date} onClose={() => setSelected(null)} />
            ) : (
              <p className={styles.hint}>Choose a dish to fly to it, or click one in the crater.</p>
            )}
          </section>

          <section className={styles.panel} aria-labelledby="array-site">
            <div className={styles.panelHead}>
              <h2 id="array-site" className={styles.panelTitle}>
                Daedalus, now
              </h2>
              <span className={styles.panelMeta}>
                {world.arrayLatitude}° · {world.arrayLongitude}°
              </span>
            </div>
            <dl className={styles.readouts}>
              <div>
                <dt>Lunar {moon.day ? 'day' : 'night'}</dt>
                <dd>
                  {moon.nextEvent} in {span(moon.nextEventHours)}
                </dd>
              </div>
              <div>
                <dt>Sun</dt>
                <dd>{moon.day ? `${fixed(moon.sun.el, 1)}° up` : 'below horizon'}</dd>
              </div>
              <div>
                <dt>Regolith</dt>
                <dd>{fixed(moon.surfaceTemperature, 0)} °C</dd>
              </div>
              <div>
                <dt>Solar wind</dt>
                <dd>{fixed(data.solarWind, 0)} km/s</dd>
              </div>
              <div>
                <dt>Proton flux</dt>
                <dd>{fixed(data.protonFlux, 2)} pfu</dd>
              </div>
              <div>
                <dt>The Lacuna</dt>
                <dd>
                  {fixed(source.az, 2)}° · {fixed(source.el, 2)}°
                </dd>
              </div>
            </dl>
            <Segmented label="Light in the view" value={light} options={LIGHTS} onChange={setLight} />
            <p className={styles.note}>
              Day and night follow the real Moon: noon here falls at new Moon. The far side never faces Earth — no
              earthlight, no radio chatter, nothing between the Array and the dark.
            </p>
          </section>
        </div>

        <section className={`${styles.panel} ${styles.logDock}`} aria-labelledby="array-log">
          <div className={styles.panelHead}>
            <h2 id="array-log" className={styles.panelTitle}>
              Decoder log
            </h2>
            <span className={styles.panelMeta}>newest first</span>
          </div>
          <ol className={styles.log}>
            {log.map((entry) => (
              <li key={entry.id} data-tone={entry.tone} style={{ '--entry-line': `var(--line-${entry.line})` } as CSSProperties}>
                <time dateTime={entry.time.toISOString()}>{entry.clock}</time>
                <span>{entry.text}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useLocation } from 'react-router';
import { Icon } from '../../components/Icon.tsx';
import { TransitionLink } from '../../components/TransitionLink.tsx';
import { fragmentById } from '../../content/fragments.ts';
import { spectralLines, spectralOrder, type SpectralKey } from '../../design/tokens.ts';
import { audio } from '../../features/audio/AudioEngine.ts';
import { unlockFragment } from '../../features/fragments/unlock.ts';
import { usePageMeta } from '../../hooks/usePageMeta.ts';
import { useResolvedMotion } from '../../hooks/useResolvedMotion.ts';
import { useStageScene } from '../../hooks/useStageScene.ts';
import { hashString } from '../../lib/random.ts';
import { lineTone } from '../../lib/spectral.ts';
import { useProgress } from '../../stores/progress.ts';
import { useSettings } from '../../stores/settings.ts';
import { useUi } from '../../stores/ui.ts';
import styles from './NotFound.module.css';

const MIN_NM = 380;
const MAX_NM = 780;
/** Half-width of the band (nm) in which the signal comes through. */
const BANDWIDTH = 2.2;
const HOLD_MS = 1200;

const clarityAt = (nm: number, target: number): number => Math.exp(-(((nm - target) / BANDWIDTH) ** 2));

/**
 * While sound is on, the receiver hisses when detuned and sings the lost
 * line's tone as the signal comes through.
 */
function useReceiverSound(clarity: number, line: SpectralKey, enabled: boolean): void {
  const nodes = useRef<{ hiss: GainNode; tone: GainNode; stop: () => void } | null>(null);
  useEffect(() => {
    const ctx = audio.context;
    const bus = audio.bus;
    if (!enabled || !ctx || !bus) return;
    const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource();
    source.buffer = noise;
    source.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 1800;
    band.Q.value = 0.5;
    const hiss = ctx.createGain();
    hiss.gain.value = 0;
    source.connect(band).connect(hiss).connect(bus);
    const osc = ctx.createOscillator();
    osc.frequency.value = lineTone(line, 1);
    const tone = ctx.createGain();
    tone.gain.value = 0;
    osc.connect(tone).connect(bus);
    source.start();
    osc.start();
    audio.duck(0.85);
    nodes.current = {
      hiss,
      tone,
      stop: () => {
        const t = ctx.currentTime;
        hiss.gain.setTargetAtTime(0, t, 0.1);
        tone.gain.setTargetAtTime(0, t, 0.1);
        source.stop(t + 0.5);
        osc.stop(t + 0.5);
        audio.duck(0);
      },
    };
    return () => {
      nodes.current?.stop();
      nodes.current = null;
    };
  }, [enabled, line]);

  useEffect(() => {
    const ctx = audio.context;
    const n = nodes.current;
    if (!ctx || !n) return;
    n.hiss.gain.setTargetAtTime(0.05 * (1 - clarity), ctx.currentTime, 0.08);
    n.tone.gain.setTargetAtTime(0.05 * clarity * clarity, ctx.currentTime, 0.12);
  }, [clarity]);
}

export default function NotFoundPage() {
  const location = useLocation();
  usePageMeta({ title: 'Signal lost', description: 'Nothing in the observatory answers to this address — but something is on the frequency.' });
  const motion = useResolvedMotion();
  const soundOn = useSettings((s) => s.sound);
  const found = useProgress((s) => Boolean(s.fragments['11']));
  const setPalette = useUi((s) => s.setPalette);

  // Every lost address has its own frequency: one of the seven lines, chosen by the path.
  const line = useMemo<SpectralKey>(
    () => spectralOrder[hashString(location.pathname) % spectralOrder.length] ?? 'ha',
    [location.pathname],
  );
  const target = spectralLines[line].nm;
  const [nm, setNm] = useState(() => (target > 580 ? 452 : 700));
  const clarity = clarityAt(nm, target);
  const locked = clarity > 0.92;
  useStageScene('static', { clarity });
  useReceiverSound(clarity, line, soundOn && audio.active);

  // Holding the signal decodes Fragment XI.
  useEffect(() => {
    if (!locked || found) return;
    const id = window.setTimeout(() => unlockFragment(11), HOLD_MS);
    return () => window.clearTimeout(id);
  }, [locked, found]);

  // "Scan the band": an accessible alternative to fine-tuning by hand.
  const scan = useRef(0);
  const scanTo = (): void => {
    cancelAnimationFrame(scan.current);
    const from = nm;
    const start = performance.now();
    const duration = motion === 'still' ? 1 : 2600;
    const tick = (now: number): void => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setNm(from + (target - from) * eased);
      if (t < 1) scan.current = requestAnimationFrame(tick);
    };
    scan.current = requestAnimationFrame(tick);
  };
  useEffect(() => () => cancelAnimationFrame(scan.current), []);

  const fragment = fragmentById(11);
  const pct = ((nm - MIN_NM) / (MAX_NM - MIN_NM)) * 100;

  return (
    <div className={`container ${styles.page}`} data-locked={locked}>
      <div className={styles.copy}>
        <p className="t-kicker">Signal lost · 404</p>
        <h1 className={styles.title}>Off the chart</h1>
        <p className={styles.lede}>
          Nothing in the observatory answers to <code className={styles.path}>{location.pathname}</code>. But there is
          something faint on this frequency.
        </p>

        <div className={styles.tuner} style={{ '--pct': `${pct}%` } as CSSProperties}>
          <div className={styles.tunerHead}>
            <label htmlFor="lost-dial" className={styles.tunerLabel}>
              Tune the receiver
            </label>
            <output htmlFor="lost-dial" className={styles.readout} aria-live="off">
              {nm.toFixed(1)} nm
            </output>
          </div>
          <div className={styles.dial}>
            <span className={styles.spectrum} aria-hidden="true" />
            {spectralOrder.map((key) => (
              <span
                key={key}
                className={styles.tick}
                style={{ left: `${((spectralLines[key].nm - MIN_NM) / (MAX_NM - MIN_NM)) * 100}%` }}
                aria-hidden="true"
              />
            ))}
            <input
              id="lost-dial"
              className={styles.range}
              type="range"
              min={MIN_NM}
              max={MAX_NM}
              step={0.1}
              value={nm}
              onChange={(e) => {
                cancelAnimationFrame(scan.current);
                setNm(Number(e.target.value));
              }}
              aria-valuetext={`${nm.toFixed(1)} nanometres${locked ? ', signal found' : ''}`}
            />
          </div>
          <div className={styles.tunerFoot}>
            <span className={styles.strength} aria-hidden="true">
              <span style={{ width: `${Math.round(clarity * 100)}%` }} />
            </span>
            <span className={styles.status} role="status">
              {locked ? 'Signal found — hold it there' : clarity > 0.25 ? 'Something is coming through…' : 'Static'}
            </span>
            <button type="button" className={styles.scan} onClick={scanTo}>
              <Icon name="signal" size={14} /> Scan the band
            </button>
          </div>
        </div>

        {found && fragment && (
          <blockquote className={styles.fragment}>
            <p>“{fragment.text}”</p>
            <footer>Fragment {fragment.numeral} of Transmission Zero</footer>
          </blockquote>
        )}

        <nav className={styles.ways} aria-label="Ways back">
          <TransitionLink to="/" className={styles.way} line="na">
            <Icon name="aperture" size={16} /> Return to Arrival
          </TransitionLink>
          <TransitionLink to="/map" className={styles.way} line="o3">
            <Icon name="map" size={16} /> Open the Map
          </TransitionLink>
          <button type="button" className={styles.way} onClick={() => setPalette(true)}>
            <Icon name="search" size={16} /> Search everything
          </button>
        </nav>
      </div>
    </div>
  );
}

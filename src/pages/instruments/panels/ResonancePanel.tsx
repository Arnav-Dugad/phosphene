import { useEffect, useRef, useState } from 'react';
import { Slider } from '../../../components/Slider.tsx';
import { Switch } from '../../../components/Switch.tsx';
import type { ResonanceScene } from '../../../engine/scenes/resonance/ResonanceScene.ts';
import { audio } from '../../../features/audio/AudioEngine.ts';
import { unlockFragment } from '../../../features/fragments/unlock.ts';
import { usePoll } from '../../../hooks/usePoll.ts';
import { useStageApi } from '../../../hooks/useStageApi.ts';
import { useStageScene } from '../../../hooks/useStageScene.ts';
import { useProgress } from '../../../stores/progress.ts';
import { useSettings } from '../../../stores/settings.ts';
import { ActionRow, Readout } from '../InstrumentPanel.tsx';
import styles from '../Instrument.module.css';

/** A few figures have names in the Institute's notebooks. */
const NAMED: Record<string, string> = {
  '5,3': 'The Singing Stone',
  '2,1': 'First light',
  '4,1': 'The lamplighter’s cross',
  '9,4': 'Mereth lattice',
};
const CHORD = new Set(['7,3', '3,7']);

const plateFrequency = (m: number, n: number): number => 64 * Math.sqrt(m * m + n * n);

/** The plate's own voice: two partials that glide when the mode changes. */
function usePlateTone(m: number, n: number, enabled: boolean): void {
  const voice = useRef<{ oscs: OscillatorNode[]; gain: GainNode } | null>(null);
  useEffect(() => {
    const ctx = audio.context;
    const bus = audio.bus;
    if (!enabled || !ctx || !bus || !audio.active) return;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(bus);
    const oscs = [1, 2.76].map((ratio) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = plateFrequency(5, 3) * ratio;
      const partial = ctx.createGain();
      partial.gain.value = ratio === 1 ? 1 : 0.18;
      osc.connect(partial).connect(gain);
      osc.start();
      return osc;
    });
    gain.gain.setTargetAtTime(0.045, ctx.currentTime, 0.6);
    audio.duck(0.7);
    voice.current = { oscs, gain };
    return () => {
      gain.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
      oscs.forEach((o) => o.stop(ctx.currentTime + 0.6));
      audio.duck(0);
      voice.current = null;
    };
  }, [enabled]);

  useEffect(() => {
    const ctx = audio.context;
    const v = voice.current;
    if (!ctx || !v) return;
    v.oscs.forEach((osc, i) =>
      osc.frequency.setTargetAtTime(plateFrequency(m, n) * (i === 0 ? 1 : 2.76), ctx.currentTime, 0.25),
    );
  }, [m, n]);
}

export function ResonancePanel() {
  const [m, setM] = useState(5);
  const [n, setN] = useState(3);
  const [sweep, setSweep] = useState(false);
  const scene = useStageApi<ResonanceScene>('resonance');
  const sound = useSettings((s) => s.sound);
  const chordFound = useProgress((s) => Boolean(s.fragments['7']));
  const settled = usePoll(scene, (s) => s.settled, 150, 0);
  const live = usePoll(scene, (s) => `${s.m},${s.n}`, 150, '5,3');
  useStageScene('resonance', { m, n, sweep });
  usePlateTone(m, n, sound);

  useEffect(() => {
    if (!scene) return;
    return scene.events.on('settled', (mm, nn) => {
      if (CHORD.has(`${mm},${nn}`)) unlockFragment(7);
    });
  }, [scene]);

  const [lm, ln] = live.split(',').map(Number) as [number, number];
  const name = CHORD.has(live)
    ? chordFound
      ? 'The Ithran chord'
      : 'An unfamiliar figure…'
    : (NAMED[live] ?? 'Unnamed figure');

  return (
    <>
      <div className={styles.callout}>
        <p className={styles.figureName}>{name}</p>
        <Readout label="Mode" value={`(${lm}, ${ln})`} />
        <Readout label="Plate tone" value={`${plateFrequency(lm, ln).toFixed(0)} Hz`} />
        <div className={styles.meter} aria-label={`Sand settled: ${Math.round(settled * 100)} percent`}>
          <span style={{ width: `${settled * 100}%` }} />
        </div>
      </div>
      <Slider label="Mode m" value={m} min={1} max={9} step={1} onChange={setM} format={(v) => String(v)} />
      <Slider label="Mode n" value={n} min={1} max={9} step={1} onChange={setN} format={(v) => String(v)} />
      <Switch
        label="Sweep through modes"
        description="The plate walks through ten figures on its own."
        checked={sweep}
        onChange={setSweep}
      />
      <ActionRow>
        <button type="button" onClick={() => scene?.scatterSand()}>
          Scatter the sand
        </button>
        {!sound && <span className={styles.hint}>Turn sound on to hear the plate.</span>}
      </ActionRow>
      {m === n && (
        <p className={styles.hint}>When m equals n the plate is perfectly still — try making them differ.</p>
      )}
    </>
  );
}

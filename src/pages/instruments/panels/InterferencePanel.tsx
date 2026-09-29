import { useEffect, useState } from 'react';
import { Segmented } from '../../../components/Segmented.tsx';
import { Slider } from '../../../components/Slider.tsx';
import type {
  InterferenceDisplay,
  InterferencePreset,
  InterferenceScene,
} from '../../../engine/scenes/interference/InterferenceScene.ts';
import { MAX_EMITTERS } from '../../../content/instruments.ts';
import { unlockFragment } from '../../../features/fragments/unlock.ts';
import { usePoll } from '../../../hooks/usePoll.ts';
import { useStageApi } from '../../../hooks/useStageApi.ts';
import { useStageScene } from '../../../hooks/useStageScene.ts';
import { ActionRow, PresetRow, Readout } from '../InstrumentPanel.tsx';
import styles from '../Instrument.module.css';

const PRESETS = [
  { value: 'array', label: 'Phased array' },
  { value: 'slits', label: 'Two sources' },
  { value: 'ring', label: 'Ring of six' },
  { value: 'chaos', label: 'Scatter' },
] as const;

const DISPLAYS = [
  { value: 'intensity', label: 'Intensity' },
  { value: 'phase', label: 'Phase' },
  { value: 'spectral', label: 'Spectral' },
] as const;

export function InterferencePanel() {
  const [preset, setPreset] = useState<InterferencePreset>('array');
  const [wavelength, setWavelength] = useState(0.12);
  const [speed, setSpeed] = useState(1);
  const [steer, setSteer] = useState(0);
  const [display, setDisplay] = useState<InterferenceDisplay>('intensity');
  const [count, setCount] = useState(MAX_EMITTERS);
  const scene = useStageApi<InterferenceScene>('interference');
  const lock = usePoll(scene, (s) => s.lock, 100, 0);
  useStageScene('interference', { preset, wavelength, speed, steer, display });

  useEffect(() => {
    if (!scene) return;
    const offLocked = scene.events.on('locked', () => unlockFragment(6));
    const offCount = scene.events.on('count', setCount);
    return () => {
      offLocked();
      offCount();
    };
  }, [scene]);

  return (
    <>
      <PresetRow label="Arrangement" options={PRESETS} value={preset} onChange={setPreset} />
      {preset === 'array' && (
        <div className={styles.callout}>
          <Slider
            label="Beam steering"
            value={steer}
            min={-0.9}
            max={0.9}
            step={0.005}
            onChange={setSteer}
            format={(v) => `${Math.round((Math.asin(Math.max(-1, Math.min(1, v * 1.1))) * 180) / Math.PI)}°`}
          />
          <div className={styles.meter} aria-label={`Beam on target: ${Math.round(lock * 100)} percent`}>
            <span style={{ width: `${lock * 100}%` }} />
          </div>
          <p className={styles.hint}>
            {lock >= 1
              ? 'Locked. The beam holds the target.'
              : 'Shift the phases until the beam finds the target ring.'}
          </p>
        </div>
      )}
      <Slider
        label="Wavelength"
        value={wavelength}
        min={0.05}
        max={0.3}
        step={0.005}
        onChange={setWavelength}
        format={(v) => `${Math.round(v * 1000)} mλ`}
      />
      <Slider
        label="Wave speed"
        value={speed}
        min={0}
        max={3}
        step={0.05}
        onChange={setSpeed}
        format={(v) => `${v.toFixed(2)}×`}
      />
      <Segmented label="Display" value={display} options={DISPLAYS} onChange={setDisplay} />
      <ActionRow>
        <button type="button" onClick={() => scene?.reset()}>
          Reset emitters
        </button>
        <Readout label="Emitters" value={`${count}/${MAX_EMITTERS}`} />
      </ActionRow>
      <p className={styles.keys}>
        Keyboard: <kbd>N</kbd> add · <kbd>[</kbd> <kbd>]</kbd> select · arrows move · <kbd>Del</kbd> remove
      </p>
    </>
  );
}

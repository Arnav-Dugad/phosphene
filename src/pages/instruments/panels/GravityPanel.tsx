import { useEffect, useState } from 'react';
import { Slider } from '../../../components/Slider.tsx';
import type { GravityPreset, GravityScene } from '../../../engine/scenes/gravity/GravityScene.ts';
import { MAX_MASSES } from '../../../content/instruments.ts';
import { unlockFragment } from '../../../features/fragments/unlock.ts';
import { useStageApi } from '../../../hooks/useStageApi.ts';
import { useStageScene } from '../../../hooks/useStageScene.ts';
import { useStage } from '../../../stores/stage.ts';
import { ActionRow, PresetRow, Readout } from '../InstrumentPanel.tsx';
import styles from '../Instrument.module.css';

const PRESETS = [
  { value: 'accretion', label: 'Accretion' },
  { value: 'binary', label: 'Binary' },
  { value: 'trinary', label: 'Three bodies' },
  { value: 'vael', label: 'Vael system' },
  { value: 'drift', label: 'Empty sky' },
] as const;

export function GravityPanel() {
  const [preset, setPreset] = useState<GravityPreset>('accretion');
  const [gravity, setGravity] = useState(1);
  const [mass, setMass] = useState(1);
  const [persistence, setPersistence] = useState(0.93);
  const [count, setCount] = useState(1);
  const scene = useStageApi<GravityScene>('gravity');
  const tier = useStage((s) => s.tier);
  useStageScene('gravity', { preset, gravity, mass, persistence });

  useEffect(() => {
    if (!scene) return;
    const offStable = scene.events.on('stable', () => unlockFragment(9));
    const offCount = scene.events.on('count', setCount);
    return () => {
      offStable();
      offCount();
    };
  }, [scene]);

  const grains = { ultra: '1 048 576', high: '262 144', balanced: '65 536', eco: '16 384' }[tier];

  return (
    <>
      <PresetRow label="System" options={PRESETS} value={preset} onChange={setPreset} />
      <Slider
        label="Gravity"
        value={gravity}
        min={0.2}
        max={3}
        step={0.05}
        onChange={setGravity}
        format={(v) => `${v.toFixed(2)} G`}
      />
      <Slider
        label="Mass to place"
        value={mass}
        min={0.1}
        max={3}
        step={0.05}
        onChange={setMass}
        format={(v) => `${v.toFixed(2)} M`}
      />
      <Slider
        label="Afterimage"
        value={persistence}
        min={0.5}
        max={0.985}
        step={0.005}
        onChange={setPersistence}
        format={(v) => `${Math.round(v * 100)}%`}
      />
      <ActionRow>
        <button type="button" onClick={() => scene?.kickAll()}>
          Kick
        </button>
        <button type="button" onClick={() => scene?.reset()}>
          Reset
        </button>
      </ActionRow>
      <div className={styles.callout}>
        <Readout label="Masses" value={`${count}/${MAX_MASSES}`} />
        <Readout label="Grains" value={grains} />
        <p className={styles.hint}>
          Grains colour by speed: slow hydrogen red through to fast calcium violet.
        </p>
      </div>
    </>
  );
}

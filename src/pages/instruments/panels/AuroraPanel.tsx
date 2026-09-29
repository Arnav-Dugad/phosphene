import { useState } from 'react';
import { Slider } from '../../../components/Slider.tsx';
import { AURORA_PALETTES } from '../../../content/instruments.ts';
import { getEngine } from '../../../engine/handle.ts';
import { useStageScene } from '../../../hooks/useStageScene.ts';
import { toast } from '../../../stores/ui.ts';
import { ActionRow, PresetRow, Readout } from '../InstrumentPanel.tsx';
import styles from '../Instrument.module.css';

const PALETTE_OPTIONS = Object.entries(AURORA_PALETTES).map(([value, p]) => ({ value, label: p.label }));

function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function AuroraPanel() {
  const [seed, setSeed] = useState(1);
  const [palette, setPalette] = useState('oxygen');
  const [scale, setScale] = useState(1);
  const [speed, setSpeed] = useState(1);
  const [turbulence, setTurbulence] = useState(1);
  const [persistence, setPersistence] = useState(0.955);
  useStageScene('aurora', { seed, palette, scale, speed, turbulence, persistence });

  const save = async (): Promise<void> => {
    const blob = await getEngine()?.capture();
    if (!blob) {
      toast({
        tone: 'warning',
        title: 'Could not capture the frame',
        body: 'The canvas is not available right now.',
      });
      return;
    }
    download(blob, `phosphene-aurora-${seed}-${palette}.png`);
    toast({
      tone: 'success',
      title: 'Frame saved',
      body: `Seed ${seed}, ${AURORA_PALETTES[palette]?.label ?? palette}.`,
      line: 'ca',
    });
  };

  return (
    <>
      <PresetRow label="Palette" options={PALETTE_OPTIONS} value={palette} onChange={setPalette} />
      <Slider
        label="Scale"
        value={scale}
        min={0.3}
        max={2.5}
        step={0.01}
        onChange={setScale}
        format={(v) => `${v.toFixed(2)}`}
      />
      <Slider
        label="Drift"
        value={speed}
        min={0}
        max={2.5}
        step={0.01}
        onChange={setSpeed}
        format={(v) => `${v.toFixed(2)}×`}
      />
      <Slider
        label="Turbulence"
        value={turbulence}
        min={0.1}
        max={2.5}
        step={0.01}
        onChange={setTurbulence}
        format={(v) => v.toFixed(2)}
      />
      <Slider
        label="Afterimage"
        value={persistence}
        min={0.8}
        max={0.99}
        step={0.001}
        onChange={setPersistence}
        format={(v) => `${(v * 100).toFixed(1)}%`}
      />
      <ActionRow>
        <button type="button" onClick={() => setSeed((s) => (s % 9999) + 1 + Math.floor(Math.random() * 97))}>
          New sky
        </button>
        <button type="button" onClick={() => void save()}>
          Save frame
        </button>
        <Readout label="Seed" value={seed} />
      </ActionRow>
      <p className={styles.hint}>
        Real aurorae glow oxygen-green below and oxygen-red above; the other palettes are Ithran skies.
      </p>
    </>
  );
}

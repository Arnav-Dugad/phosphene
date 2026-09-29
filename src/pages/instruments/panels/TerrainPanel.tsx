import { useCallback, useEffect, useState } from 'react';
import { Segmented } from '../../../components/Segmented.tsx';
import { Slider } from '../../../components/Slider.tsx';
import { Switch } from '../../../components/Switch.tsx';
import type { TerrainScene } from '../../../engine/scenes/terrain/TerrainScene.ts';
import { useStageApi } from '../../../hooks/useStageApi.ts';
import { useStageScene } from '../../../hooks/useStageScene.ts';
import styles from '../Instrument.module.css';

type Source = 'carrier' | 'microphone';
type MicState = 'idle' | 'asking' | 'live' | 'denied' | 'unavailable';

const SOURCES = [
  { value: 'carrier', label: 'Serein carrier' },
  { value: 'microphone', label: 'Microphone' },
] as const;

const PALETTES = [
  { value: 'spectral', label: 'Spectral' },
  { value: 'ember', label: 'Ember' },
] as const;

const micSupported = (): boolean =>
  typeof navigator !== 'undefined' &&
  navigator.mediaDevices !== undefined &&
  'getUserMedia' in navigator.mediaDevices;

/**
 * Microphone audio is analysed locally: the stream feeds an AnalyserNode that
 * is never connected to the speakers or the network. `report` hears whether
 * the visitor granted access.
 */
function useMicrophone(
  scene: TerrainScene | null,
  active: boolean,
  report: (state: 'live' | 'denied') => void,
): void {
  useEffect(() => {
    if (!active || !scene) return;
    let cancelled = false;
    let session: { stream: MediaStream; ctx: AudioContext } | null = null;
    navigator.mediaDevices
      .getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false } })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const ctx = new AudioContext();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.smoothingTimeConstant = 0.2;
        source.connect(analyser);
        scene.setAnalyser(analyser);
        session = { stream, ctx };
        report('live');
      })
      .catch(() => {
        if (!cancelled) report('denied');
      });
    return () => {
      cancelled = true;
      scene.setAnalyser(null);
      if (session) {
        session.stream.getTracks().forEach((t) => t.stop());
        void session.ctx.close();
      }
    };
  }, [scene, active, report]);
}

const MIC_MESSAGES: Record<MicState, string> = {
  idle: '',
  asking: 'Waiting for permission to listen…',
  live: 'Listening. Speak, sing or whistle — the terrain is your voice.',
  denied: 'Microphone access was declined. The carrier is still here.',
  unavailable: 'This browser cannot share a microphone. The carrier is still here.',
};

export function TerrainPanel() {
  const [source, setSource] = useState<Source>('carrier');
  const [mic, setMic] = useState<MicState>('idle');
  const [gain, setGain] = useState(1);
  const [speed, setSpeed] = useState(30);
  const [palette, setPalette] = useState<'spectral' | 'ember'>('spectral');
  const [frozen, setFrozen] = useState(false);
  const scene = useStageApi<TerrainScene>('terrain');
  useStageScene('terrain', { gain, speed, palette, frozen });
  const report = useCallback((state: 'live' | 'denied') => {
    setMic(state);
    if (state === 'denied') setSource('carrier');
  }, []);
  useMicrophone(scene, source === 'microphone', report);

  const chooseSource = (next: Source): void => {
    if (next === 'microphone' && !micSupported()) {
      setMic('unavailable');
      return;
    }
    setSource(next);
    setMic(next === 'microphone' ? 'asking' : 'idle');
  };

  return (
    <>
      <Segmented label="Source" value={source} options={SOURCES} onChange={chooseSource} />
      {MIC_MESSAGES[mic] && (
        <p className={styles.hint} role="status">
          {MIC_MESSAGES[mic]}
        </p>
      )}
      <Slider
        label="Gain"
        value={gain}
        min={0.2}
        max={3}
        step={0.05}
        onChange={setGain}
        format={(v) => `${v.toFixed(2)}×`}
      />
      <Slider
        label="Time"
        value={speed}
        min={5}
        max={90}
        step={1}
        onChange={setSpeed}
        format={(v) => `${v} rows/s`}
      />
      <Segmented label="Palette" value={palette} options={PALETTES} onChange={setPalette} />
      <Switch
        label="Freeze the terrain"
        description="Hold this moment still to study it."
        checked={frozen}
        onChange={setFrozen}
      />
      <p className={styles.hint}>
        The carrier is built from the seven spectral tones — each line’s light frequency, forty octaves down —
        with their harmonics and bursts of data.
      </p>
    </>
  );
}

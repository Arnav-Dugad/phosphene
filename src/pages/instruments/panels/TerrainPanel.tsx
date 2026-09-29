import { useEffect, useRef, useState } from 'react';
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

/**
 * Microphone audio is analysed locally: the stream feeds an AnalyserNode that
 * is never connected to the speakers or the network.
 */
function useMicrophone(scene: TerrainScene | null, wanted: boolean): MicState {
  const [state, setState] = useState<MicState>('idle');
  const session = useRef<{ stream: MediaStream; ctx: AudioContext } | null>(null);

  useEffect(() => {
    if (!wanted || !scene) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setState('unavailable');
      return;
    }
    let cancelled = false;
    setState('asking');
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
        session.current = { stream, ctx };
        setState('live');
      })
      .catch(() => {
        if (!cancelled) setState('denied');
      });
    return () => {
      cancelled = true;
      scene.setAnalyser(null);
      const s = session.current;
      if (s) {
        s.stream.getTracks().forEach((t) => t.stop());
        void s.ctx.close();
      }
      session.current = null;
      setState('idle');
    };
  }, [scene, wanted]);

  return state;
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
  const [gain, setGain] = useState(1);
  const [speed, setSpeed] = useState(30);
  const [palette, setPalette] = useState<'spectral' | 'ember'>('spectral');
  const [frozen, setFrozen] = useState(false);
  const scene = useStageApi<TerrainScene>('terrain');
  useStageScene('terrain', { gain, speed, palette, frozen });
  const mic = useMicrophone(scene, source === 'microphone');

  useEffect(() => {
    if (mic === 'denied' || mic === 'unavailable') setSource('carrier');
  }, [mic]);

  return (
    <>
      <Segmented label="Source" value={source} options={SOURCES} onChange={setSource} />
      {MIC_MESSAGES[mic] && (
        <p className={styles.hint} role="status">
          {MIC_MESSAGES[mic]}
        </p>
      )}
      <Slider label="Gain" value={gain} min={0.2} max={3} step={0.05} onChange={setGain} format={(v) => `${v.toFixed(2)}×`} />
      <Slider label="Time" value={speed} min={5} max={90} step={1} onChange={setSpeed} format={(v) => `${v} rows/s`} />
      <Segmented label="Palette" value={palette} options={PALETTES} onChange={setPalette} />
      <Switch label="Freeze the terrain" description="Hold this moment still to study it." checked={frozen} onChange={setFrozen} />
      <p className={styles.hint}>
        The carrier is built from the seven spectral tones — each line’s light frequency, forty octaves down — with their
        harmonics and bursts of data.
      </p>
    </>
  );
}

import { useEffect } from 'react';
import { channels } from '../../content/receiver.ts';
import { lineTone } from '../../lib/spectral.ts';
import { audio } from '../../features/audio/AudioEngine.ts';
import type { RowHub } from './receiver.ts';

/** Seconds per breath of each channel, matching the receiver's synthesis. */
const BREATH_SECONDS = 7.3;

/**
 * Sonifies the carrier: seven sine voices, one per spectral line (its light
 * frequency forty-one octaves down), each breathing on the receiver's slow
 * cycle; data bursts tick on their channel's tone. Everything is scheduled on
 * the audio clock — no per-frame JavaScript.
 */
export function useCarrierVoice(listening: boolean, hub: RowHub): void {
  useEffect(() => {
    const ctx = audio.context;
    const bus = audio.bus;
    if (!listening || !ctx || !bus) return;
    const start = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0, start);
    master.gain.linearRampToValueAtTime(1, start + 1.4);
    master.connect(bus);

    const sources: AudioScheduledSourceNode[] = [];
    channels.forEach((channel, i) => {
      const voice = ctx.createOscillator();
      voice.frequency.value = lineTone(channel.key, 1);
      const gain = ctx.createGain();
      gain.gain.value = 0.016;
      const breath = ctx.createOscillator();
      breath.frequency.value = 1 / BREATH_SECONDS;
      const depth = ctx.createGain();
      depth.gain.value = 0.012;
      breath.connect(depth).connect(gain.gain);
      voice.connect(gain).connect(master);
      voice.start(start);
      // Offset each breath the way the receiver offsets its channels.
      breath.start(start + ((i * 0.13) % 1) * BREATH_SECONDS);
      sources.push(voice, breath);
    });
    audio.duck(0.8);

    let lastTick = 0;
    const offRows = hub.subscribe((row) => {
      const channel = channels[row.burst];
      if (!channel) return;
      const now = performance.now();
      if (now - lastTick < 260) return;
      lastTick = now;
      audio.play('tick', channel.key);
    });

    return () => {
      offRows();
      const t = ctx.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(master.gain.value, t);
      master.gain.linearRampToValueAtTime(0, t + 0.45);
      sources.forEach((source) => source.stop(t + 0.5));
      window.setTimeout(() => master.disconnect(), 800);
      audio.duck(0);
    };
  }, [listening, hub]);
}

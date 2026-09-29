import type { SpectralKey } from '../../design/tokens.ts';
import { lineTone } from '../../lib/spectral.ts';

/**
 * PHOSPHENE's sound is synthesised, never sampled.
 *
 * Every tone is a colour: a spectral line's light frequency transposed down
 * forty octaves (see lib/spectral.ts). The ambient drone sits on the current
 * place's line; interface sounds are short, quiet voices of the same tones.
 * Nothing plays until the visitor turns sound on, and the preference is
 * remembered — but even then audio only resumes after their first gesture.
 */

export type Cue = 'hover' | 'click' | 'open' | 'close' | 'blink' | 'success' | 'fragment' | 'error' | 'type' | 'tick';

const DRONE_RATIOS = [0.25, 0.5, 0.375, 1] as const;
const DRONE_GAINS = [0.5, 0.32, 0.22, 0.05] as const;

class Engine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ui: GainNode | null = null;
  private ambient: GainNode | null = null;
  private droneOscs: OscillatorNode[] = [];
  private droneFilter: BiquadFilterNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private line: SpectralKey = 'na';
  private volume = 0.7;
  private enabled = false;
  private lastHover = 0;

  get active(): boolean {
    return this.enabled && this.ctx?.state === 'running';
  }

  get context(): AudioContext | null {
    return this.ctx;
  }

  /** Output node for instrument voices (goes through reverb and master). */
  get bus(): GainNode | null {
    return this.ui;
  }

  private build(): AudioContext {
    const ctx = new AudioContext({ latencyHint: 'interactive' });
    const master = ctx.createGain();
    master.gain.value = 0;
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.ratio.value = 3;
    master.connect(compressor).connect(ctx.destination);

    const reverb = ctx.createConvolver();
    reverb.buffer = this.impulse(ctx, 3.2);
    const reverbSend = ctx.createGain();
    reverbSend.gain.value = 0.45;
    reverbSend.connect(reverb).connect(master);

    const ui = ctx.createGain();
    ui.gain.value = 0.9;
    ui.connect(master);
    ui.connect(reverbSend);

    const ambient = ctx.createGain();
    ambient.gain.value = 0.0;
    ambient.connect(master);
    ambient.connect(reverbSend);

    // Drone: four sine/triangle voices on the line's tone, through a breathing low-pass.
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 780;
    filter.Q.value = 0.4;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.043;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 260;
    lfo.connect(lfoDepth).connect(filter.frequency);
    lfo.start();
    filter.connect(ambient);

    const base = lineTone(this.line);
    this.droneOscs = DRONE_RATIOS.map((ratio, i) => {
      const osc = ctx.createOscillator();
      osc.type = i === 1 ? 'triangle' : 'sine';
      osc.frequency.value = base * ratio;
      osc.detune.value = (i - 1.5) * 3;
      const gain = ctx.createGain();
      gain.gain.value = DRONE_GAINS[i] ?? 0.1;
      osc.connect(gain).connect(filter);
      osc.start();
      return osc;
    });

    // A faint band of filtered noise: the hiss of an open sky.
    this.noiseBuffer = this.whiteNoise(ctx, 2);
    const hiss = ctx.createBufferSource();
    hiss.buffer = this.noiseBuffer;
    hiss.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 420;
    band.Q.value = 0.6;
    const hissGain = ctx.createGain();
    hissGain.gain.value = 0.035;
    hiss.connect(band).connect(hissGain).connect(ambient);
    hiss.start();

    this.ctx = ctx;
    this.master = master;
    this.ui = ui;
    this.ambient = ambient;
    this.droneFilter = filter;
    return ctx;
  }

  private impulse(ctx: AudioContext, seconds: number): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        const t = i / length;
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 3.2) * (t < 0.01 ? t / 0.01 : 1);
      }
    }
    return buffer;
  }

  private whiteNoise(ctx: AudioContext, seconds: number): AudioBuffer {
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  /** Turns sound on. Must be called from a user gesture the first time. */
  async enable(): Promise<void> {
    this.enabled = true;
    const ctx = this.ctx ?? this.build();
    if (ctx.state !== 'running') await ctx.resume();
    const now = ctx.currentTime;
    this.master?.gain.cancelScheduledValues(now);
    this.master?.gain.setTargetAtTime(this.volume, now, 0.35);
    this.ambient?.gain.setTargetAtTime(0.16, now, 1.6);
  }

  async disable(): Promise<void> {
    this.enabled = false;
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    this.master.gain.setTargetAtTime(0, ctx.currentTime, 0.18);
    await new Promise((r) => setTimeout(r, 700));
    if (!this.enabled && ctx.state === 'running') await ctx.suspend();
  }

  /** Resume after the page was hidden, or on first gesture of a return visit. */
  async wake(): Promise<void> {
    if (!this.enabled) return;
    await this.enable();
  }

  sleep(): void {
    if (this.ctx?.state === 'running') void this.ctx.suspend();
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.ctx && this.master && this.enabled) this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.1);
  }

  /** Glides the drone to a place's spectral line. */
  setLine(line: SpectralKey): void {
    this.line = line;
    const ctx = this.ctx;
    if (!ctx) return;
    const base = lineTone(line);
    this.droneOscs.forEach((osc, i) => {
      osc.frequency.cancelScheduledValues(ctx.currentTime);
      osc.frequency.setTargetAtTime(base * (DRONE_RATIOS[i] ?? 1), ctx.currentTime, 1.2);
    });
    // Bluer light, brighter timbre: the filter opens with the tone.
    this.droneFilter?.frequency.setTargetAtTime(420 + base * 0.9, ctx.currentTime, 1.5);
  }

  /** Dims the ambient bed (e.g. while an instrument is producing its own sound). */
  duck(amount: number): void {
    if (!this.ctx || !this.ambient) return;
    this.ambient.gain.setTargetAtTime(0.16 * (1 - amount), this.ctx.currentTime, 0.4);
  }

  private voice(
    freq: number,
    start: number,
    duration: number,
    gain: number,
    type: OscillatorType = 'sine',
    glideTo?: number,
  ): void {
    const ctx = this.ctx;
    if (!ctx || !this.ui) return;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, start + duration);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, start);
    env.gain.linearRampToValueAtTime(gain, start + Math.min(0.012, duration * 0.2));
    env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(env).connect(this.ui);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  private noise(start: number, duration: number, gain: number, from: number, to: number, q = 1.2): void {
    const ctx = this.ctx;
    if (!ctx || !this.ui || !this.noiseBuffer) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = q;
    filter.frequency.setValueAtTime(from, start);
    filter.frequency.exponentialRampToValueAtTime(to, start + duration);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, start);
    env.gain.linearRampToValueAtTime(gain, start + duration * 0.3);
    env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    src.connect(filter).connect(env).connect(this.ui);
    src.start(start, Math.random());
    src.stop(start + duration + 0.05);
  }

  play(cue: Cue, line: SpectralKey = this.line): void {
    if (!this.active || !this.ctx) return;
    const t = this.ctx.currentTime + 0.005;
    const tone = lineTone(line);
    switch (cue) {
      case 'hover': {
        const now = performance.now();
        if (now - this.lastHover < 60) return;
        this.lastHover = now;
        this.voice(tone * 2, t, 0.09, 0.018);
        break;
      }
      case 'tick':
        this.voice(tone * 4, t, 0.03, 0.012, 'triangle');
        break;
      case 'type':
        this.noise(t, 0.025, 0.05, 3800, 2600, 3);
        break;
      case 'click':
        this.voice(tone / 4, t, 0.12, 0.09, 'sine', tone / 6);
        this.noise(t, 0.03, 0.05, 5200, 2400, 2);
        break;
      case 'open':
        this.voice(tone / 2, t, 0.34, 0.05, 'sine', tone);
        this.voice(tone, t + 0.05, 0.4, 0.025);
        break;
      case 'close':
        this.voice(tone, t, 0.3, 0.04, 'sine', tone / 2);
        break;
      case 'blink':
        this.noise(t, 0.62, 0.11, 2600, 260, 0.9);
        this.voice(tone / 8, t + 0.25, 0.9, 0.12, 'sine', tone / 10);
        this.voice(tone, t + 0.42, 1.3, 0.03);
        this.voice(tone * 1.5, t + 0.5, 1.2, 0.015);
        break;
      case 'success':
        this.voice(tone, t, 0.6, 0.035);
        this.voice(tone * 1.25, t + 0.09, 0.8, 0.03);
        break;
      case 'fragment': {
        const lines: SpectralKey[] = ['ha', 'na', 'o3', 'hb', 'ca'];
        lines.forEach((k, i) => this.voice(lineTone(k), t + i * 0.11, 1.6, 0.03));
        this.voice(tone / 4, t, 2.2, 0.06);
        break;
      }
      case 'error':
        this.voice(110, t, 0.22, 0.06, 'triangle');
        this.voice(116.5, t, 0.22, 0.05, 'triangle');
        break;
    }
  }
}

export const audio = new Engine();

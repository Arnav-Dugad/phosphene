import { channels, RECEIVER_BINS, RECEIVER_SAMPLE_RATE } from '../content/receiver.ts';
import { FFT, hannWindow } from '../lib/fft.ts';
import { createRng } from '../lib/random.ts';

/**
 * The Halden Deep Array's receiver, simulated. Seven narrow channels — one per
 * spectral line — carry the Serein carrier plus on–off keyed data bursts; a
 * slow Doppler drift follows the Moon's orbit; noise fills the rest. Each
 * row, the worker synthesises a block of baseband samples, transforms it and
 * posts one spectrogram row. Synthesis is seeded by wall-clock time, so every
 * visitor watching at the same moment sees the same signal.
 */
export type ReceiverCommand =
  | { type: 'start'; rate: number }
  | { type: 'snapshot'; rows: number; rate: number }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'stop' };

export interface ReceiverRow {
  type: 'row';
  /** Normalised magnitudes in [0, 1], RECEIVER_BINS long. */
  row: Float32Array;
  /** Channel index that carried a data burst in this row, or -1. */
  burst: number;
  /** Unix seconds the row represents. */
  time: number;
}

interface WorkerScope {
  onmessage: ((event: MessageEvent<ReceiverCommand>) => void) | null;
  postMessage(message: ReceiverRow, transfer: Transferable[]): void;
}

const scope = self as unknown as WorkerScope;
const SIZE = 1024;
const CHANNEL_HZ = channels.map((c) => c.hz);
const fft = new FFT(SIZE);
const window_ = hannWindow(SIZE);
const samples = new Float32Array(SIZE);
const re = new Float32Array(SIZE);
const im = new Float32Array(SIZE);
const db = new Float32Array(SIZE / 2);

let timer = 0;
let running = false;

function synthesise(now: number): ReceiverRow {
  // Seed by the row's time slot so simultaneous visitors see the same data.
  const rng = createRng(`receiver:${Math.floor(now * 20)}`);
  const lunarPhase = (now / (27.3217 * 86400)) * Math.PI * 2;
  const doppler = Math.cos(lunarPhase) * 3.5;
  const burst = rng.chance(0.15) ? rng.int(0, CHANNEL_HZ.length - 1) : -1;

  for (let i = 0; i < SIZE; i++) {
    const t = now + i / RECEIVER_SAMPLE_RATE;
    let v = 0;
    for (let c = 0; c < CHANNEL_HZ.length; c++) {
      const f = (CHANNEL_HZ[c] as number) + doppler;
      // Every channel breathes on its own slow cycle.
      const breath = 0.55 + 0.45 * Math.sin(2 * Math.PI * (t / 7.3 + c * 0.13));
      v += Math.sin(2 * Math.PI * f * t) * 0.12 * breath;
      if (c === burst) {
        // On–off keyed data: sidebands either side of the carrier.
        const bit = Math.sin(2 * Math.PI * 38 * t) > 0 ? 1 : 0;
        v += (Math.sin(2 * Math.PI * (f + 34) * t) + Math.sin(2 * Math.PI * (f - 34) * t)) * 0.06 * bit;
      }
    }
    samples[i] = v + (rng.next() - 0.5) * 0.35;
  }

  fft.magnitudeDb(samples, db, re, im, window_);
  const row = new Float32Array(RECEIVER_BINS);
  const span = db.length / RECEIVER_BINS;
  for (let b = 0; b < RECEIVER_BINS; b++) {
    let peak = -140;
    for (let k = 0; k < span; k++) peak = Math.max(peak, db[b * span + k] ?? -140);
    row[b] = Math.min(1, Math.max(0, (peak + 72) / 58));
  }
  return { type: 'row', row, burst, time: now };
}

function post(message: ReceiverRow): void {
  scope.postMessage(message, [message.row.buffer]);
}

scope.onmessage = (event) => {
  const command = event.data;
  switch (command.type) {
    case 'start':
      running = true;
      clearInterval(timer);
      timer = setInterval(() => {
        if (running) post(synthesise(Date.now() / 1000));
      }, 1000 / command.rate);
      break;
    case 'snapshot': {
      const now = Date.now() / 1000;
      for (let k = command.rows - 1; k >= 0; k--) post(synthesise(now - k / command.rate));
      break;
    }
    case 'pause':
      running = false;
      break;
    case 'resume':
      running = true;
      break;
    case 'stop':
      running = false;
      clearInterval(timer);
      break;
  }
};

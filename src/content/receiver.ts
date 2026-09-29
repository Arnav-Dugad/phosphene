import { spectralLines, spectralOrder, type SpectralKey } from '../design/tokens.ts';

/**
 * The Array receiver's simulated baseband. Kept apart from `array.ts` so the
 * receiver worker imports only these few constants.
 */
export interface Channel {
  key: SpectralKey;
  notation: string;
  nm: number;
  /** Baseband centre in the receiver's simulated spectrum, Hz. */
  hz: number;
}

/** 4096 samples per second, so 0–2048 Hz are visible. */
export const RECEIVER_SAMPLE_RATE = 4096;
/** Columns in one spectrogram row. */
export const RECEIVER_BINS = 256;

export const channels: readonly Channel[] = spectralOrder.map((key, i) => ({
  key,
  notation: spectralLines[key].notation,
  nm: spectralLines[key].nm,
  hz: 260 + i * 250,
}));

/**
 * In-place iterative radix-2 FFT with cached twiddle factors and bit-reversal
 * tables. Used by the Array's receiver (in a worker) and by the spectral
 * terrain instrument.
 */
export class FFT {
  readonly size: number;
  private readonly cos: Float32Array;
  private readonly sin: Float32Array;
  private readonly reversed: Uint32Array;

  constructor(size: number) {
    if (size < 2 || (size & (size - 1)) !== 0)
      throw new Error(`FFT size must be a power of two, got ${size}`);
    this.size = size;
    this.cos = new Float32Array(size / 2);
    this.sin = new Float32Array(size / 2);
    for (let i = 0; i < size / 2; i++) {
      this.cos[i] = Math.cos((-2 * Math.PI * i) / size);
      this.sin[i] = Math.sin((-2 * Math.PI * i) / size);
    }
    const bits = Math.log2(size);
    this.reversed = new Uint32Array(size);
    for (let i = 0; i < size; i++) {
      let r = 0;
      for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
      this.reversed[i] = r;
    }
  }

  /** Transforms (re, im) in place. */
  transform(re: Float32Array, im: Float32Array): void {
    const n = this.size;
    for (let i = 0; i < n; i++) {
      const j = this.reversed[i] as number;
      if (j > i) {
        const tr = re[i] as number;
        re[i] = re[j] as number;
        re[j] = tr;
        const ti = im[i] as number;
        im[i] = im[j] as number;
        im[j] = ti;
      }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const half = len >> 1;
      const step = n / len;
      for (let start = 0; start < n; start += len) {
        for (let k = 0; k < half; k++) {
          const wr = this.cos[k * step] as number;
          const wi = this.sin[k * step] as number;
          const a = start + k;
          const b = a + half;
          const br = re[b] as number;
          const bi = im[b] as number;
          const tr = br * wr - bi * wi;
          const ti = br * wi + bi * wr;
          const ar = re[a] as number;
          const ai = im[a] as number;
          re[b] = ar - tr;
          im[b] = ai - ti;
          re[a] = ar + tr;
          im[a] = ai + ti;
        }
      }
    }
  }

  /**
   * Magnitude spectrum in decibels of a real signal. Writes size/2 bins into
   * `out`. `scratchRe`/`scratchIm` avoid per-frame allocation.
   */
  magnitudeDb(
    signal: Float32Array,
    out: Float32Array,
    scratchRe: Float32Array,
    scratchIm: Float32Array,
    window: Float32Array,
  ): void {
    const n = this.size;
    for (let i = 0; i < n; i++) {
      scratchRe[i] = (signal[i] as number) * (window[i] as number);
      scratchIm[i] = 0;
    }
    this.transform(scratchRe, scratchIm);
    const norm = 2 / n;
    for (let i = 0; i < n / 2; i++) {
      const r = scratchRe[i] as number;
      const m = scratchIm[i] as number;
      const mag = Math.sqrt(r * r + m * m) * norm;
      out[i] = 20 * Math.log10(mag + 1e-9);
    }
  }
}

/** Hann window of length n. */
export function hannWindow(n: number): Float32Array {
  const w = new Float32Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
  return w;
}

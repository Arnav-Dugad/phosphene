import { useEffect, useRef } from 'react';
import { channels, RECEIVER_BINS, RECEIVER_SAMPLE_RATE } from '../../content/receiver.ts';
import { spectralLines } from '../../design/tokens.ts';
import { hexToRgb } from '../../lib/spectral.ts';
import type { RowHub } from './receiver.ts';
import styles from './Array.module.css';

export const SPECTROGRAM_ROWS = 128;
const NYQUIST = RECEIVER_SAMPLE_RATE / 2;

/**
 * Per-column tint: columns near a channel take its spectral line's colour,
 * so the seven carriers draw themselves as seven coloured traces.
 */
function columnTints(): Float32Array {
  const tints = new Float32Array(RECEIVER_BINS * 3);
  const neutral = [0.42, 0.47, 0.58] as const;
  for (let b = 0; b < RECEIVER_BINS; b++) {
    const hz = ((b + 0.5) / RECEIVER_BINS) * NYQUIST;
    let best = 0;
    let rgb: readonly number[] = neutral;
    for (const channel of channels) {
      const weight = Math.exp(-(((hz - channel.hz) / 60) ** 2));
      if (weight > best) {
        best = weight;
        rgb = hexToRgb(spectralLines[channel.key].nocturne);
      }
    }
    for (let c = 0; c < 3; c++) tints[b * 3 + c] = (neutral[c] as number) * (1 - best) + (rgb[c] as number) * best;
  }
  return tints;
}

/** A scrolling waterfall: newest row at the top, 6.4 seconds of history. */
export function Spectrogram({ hub, label }: { hub: RowHub; label: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { alpha: false });
    if (!canvas || !ctx) return;
    ctx.fillStyle = '#07080b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const tints = columnTints();
    const line = ctx.createImageData(RECEIVER_BINS, 1);
    return hub.subscribe(({ row }) => {
      ctx.drawImage(canvas, 0, 0, RECEIVER_BINS, SPECTROGRAM_ROWS - 1, 0, 1, RECEIVER_BINS, SPECTROGRAM_ROWS - 1);
      for (let b = 0; b < RECEIVER_BINS; b++) {
        const v = row[b] ?? 0;
        const energy = Math.pow(v, 1.7);
        const hot = Math.max(0, v - 0.82) * 3.2;
        const i = b * 4;
        for (let c = 0; c < 3; c++) {
          line.data[i + c] = Math.min(255, 7 + ((tints[b * 3 + c] as number) * energy + hot) * 255);
        }
        line.data[i + 3] = 255;
      }
      ctx.putImageData(line, 0, 0);
    });
  }, [hub]);

  return (
    <figure className={styles.spectrogram}>
      <div className={styles.channelScale} aria-hidden="true">
        {channels.map((channel) => (
          <span
            key={channel.key}
            className={styles.channelTick}
            style={{ left: `${(channel.hz / NYQUIST) * 100}%`, color: `var(--line-${channel.key})` }}
          >
            {channel.notation}
          </span>
        ))}
      </div>
      <canvas
        ref={canvasRef}
        className={styles.waterfall}
        width={RECEIVER_BINS}
        height={SPECTROGRAM_ROWS}
        role="img"
        aria-label={label}
      />
      <figcaption className={styles.axis} aria-hidden="true">
        <span>0 Hz</span>
        <span>Baseband · newest at top</span>
        <span>{NYQUIST} Hz</span>
      </figcaption>
    </figure>
  );
}

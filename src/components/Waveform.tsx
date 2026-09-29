import { memo, useMemo } from 'react';
import { createRng } from '../lib/random.ts';

/**
 * A procedural waveform signature: every transmission has its own, seeded by
 * its id, so the same story always "sounds" the same.
 */
export const Waveform = memo(function Waveform({
  seed,
  width = 320,
  height = 48,
  className,
}: {
  seed: string;
  width?: number;
  height?: number;
  className?: string;
}) {
  const d = useMemo(() => {
    const rng = createRng(`wave:${seed}`);
    const f1 = rng.range(8, 20);
    const f2 = rng.range(30, 70);
    const bursts = rng.int(2, 5);
    const phase = rng.next() * 10;
    const pts: string[] = [];
    for (let x = 0; x <= width; x += 2) {
      const t = x / width;
      const env = Math.sin(t * Math.PI);
      const burst = Math.max(0, Math.sin(t * Math.PI * bursts + phase)) ** 4;
      const y =
        height / 2 -
        (Math.sin(t * f1 + phase) * 0.3 +
          Math.sin(t * f2) * (0.12 + burst * 0.5) +
          (rng.next() - 0.5) * 0.08) *
          env *
          (height * 0.45);
      pts.push(`${x === 0 ? 'M' : 'L'}${x} ${y.toFixed(1)}`);
    }
    return pts.join('');
  }, [seed, width, height]);

  return (
    <svg
      className={className}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path d={d} pathLength={1} fill="none" stroke="currentColor" vectorEffect="non-scaling-stroke" />
    </svg>
  );
});

import { memo, useMemo } from 'react';
import type { Relic } from '../content/relics.ts';
import { generateRelicForm, projectPlate, type PlateLine } from '../lib/relicGeometry.ts';
import styles from './RelicPlate.module.css';

const SIZE = 240;
const cache = new Map<string, PlateLine[]>();

function plateFor(relic: Relic): PlateLine[] {
  let lines = cache.get(relic.id);
  if (!lines) {
    lines = projectPlate(generateRelicForm(relic.kind, relic.seed, 0), SIZE);
    cache.set(relic.id, lines);
  }
  return lines;
}

interface RelicPlateProps {
  relic: Relic;
  className?: string;
  /** Draw strokes in when first shown. */
  draw?: boolean;
  /** Show catalogue marks around the engraving. */
  marks?: boolean;
}

/**
 * A relic as an engraved plate: its reconstruction projected into hairlines,
 * nearer lines stronger, like a museum drawing made by an instrument.
 */
export const RelicPlate = memo(function RelicPlate({
  relic,
  className,
  draw = false,
  marks = true,
}: RelicPlateProps) {
  const lines = useMemo(() => plateFor(relic), [relic]);
  return (
    <svg
      className={`${styles.plate} ${className ?? ''}`}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="img"
      aria-label={`Engraved reconstruction of ${relic.name}`}
      data-draw-plate={draw || undefined}
      style={{ ['--plate-line' as string]: `var(--line-${relic.line})` }}
    >
      {marks && (
        <g className={styles.marks} aria-hidden="true">
          <path d="M8 20V8h12M232 20V8h-12M8 220v12h12M232 220v12h-12" />
          <text x="14" y="30">
            {relic.catalog}
          </text>
          <text x="226" y="30" textAnchor="end">
            {relic.integrity}%
          </text>
        </g>
      )}
      <g className={styles.lines}>
        {lines.map((line, i) => (
          <path
            key={i}
            d={line.d}
            pathLength={1}
            style={{
              opacity: 0.18 + (1 - line.depth) * 0.72,
              ['--li' as string]: i,
            }}
          />
        ))}
      </g>
    </svg>
  );
});

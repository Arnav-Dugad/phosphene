import { useId, type CSSProperties } from 'react';
import styles from './Controls.module.css';

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  /** Human-readable value, also exposed as aria-valuetext. */
  format?: (value: number) => string;
  /** Optional tick positions (in value units) with labels. */
  marks?: readonly { value: number; label?: string }[];
  className?: string;
  hideLabel?: boolean;
}

/** A native range input dressed as an instrument dial: luminous fill, hairline track, ticks. */
export function Slider({ label, value, min, max, step = 0.01, onChange, format, marks, className, hideLabel }: SliderProps) {
  const id = useId();
  const pct = ((value - min) / (max - min)) * 100;
  const text = format ? format(value) : String(Math.round(value * 100) / 100);
  return (
    <div className={`${styles.slider} ${className ?? ''}`}>
      <div className={styles.sliderHead}>
        <label htmlFor={id} className={hideLabel ? 'sr-only' : styles.label}>
          {label}
        </label>
        <output htmlFor={id} className={styles.value}>
          {text}
        </output>
      </div>
      <div className={styles.rangeWrap} style={{ '--pct': `${pct}%` } as CSSProperties}>
        <input
          id={id}
          type="range"
          className={styles.range}
          min={min}
          max={max}
          step={step}
          value={value}
          aria-valuetext={text}
          onChange={(e) => onChange(Number(e.target.value))}
          data-cursor="drag"
        />
        {marks && (
          <div className={styles.marks} aria-hidden="true">
            {marks.map((m) => (
              <span key={m.value} className={styles.mark} style={{ left: `${((m.value - min) / (max - min)) * 100}%` }}>
                {m.label && <span className={styles.markLabel}>{m.label}</span>}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

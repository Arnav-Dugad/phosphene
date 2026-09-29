import { useId, type CSSProperties } from 'react';
import styles from './Controls.module.css';

interface Option<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: readonly Option<T>[];
  onChange: (value: T) => void;
  className?: string;
  hideLabel?: boolean;
}

/**
 * A segmented control built on native radio inputs (arrow keys, form
 * semantics and screen-reader grouping come for free) with a sliding light.
 */
export function Segmented<T extends string>({ label, value, options, onChange, className, hideLabel }: SegmentedProps<T>) {
  const name = useId();
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <fieldset className={`${styles.segmented} ${className ?? ''}`}>
      <legend className={hideLabel ? 'sr-only' : styles.label}>{label}</legend>
      <div
        className={styles.segments}
        style={{ '--count': options.length, '--index': index } as CSSProperties}
      >
        <span className={styles.indicator} aria-hidden="true" />
        {options.map((option) => (
          <label key={option.value} className={styles.segment} title={option.hint}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={option.value === value}
              onChange={() => onChange(option.value)}
              className={styles.radio}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

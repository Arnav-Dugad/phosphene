import { useState, type CSSProperties, type ReactNode } from 'react';
import { Icon } from '../../components/Icon.tsx';
import { TransitionLink } from '../../components/TransitionLink.tsx';
import { instruments, type Instrument } from '../../content/instruments.ts';
import { pad } from '../../lib/format.ts';
import styles from './Instrument.module.css';

/**
 * The instrument's control panel: a glass panel on wide screens, a collapsible
 * bottom sheet on phones so the simulation keeps the stage.
 */
export function InstrumentPanel({ instrument, children }: { instrument: Instrument; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  const index = instruments.findIndex((i) => i.slug === instrument.slug);
  const prev = instruments[(index - 1 + instruments.length) % instruments.length];
  const next = instruments[(index + 1) % instruments.length];

  return (
    <aside
      className={styles.panel}
      data-open={open}
      style={{ '--instrument-line': `var(--line-${instrument.line})` } as CSSProperties}
      aria-labelledby="instrument-title"
    >
      <div className={styles.panelHead}>
        <TransitionLink to="/instruments" className={styles.back}>
          <Icon name="arrowLeft" size={14} /> Instruments · {pad(index + 1)}/{pad(instruments.length)}
        </TransitionLink>
        <button
          type="button"
          className={styles.sheetToggle}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Collapse the controls' : 'Expand the controls'}
        >
          <Icon name={open ? 'chevronDown' : 'chevronUp'} size={16} />
        </button>
      </div>
      <h1 id="instrument-title" className={styles.name}>
        {instrument.name}
      </h1>
      <p className={styles.epithet}>{instrument.epithet}</p>

      <div className={styles.panelBody}>
        <div className={styles.controls}>{children}</div>

        <details className={styles.details}>
          <summary>How it works</summary>
          <p className={styles.principle}>{instrument.principle}</p>
          <p>{instrument.summary}</p>
          <p className={styles.lore}>{instrument.lore}</p>
          <ul>
            {instrument.controls.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </details>

        <nav className={styles.pager} aria-label="Other instruments">
          {prev && (
            <TransitionLink to={`/instruments/${prev.slug}`} line={prev.line}>
              <Icon name="arrowLeft" size={14} /> {prev.name}
            </TransitionLink>
          )}
          {next && (
            <TransitionLink to={`/instruments/${next.slug}`} line={next.line}>
              {next.name} <Icon name="arrowRight" size={14} />
            </TransitionLink>
          )}
        </nav>
      </div>
    </aside>
  );
}

/** A labelled group of buttons for presets. */
export function PresetRow<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className={styles.presets} role="group" aria-label={label}>
      <p className={styles.groupLabel}>{label}</p>
      <div className={styles.presetButtons}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={o.value === value}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ActionRow({ children }: { children: ReactNode }) {
  return <div className={styles.actions}>{children}</div>;
}

export function Readout({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className={styles.readout}>
      <span>{label}</span>
      <span className={styles.readoutValue}>{value}</span>
    </div>
  );
}

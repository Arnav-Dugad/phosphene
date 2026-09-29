import styles from './Controls.module.css';

interface SwitchProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}

/** An on/off switch: a luminous bead that travels a hairline slot. */
export function Switch({ label, description, checked, onChange, className }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={`${styles.switchRow} ${className ?? ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.switchText}>
        <span className={styles.switchLabel}>{label}</span>
        {description && <span className={styles.switchDescription}>{description}</span>}
      </span>
      <span className={styles.switch} data-on={checked} aria-hidden="true">
        <span className={styles.bead} />
      </span>
    </button>
  );
}

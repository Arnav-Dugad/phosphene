import styles from './Wordmark.module.css';

/**
 * The mark: an aperture (the eye, the lens, the ring of the Lacuna) with a
 * phosphene — a point of light that isn't really there — and the faint arc of
 * its afterimage.
 */
export function ApertureMark({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg
      className={`${styles.mark} ${className ?? ''}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="10.25" stroke="currentColor" strokeWidth="1.1" />
      <path
        className={styles.afterimage}
        d="M4.9 15.6a8 8 0 0 0 4.6 4.1"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      <g className={styles.orbit}>
        <circle className={styles.dot} cx="15.6" cy="8.4" r="2" />
      </g>
    </svg>
  );
}

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={styles.wordmark}>
      <ApertureMark />
      {!compact && <span className={styles.word}>Phosphene</span>}
    </span>
  );
}

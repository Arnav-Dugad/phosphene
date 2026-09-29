import type { CSSProperties } from 'react';
import styles from './FlareText.module.css';

/**
 * Text that light passes over: on hover or focus of the nearest interactive
 * ancestor each letter briefly takes the page's spectral colour, left to
 * right. Screen readers get the plain text once.
 */
export function FlareText({ text, className }: { text: string; className?: string }) {
  return (
    <span className={`${styles.flare} ${className ?? ''}`}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true" className={styles.chars}>
        {Array.from(text).map((char, i) => (
          <span key={i} className={styles.char} style={{ '--i': i } as CSSProperties}>
            {char === ' ' ? ' ' : char}
          </span>
        ))}
      </span>
    </span>
  );
}

export const flareHostClass = styles.flareHost ?? '';

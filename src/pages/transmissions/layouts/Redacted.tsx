import { Fragment, useState } from 'react';
import styles from '../Story.module.css';

function Redaction({ phrase }: { phrase: string }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      type="button"
      className={styles.redacted}
      aria-pressed={open}
      data-open={open}
      onClick={() => setOpen((v) => !v)}
      data-cursor-label={open ? 'Redact' : 'Decode'}
    >
      {phrase}
    </button>
  );
}

/**
 * Text in which some phrases were redacted in the logbook: a bar that decodes
 * on hover, or when pressed (so touch and keyboard users can read it too).
 * Assistive technology always receives the phrase itself.
 */
export function RedactedText({ text, redacted = [] }: { text: string; redacted?: readonly string[] }) {
  if (redacted.length === 0) return <>{text}</>;
  const pattern = new RegExp(`(${redacted.map((r) => r.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g');
  return (
    <>
      {text.split(pattern).map((part, i) =>
        redacted.includes(part) ? <Redaction key={i} phrase={part} /> : <Fragment key={i}>{part}</Fragment>,
      )}
    </>
  );
}

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Icon } from '../../components/Icon.tsx';
import { useUi, type Toast } from '../../stores/ui.ts';
import styles from './Toasts.module.css';

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useUi((s) => s.dismissToast);
  const [paused, setPaused] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const remaining = useRef(toast.ttl);
  const started = useRef(performance.now());

  useEffect(() => {
    if (paused || leaving) return;
    started.current = performance.now();
    const id = window.setTimeout(() => setLeaving(true), remaining.current);
    return () => {
      window.clearTimeout(id);
      remaining.current -= performance.now() - started.current;
    };
  }, [paused, leaving]);

  useEffect(() => {
    if (!leaving) return;
    const id = window.setTimeout(() => dismiss(toast.id), 420);
    return () => window.clearTimeout(id);
  }, [leaving, dismiss, toast.id]);

  return (
    <li
      className={styles.toast}
      data-tone={toast.tone}
      data-leaving={leaving}
      style={{ '--toast-line': `var(--line-${toast.line ?? 'na'})`, '--ttl': `${toast.ttl}ms` } as CSSProperties}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <span className={styles.glyph} aria-hidden="true" />
      <div className={styles.text}>
        <p className={styles.title}>{toast.title}</p>
        {toast.body && <p className={toast.tone === 'fragment' ? styles.quote : styles.body}>{toast.body}</p>}
      </div>
      <button type="button" className={styles.close} onClick={() => setLeaving(true)} aria-label="Dismiss notification">
        <Icon name="close" size={14} />
      </button>
      <span className={styles.timer} data-paused={paused} aria-hidden="true" />
    </li>
  );
}

/** Notifications: announced politely, pausable on hover or focus, dismissible. */
export function Toasts() {
  const toasts = useUi((s) => s.toasts);
  return (
    <section className={styles.region} aria-label="Notifications" data-print="hide">
      <ol role="list" className={styles.list} aria-live="polite" aria-relevant="additions">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} />
        ))}
      </ol>
    </section>
  );
}

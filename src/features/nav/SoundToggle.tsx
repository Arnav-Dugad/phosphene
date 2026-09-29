import { useSound } from '../audio/useSound.ts';
import styles from './SoundToggle.module.css';

/** Five bars that breathe when sound is on and lie flat when it is off. */
export function SoundToggle({ className }: { className?: string }) {
  const { enabled, toggle } = useSound();
  return (
    <button
      type="button"
      className={`${styles.toggle} ${className ?? ''}`}
      aria-pressed={enabled}
      aria-label={enabled ? 'Sound on — mute' : 'Sound off — unmute'}
      data-cursor-label={enabled ? 'Mute' : 'Sound'}
      data-state={enabled ? 'on' : 'off'}
      onClick={toggle}
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} className={styles.bar} style={{ animationDelay: `${i * -170}ms` }} />
      ))}
    </button>
  );
}

import { useId, useState } from 'react';
import { IthranText } from '../../../components/IthranText.tsx';
import { TransitionLink } from '../../../components/TransitionLink.tsx';
import { useProgress } from '../../../stores/progress.ts';
import { toast } from '../../../stores/ui.ts';
import styles from '../Story.module.css';

/** Inline transliteration widget in "A Grammar of Light". */
export function GlyphTry() {
  const id = useId();
  const sigil = useProgress((s) => s.sigil);
  const setSigil = useProgress((s) => s.setSigil);
  const [text, setText] = useState(sigil ?? 'phosphene');
  const clean = text.replace(/[^a-z0-9 ]/gi, '').slice(0, 24);

  return (
    <div className={styles.try}>
      <label htmlFor={id} className={styles.tryLabel}>
        Write a name
      </label>
      <input
        id={id}
        className={styles.tryInput}
        value={text}
        maxLength={24}
        onChange={(e) => setText(e.target.value)}
        autoComplete="off"
        spellCheck={false}
      />
      <div className={styles.tryOutput} aria-live="polite">
        {clean.trim() ? (
          <IthranText text={clean} size={30} weight={1.1} />
        ) : (
          <span className={styles.tryEmpty}>Letters and numbers only — the aperture has no glyphs for punctuation.</span>
        )}
      </div>
      <div className={styles.tryActions}>
        <button
          type="button"
          className={styles.tryButton}
          disabled={!clean.trim()}
          onClick={() => {
            setSigil(clean);
            toast({ tone: 'success', title: 'Sigil kept', body: `The observatory will remember “${clean.trim()}”.`, line: 'hb' });
          }}
        >
          Keep as my sigil
        </button>
        <TransitionLink to="/instruments/glyphs" className={styles.tryLink}>
          Open the Glyph Synthesizer →
        </TransitionLink>
      </div>
    </div>
  );
}

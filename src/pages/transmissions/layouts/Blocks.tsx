import type { StoryBlock } from '../../../content/stories.ts';
import { IthranText } from '../../../components/IthranText.tsx';
import { resolveStoryText } from '../../../lib/storyText.ts';
import { GlyphTry } from './GlyphTry.tsx';
import { RedactedText } from './Redacted.tsx';
import styles from '../Story.module.css';

/** Renders one story block in the default editorial style. Layouts may override. */
export function Block({ block }: { block: StoryBlock }) {
  switch (block.type) {
    case 'lead':
      return <p className={styles.lead}>{resolveStoryText(block.text)}</p>;
    case 'p':
      return <p className={styles.p}>{resolveStoryText(block.text)}</p>;
    case 'h':
      return <h2 className={styles.h}>{block.text}</h2>;
    case 'quote':
      return (
        <blockquote className={styles.quote}>
          <p>“{resolveStoryText(block.text)}”</p>
          {block.cite && <footer>— {block.cite}</footer>}
        </blockquote>
      );
    case 'pull':
      return (
        <p className={styles.pull} role="doc-pullquote">
          {resolveStoryText(block.text)}
        </p>
      );
    case 'glyph':
      return (
        <figure className={styles.glyph}>
          <div className={styles.glyphArt}>
            <IthranText
              text={block.word}
              size={block.word.length > 1 ? 34 : 110}
              mode={block.word.length > 1 ? 'rosette' : 'line'}
              weight={block.word.length > 1 ? 1.1 : 1.4}
              draw
            />
          </div>
          <figcaption>{block.caption}</figcaption>
        </figure>
      );
    case 'try':
      return <GlyphTry />;
    case 'entry':
      return (
        <article className={styles.entry}>
          <p className={styles.entryDate}>{resolveStoryText(block.date)}</p>
          <p className={styles.entryText}>
            <RedactedText text={resolveStoryText(block.text)} redacted={block.redacted} />
          </p>
          <p className={styles.entryAuthor}>{block.author}</p>
        </article>
      );
    case 'gap':
      return (
        <div className={styles.gap} role="img" aria-label={`${block.label}: ${block.minutes} minutes without signal`}>
          <span className={styles.gapLine} aria-hidden="true" />
          <span className={styles.gapLabel} aria-hidden="true">
            {block.label} · {block.minutes} min
          </span>
        </div>
      );
  }
}

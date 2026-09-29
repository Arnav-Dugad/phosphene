import type { CSSProperties } from 'react';
import { useParams } from 'react-router';
import { Icon } from '../../components/Icon.tsx';
import { TransitionLink } from '../../components/TransitionLink.tsx';
import { Waveform } from '../../components/Waveform.tsx';
import { eraById } from '../../content/eras.ts';
import { stories, storyBySlug, type Story } from '../../content/stories.ts';
import type { LacunaMode, SpectralKey } from '../../content/types.ts';
import { usePageMeta } from '../../hooks/usePageMeta.ts';
import { useStageScene } from '../../hooks/useStageScene.ts';
import { ChoirLayout, GrammarLayout, JournalLayout, LamplightersLayout, SilenceLayout } from './layouts/Layouts.tsx';
import styles from './Story.module.css';

const SCENES: Record<Story['layout'], { mode: LacunaMode; tint: SpectralKey }> = {
  lamplighters: { mode: 'lanterns', tint: 'na' },
  grammar: { mode: 'dusk', tint: 'hb' },
  choir: { mode: 'choir', tint: 'ca' },
  journal: { mode: 'dusk', tint: 'he' },
  silence: { mode: 'ambient', tint: 'he' },
};

function StoryBody({ story }: { story: Story }) {
  switch (story.layout) {
    case 'lamplighters':
      return <LamplightersLayout story={story} />;
    case 'grammar':
      return <GrammarLayout story={story} />;
    case 'choir':
      return <ChoirLayout story={story} />;
    case 'journal':
      return <JournalLayout story={story} />;
    case 'silence':
      return <SilenceLayout story={story} />;
  }
}

export default function StoryPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const story = storyBySlug(slug);
  usePageMeta(
    story
      ? { title: `${story.title} — Transmissions`, description: story.excerpt }
      : { title: 'Transmission not found', description: 'No transmission has been received under this name.' },
  );
  const scene = story ? SCENES[story.layout] : SCENES.silence;
  useStageScene('lacuna', scene);

  if (!story) {
    return (
      <div className={`container ${styles.missing}`}>
        <p className="t-kicker">04 · Transmissions</p>
        <h1 className={styles.title}>Nothing received under that name.</h1>
        <TransitionLink to="/transmissions" className={styles.back}>
          <Icon name="arrowLeft" size={15} /> All transmissions
        </TransitionLink>
      </div>
    );
  }

  const era = story.era ? eraById(story.era) : null;
  const index = stories.findIndex((s) => s.slug === story.slug);
  const next = stories[(index + 1) % stories.length];

  return (
    <article
      className={styles.story}
      data-layout={story.layout}
      style={{ '--story-line': `var(--line-${story.line})` } as CSSProperties}
    >
      <header className={`container ${styles.header}`}>
        <TransitionLink to="/transmissions" className={styles.back}>
          <Icon name="arrowLeft" size={15} /> Transmissions
        </TransitionLink>
        <p className={styles.kind}>
          {story.kind}
          {era ? ` · ${era.numeral} · ${era.name}` : ''}
        </p>
        <h1 className={styles.title}>{story.title}</h1>
        <p className={styles.subtitle}>{story.subtitle}</p>
        <dl className={styles.meta}>
          <div>
            <dt>Credit</dt>
            <dd>{story.translator}</dd>
          </div>
          <div>
            <dt>Received</dt>
            <dd>{story.received}</dd>
          </div>
          <div>
            <dt>Reading</dt>
            <dd>{story.minutes} minutes</dd>
          </div>
          {story.confidence !== null && (
            <div>
              <dt>Confidence</dt>
              <dd className={styles.confidence}>
                <span aria-hidden="true">
                  <span style={{ width: `${story.confidence}%` }} />
                </span>
                {story.confidence}%
              </dd>
            </div>
          )}
        </dl>
      </header>

      <div className={`container ${styles.body}`}>
        <StoryBody story={story} />
      </div>

      <footer className={`container ${styles.end}`}>
        <Waveform seed={story.slug} className={styles.endWave} />
        <p className={styles.endLabel}>End of transmission</p>
        {next && next.slug !== story.slug && (
          <TransitionLink
            to={`/transmissions/${next.slug}`}
            className={styles.next}
            style={{ '--next-line': `var(--line-${next.line})` } as CSSProperties}
            data-cursor-label="Receive"
          >
            <span className={styles.nextLabel}>Next transmission</span>
            <span className={styles.nextTitle}>{next.title}</span>
            <span className={styles.nextExcerpt}>“{next.excerpt}”</span>
          </TransitionLink>
        )}
      </footer>
    </article>
  );
}

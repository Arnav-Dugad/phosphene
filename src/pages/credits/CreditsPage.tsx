import { useState } from 'react';
import { Icon } from '../../components/Icon.tsx';
import { TransitionLink } from '../../components/TransitionLink.tsx';
import { ApertureMark } from '../../components/Wordmark.tsx';
import { keepers } from '../../content/institute.ts';
import { world } from '../../content/world.ts';
import { usePageMeta } from '../../hooks/usePageMeta.ts';
import { useResolvedMotion } from '../../hooks/useResolvedMotion.ts';
import { useStageScene } from '../../hooks/useStageScene.ts';
import styles from './Credits.module.css';

interface Credit {
  role: string;
  names: readonly string[];
}

interface Reel {
  title: string;
  credits: readonly Credit[];
}

const REELS: readonly Reel[] = [
  {
    title: 'Sent by',
    credits: [
      { role: 'The memory of', names: ['The Ithra of Vael, all of them'] },
      { role: 'Read into the Choir on the last night', names: ['Four thousand and eleven voices'] },
      {
        role: 'The Accord of Dusk',
        names: ['Everyone who chose to be remembered', 'Everyone who chose to fade'],
      },
    ],
  },
  {
    title: 'Received by',
    credits: [
      ...keepers.map((k) => ({ role: k.role, names: [k.name] })),
      { role: 'The night watch', names: ['Ninety years of it, and counting'] },
      { role: 'Volunteer readers', names: ['Four thousand, in forty languages'] },
    ],
  },
  {
    title: 'Set in',
    credits: [
      { role: 'Display', names: ['Cormorant — Christian Thalmann'] },
      { role: 'Text', names: ['Mona Sans — GitHub'] },
      { role: 'Data', names: ['Martian Mono — Evil Martians'] },
    ],
  },
  {
    title: 'Made with',
    credits: [
      { role: 'Rendering', names: ['three.js', 'postprocessing'] },
      { role: 'Interface', names: ['React', 'React Router'] },
      { role: 'Motion', names: ['GSAP', 'Lenis'] },
      { role: 'State and tooling', names: ['zustand', 'Vite', 'TypeScript'] },
      { role: 'Written and built', names: ['with Claude, by Anthropic'] },
    ],
  },
  {
    title: 'Light and sound',
    credits: [
      {
        role: 'Every colour',
        names: ['Seven spectral lines of hydrogen, sodium, magnesium, oxygen, helium and calcium'],
      },
      { role: 'Every sound', names: ['Those same lines, forty octaves down'] },
      { role: 'Every star, relic and world', names: ['Generated in your browser, just now'] },
    ],
  },
];

export default function CreditsPage() {
  usePageMeta('credits');
  useStageScene('lacuna', { mode: 'credits', tint: 'na' });
  const motion = useResolvedMotion();
  const [rolling, setRolling] = useState(motion !== 'still');
  const [paused, setPaused] = useState(false);

  return (
    <div className={styles.page} data-rolling={rolling} data-paused={paused}>
      <div className={styles.controls}>
        {rolling && (
          <button
            type="button"
            className={styles.control}
            onClick={() => setPaused((p) => !p)}
            aria-pressed={paused}
          >
            <Icon name={paused ? 'play' : 'pause'} size={13} />
            {paused ? 'Resume' : 'Pause'}
          </button>
        )}
        <button
          type="button"
          className={styles.control}
          onClick={() => setRolling((r) => !r)}
          aria-pressed={!rolling}
        >
          <Icon name={rolling ? 'list' : 'play'} size={13} />
          {rolling ? 'Read at my own pace' : 'Roll the credits'}
        </button>
      </div>

      <div className={styles.viewport}>
        {/* Focusing a link inside the roll stops it, so it is never carried off-screen. */}
        <div
          className={styles.roll}
          onFocus={(e) => {
            if (e.target instanceof HTMLElement && e.target.matches('a, button')) setRolling(false);
          }}
        >
          <header className={styles.opening}>
            <ApertureMark size={64} className={styles.mark} />
            <h1 className={styles.title}>
              {world.name}
              <span className={styles.subtitle}>Credits</span>
            </h1>
            <p className={styles.tagline}>{world.tagline}</p>
          </header>

          {REELS.map((reel) => (
            <section key={reel.title} className={styles.reel} aria-label={reel.title}>
              <h2 className={styles.reelTitle}>{reel.title}</h2>
              <dl className={styles.credits}>
                {reel.credits.map((credit) => (
                  <div key={`${credit.role}-${credit.names.join()}`} className={styles.credit}>
                    <dt>{credit.role}</dt>
                    {credit.names.map((name) => (
                      <dd key={name}>{name}</dd>
                    ))}
                  </div>
                ))}
              </dl>
            </section>
          ))}

          <footer className={styles.closing}>
            <p className={styles.closingLine}>We were here. You are here.</p>
            <p className={styles.closingLine}>For a moment, the light connects us.</p>
            <p className={styles.fiction}>
              {world.name} is a work of fiction. The Ithra, the Institute and the Serein Signal are invented;
              the sky they live in is real.
            </p>
            <TransitionLink to="/" className={styles.home} line="na">
              Return to Arrival <Icon name="arrowRight" size={16} />
            </TransitionLink>
          </footer>
        </div>
      </div>
    </div>
  );
}

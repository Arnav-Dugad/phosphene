import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { world } from '../../content/world.ts';
import { cssEase, easing } from '../../design/motion.ts';
import { setChannel } from '../../engine/input.ts';
import { useResolvedMotion } from '../../hooks/useResolvedMotion.ts';
import { useProgress } from '../../stores/progress.ts';
import { useSettings } from '../../stores/settings.ts';
import { useStage } from '../../stores/stage.ts';
import { useUi } from '../../stores/ui.ts';
import { ScrambleText } from '../../components/ScrambleText.tsx';
import { lockScroll } from '../scroll/scroller.ts';
import { audio } from '../audio/AudioEngine.ts';
import styles from './Intro.module.css';

type Variant = 'full' | 'short' | 'none';

const BOOT_MIN: Record<Variant, number> = { full: 1500, short: 450, none: 0 };
const DEFINITION_MS = 5600;
const OPEN_MS: Record<Variant, number> = { full: 2600, short: 1500, none: 350 };

function sinceLabel(timestamp: number | null): string | null {
  if (!timestamp) return null;
  const seconds = (Date.now() - timestamp) / 1000;
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (seconds < 3600) return rtf.format(-Math.max(1, Math.round(seconds / 60)), 'minute');
  if (seconds < 86_400) return rtf.format(-Math.round(seconds / 3600), 'hour');
  return rtf.format(-Math.round(seconds / 86_400), 'day');
}

function IntroSequence({ replay }: { replay: boolean }) {
  const motion = useResolvedMotion();
  const pref = useSettings((s) => s.intro);
  const phase = useUi((s) => s.introPhase);
  const setPhase = useUi((s) => s.setIntroPhase);
  const loadProgress = useStage((s) => s.loadProgress);
  const [fontsReady, setFontsReady] = useState(false);
  const [minElapsed, setMinElapsed] = useState(false);
  const [canSkip, setCanSkip] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const pctRef = useRef<HTMLSpanElement>(null);

  const [variant] = useState<Variant>(() => {
    if (motion === 'still') return 'none';
    if (replay || pref === 'always') return 'full';
    if (pref === 'never') return 'short';
    return useProgress.getState().introSeen ? 'short' : 'full';
  });

  const welcome = useMemo(() => {
    const { previousVisit, fragments } = useProgress.getState();
    const since = sinceLabel(previousVisit);
    if (!since || replay) return null;
    const count = Object.keys(fragments).length;
    return `Welcome back, observer · last link ${since}${count ? ` · ${count}/12 fragments decoded` : ''}`;
  }, [replay]);

  // Take over from the static boot screen and hold the world dark.
  useLayoutEffect(() => {
    document.getElementById('boot')?.remove();
    setChannel('stage.reveal', 0);
    setPhase('boot');
    lockScroll(true);
    return () => lockScroll(false);
  }, [setPhase]);

  useEffect(() => {
    let alive = true;
    void Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2600))]).then(() => {
      if (alive) setFontsReady(true);
    });
    const min = window.setTimeout(() => setMinElapsed(true), BOOT_MIN[variant]);
    const skip = window.setTimeout(() => setCanSkip(true), 1100);
    return () => {
      alive = false;
      window.clearTimeout(min);
      window.clearTimeout(skip);
    };
  }, [variant]);

  // The percentage readout eases toward real progress.
  useEffect(() => {
    if (phase !== 'boot') return;
    let shown = 0;
    let raf = 0;
    const tick = (): void => {
      const target = Math.min(useStage.getState().loadProgress, fontsReady ? 1 : 0.92);
      shown += (target - shown) * 0.08;
      if (pctRef.current) pctRef.current.textContent = `${String(Math.floor(shown * 100)).padStart(2, '0')}%`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, fontsReady]);

  // Boot → definition (first visit) or straight to opening.
  useEffect(() => {
    if (phase === 'boot' && loadProgress >= 1 && fontsReady && minElapsed) {
      setPhase(variant === 'full' ? 'definition' : 'opening');
    }
  }, [phase, loadProgress, fontsReady, minElapsed, variant, setPhase]);

  useEffect(() => {
    if (phase !== 'definition') return;
    const id = window.setTimeout(() => setPhase('opening'), DEFINITION_MS);
    return () => window.clearTimeout(id);
  }, [phase, setPhase]);

  // Opening: the aperture widens; the world's own ring grows in step.
  useEffect(() => {
    const root = rootRef.current;
    if (phase !== 'opening' || !root) return;
    const duration = OPEN_MS[variant];
    audio.play('blink', 'na');
    const start = performance.now();
    let raf = 0;
    const step = (now: number): void => {
      const t = Math.min(1, (now - start) / duration);
      setChannel('stage.reveal', easing.inOut(t));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    const animation = root.animate([{ '--iris': '0px' }, { '--iris': '160vmax' }] as Keyframe[], {
      duration,
      easing: cssEase.inOut,
      fill: 'forwards',
    });
    const finish = (): void => {
      setChannel('stage.reveal', 1);
      useProgress.getState().markIntroSeen();
      lockScroll(false);
      setPhase('done');
    };
    animation.finished.then(finish, finish);
    return () => {
      cancelAnimationFrame(raf);
      animation.cancel();
    };
  }, [phase, variant, setPhase]);

  // Any key or click after the first moment skips ahead.
  useEffect(() => {
    if (!canSkip || (phase !== 'definition' && phase !== 'boot')) return;
    const skip = (e: Event): void => {
      if (e instanceof KeyboardEvent && (e.key === 'Tab' || e.metaKey || e.ctrlKey)) return;
      if (useStage.getState().loadProgress >= 1) setPhase('opening');
    };
    window.addEventListener('keydown', skip);
    window.addEventListener('pointerdown', skip);
    return () => {
      window.removeEventListener('keydown', skip);
      window.removeEventListener('pointerdown', skip);
    };
  }, [canSkip, phase, setPhase]);

  if (phase === 'done') return null;

  const status =
    loadProgress < 0.45 ? 'Establishing link' : loadProgress < 1 ? 'Acquiring signal' : 'Signal locked';

  return (
    <div ref={rootRef} className={styles.intro} data-phase={phase} data-variant={variant} aria-live="polite">
      <div className={styles.top} aria-hidden="true">
        <span>{world.array}</span>
        <span>Channel 7</span>
      </div>

      {phase === 'boot' && (
        <div className={styles.aperture} aria-hidden="true">
          <span className={styles.dot} />
        </div>
      )}

      {phase === 'definition' && (
        <div className={styles.definition}>
          <h2 className={styles.word}>
            <ScrambleText text={world.definition.word} stagger={70} />
          </h2>
          <p className={styles.pron}>
            <span>{world.definition.pronunciation}</span>
            <span className={styles.pos}>{world.definition.partOfSpeech}</span>
          </p>
          <p className={styles.sense}>{world.definition.sense}</p>
          <p className={styles.coda}>
            What you are about to see left its source thirty-six thousand years ago.
          </p>
        </div>
      )}

      <div className={styles.bottom}>
        <span aria-hidden="true">{welcome ?? status}</span>
        {phase === 'boot' && (
          <span ref={pctRef} className="t-numeric" aria-hidden="true">
            00%
          </span>
        )}
        {canSkip && (phase === 'definition' || phase === 'boot') && variant === 'full' && (
          <button type="button" className={styles.skip} onClick={() => setPhase('opening')}>
            Skip <span aria-hidden="true">↵</span>
          </button>
        )}
      </div>
      <p className="sr-only">{phase === 'boot' ? `${status}…` : 'Arriving at the observatory.'}</p>
    </div>
  );
}

/** The arrival sequence. Keyed by `introRun` so a replay starts fresh. */
export function Intro() {
  const run = useUi((s) => s.introRun);
  return <IntroSequence key={run} replay={run > 0} />;
}

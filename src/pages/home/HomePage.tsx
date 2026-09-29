import { useEffect } from 'react';
import { setChannel } from '../../engine/input.ts';
import { usePageMeta } from '../../hooks/usePageMeta.ts';
import { useStageScene } from '../../hooks/useStageScene.ts';
import { AgesChapter } from './AgesChapter.tsx';
import { ClimaxChapter } from './ClimaxChapter.tsx';
import { Hero } from './Hero.tsx';
import { SignalChapter } from './SignalChapter.tsx';
import { SurvivedChapter } from './SurvivedChapter.tsx';
import styles from './Home.module.css';

/**
 * Arrival. Five chapters paced quiet → discovery → spectacle → quiet → climax,
 * each reporting its progress to the stage so the camera can fly the
 * Lacuna in step with the reading.
 */
export default function HomePage() {
  usePageMeta('arrival');
  useStageScene('lacuna', { mode: 'home' });

  useEffect(() => {
    setChannel('home.chapter', 0);
    return () => setChannel('home.chapter', 0);
  }, []);

  return (
    <div className={styles.home}>
      <Hero index={0} />
      <SignalChapter index={1} />
      <AgesChapter index={2} />
      <SurvivedChapter index={3} />
      <ClimaxChapter index={4} />
    </div>
  );
}

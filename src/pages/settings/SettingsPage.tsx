import { useState, type ReactNode } from 'react';
import { Button } from '../../components/Button.tsx';
import { Segmented } from '../../components/Segmented.tsx';
import { Slider } from '../../components/Slider.tsx';
import { Switch } from '../../components/Switch.tsx';
import { TransitionLink } from '../../components/TransitionLink.tsx';
import { FRAGMENT_TOTAL } from '../../content/fragments.ts';
import { audio } from '../../features/audio/AudioEngine.ts';
import { replayIntro } from '../../features/intro/introControl.ts';
import { usePageMeta } from '../../hooks/usePageMeta.ts';
import { titleCase } from '../../lib/format.ts';
import { useResolvedMotion } from '../../hooks/useResolvedMotion.ts';
import { useStageScene } from '../../hooks/useStageScene.ts';
import { fragmentCount, useProgress } from '../../stores/progress.ts';
import {
  useSettings,
  type ContrastPreference,
  type CursorPreference,
  type IntroPreference,
  type MotionPreference,
  type QualityPreference,
  type ThemePreference,
} from '../../stores/settings.ts';
import { useStage } from '../../stores/stage.ts';
import { toast } from '../../stores/ui.ts';
import styles from './Settings.module.css';

const MOTION = [
  { value: 'system', label: 'System', hint: 'Follow your device’s reduced-motion setting' },
  { value: 'full', label: 'Full' },
  { value: 'gentle', label: 'Gentle', hint: 'Slower, calmer, no parallax' },
  { value: 'still', label: 'Still', hint: 'Nothing moves unless you move it' },
] as const;

const QUALITY = [
  { value: 'auto', label: 'Auto' },
  { value: 'ultra', label: 'Ultra' },
  { value: 'high', label: 'High' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'eco', label: 'Eco' },
] as const;

const THEME = [
  { value: 'nocturne', label: 'Nocturne', hint: 'Light on darkness' },
  { value: 'plate', label: 'Plate', hint: 'Ink on a photographic plate' },
] as const;

const CONTRAST = [
  { value: 'system', label: 'System' },
  { value: 'standard', label: 'Standard' },
  { value: 'high', label: 'High' },
] as const;

const CURSOR = [
  { value: 'instrument', label: 'Instrument' },
  { value: 'system', label: 'System' },
] as const;

const INTRO = [
  { value: 'first-visit', label: 'First visit' },
  { value: 'always', label: 'Every visit' },
  { value: 'never', label: 'Never' },
] as const;

const TIER_NOTES: Record<string, string> = {
  ultra: 'A million particles, full post-processing, multisampling.',
  high: 'Rich particle counts and full post-processing.',
  balanced: 'Leaner simulations; post-processing without multisampling.',
  eco: 'Minimal simulations, no post-processing, thirty frames a second.',
};

function Group({
  id,
  title,
  note,
  children,
}: {
  id: string;
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section className={styles.group} aria-labelledby={id}>
      <div className={styles.groupHead}>
        <h2 id={id} className={styles.groupTitle}>
          {title}
        </h2>
        {note && <p className={styles.groupNote}>{note}</p>}
      </div>
      <div className={styles.groupBody}>{children}</div>
    </section>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.readout}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export default function SettingsPage() {
  usePageMeta('settings');
  useStageScene('lacuna', { mode: 'dusk', tint: 'hb' });
  const settings = useSettings();
  const set = settings.set;
  const resolved = useResolvedMotion();
  const stage = useStage();
  const progress = useProgress();
  const [confirming, setConfirming] = useState<'progress' | 'settings' | null>(null);

  const setSound = (on: boolean): void => {
    set('sound', on);
    if (on) void audio.enable().then(() => audio.play('success'));
  };

  const forget = (): void => {
    progress.reset();
    setConfirming(null);
    toast({
      tone: 'info',
      title: 'Observations forgotten',
      body: 'Fragments, path and sigil have been cleared.',
    });
  };

  const restore = (): void => {
    settings.reset();
    setConfirming(null);
    toast({ tone: 'info', title: 'Calibration restored', body: 'Every setting is back to its default.' });
  };

  return (
    <div className={`container ${styles.page}`}>
      <header className={styles.head}>
        <p className="t-kicker">09 · Settings</p>
        <h1 className={styles.title}>Calibration</h1>
        <p className={styles.lede}>
          Tune the observatory to you. Every choice is stored on this device only, and nothing here is ever
          sent anywhere.
        </p>
      </header>

      <div className={styles.groups}>
        <Group
          id="settings-motion"
          title="Motion"
          note={`In effect now: ${resolved}. “System” follows your device’s reduced-motion setting.`}
        >
          <Segmented<MotionPreference>
            label="Motion"
            value={settings.motion}
            options={MOTION}
            onChange={(v) => set('motion', v)}
          />
        </Group>

        <Group
          id="settings-quality"
          title="Graphics"
          note="Auto measures your device and adapts while you browse."
        >
          <Segmented<QualityPreference>
            label="Quality"
            value={settings.quality}
            options={QUALITY}
            onChange={(v) => set('quality', v)}
          />
          <dl className={styles.readouts}>
            <Readout label="Rendering at" value={titleCase(stage.tier)} />
            <Readout label="Detected as" value={titleCase(stage.detectedTier)} />
            <Readout label="Frame rate" value={stage.fps ? `${Math.round(stage.fps)} fps` : '—'} />
            <Readout label="Graphics" value={stage.gpu === 'unknown' ? 'Not reported' : stage.gpu} />
          </dl>
          <p className={styles.hint}>{TIER_NOTES[stage.tier]}</p>
        </Group>

        <Group id="settings-sound" title="Sound" note="Synthesised live. Nothing plays until you turn it on.">
          <Switch
            label="Sound"
            description="Ambient drone and interface tones"
            checked={settings.sound}
            onChange={setSound}
          />
          <Slider
            label="Volume"
            value={settings.volume}
            min={0}
            max={1}
            step={0.01}
            onChange={(v) => {
              set('volume', v);
              audio.setVolume(v);
            }}
            format={(v) => `${Math.round(v * 100)}%`}
          />
        </Group>

        <Group id="settings-appearance" title="Appearance">
          <Segmented<ThemePreference>
            label="Theme"
            value={settings.theme}
            options={THEME}
            onChange={(v) => set('theme', v)}
          />
          <Segmented<ContrastPreference>
            label="Contrast"
            value={settings.contrast}
            options={CONTRAST}
            onChange={(v) => set('contrast', v)}
          />
          <Segmented<CursorPreference>
            label="Cursor"
            value={settings.cursor}
            options={CURSOR}
            onChange={(v) => set('cursor', v)}
          />
          <Switch
            label="Film grain"
            description="A faint photographic texture over everything"
            checked={settings.grain}
            onChange={(v) => set('grain', v)}
          />
          <Switch
            label="Spectral vision"
            description="Luminance becomes wavelength. There is also a key sequence for it."
            checked={settings.spectral}
            onChange={(v) => set('spectral', v)}
          />
        </Group>

        <Group id="settings-intro" title="Arrival sequence">
          <Segmented<IntroPreference>
            label="Play the opening"
            value={settings.intro}
            options={INTRO}
            onChange={(v) => set('intro', v)}
          />
          <div className={styles.actions}>
            <Button variant="ghost" icon="play" onClick={() => replayIntro()} line="na">
              Replay it now
            </Button>
          </div>
        </Group>

        <Group
          id="settings-data"
          title="Your observations"
          note="Kept in this browser’s storage. Erasing them cannot be undone."
        >
          <dl className={styles.readouts}>
            <Readout
              label="Fragments decoded"
              value={`${fragmentCount(progress.fragments)} of ${FRAGMENT_TOTAL}`}
            />
            <Readout label="Path traced" value={`${progress.path.length} steps`} />
            <Readout label="Relics examined" value={String(progress.relicsViewed.length)} />
            <Readout label="Visits" value={String(progress.visits)} />
          </dl>
          <p className={styles.hint}>
            See what you have decoded in{' '}
            <TransitionLink to="/transmission-zero">Transmission Zero</TransitionLink>, and your path on{' '}
            <TransitionLink to="/map">the Map</TransitionLink>.
          </p>
          <div className={styles.actions}>
            {confirming === 'progress' ? (
              <div className={styles.confirm} role="group" aria-label="Confirm erasing observations">
                <span>Erase every fragment, your path and your sigil?</span>
                <Button variant="primary" icon="reset" line="ha" onClick={forget}>
                  Erase
                </Button>
                <Button variant="quiet" icon={null} onClick={() => setConfirming(null)}>
                  Keep them
                </Button>
              </div>
            ) : (
              <Button variant="ghost" icon="reset" line="ha" onClick={() => setConfirming('progress')}>
                Forget my observations
              </Button>
            )}
            {confirming === 'settings' ? (
              <div className={styles.confirm} role="group" aria-label="Confirm restoring settings">
                <span>Restore every setting to its default?</span>
                <Button variant="primary" icon="reset" onClick={restore}>
                  Restore
                </Button>
                <Button variant="quiet" icon={null} onClick={() => setConfirming(null)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button variant="quiet" icon="reset" onClick={() => setConfirming('settings')}>
                Restore default settings
              </Button>
            )}
          </div>
        </Group>

        <Group id="settings-keys" title="Keyboard">
          <dl className={styles.keys}>
            <div>
              <dt>
                <kbd>Ctrl</kbd> <kbd>K</kbd>
              </dt>
              <dd>Open the console — search everything, run any action</dd>
            </div>
            <div>
              <dt>
                <kbd>G</kbd> then a letter
              </dt>
              <dd>
                Jump to a place: A Atlas, C Chronicle, R Archive, T Transmissions, I Instruments, Y Array, M
                Map, U Institute
              </dd>
            </div>
            <div>
              <dt>
                <kbd>`</kbd>
              </dt>
              <dd>Open the Array terminal</dd>
            </div>
            <div>
              <dt>
                <kbd>Esc</kbd>
              </dt>
              <dd>Close any overlay</dd>
            </div>
          </dl>
        </Group>
      </div>
    </div>
  );
}

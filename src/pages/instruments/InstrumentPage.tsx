import type { ReactNode } from 'react';
import { useParams } from 'react-router';
import { Icon } from '../../components/Icon.tsx';
import { TransitionLink } from '../../components/TransitionLink.tsx';
import { instrumentBySlug, type Instrument } from '../../content/instruments.ts';
import { InteractionSurface } from '../../features/stage/InteractionSurface.tsx';
import { usePageMeta } from '../../hooks/usePageMeta.ts';
import { useStageScene } from '../../hooks/useStageScene.ts';
import { GlyphStudio } from './GlyphStudio.tsx';
import { InstrumentPanel } from './InstrumentPanel.tsx';
import { AuroraPanel } from './panels/AuroraPanel.tsx';
import { GravityPanel } from './panels/GravityPanel.tsx';
import { InterferencePanel } from './panels/InterferencePanel.tsx';
import { ResonancePanel } from './panels/ResonancePanel.tsx';
import { TerrainPanel } from './panels/TerrainPanel.tsx';
import styles from './Instrument.module.css';

const SURFACES: Record<string, { label: string; instructions: string; cursor: 'drag' | 'crosshair'; cursorLabel: string }> = {
  interference: {
    label: 'Interference field',
    instructions:
      'Click empty space to add an emitter, drag emitters to move them, double-click to remove. With this area focused: N adds an emitter at the centre, the bracket keys select emitters, arrow keys move the selected one and Delete removes it.',
    cursor: 'crosshair',
    cursorLabel: 'Place',
  },
  resonance: {
    label: 'Resonance plate',
    instructions: 'Drag across the plate to bow it and add energy where you touch. Use the mode sliders in the panel to change the figure.',
    cursor: 'crosshair',
    cursorLabel: 'Bow',
  },
  gravity: {
    label: 'Gravity field',
    instructions: 'Click to place a mass, drag a mass to move it, double-click a mass to remove it. Scroll or pinch to zoom.',
    cursor: 'crosshair',
    cursorLabel: 'Place mass',
  },
  terrain: {
    label: 'Spectral terrain',
    instructions: 'A landscape of frequencies. Use the panel to change the source, gain and speed.',
    cursor: 'drag',
    cursorLabel: 'Listen',
  },
  aurora: {
    label: 'Aurora field',
    instructions: 'A generative sky. Use the panel to change palette, flow and seed, and to save the frame.',
    cursor: 'drag',
    cursorLabel: 'Watch',
  },
};

const PANELS: Record<string, () => ReactNode> = {
  interference: () => <InterferencePanel />,
  resonance: () => <ResonancePanel />,
  gravity: () => <GravityPanel />,
  terrain: () => <TerrainPanel />,
  aurora: () => <AuroraPanel />,
};

function SimulatedInstrument({ instrument }: { instrument: Instrument }) {
  const surface = SURFACES[instrument.slug];
  const panel = PANELS[instrument.slug];
  return (
    <>
      {surface && (
        <InteractionSurface
          label={surface.label}
          instructions={surface.instructions}
          cursor={surface.cursor}
          cursorLabel={surface.cursorLabel}
        />
      )}
      <InstrumentPanel instrument={instrument}>{panel?.()}</InstrumentPanel>
    </>
  );
}

function Missing() {
  useStageScene('lacuna', { mode: 'dusk', tint: 'o3' });
  return (
    <div className={`container ${styles.missing}`}>
      <p className="t-kicker">05 · Instruments</p>
      <h1 className={styles.name}>No instrument by that name.</h1>
      <TransitionLink to="/instruments" className={styles.back}>
        <Icon name="arrowLeft" size={14} /> All instruments
      </TransitionLink>
    </div>
  );
}

export default function InstrumentPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const instrument = instrumentBySlug(slug);
  usePageMeta(
    instrument
      ? { title: `${instrument.name} — Instruments`, description: instrument.summary }
      : { title: 'Instrument not found', description: 'No instrument by that name.' },
  );
  if (!instrument) return <Missing />;
  return (
    <div className={styles.shell} data-instrument={instrument.slug}>
      {instrument.slug === 'glyphs' ? <GlyphStudio instrument={instrument} /> : <SimulatedInstrument key={instrument.slug} instrument={instrument} />}
    </div>
  );
}

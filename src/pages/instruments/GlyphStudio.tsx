import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react';
import { IthranText } from '../../components/IthranText.tsx';
import { Segmented } from '../../components/Segmented.tsx';
import { Slider } from '../../components/Slider.tsx';
import type { Instrument } from '../../content/instruments.ts';
import { spectralLines, spectralOrder, type SpectralKey } from '../../design/tokens.ts';
import { unlockFragment } from '../../features/fragments/unlock.ts';
import { useStageScene } from '../../hooks/useStageScene.ts';
import { glyphFor, type Stroke } from '../../lib/glyphs.ts';
import { useProgress } from '../../stores/progress.ts';
import { toast } from '../../stores/ui.ts';
import { ActionRow } from './InstrumentPanel.tsx';
import { InstrumentPanel } from './InstrumentPanel.tsx';
import styles from './Instrument.module.css';

const MODES = [
  { value: 'rosette', label: 'Rosette' },
  { value: 'line', label: 'Thread' },
] as const;

function describe(strokes: readonly Stroke[]): string {
  const rim = strokes.find((s) => s.kind === 'rim');
  const parts: string[] = [];
  if (rim && rim.kind === 'rim') parts.push(rim.gap === null ? 'closed rim (vowel)' : `rim broken at spoke ${rim.gap}`);
  const arcs = strokes.filter((s) => s.kind === 'arc').length;
  const rays = strokes.filter((s) => s.kind === 'ray').length;
  const dots = strokes.filter((s) => s.kind === 'dot').length;
  if (arcs) parts.push(`${arcs} arc${arcs > 1 ? 's' : ''}`);
  if (rays) parts.push(`${rays} ray${rays > 1 ? 's' : ''}`);
  if (strokes.some((s) => s.kind === 'chord')) parts.push('a chord');
  if (dots) parts.push(`${dots} light${dots > 1 ? 's' : ''}`);
  if (strokes.some((s) => s.kind === 'core')) parts.push('lit core');
  return parts.join(', ');
}

function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function GlyphStudio({ instrument }: { instrument: Instrument }) {
  const inputId = useId();
  const sigil = useProgress((s) => s.sigil);
  const setSigil = useProgress((s) => s.setSigil);
  const [text, setText] = useState(sigil ?? 'phosphene');
  const [mode, setMode] = useState<'rosette' | 'line'>('rosette');
  const [weight, setWeight] = useState(1.2);
  const [line, setLine] = useState<SpectralKey>('he');
  const [take, setTake] = useState(0);
  const artRef = useRef<HTMLDivElement>(null);
  useStageScene('lacuna', { mode: 'dusk', tint: line });

  const clean = text.replace(/[^a-z0-9 ]/gi, '').slice(0, 32);
  const letters = useMemo(
    () => Array.from(clean.toLowerCase()).filter((c) => c !== ' ').map((c) => ({ char: c, info: describe(glyphFor(c).strokes) })),
    [clean],
  );

  useEffect(() => {
    if (clean.trim().toLowerCase() === 'ithra') unlockFragment(8);
  }, [clean]);

  const svgMarkup = (): string | null => {
    const svg = artRef.current?.querySelector('svg');
    if (!svg) return null;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('style', `color:${spectralLines[line].nocturne};background:#040406`);
    clone.removeAttribute('data-draw');
    return new XMLSerializer().serializeToString(clone);
  };

  const exportSvg = (): void => {
    const markup = svgMarkup();
    if (markup) download(new Blob([markup], { type: 'image/svg+xml' }), `ithran-${clean.trim().replace(/\s+/g, '-') || 'glyph'}.svg`);
  };

  const exportPng = (): void => {
    const markup = svgMarkup();
    const svg = artRef.current?.querySelector('svg');
    if (!markup || !svg) return;
    const box = svg.viewBox.baseVal;
    const scale = 2048 / Math.max(box.width, box.height);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(box.width * scale) + 256;
    canvas.height = Math.round(box.height * scale) + 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const image = new Image();
    image.onload = () => {
      ctx.fillStyle = '#040406';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 128, 128, box.width * scale, box.height * scale);
      canvas.toBlob((blob) => blob && download(blob, `ithran-${clean.trim().replace(/\s+/g, '-') || 'glyph'}.png`));
    };
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  };

  return (
    <>
      <div className={styles.studioArt} ref={artRef} style={{ color: `var(--line-${line})` }}>
        {clean.trim() ? (
          <IthranText
            key={`${take}-${mode}-${clean}`}
            text={clean}
            mode={mode}
            size={mode === 'rosette' ? 56 : 44}
            weight={weight}
            draw
            className={styles.studioSvg}
          />
        ) : (
          <p className={styles.hint}>The aperture script has glyphs for letters and numbers.</p>
        )}
        <p className={styles.studioCaption} aria-hidden="true">
          {clean.trim() ? `“${clean.trim()}”` : ''}
        </p>
      </div>

      <InstrumentPanel instrument={instrument}>
        <div className={styles.field}>
          <label htmlFor={inputId} className={styles.groupLabel}>
            Text
          </label>
          <input
            id={inputId}
            className={styles.textInput}
            value={text}
            maxLength={32}
            spellCheck={false}
            autoComplete="off"
            onChange={(e) => setText(e.target.value)}
          />
        </div>
        <Segmented label="Form" value={mode} options={MODES} onChange={setMode} />
        <Slider label="Stroke" value={weight} min={0.5} max={3} step={0.05} onChange={setWeight} format={(v) => `${v.toFixed(2)} px`} />
        <div className={styles.presets} role="radiogroup" aria-label="Colour">
          <p className={styles.groupLabel}>Colour</p>
          <div className={styles.swatches}>
            {spectralOrder.map((key) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={key === line}
                aria-label={spectralLines[key].name}
                title={`${spectralLines[key].notation} · ${spectralLines[key].nm} nm`}
                className={styles.swatch}
                style={{ '--swatch': `var(--line-${key})` } as CSSProperties}
                onClick={() => setLine(key)}
              />
            ))}
          </div>
        </div>
        <ActionRow>
          <button type="button" onClick={() => setTake((t) => t + 1)}>
            Write again
          </button>
          <button type="button" onClick={exportSvg} disabled={!clean.trim()}>
            SVG
          </button>
          <button type="button" onClick={exportPng} disabled={!clean.trim()}>
            PNG
          </button>
          <button
            type="button"
            disabled={!clean.trim()}
            onClick={() => {
              setSigil(clean);
              toast({ tone: 'success', title: 'Sigil kept', body: `The observatory will remember “${clean.trim()}”.`, line });
            }}
          >
            Keep as sigil
          </button>
        </ActionRow>
        {letters.length > 0 && (
          <details className={styles.details}>
            <summary>Anatomy of the glyphs</summary>
            <ul className={styles.anatomy}>
              {letters.slice(0, 16).map((l, i) => (
                <li key={`${l.char}-${i}`}>
                  <IthranText text={l.char} size={22} weight={1.1} label={`Glyph for ${l.char}`} />
                  <span className={styles.anatomyChar}>{l.char}</span>
                  <span className={styles.anatomyInfo}>{l.info}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </InstrumentPanel>
    </>
  );
}

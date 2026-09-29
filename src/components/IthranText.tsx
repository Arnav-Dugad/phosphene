import { useMemo } from 'react';
import { layoutWord, type WordLayoutMode } from '../lib/glyphs.ts';

interface IthranTextProps {
  text: string;
  /** Glyph diameter in px. */
  size?: number;
  mode?: WordLayoutMode;
  className?: string;
  /** Stroke width in px. */
  weight?: number;
  /** Accessible label; the Latin text is used when omitted. */
  label?: string;
  /** Animate strokes drawing in (via CSS on `.stroke`). */
  draw?: boolean;
}

/**
 * Renders Latin text in the Ithran script as inline SVG. The glyphs are
 * decorative writing; assistive technology receives the Latin text.
 */
export function IthranText({ text, size = 18, mode = 'line', className, weight = 1, label, draw = false }: IthranTextProps) {
  const layout = useMemo(() => layoutWord(text, mode, size), [text, mode, size]);
  const pad = weight * 2;
  return (
    <svg
      className={className}
      width={layout.width + pad * 2}
      height={layout.height + pad * 2}
      viewBox={`${-pad} ${-pad} ${layout.width + pad * 2} ${layout.height + pad * 2}`}
      role="img"
      aria-label={label ?? `“${text}” in Ithran script`}
      fill="none"
      stroke="currentColor"
      strokeWidth={weight}
      strokeLinecap="round"
      data-draw={draw || undefined}
    >
      {layout.thread && <path d={layout.thread} opacity={0.45} />}
      {layout.glyphs.map((g) => (
        <g key={g.index} style={{ ['--gi' as string]: g.index }}>
          <path className="stroke" d={g.d} pathLength={1} />
          {g.dots.map((dot, i) => (
            <circle key={i} cx={dot.cx} cy={dot.cy} r={dot.r} fill="currentColor" stroke="none" />
          ))}
        </g>
      ))}
    </svg>
  );
}

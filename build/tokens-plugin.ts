import type { Plugin } from 'vite';
import {
  blur,
  cssBezier,
  duration,
  ease,
  fontFamily,
  grid,
  layer,
  leading,
  neutrals,
  radius,
  space,
  spectralLines,
  spectralOrder,
  tracking,
  typeScale,
} from '../src/design/tokens.ts';

const VIRTUAL_ID = 'virtual:phosphene-tokens.css';
const RESOLVED_ID = `\0${VIRTUAL_ID}`;

const kebab = (s: string): string => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

const block = (selector: string, vars: Record<string, string | number>): string =>
  `${selector} {\n${Object.entries(vars)
    .map(([k, v]) => `  --${k}: ${v};`)
    .join('\n')}\n}\n`;

const prefixed = (prefix: string, record: Record<string, string | number>): Record<string, string | number> =>
  Object.fromEntries(Object.entries(record).map(([k, v]) => [`${prefix}-${kebab(k)}`, v]));

function neutralVars(theme: keyof typeof neutrals): Record<string, string> {
  const n = neutrals[theme];
  return {
    void: n.void,
    'ink-0': n.ink0,
    'ink-1': n.ink1,
    'ink-2': n.ink2,
    'ink-3': n.ink3,
    bone: n.bone,
    'bone-dim': n.boneDim,
    'bone-faint': n.boneFaint,
    hairline: n.hairline,
    'hairline-strong': n.hairlineStrong,
    veil: n.veil,
    'veil-strong': n.veilStrong,
  };
}

function lineVars(theme: 'nocturne' | 'plate'): Record<string, string> {
  return Object.fromEntries(spectralOrder.map((key) => [`line-${key}`, spectralLines[key][theme]]));
}

/** Builds the full token stylesheet. Exported for tests and tooling. */
export function renderTokenCss(): string {
  const root: Record<string, string | number> = {
    ...prefixed('font', fontFamily),
    ...prefixed('type', typeScale),
    ...prefixed('leading', leading),
    ...prefixed('tracking', tracking),
    ...prefixed('space', space),
    'grid-columns': grid.columns,
    'grid-max': grid.maxWidth,
    measure: grid.measure,
    'measure-narrow': grid.measureNarrow,
    ...prefixed('radius', radius),
    ...prefixed('z', layer),
    ...prefixed('blur', blur),
    ...Object.fromEntries(Object.entries(ease).map(([k, v]) => [`ease-${kebab(k)}`, cssBezier(v)])),
    ...Object.fromEntries(Object.entries(duration).map(([k, v]) => [`dur-${kebab(k)}`, `${v}ms`])),
    ...neutralVars('nocturne'),
    ...lineVars('nocturne'),
    ember: 'var(--line-na)',
    signal: 'var(--line-o3)',
    alarm: 'var(--line-ha)',
  };

  return [
    '/* Generated from src/design/tokens.ts — do not edit by hand. */',
    block(':root', root),
    block(":root[data-theme='plate']", { ...neutralVars('plate'), ...lineVars('plate') }),
  ].join('\n');
}

export function designTokens(): Plugin {
  return {
    name: 'phosphene:design-tokens',
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : undefined;
    },
    load(id) {
      return id === RESOLVED_ID ? renderTokenCss() : undefined;
    },
  };
}

/** Typographic minus sign — used instead of a hyphen for negative readouts. */
export const MINUS = '−';
/** Thin space — the scientific thousands separator. */
export const THIN_SPACE = ' ';

export const pad = (n: number, width = 2): string => String(Math.trunc(Math.abs(n))).padStart(width, '0');

export function fixed(n: number, digits = 1): string {
  const s = Math.abs(n).toFixed(digits);
  return n < 0 && Number(s) !== 0 ? `${MINUS}${s}` : s;
}

export function signed(n: number, digits = 1): string {
  const s = Math.abs(n).toFixed(digits);
  if (Number(s) === 0) return `±${s}`;
  return `${n < 0 ? MINUS : '+'}${s}`;
}

/** 4812113 → "4 812 113" (thin spaces). */
export function thousands(n: number, digits = 0): string {
  const [int = '0', frac] = Math.abs(n).toFixed(digits).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, THIN_SPACE);
  return `${n < 0 ? MINUS : ''}${grouped}${frac ? `.${frac}` : ''}`;
}

const ROMAN: ReadonlyArray<readonly [number, string]> = [
  [1000, 'M'],
  [900, 'CM'],
  [500, 'D'],
  [400, 'CD'],
  [100, 'C'],
  [90, 'XC'],
  [50, 'L'],
  [40, 'XL'],
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
];

export function roman(n: number): string {
  let rest = Math.max(0, Math.floor(n));
  let out = '';
  for (const [value, glyph] of ROMAN) {
    while (rest >= value) {
      out += glyph;
      rest -= value;
    }
  }
  return out;
}

export function formatRightAscension(ra: { h: number; m: number; s: number }): string {
  return `${pad(ra.h)}h ${pad(ra.m)}m ${pad(ra.s)}s`;
}

export function formatDeclination(dec: { d: number; m: number; s: number }): string {
  const sign = dec.d < 0 ? MINUS : '+';
  return `${sign}${pad(Math.abs(dec.d))}° ${pad(dec.m)}′ ${pad(dec.s)}″`;
}

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB'] as const;

export function formatBytes(bytes: number, digits = 2): string {
  let value = bytes;
  let unit = 0;
  while (value >= 1000 && unit < BYTE_UNITS.length - 1) {
    value /= 1000;
    unit++;
  }
  return `${value.toFixed(unit === 0 ? 0 : digits)} ${BYTE_UNITS[unit]}`;
}

/** Slug → Title Case fallback for labels. */
export const titleCase = (s: string): string =>
  s.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/** English list: ["a","b","c"] → "a, b and c". */
export function listJoin(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

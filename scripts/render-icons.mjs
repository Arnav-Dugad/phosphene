/**
 * Renders PHOSPHENE's icons from one procedural SVG: the aperture (the eye,
 * the lens, the ring of the Lacuna) with a phosphene of light inside it.
 * Run with `npm run icons`; the output is committed under public/icons.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'public/icons');
mkdirSync(out, { recursive: true });

const VOID = '#040406';
const EMBER = '#ffb45e';
const BONE = '#ece6da';

/**
 * @param {object} options
 * @param {boolean} options.background Fill the canvas (maskable/touch icons need it).
 * @param {number} options.safe Fraction of the canvas the mark may occupy.
 */
function mark({ background, safe }) {
  const size = 512;
  const r = (size / 2) * safe;
  const c = size / 2;
  const stroke = Math.max(10, r * 0.085);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <radialGradient id="glow" cx="0.62" cy="0.36" r="0.5">
      <stop offset="0" stop-color="${EMBER}" stop-opacity="0.55"/>
      <stop offset="0.45" stop-color="${EMBER}" stop-opacity="0.12"/>
      <stop offset="1" stop-color="${EMBER}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="dot" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#fff4e2"/>
      <stop offset="0.55" stop-color="${EMBER}"/>
      <stop offset="1" stop-color="${EMBER}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  ${background ? `<rect width="${size}" height="${size}" fill="${VOID}"/>` : ''}
  <circle cx="${c}" cy="${c}" r="${r}" fill="url(#glow)"/>
  <circle cx="${c}" cy="${c}" r="${r - stroke / 2}" fill="none" stroke="${BONE}" stroke-width="${stroke}" stroke-opacity="0.92"/>
  <path d="M ${c - r * 0.62} ${c + r * 0.31} A ${r * 0.68} ${r * 0.68} 0 0 0 ${c - r * 0.2} ${c + r * 0.66}"
        fill="none" stroke="${EMBER}" stroke-width="${stroke * 0.8}" stroke-linecap="round" stroke-opacity="0.55"/>
  <circle cx="${c + r * 0.3}" cy="${c - r * 0.3}" r="${r * 0.3}" fill="url(#dot)"/>
  <circle cx="${c + r * 0.3}" cy="${c - r * 0.3}" r="${r * 0.13}" fill="${EMBER}"/>
</svg>`;
}

function png(svg, size, name) {
  const image = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
  writeFileSync(resolve(out, name), image);
}

const transparent = mark({ background: false, safe: 0.94 });
const filled = mark({ background: true, safe: 0.78 });
const maskable = mark({ background: true, safe: 0.62 });

writeFileSync(resolve(out, 'favicon.svg'), transparent);
png(transparent, 32, 'favicon-32.png');
png(filled, 180, 'apple-touch-icon.png');
png(filled, 192, 'icon-192.png');
png(filled, 512, 'icon-512.png');
png(maskable, 512, 'icon-maskable-512.png');

console.warn(`icons written to ${out}`);

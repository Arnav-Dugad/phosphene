import { spectralLines, type SpectralKey } from '../design/tokens.ts';

/** Speed of light in vacuum, m/s. */
export const SPEED_OF_LIGHT = 299_792_458;

/**
 * Octaves between visible light and audible sound. Dividing an optical
 * frequency by 2^40 lands the whole visible spectrum (≈400–790 THz) inside a
 * single musical octave around 360–720 Hz — so every colour in PHOSPHENE is
 * also, literally, a note.
 */
export const LIGHT_TO_SOUND_OCTAVES = 40;

/** Optical frequency (Hz) of a wavelength given in nanometres. */
export const frequencyOf = (nm: number): number => SPEED_OF_LIGHT / (nm * 1e-9);

/** The audible tone (Hz) of a wavelength: its frequency transposed down 40 octaves. */
export const toneOf = (nm: number, extraOctavesDown = 0): number =>
  frequencyOf(nm) / 2 ** (LIGHT_TO_SOUND_OCTAVES + extraOctavesDown);

export const lineTone = (key: SpectralKey, extraOctavesDown = 0): number =>
  toneOf(spectralLines[key].nm, extraOctavesDown);

const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'] as const;

/** Nearest equal-tempered note name and cents offset for a frequency (A4 = 440 Hz). */
export function noteOf(hz: number): { name: string; octave: number; cents: number } {
  const semitonesFromA4 = 12 * Math.log2(hz / 440);
  const nearest = Math.round(semitonesFromA4);
  const cents = Math.round((semitonesFromA4 - nearest) * 100);
  const midi = 69 + nearest;
  const name = NOTE_NAMES[((midi % 12) + 12) % 12] ?? 'A';
  return { name, octave: Math.floor(midi / 12) - 1, cents };
}

/**
 * Approximate sRGB rendition of a monochromatic wavelength (380–780 nm), after
 * Dan Bruton's piecewise model with an intensity roll-off at the edges of
 * vision. Returns components in [0, 1].
 */
export function wavelengthToRgb(nm: number): [number, number, number] {
  let r = 0;
  let g = 0;
  let b = 0;
  if (nm >= 380 && nm < 440) {
    r = -(nm - 440) / (440 - 380);
    b = 1;
  } else if (nm >= 440 && nm < 490) {
    g = (nm - 440) / (490 - 440);
    b = 1;
  } else if (nm >= 490 && nm < 510) {
    g = 1;
    b = -(nm - 510) / (510 - 490);
  } else if (nm >= 510 && nm < 580) {
    r = (nm - 510) / (580 - 510);
    g = 1;
  } else if (nm >= 580 && nm < 645) {
    r = 1;
    g = -(nm - 645) / (645 - 580);
  } else if (nm >= 645 && nm <= 780) {
    r = 1;
  }

  let intensity = 0;
  if (nm >= 380 && nm < 420) intensity = 0.3 + (0.7 * (nm - 380)) / (420 - 380);
  else if (nm >= 420 && nm <= 700) intensity = 1;
  else if (nm > 700 && nm <= 780) intensity = 0.3 + (0.7 * (780 - nm)) / (780 - 700);

  const gamma = 0.8;
  const shape = (c: number): number => (c === 0 ? 0 : Math.pow(c * intensity, gamma));
  return [shape(r), shape(g), shape(b)];
}

/** Hex string `#rrggbb` → [r, g, b] in [0, 1]. */
export function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace('#', '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map((c) => c + c)
          .join('')
      : value;
  const n = parseInt(full, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** CSS custom property reference for a spectral line. */
export const lineVar = (key: SpectralKey): string => `var(--line-${key})`;

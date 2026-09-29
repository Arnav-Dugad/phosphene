import { describe, expect, it } from 'vitest';
import { FFT, hannWindow } from './fft.ts';
import { fixed, formatBytes, roman, signed, THIN_SPACE, thousands } from './format.ts';
import { glyphFor, layoutWord } from './glyphs.ts';
import { angleDelta, clamp, damp, wrap } from './math.ts';
import { createRng, hashString } from './random.ts';
import { fuzzyMatch, highlightSegments, rank } from './search.ts';
import { lineTone, noteOf, toneOf, wavelengthToRgb } from './spectral.ts';
import { cadencePhase, observatoryTime, streamFraction, yearsListening } from './time.ts';
import { numberToWords } from './words.ts';

describe('random', () => {
  it('is deterministic for a seed and differs between seeds', () => {
    const a = createRng('lantern');
    const b = createRng('lantern');
    const c = createRng('lanterns');
    const seqA = Array.from({ length: 8 }, () => a.next());
    expect(Array.from({ length: 8 }, () => b.next())).toEqual(seqA);
    expect(Array.from({ length: 8 }, () => c.next())).not.toEqual(seqA);
  });

  it('keeps every helper inside its range', () => {
    const rng = createRng(42);
    for (let i = 0; i < 2000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      const n = rng.int(3, 7);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(7);
      expect(Number.isInteger(n)).toBe(true);
    }
    const [x, y, z] = rng.onSphere();
    expect(Math.hypot(x, y, z)).toBeCloseTo(1, 6);
  });

  it('hashes strings stably', () => {
    expect(hashString('phosphene')).toBe(hashString('phosphene'));
    expect(hashString('phosphene')).not.toBe(hashString('Phosphene'));
  });

  it('shuffles without losing items', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    expect(createRng('s').shuffle(items).sort()).toEqual(items);
  });
});

describe('math', () => {
  it('clamps, wraps and damps', () => {
    expect(clamp(2)).toBe(1);
    expect(clamp(-1, 0, 5)).toBe(0);
    expect(wrap(370, 0, 360)).toBeCloseTo(10);
    expect(wrap(-10, 0, 360)).toBeCloseTo(350);
    expect(damp(0, 10, 1000, 1)).toBeCloseTo(10);
    expect(damp(0, 10, 0, 1)).toBe(0);
  });

  it('takes the short way round angles', () => {
    expect(angleDelta(0.1, Math.PI * 2 - 0.1)).toBeCloseTo(-0.2);
  });
});

describe('spectral', () => {
  it('puts every visible wavelength inside one audible octave', () => {
    const red = toneOf(700);
    const violet = toneOf(400);
    expect(red).toBeGreaterThan(300);
    expect(violet).toBeLessThan(800);
    expect(violet / red).toBeLessThan(2);
  });

  it('names notes', () => {
    expect(noteOf(440)).toEqual({ name: 'A', octave: 4, cents: 0 });
    expect(noteOf(261.63).name).toBe('C');
  });

  it('transposes lines by octaves', () => {
    expect(lineTone('na', 1)).toBeCloseTo(lineTone('na') / 2, 6);
  });

  it('renders wavelengths as colours with the right dominant channel', () => {
    const [r, g, b] = wavelengthToRgb(650);
    expect(r).toBeGreaterThan(g);
    expect(r).toBeGreaterThan(b);
    const [, g2] = wavelengthToRgb(530);
    expect(g2).toBeGreaterThan(0.8);
  });
});

describe('fft', () => {
  it('finds a pure tone in the right bin', () => {
    const size = 1024;
    const rate = 4096;
    const fft = new FFT(size);
    const signal = new Float32Array(size);
    for (let i = 0; i < size; i++) signal[i] = Math.sin((2 * Math.PI * 512 * i) / rate);
    const out = new Float32Array(size / 2);
    fft.magnitudeDb(signal, out, new Float32Array(size), new Float32Array(size), hannWindow(size));
    const peak = out.indexOf(Math.max(...out));
    expect(peak).toBe(Math.round((512 / rate) * size));
  });

  it('rejects sizes that are not powers of two', () => {
    expect(() => new FFT(1000)).toThrow();
  });
});

describe('search', () => {
  it('ranks word-start matches first', () => {
    const items = [
      { id: 'a', title: 'Resonant Library Carrier' },
      { id: 'b', title: 'Archive' },
    ];
    const ranked = rank('arc', items);
    expect(ranked[0]?.item.id).toBe('b');
  });

  it('rejects out-of-order letters and highlights hits', () => {
    expect(fuzzyMatch('zx', 'Atlas')).toBeNull();
    const match = fuzzyMatch('atl', 'Atlas');
    expect(match).not.toBeNull();
    const segments = highlightSegments('Atlas', match?.indices ?? []);
    expect(segments[0]).toEqual({ text: 'Atl', hit: true });
  });
});

describe('glyphs', () => {
  it('gives each letter a stable glyph, and vowels a lit core', () => {
    expect(glyphFor('a')).toEqual(glyphFor('a'));
    expect(glyphFor('a')).not.toEqual(glyphFor('b'));
    expect(glyphFor('e').strokes.some((s) => s.kind === 'core')).toBe(true);
  });

  it('lays out words in both modes', () => {
    const line = layoutWord('ithra', 'line', 20);
    expect(line.glyphs).toHaveLength(5);
    expect(line.width).toBeGreaterThan(0);
    const rosette = layoutWord('halden', 'rosette', 20);
    expect(rosette.glyphs).toHaveLength(6);
    expect(rosette.width).toBeCloseTo(rosette.height, 5);
  });
});

describe('format and words', () => {
  it('formats numbers the observatory way', () => {
    expect(thousands(4812113)).toBe(['4', '812', '113'].join(THIN_SPACE));
    expect(fixed(-0.04, 1)).toBe('0.0');
    expect(fixed(-1.25, 1)).toBe('−1.3');
    expect(signed(-1.5)).toBe('−1.5');
    expect(signed(0)).toBe('±0.0');
    expect(roman(2026)).toBe('MMXXVI');
    expect(formatBytes(1_107_000_000_000, 3)).toBe('1.107 TB');
  });

  it('spells numbers', () => {
    expect(numberToWords(90)).toBe('ninety');
    expect(numberToWords(11)).toBe('eleven');
    expect(numberToWords(342)).toBe('three hundred and forty-two');
  });
});

describe('observatory time', () => {
  const date = new Date('2026-09-30T12:00:00Z');

  it('runs three hundred years ahead', () => {
    expect(observatoryTime(date).year).toBe(2326);
  });

  it('has been listening since 1936 of our calendar', () => {
    expect(yearsListening(date)).toBeGreaterThan(90);
    expect(yearsListening(date)).toBeLessThan(91);
    expect(streamFraction(date)).toBeCloseTo(yearsListening(date) / 1100, 8);
  });

  it('keeps the cadence phase in [0, 1)', () => {
    for (let h = 0; h < 48; h += 3.7) {
      const p = cadencePhase(new Date(date.getTime() + h * 3_600_000));
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThan(1);
    }
  });
});

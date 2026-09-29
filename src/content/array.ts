import { spectralOrder, type SpectralKey } from '../design/tokens.ts';
import { signed } from '../lib/format.ts';
import { degToRad, TAU } from '../lib/math.ts';
import { createRng } from '../lib/random.ts';
import { cadencePhase, formatOstClock, secondsListening, streamFraction } from '../lib/time.ts';
import { channels } from './receiver.ts';
import { relics } from './relics.ts';
import { world } from './world.ts';

/**
 * The Halden Deep Array, modelled. Everything here is a pure function of the
 * wall clock, so the page, the WebGL scene and every visitor watching at the
 * same moment agree on what the Array is doing: which dishes are calibrating,
 * where the Lacuna sits in the sky, whether it is day or night in Daedalus
 * Crater (that one follows the real Moon), and what the decoder just logged.
 */

/** One scene unit is ten metres. */
export const METRES_PER_UNIT = 10;
export const DISH_DIAMETER_M = 25;

export type DishGroup = 'Core' | 'Arm I' | 'Arm II' | 'Arm III';
export type DishState = 'tracking' | 'calibrating' | 'slewing' | 'stowed' | 'offline';

export interface Dish {
  index: number;
  id: string;
  /** Scene position in units (x east, z south). */
  x: number;
  z: number;
  group: DishGroup;
  /** The spectral channel its receiver chain is optimised for. */
  channel: SpectralKey;
  /** Observatory year the dish was commissioned. */
  commissioned: number;
  name: string | null;
}

export const DISH_STATES: readonly DishState[] = ['tracking', 'calibrating', 'slewing', 'stowed', 'offline'];

export const DISH_STATE_INFO: Record<DishState, { label: string; line: SpectralKey | null; description: string }> = {
  tracking: { label: 'Tracking', line: 'o3', description: 'Following the Lacuna and contributing to the combined signal.' },
  calibrating: {
    label: 'Calibrating',
    line: 'na',
    description: 'Pointed at a reference source to measure its own errors. Returns to tracking in minutes.',
  },
  slewing: { label: 'Slewing', line: 'hb', description: 'Moving between targets at a degree and a half per second.' },
  stowed: { label: 'Stowed', line: null, description: 'Parked facing the zenith — thermal stow, or waiting out a particle storm.' },
  offline: { label: 'Maintenance', line: 'ha', description: 'Out of the array today. A crew is with it.' },
};

/**
 * Layout: a hexagonal core of nineteen dishes (built before first detection)
 * and three logarithmic-spiral arms of fifteen added afterwards — sixty-four
 * in all, spread over two and a half kilometres of crater floor.
 */
function buildDishes(): Dish[] {
  const dishes: Dish[] = [];
  const push = (x: number, z: number, group: DishGroup, commissioned: number): void => {
    const index = dishes.length;
    dishes.push({
      index,
      id: `HD-${String(index + 1).padStart(2, '0')}`,
      x,
      z,
      group,
      channel: spectralOrder[index % spectralOrder.length] as SpectralKey,
      commissioned,
      name: index === 0 ? 'Aster' : null,
    });
  };
  const spacing = 6;
  push(0, 0, 'Core', 2231);
  for (let ring = 1; ring <= 2; ring++) {
    for (let side = 0; side < 6; side++) {
      for (let step = 0; step < ring; step++) {
        const a0 = (side / 6) * TAU + Math.PI / 6;
        const a1 = ((side + 1) / 6) * TAU + Math.PI / 6;
        const t = step / ring;
        const x = (Math.cos(a0) * (1 - t) + Math.cos(a1) * t) * ring * spacing;
        const z = (Math.sin(a0) * (1 - t) + Math.sin(a1) * t) * ring * spacing;
        push(x, z, 'Core', 2231 + ring);
      }
    }
  }
  const arms: DishGroup[] = ['Arm I', 'Arm II', 'Arm III'];
  arms.forEach((group, arm) => {
    for (let k = 1; k <= 15; k++) {
      const r = 14 * Math.pow(1.155, k);
      const a = (arm / 3) * TAU - Math.PI / 2 + 0.85 * Math.log(r / 14);
      push(Math.cos(a) * r, Math.sin(a) * r, group, 2243 + Math.floor(k * 1.6) + arm);
    }
  });
  return dishes;
}

export const dishes: readonly Dish[] = buildDishes();
export const DISH_COUNT = dishes.length;

/* ── Sky ─────────────────────────────────────────────────────────────────── */

const SIDEREAL_MONTH_S = 27.321661 * 86400;
const SYNODIC_MONTH_MS = 29.530588853 * 86400 * 1000;
/** A known new Moon (2000-01-06 18:14 UTC); the far side has local noon at new Moon. */
const NEW_MOON_EPOCH = Date.UTC(2000, 0, 6, 18, 14);

export interface Pointing {
  /** Degrees clockwise from north. */
  az: number;
  /** Degrees above the horizon. */
  el: number;
}

/**
 * Where the Lacuna sits in Daedalus's sky: low in the north-west, wheeling
 * slowly with the Moon's rotation. With no air to look through, the Array can
 * listen almost down to the horizon.
 */
export function sourcePointing(date: Date = new Date()): Pointing {
  const phase = ((date.getTime() / 1000) % SIDEREAL_MONTH_S) / SIDEREAL_MONTH_S;
  return {
    az: 318 + 9 * Math.sin(phase * TAU),
    el: 12 + 3 * Math.cos(phase * TAU),
  };
}

/** A unit vector in scene space (x east, y up, z south) for an az/el pointing. */
export function pointingVector(p: Pointing): [number, number, number] {
  const az = degToRad(p.az);
  const el = degToRad(p.el);
  return [Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)];
}

export interface LunarLight {
  /** Synodic phase in [0, 1): 0 is local noon at Daedalus (new Moon as seen from Earth). */
  phase: number;
  sun: Pointing;
  day: boolean;
  /** Hours until the next sunrise or sunset. */
  nextEventHours: number;
  nextEvent: 'sunrise' | 'sunset';
  /** Approximate regolith surface temperature, °C. */
  surfaceTemperature: number;
  /** Days since local sunrise (day) or sunset (night). */
  daysInto: number;
}

/**
 * The real lunar day over Daedalus. The crater sits near the centre of the far
 * side, so its noon falls at new Moon and its midnight at full Moon; a lunar
 * day lasts 29.5 Earth days.
 */
export function lunarLight(date: Date = new Date()): LunarLight {
  const phase = ((((date.getTime() - NEW_MOON_EPOCH) / SYNODIC_MONTH_MS) % 1) + 1) % 1;
  const latitude = degToRad(world.arrayLatitude);
  const hour = phase * TAU;
  const up = Math.cos(latitude) * Math.cos(hour);
  const east = -Math.sin(hour);
  const north = -Math.sin(latitude) * Math.cos(hour);
  const el = Math.asin(Math.max(-1, Math.min(1, up)));
  const az = (Math.atan2(east, north) * 180) / Math.PI;
  const day = phase < 0.25 || phase >= 0.75;
  const monthHours = SYNODIC_MONTH_MS / 3_600_000;
  const nextEvent = day ? 'sunset' : 'sunrise';
  const target = day ? (phase < 0.25 ? 0.25 : 1.25) : 0.75;
  const nextEventHours = (target - phase) * monthHours;
  const sinEl = Math.max(0, Math.sin(el));
  const sinceSunset = (((phase - 0.25) % 1) + 1) % 1;
  const surfaceTemperature = day
    ? -170 + 290 * Math.pow(sinEl, 0.3)
    : -173 + 73 * Math.exp(-(sinceSunset / 0.5) * 4);
  const daysInto = ((day ? (phase + 0.25) % 1 : phase - 0.25) * SYNODIC_MONTH_MS) / 86_400_000;
  return {
    phase,
    sun: { az: (az + 360) % 360, el: (el * 180) / Math.PI },
    day,
    nextEventHours,
    nextEvent,
    surfaceTemperature,
    daysInto,
  };
}

/* ── Dish states ─────────────────────────────────────────────────────────── */

const STATE_SLOT_S = 600;
const SLEW_S = 45;

function slotStates(slot: number): DishState[] {
  const states: DishState[] = dishes.map(() => 'tracking');
  const rng = createRng(`array-states:${slot}`);
  const calibrating = rng.int(1, 3);
  for (let i = 0; i < calibrating; i++) states[rng.int(1, DISH_COUNT - 1)] = 'calibrating';
  if (rng.chance(0.3)) states[rng.int(1, DISH_COUNT - 1)] = 'stowed';
  // Maintenance runs by the (Earth) day: one dish, most days.
  const day = Math.floor((slot * STATE_SLOT_S) / 86400);
  const crew = createRng(`array-maintenance:${day}`);
  if (crew.chance(0.7)) states[crew.int(1, DISH_COUNT - 1)] = 'offline';
  return states;
}

/** Every dish's state at `date`. Dishes that just changed target are slewing. */
export function dishStates(date: Date = new Date()): DishState[] {
  const seconds = date.getTime() / 1000;
  const slot = Math.floor(seconds / STATE_SLOT_S);
  const current = slotStates(slot);
  const elapsed = seconds - slot * STATE_SLOT_S;
  if (elapsed >= SLEW_S) return current;
  const previous = slotStates(slot - 1);
  return current.map((state, i) => (state !== previous[i] && state !== 'offline' ? 'slewing' : state));
}

/** Where a dish in a given state is (or wants to be) pointed. */
export function dishTarget(dish: Dish, state: DishState, date: Date = new Date()): Pointing {
  if (state === 'stowed' || state === 'offline') return { az: 180, el: 90 };
  if (state === 'calibrating') {
    const rng = createRng(`calibrator:${dish.index}`);
    return { az: rng.range(20, 160), el: rng.range(28, 62) };
  }
  const source = sourcePointing(date);
  // Each dish carries a tiny residual pointing error, visible in its readout.
  const rng = createRng(`pointing:${dish.index}`);
  return { az: source.az + rng.gaussian(0, 0.004), el: source.el + rng.gaussian(0, 0.003) };
}

/* ── Telemetry ───────────────────────────────────────────────────────────── */

/** Average information rate of the stream beneath the carrier, bits per second. */
export const STREAM_BITS_PER_SECOND = 3100;
const FRAME_SECONDS = 0.8;

export interface Telemetry {
  snr: number;
  /** Line-of-sight velocity toward the Lacuna, km/s (Earth's orbit plus the Moon's). */
  radialVelocity: number;
  bitsPerSecond: number;
  bytesReceived: number;
  streamFraction: number;
  frame: number;
  /** Seconds until Transmission Zero repeats. */
  nextRepetition: number;
  repetitions: number;
  solarWind: number;
  protonFlux: number;
  systemTemperature: number;
  tracking: number;
}

const wave = (t: number, period: number, phase = 0): number => Math.sin((t / period) * TAU + phase);

export function telemetry(date: Date = new Date()): Telemetry {
  const t = date.getTime() / 1000;
  const listening = secondsListening(date);
  const states = dishStates(date);
  const tracking = states.filter((s) => s === 'tracking').length;
  const year = 365.25 * 86400;
  // Earth's orbital velocity projected toward Cygnus (ecliptic latitude ≈ 57°), plus the Moon's orbit.
  const radialVelocity = 29.78 * Math.cos(degToRad(57)) * wave(t, year, 1.1) + 1.02 * wave(t, SIDEREAL_MONTH_S, 0.4);
  const jitter = createRng(`telemetry:${Math.floor(t)}`);
  const snr = 12.4 + 1.3 * wave(t, 5400, 0.7) + 0.5 * wave(t, 777) + 1.1 * (tracking / DISH_COUNT - 0.9) * 10 + jitter.gaussian(0, 0.08);
  const bitsPerSecond = STREAM_BITS_PER_SECOND * (0.96 + 0.05 * wave(t, 3600, 2.1)) + jitter.gaussian(0, 9);
  const cycle = world.cadenceSeconds;
  return {
    snr,
    radialVelocity,
    bitsPerSecond,
    bytesReceived: (listening * STREAM_BITS_PER_SECOND) / 8,
    streamFraction: streamFraction(date),
    frame: Math.floor(listening / FRAME_SECONDS),
    nextRepetition: (1 - cadencePhase(date)) * cycle,
    repetitions: Math.floor(listening / cycle),
    solarWind: 410 + 70 * wave(t, 27 * 86400, 0.3) + 25 * wave(t, 86400 * 3.1) + jitter.gaussian(0, 1.5),
    protonFlux: Math.max(0.05, 0.9 + 0.6 * wave(t, 86400 * 5.3, 1.7) + jitter.gaussian(0, 0.02)),
    systemTemperature: 23.5 + 1.2 * wave(t, 86400 * 29.53, 0.2) + jitter.gaussian(0, 0.05),
    tracking,
  };
}

export interface DishReadout {
  state: DishState;
  pointing: Pointing;
  snr: number;
  systemTemperature: number;
  feedTemperature: number;
  uptimeDays: number;
}

export function dishReadout(dish: Dish, date: Date = new Date()): DishReadout {
  const state = dishStates(date)[dish.index] ?? 'tracking';
  const t = date.getTime() / 1000;
  const own = createRng(`dish:${dish.index}`);
  const jitter = createRng(`dish:${dish.index}:${Math.floor(t)}`);
  const quality = own.range(-0.8, 0.8);
  const receiving = state === 'tracking';
  return {
    state,
    pointing: dishTarget(dish, state, date),
    snr: receiving ? 12.4 + quality + 0.6 * wave(t, 900, dish.index) + jitter.gaussian(0, 0.12) : 0,
    systemTemperature: 22.8 + own.range(0, 3) + jitter.gaussian(0, 0.05),
    feedTemperature: 14.1 + own.range(0, 1.5) + 0.3 * wave(t, 600, dish.index),
    uptimeDays: state === 'offline' ? 0 : Math.floor(own.range(3, 140) + ((t / 86400) % 30)),
  };
}

/* ── Decoder log ─────────────────────────────────────────────────────────── */

export type LogTone = 'info' | 'ok' | 'notice' | 'accord';

export interface LogEntry {
  id: number;
  time: Date;
  clock: string;
  text: string;
  tone: LogTone;
  line: SpectralKey;
}

const LOG_SLOT_S = 6;
const hex = (n: number): string => n.toString(16).toUpperCase().padStart(4, '0');

function logEntry(slot: number): LogEntry {
  const rng = createRng(`decoder-log:${slot}`);
  const time = new Date(slot * LOG_SLOT_S * 1000);
  const channel = rng.pick(channels);
  const frame = Math.floor(secondsListening(time) / FRAME_SECONDS);
  const roll = rng.next();
  let text: string;
  let tone: LogTone = 'info';
  if (roll < 0.26) {
    text = `Frame ${frame} · ${channel.notation} · ${rng.int(96, 1024)} symbols · parity ok`;
    tone = 'ok';
  } else if (roll < 0.44) {
    text = `${channel.notation} burst · ${rng.int(180, 4090)} B · checksum ${hex(rng.int(0, 0xffff))} ✓`;
    tone = 'ok';
  } else if (roll < 0.6) {
    text = `Glyph cluster ${hex(rng.int(0, 0xffff))} resolved · confidence ${rng.range(0.61, 0.99).toFixed(2)}`;
  } else if (roll < 0.72) {
    const relic = rng.pick(relics);
    text = `Cross-reference ${relic.catalog} · layer ${rng.int(2, 9)} · +${rng.range(0.3, 9.8).toFixed(1)} KB`;
    tone = 'notice';
  } else if (roll < 0.8) {
    const dish = rng.pick(dishes);
    text = `${dish.id} pointing correction ${signed(rng.gaussian(0, 0.004), 4)}°`;
  } else if (roll < 0.88) {
    text = `Carrier lock ${channel.notation} · drift ${signed(rng.gaussian(0, 0.0008), 4)} s per cadence`;
    tone = 'ok';
  } else if (roll < 0.94) {
    text = `Unparsed structure on ${channel.notation} · queued for the Institute`;
    tone = 'notice';
  } else {
    text = `Accord flag on segment ${hex(rng.int(0, 0xffff))}${hex(rng.int(0, 0xffff))} · memory withheld as asked`;
    tone = 'accord';
  }
  return { id: slot, time, clock: formatOstClock(time), text, tone, line: tone === 'accord' ? 'ca' : channel.key };
}

/** The newest `count` decoder log entries at `date`, newest first. */
export function decoderLog(date: Date = new Date(), count = 8): LogEntry[] {
  const slot = Math.floor(date.getTime() / 1000 / LOG_SLOT_S);
  return Array.from({ length: count }, (_, i) => logEntry(slot - i));
}

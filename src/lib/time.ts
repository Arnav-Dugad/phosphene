import { world } from '../content/world.ts';

const MS_PER_YEAR = 365.2425 * 24 * 3600 * 1000;

/** Detection instant expressed on the visitor's (real) calendar. */
const detectionReal = (() => {
  const d = new Date(world.detectionIso);
  d.setUTCFullYear(d.getUTCFullYear() - world.yearOffset);
  return d.getTime();
})();

export interface ObservatoryTime {
  year: number;
  month: number;
  day: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/** Observatory Standard Time (OST): UTC, three hundred years ahead. */
export function observatoryTime(date: Date = new Date()): ObservatoryTime {
  return {
    year: date.getUTCFullYear() + world.yearOffset,
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hours: date.getUTCHours(),
    minutes: date.getUTCMinutes(),
    seconds: date.getUTCSeconds(),
  };
}

const pad = (n: number, width = 2): string => String(n).padStart(width, '0');

export function formatOstDate(date: Date = new Date()): string {
  const t = observatoryTime(date);
  return `${t.year}.${pad(t.month)}.${pad(t.day)}`;
}

export function formatOstClock(date: Date = new Date()): string {
  const t = observatoryTime(date);
  return `${pad(t.hours)}:${pad(t.minutes)}:${pad(t.seconds)}`;
}

/** Seconds since first detection. */
export const secondsListening = (date: Date = new Date()): number => (date.getTime() - detectionReal) / 1000;

/** Fractional years of reception so far. */
export const yearsListening = (date: Date = new Date()): number =>
  (date.getTime() - detectionReal) / MS_PER_YEAR;

/** Fraction of the Choir's estimated transmission received so far. */
export const streamFraction = (date: Date = new Date()): number =>
  yearsListening(date) / world.streamYearsTotal;

/** Phase in [0, 1) of the carrier's heartbeat cadence. */
export const cadencePhase = (date: Date = new Date()): number => {
  const s = secondsListening(date);
  return (((s % world.cadenceSeconds) + world.cadenceSeconds) % world.cadenceSeconds) / world.cadenceSeconds;
};

/** Observatory year for a real-world year, e.g. for dated log entries. */
export const toObservatoryYear = (realYear: number): number => realYear + world.yearOffset;

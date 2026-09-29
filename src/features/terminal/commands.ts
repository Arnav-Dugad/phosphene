import {
  DISH_COUNT,
  DISH_STATE_INFO,
  DISH_STATES,
  decoderLog,
  dishes,
  dishStates,
  lunarLight,
  telemetry,
} from '../../content/array.ts';
import { FRAGMENT_TOTAL, fragments } from '../../content/fragments.ts';
import { places } from '../../content/routes.ts';
import { world } from '../../content/world.ts';
import { spectralOrder } from '../../design/tokens.ts';
import { fixed, formatBytes, pad, thousands } from '../../lib/format.ts';
import { formatOstClock, formatOstDate, yearsListening } from '../../lib/time.ts';
import type { ProgressState } from '../../stores/progress.ts';
import {
  QUALITY_TIERS,
  type MotionPreference,
  type QualityPreference,
  type Settings,
  type ThemePreference,
} from '../../stores/settings.ts';

export type LineKind = 'input' | 'out' | 'accent' | 'error' | 'dim';

export interface TerminalLine {
  kind: LineKind;
  text: string;
}

export interface TerminalContext {
  now: Date;
  progress: ProgressState;
  settings: Settings;
  history: readonly string[];
  go: (path: string) => void;
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  sound: (on: boolean) => void;
  listen: () => void;
  clear: () => void;
  close: () => void;
}

type Handler = (args: string[], ctx: TerminalContext) => TerminalLine[];

const out = (text: string): TerminalLine => ({ kind: 'out', text });
const accent = (text: string): TerminalLine => ({ kind: 'accent', text });
const dim = (text: string): TerminalLine => ({ kind: 'dim', text });
const error = (text: string): TerminalLine => ({ kind: 'error', text });

const clock = (seconds: number): string => {
  const s = Math.max(0, Math.floor(seconds));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
};

const HELP: readonly [string, string][] = [
  ['status', 'the Array, right now'],
  ['dishes', 'which dishes are doing what'],
  ['log', 'the latest decoder entries'],
  ['fragments', 'your progress through Transmission Zero'],
  ['places', 'everywhere you can go'],
  ['goto <place>', 'travel (e.g. goto archive)'],
  ['listen', 'play the seven lines (sound must be on)'],
  ['sound on|off', 'turn sound on or off'],
  ['theme nocturne|plate', 'change the theme'],
  ['motion system|full|gentle|still', 'change the motion level'],
  ['quality auto|ultra|high|balanced|eco', 'change graphics quality'],
  ['date', 'observatory time'],
  ['whoami', 'what the observatory knows about you'],
  ['history · clear · exit', ''],
];

const PLACE_ALIASES: Record<string, string> = {
  home: '/',
  arrival: '/',
  zero: '/transmission-zero',
  tz: '/transmission-zero',
  lost: '/lost',
};

function resolvePlace(name: string): string | null {
  const key = name.toLowerCase();
  if (PLACE_ALIASES[key]) return PLACE_ALIASES[key];
  const place = places.find((p) => p.id === key || p.label.toLowerCase() === key || p.path === `/${key}`);
  return place ? place.path : null;
}

const commands: Record<string, Handler> = {
  help: () => [
    accent('The Halden Deep Array — observer terminal'),
    ...HELP.map(([cmd, text]) => out(`  ${cmd.padEnd(38)}${text}`)),
    dim('Tab completes, ↑ and ↓ recall, Esc or ` closes.'),
  ],

  status: (_args, ctx) => {
    const t = telemetry(ctx.now);
    const moon = lunarLight(ctx.now);
    return [
      accent(`${world.array} · ${world.arraySite}`),
      out(`  receiving      ${t.tracking} of ${DISH_COUNT} dishes on source`),
      out(`  snr            ${fixed(t.snr, 1)} dB`),
      out(`  stream rate    ${fixed(t.bitsPerSecond / 1000, 2)} kbit/s`),
      out(
        `  received       ${formatBytes(t.bytesReceived, 3)} · ${fixed(t.streamFraction * 100, 4)}% of the stream`,
      ),
      out(`  next zero      ${clock(t.nextRepetition)} (repetition ${thousands(t.repetitions + 1)})`),
      out(
        `  lunar ${moon.day ? 'day  ' : 'night'}    ${moon.nextEvent} in ${fixed(moon.nextEventHours, 1)} h · regolith ${fixed(moon.surfaceTemperature, 0)} °C`,
      ),
    ];
  },

  dishes: (_args, ctx) => {
    const states = dishStates(ctx.now);
    const lines = DISH_STATES.map((state) => {
      const count = states.filter((s) => s === state).length;
      return out(`  ${DISH_STATE_INFO[state].label.padEnd(14)}${String(count).padStart(3)}`);
    });
    const unusual = dishes.filter((d) => states[d.index] !== 'tracking');
    return [
      accent(`${DISH_COUNT} dishes`),
      ...lines,
      ...(unusual.length
        ? [
            dim(
              `  off source: ${unusual.map((d) => `${d.id} (${DISH_STATE_INFO[states[d.index] ?? 'tracking'].label.toLowerCase()})`).join(', ')}`,
            ),
          ]
        : []),
    ];
  },

  log: (_args, ctx) => [
    accent('decoder log'),
    ...decoderLog(ctx.now, 6).map((e) => out(`  ${e.clock}  ${e.text}`)),
  ],

  fragments: (_args, ctx) => {
    const decoded = fragments.filter((f) => ctx.progress.fragments[String(f.id)]);
    return [
      accent(`Transmission Zero · ${decoded.length} of ${FRAGMENT_TOTAL} decoded`),
      ...fragments.map((f) =>
        ctx.progress.fragments[String(f.id)]
          ? out(`  ${f.numeral.padEnd(5)}${f.text}`)
          : dim(`  ${f.numeral.padEnd(5)}— ${f.hint}`),
      ),
    ];
  },

  places: () => [
    accent('places'),
    ...places.filter((p) => p.kind !== 'hidden').map((p) => out(`  ${p.id.padEnd(16)}${p.gloss}`)),
  ],

  goto: (args, ctx) => {
    const name = args.join(' ');
    if (!name) return [error('goto where? try: goto atlas')];
    const path = resolvePlace(name);
    if (!path) return [error(`no place called “${name}”. try: places`)];
    ctx.close();
    ctx.go(path);
    return [dim(`travelling to ${path}…`)];
  },

  listen: (_args, ctx) => {
    if (!ctx.settings.sound) return [error('sound is off. try: sound on')];
    ctx.listen();
    return [accent(`♪ ${spectralOrder.map((k) => k.toUpperCase()).join(' · ')}`)];
  },

  sound: (args, ctx) => {
    const on = args[0] === 'on' ? true : args[0] === 'off' ? false : !ctx.settings.sound;
    ctx.sound(on);
    return [out(`sound ${on ? 'on' : 'off'}`)];
  },

  theme: (args, ctx) => {
    const value = args[0] as ThemePreference | undefined;
    if (value !== 'nocturne' && value !== 'plate') return [error('theme nocturne|plate')];
    ctx.set('theme', value);
    return [out(`theme: ${value}`)];
  },

  motion: (args, ctx) => {
    const value = args[0] as MotionPreference | undefined;
    if (!value || !['system', 'full', 'gentle', 'still'].includes(value))
      return [error('motion system|full|gentle|still')];
    ctx.set('motion', value);
    return [out(`motion: ${value}`)];
  },

  quality: (args, ctx) => {
    const value = args[0] as QualityPreference | undefined;
    if (!value || (value !== 'auto' && !QUALITY_TIERS.includes(value)))
      return [error('quality auto|ultra|high|balanced|eco')];
    ctx.set('quality', value);
    return [out(`quality: ${value}`)];
  },

  date: (_args, ctx) => [
    out(`${formatOstDate(ctx.now)} ${formatOstClock(ctx.now)} OST`),
    dim(`listening for ${fixed(yearsListening(ctx.now), 3)} years`),
  ],

  whoami: (_args, ctx) => {
    const p = ctx.progress;
    const first = p.firstVisit ? formatOstDate(new Date(p.firstVisit)) : 'today';
    return [
      out(`observer, first seen ${first}`),
      out(`  visits ${p.visits} · steps traced ${p.path.length} · relics examined ${p.relicsViewed.length}`),
      out(`  sigil ${p.sigil ? `“${p.sigil}”` : 'none yet — write one in the Glyph Synthesizer'}`),
      dim('nothing else. this observatory keeps no records of you beyond this browser.'),
    ];
  },

  history: (_args, ctx) => ctx.history.map((h, i) => out(`  ${String(i + 1).padStart(3)}  ${h}`)),

  echo: (args) => [out(args.join(' '))],

  clear: (_args, ctx) => {
    ctx.clear();
    return [];
  },

  exit: (_args, ctx) => {
    ctx.close();
    return [];
  },

  // Things people try.
  ithra: () => [accent('those who keep the light.')],
  reply: () => [out('there is no one left to hear.'), dim('listen instead: try `listen`')],
  sudo: () => [error('the Accord does not recognise superusers.')],
  decode: (_args, ctx) => {
    const next = fragments.find((f) => !ctx.progress.fragments[String(f.id)]);
    return next
      ? [out(`nearest undecoded line: ${next.numeral}`), dim(`  ${next.hint}`)]
      : [accent('every line is decoded. go to: goto zero')];
  },
};

commands.quit = commands.exit as Handler;
commands.cd = commands.goto as Handler;
commands.ls = commands.places as Handler;
commands['?'] = commands.help as Handler;

export const COMMAND_NAMES = Object.keys(commands).sort();

export function runCommand(input: string, ctx: TerminalContext): TerminalLine[] {
  const [name = '', ...args] = input.trim().split(/\s+/);
  const handler = commands[name.toLowerCase()];
  if (!handler) return [error(`${name}: command not found. try: help`)];
  return handler(args, ctx);
}

/** Completes the first word to the only command it can be. */
export function complete(input: string): string {
  if (input.includes(' ')) return input;
  const matches = COMMAND_NAMES.filter((c) => c.startsWith(input.toLowerCase()));
  return matches.length === 1 ? `${matches[0]} ` : input;
}

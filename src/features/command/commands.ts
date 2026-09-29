import type { IconName } from '../../components/Icon.tsx';
import { places } from '../../content/routes.ts';
import type { SpectralKey } from '../../design/tokens.ts';
import type { QualityTier, Settings } from '../../stores/settings.ts';

export type CommandGroup =
  | 'Recent'
  | 'Places'
  | 'Worlds'
  | 'Ages'
  | 'Relics'
  | 'Transmissions'
  | 'Instruments'
  | 'Actions'
  | 'Shortcuts'
  | 'Hidden';

export interface CommandContext {
  go: (path: string) => void;
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  settings: () => Settings;
  openTerminal: () => void;
  replayIntro: () => void;
  toggleSound: () => void;
  notify: (title: string, body?: string) => void;
  resetProgress: () => void;
}

export interface Command {
  id: string;
  group: CommandGroup;
  title: string;
  subtitle?: string;
  keywords?: readonly string[];
  line?: SpectralKey;
  icon?: IconName;
  /** Keyboard hint shown on the right. */
  hint?: string;
  /** Hidden commands appear only when the query matches one of their keywords exactly. */
  secret?: boolean;
  run: (ctx: CommandContext) => void;
}

const placeCommands: Command[] = places
  .filter((p) => p.kind !== 'hidden')
  .map((p) => ({
    id: `place:${p.id}`,
    group: 'Places',
    title: p.label,
    subtitle: p.gloss,
    keywords: p.keywords,
    line: p.line,
    run: (ctx) => ctx.go(p.path),
  }));

const tierCommands: Command[] = (['auto', 'ultra', 'high', 'balanced', 'eco'] as const).map((tier) => ({
  id: `quality:${tier}`,
  group: 'Actions',
  title: `Graphics: ${tier === 'auto' ? 'Automatic' : tier[0]?.toUpperCase() + tier.slice(1)}`,
  subtitle: tier === 'auto' ? 'Let the observatory measure your device' : `Force the ${tier} quality tier`,
  keywords: ['quality', 'performance', 'graphics', tier],
  icon: 'eye',
  run: (ctx) => {
    ctx.setSetting('quality', tier as QualityTier | 'auto');
    ctx.notify('Graphics recalibrated', tier === 'auto' ? 'Automatic quality' : `Tier: ${tier}`);
  },
}));

const actionCommands: Command[] = [
  {
    id: 'action:sound',
    group: 'Actions',
    title: 'Toggle sound',
    subtitle: 'Procedural tones — every colour has a note',
    keywords: ['audio', 'mute', 'volume', 'music'],
    icon: 'soundOn',
    run: (ctx) => ctx.toggleSound(),
  },
  {
    id: 'action:theme',
    group: 'Actions',
    title: 'Switch theme',
    subtitle: 'Nocturne (luminous) ⇄ Plate (engraved)',
    keywords: ['dark', 'light', 'plate', 'nocturne', 'colour'],
    icon: 'plate',
    run: (ctx) => ctx.setSetting('theme', ctx.settings().theme === 'plate' ? 'nocturne' : 'plate'),
  },
  {
    id: 'action:motion',
    group: 'Actions',
    title: 'Cycle motion',
    subtitle: 'Full → Gentle → Still',
    keywords: ['animation', 'reduce motion', 'accessibility', 'calm'],
    icon: 'orbit',
    run: (ctx) => {
      const current = ctx.settings().motion;
      const next = current === 'full' || current === 'system' ? 'gentle' : current === 'gentle' ? 'still' : 'full';
      ctx.setSetting('motion', next);
      ctx.notify('Motion', next === 'full' ? 'Full' : next === 'gentle' ? 'Gentle' : 'Still');
    },
  },
  {
    id: 'action:contrast',
    group: 'Actions',
    title: 'Toggle high contrast',
    keywords: ['accessibility', 'legibility', 'contrast'],
    icon: 'eye',
    run: (ctx) => ctx.setSetting('contrast', ctx.settings().contrast === 'high' ? 'standard' : 'high'),
  },
  {
    id: 'action:cursor',
    group: 'Actions',
    title: 'Toggle instrument cursor',
    subtitle: 'Use the system pointer instead',
    keywords: ['pointer', 'mouse', 'accessibility'],
    icon: 'spark',
    run: (ctx) => ctx.setSetting('cursor', ctx.settings().cursor === 'instrument' ? 'system' : 'instrument'),
  },
  {
    id: 'action:grain',
    group: 'Actions',
    title: 'Toggle film grain',
    keywords: ['noise', 'texture', 'grain'],
    icon: 'spark',
    run: (ctx) => ctx.setSetting('grain', !ctx.settings().grain),
  },
  ...tierCommands,
  {
    id: 'action:intro',
    group: 'Actions',
    title: 'Replay the arrival',
    subtitle: 'Watch the opening sequence again',
    keywords: ['intro', 'opening', 'boot', 'replay'],
    icon: 'play',
    run: (ctx) => ctx.replayIntro(),
  },
  {
    id: 'action:copy',
    group: 'Actions',
    title: 'Copy link to this place',
    keywords: ['share', 'url', 'link', 'copy'],
    icon: 'copy',
    run: (ctx) => {
      void navigator.clipboard?.writeText(window.location.href).then(
        () => ctx.notify('Link copied', window.location.href),
        () => ctx.notify('Could not copy', 'Your browser blocked clipboard access.'),
      );
    },
  },
  {
    id: 'action:terminal',
    group: 'Actions',
    title: 'Open the Array terminal',
    subtitle: 'A direct line to the Halden Deep Array',
    keywords: ['terminal', 'console', 'shell', 'cli', 'halden'],
    icon: 'terminal',
    hint: '`',
    run: (ctx) => ctx.openTerminal(),
  },
];

const shortcutCommands: Command[] = [
  { key: '⌘K / Ctrl K', title: 'Open this console' },
  { key: '`', title: 'Open the Array terminal' },
  { key: 'G then A', title: 'Go to the Atlas (G + first letter of any place)' },
  { key: 'Esc', title: 'Close any overlay' },
  { key: '/', title: 'Search the Archive (on the Archive)' },
].map((s, i) => ({
  id: `shortcut:${i}`,
  group: 'Shortcuts' as const,
  title: s.title,
  hint: s.key,
  keywords: ['keyboard', 'shortcut', 'help', '?'],
  icon: 'keyboard' as const,
  run: () => undefined,
}));

const secretCommands: Command[] = [
  {
    id: 'secret:credits',
    group: 'Hidden',
    title: 'Roll the credits',
    keywords: ['credits', 'roll credits', 'thanks'],
    secret: true,
    icon: 'spark',
    run: (ctx) => ctx.go('/credits'),
  },
  {
    id: 'secret:zero',
    group: 'Hidden',
    title: 'Transmission Zero',
    subtitle: 'The message at the head of the signal',
    keywords: ['zero', 'transmission zero', 'message', 'fragments'],
    secret: true,
    line: 'ca',
    run: (ctx) => ctx.go('/transmission-zero'),
  },
  {
    id: 'secret:spectral',
    group: 'Hidden',
    title: 'Spectral vision',
    subtitle: 'See luminance as wavelength',
    keywords: ['spectral', 'spectrum', 'vision', 'prism', 'lanternfall'],
    secret: true,
    line: 'o3',
    run: (ctx) => {
      const next = !ctx.settings().spectral;
      ctx.setSetting('spectral', next);
      ctx.notify(next ? 'Spectral vision engaged' : 'Spectral vision released');
    },
  },
  {
    id: 'secret:ithra',
    group: 'Hidden',
    title: 'Ithra',
    subtitle: '“Those who keep the light”',
    keywords: ['ithra'],
    secret: true,
    line: 'na',
    run: (ctx) => ctx.notify('Ithra', 'The word they used for themselves: those who keep the light.'),
  },
  {
    id: 'secret:reset',
    group: 'Hidden',
    title: 'Forget my observations',
    subtitle: 'Reset fragments, path and sigil',
    keywords: ['reset', 'forget', 'clear progress'],
    secret: true,
    icon: 'reset',
    run: (ctx) => ctx.resetProgress(),
  },
];

export function allCommands(): Command[] {
  return [...placeCommands, ...actionCommands, ...shortcutCommands, ...secretCommands];
}

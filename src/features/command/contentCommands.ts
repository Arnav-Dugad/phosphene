import { chartNodes, type NodeKind } from '../../content/graph.ts';
import type { Command, CommandGroup } from './commands.ts';

/**
 * Every world, age, relic, story and instrument as a console command. Loaded
 * when the console first opens, so the content never weighs on first paint.
 */
const GROUPS: Partial<Record<NodeKind, CommandGroup>> = {
  world: 'Worlds',
  era: 'Ages',
  relic: 'Relics',
  story: 'Transmissions',
  instrument: 'Instruments',
};

export function contentCommands(): Command[] {
  return chartNodes.flatMap((node): Command[] => {
    const group = GROUPS[node.kind];
    if (!group) return [];
    return [
      {
        id: node.id,
        group,
        title: node.label,
        subtitle: node.gloss,
        keywords: [node.kind, group.toLowerCase(), ...node.gloss.toLowerCase().split(/[\s·,]+/).filter((w) => w.length > 3)],
        line: node.line,
        run: (ctx) => ctx.go(node.path),
      },
    ];
  });
}

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { Icon } from '../../components/Icon.tsx';
import { cssEase } from '../../design/motion.ts';
import { useResolvedMotion } from '../../hooks/useResolvedMotion.ts';
import { highlightSegments, rank } from '../../lib/search.ts';
import { readItem, STORAGE_KEYS, writeItem } from '../../lib/storage.ts';
import { useProgress } from '../../stores/progress.ts';
import { useSettings } from '../../stores/settings.ts';
import { useUi } from '../../stores/ui.ts';
import { audio } from '../audio/AudioEngine.ts';
import { useSound } from '../audio/useSound.ts';
import { replayIntro } from '../intro/introControl.ts';
import { useTransitionNavigate } from '../transition/useTransitionNavigate.ts';
import { allCommands, type Command, type CommandContext, type CommandGroup } from './commands.ts';
import styles from './CommandPalette.module.css';

function readRecent(): string[] {
  try {
    const raw = readItem(STORAGE_KEYS.commands);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function pushRecent(id: string): void {
  const next = [id, ...readRecent().filter((x) => x !== id)].slice(0, 5);
  writeItem(STORAGE_KEYS.commands, JSON.stringify(next));
}

interface Row {
  command: Command;
  indices: number[];
  group: CommandGroup;
}

/**
 * The Console: search every place, relic, world and story, and run actions.
 * Implements the ARIA combobox + listbox pattern inside a native modal dialog.
 */
export function CommandPalette() {
  const open = useUi((s) => s.paletteOpen);
  const setPalette = useUi((s) => s.setPalette);
  const setTerminal = useUi((s) => s.setTerminal);
  const pushToast = useUi((s) => s.toast);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const motion = useResolvedMotion();
  const go = useTransitionNavigate();
  const { toggle: toggleSound } = useSound();
  const listId = useId();

  const commands = useMemo(() => (open ? allCommands() : []), [open]);

  const rows = useMemo<Row[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      const byId = new Map(commands.map((c) => [c.id, c]));
      const recents = recent
        .map((id) => byId.get(id))
        .filter((c): c is Command => Boolean(c))
        .map((command) => ({ command, indices: [], group: 'Recent' as const }));
      const places = commands
        .filter((c) => c.group === 'Places')
        .map((command) => ({ command, indices: [], group: command.group }));
      const actions = commands
        .filter((c) => c.group === 'Actions' && !c.id.startsWith('quality:'))
        .map((command) => ({ command, indices: [], group: command.group }));
      return [...recents, ...places, ...actions];
    }
    if (q === '?') {
      return commands.filter((c) => c.group === 'Shortcuts').map((command) => ({ command, indices: [], group: command.group }));
    }
    const visible = commands.filter((c) => !c.secret || c.keywords?.some((k) => k === q));
    const ranked = rank(query, visible, 60);
    const grouped = new Map<CommandGroup, Row[]>();
    for (const r of ranked) {
      const list = grouped.get(r.item.group) ?? [];
      if (list.length < 8) list.push({ command: r.item, indices: r.indices, group: r.item.group });
      grouped.set(r.item.group, list);
    }
    // Groups appear in the order of their best match.
    return [...grouped.entries()]
      .sort((a, b) => ranked.findIndex((r) => r.item.group === a[0]) - ranked.findIndex((r) => r.item.group === b[0]))
      .flatMap(([, list]) => list);
  }, [commands, query, recent]);

  // A click on the dialog element itself (not its box) is a click on the backdrop.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onBackdrop = (e: MouseEvent): void => {
      if (e.target === dialog) setPalette(false);
    };
    dialog.addEventListener('click', onBackdrop);
    return () => dialog.removeEventListener('click', onBackdrop);
  }, [setPalette]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setQuery('');
      setRecent(readRecent());
      dialog.showModal();
      audio.play('open', 'o3');
      if (motion !== 'still') {
        dialog.animate(
          [
            { opacity: 0, transform: 'translateY(-8px) scale(0.985)', filter: 'blur(6px)' },
            { opacity: 1, transform: 'none', filter: 'blur(0)' },
          ],
          { duration: 420, easing: cssEase.out },
        );
      }
      requestAnimationFrame(() => inputRef.current?.focus());
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, motion]);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const context: CommandContext = {
    go: (path) => go(path),
    setSetting: (key, value) => useSettings.getState().set(key, value),
    settings: () => useSettings.getState(),
    openTerminal: () => setTerminal(true),
    replayIntro,
    toggleSound,
    notify: (title, body) => pushToast({ tone: 'info', title, body, line: 'o3' }),
    resetProgress: () => {
      useProgress.getState().reset();
      pushToast({ tone: 'info', title: 'Observations forgotten', body: 'Fragments, path and sigil have been cleared.' });
    },
  };

  const run = (row: Row | undefined): void => {
    if (!row || row.command.group === 'Shortcuts') return;
    pushRecent(row.command.id);
    setPalette(false);
    audio.play('click');
    // Let the dialog close before navigation starts its blink.
    requestAnimationFrame(() => row.command.run(context));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (rows.length ? (i + 1) % rows.length : 0));
      audio.play('tick');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (rows.length ? (i - 1 + rows.length) % rows.length : 0));
      audio.play('tick');
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActive(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActive(Math.max(0, rows.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      run(rows[active]);
    }
  };

  const activeId = rows[active] ? `${listId}-opt-${active}` : undefined;

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-label="Console"
      onCancel={(e) => {
        e.preventDefault();
        setPalette(false);
      }}
    >
      <div className={styles.box}>
        <div className={styles.inputRow}>
          <Icon name="search" size={18} className={styles.searchIcon} />
          <input
            ref={inputRef}
            className={styles.input}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={activeId}
            aria-autocomplete="list"
            aria-label="Search the observatory or type a command"
            placeholder="Search places, relics, worlds — or type a command…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
              audio.play('type');
            }}
            onKeyDown={onKeyDown}
            spellCheck={false}
            autoComplete="off"
          />
          <kbd className={styles.esc}>Esc</kbd>
        </div>

        <div ref={listRef} id={listId} role="listbox" aria-label="Results" className={styles.list} data-lenis-prevent>
          {rows.length === 0 && (
            <p className={styles.empty}>
              Nothing answers to “{query}”. The signal is patient — try fewer letters, or <kbd>?</kbd> for shortcuts.
            </p>
          )}
          {rows.map((row, i) => {
            const showHeader = i === 0 || rows[i - 1]?.group !== row.group;
            const { command } = row;
            return (
              <div key={`${row.group}-${command.id}`} role="presentation">
                {showHeader && (
                  <div className={styles.group} role="presentation">
                    {row.group}
                  </div>
                )}
                {/* Keyboard interaction lives on the combobox input (aria-activedescendant pattern). */}
                {/* eslint-disable-next-line jsx-a11y-x/click-events-have-key-events */}
                <div
                  id={`${listId}-opt-${i}`}
                  role="option"
                  tabIndex={-1}
                  aria-selected={i === active}
                  data-index={i}
                  className={styles.option}
                  style={{ '--opt-line': `var(--line-${command.line ?? 'na'})` } as CSSProperties}
                  onPointerMove={() => i !== active && setActive(i)}
                  onClick={() => run(row)}
                >
                  <span className={styles.marker} aria-hidden="true">
                    {command.icon ? <Icon name={command.icon} size={15} /> : <span className={styles.dot} />}
                  </span>
                  <span className={styles.title}>
                    {highlightSegments(command.title, row.indices).map((seg, k) =>
                      seg.hit ? (
                        <mark key={k} className={styles.hit}>
                          {seg.text}
                        </mark>
                      ) : (
                        <span key={k}>{seg.text}</span>
                      ),
                    )}
                  </span>
                  {command.subtitle && <span className={styles.subtitle}>{command.subtitle}</span>}
                  <span className={styles.hint} aria-hidden="true">
                    {command.hint ?? (i === active ? '↵' : '')}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className={styles.footer} aria-hidden="true">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> navigate
          </span>
          <span>
            <kbd>↵</kbd> open
          </span>
          <span>
            <kbd>?</kbd> shortcuts
          </span>
          <span className={styles.count}>{rows.length} results</span>
        </div>
      </div>
    </dialog>
  );
}

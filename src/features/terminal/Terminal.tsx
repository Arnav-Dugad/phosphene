import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { cssEase } from '../../design/motion.ts';
import { spectralOrder } from '../../design/tokens.ts';
import { useResolvedMotion } from '../../hooks/useResolvedMotion.ts';
import { lineTone } from '../../lib/spectral.ts';
import { useProgress } from '../../stores/progress.ts';
import { useSettings } from '../../stores/settings.ts';
import { useUi } from '../../stores/ui.ts';
import { audio } from '../audio/AudioEngine.ts';
import { useTransitionNavigate } from '../transition/useTransitionNavigate.ts';
import { complete, runCommand, type TerminalContext, type TerminalLine } from './commands.ts';
import styles from './Terminal.module.css';

const WELCOME: TerminalLine[] = [
  { kind: 'accent', text: 'halden deep array · observer terminal' },
  { kind: 'dim', text: 'a direct line to the dishes. type `help` to begin.' },
];

/**
 * The Array terminal: a command line into the same live model the Array
 * page shows. Opened with the backtick key or from the console.
 */
export default function Terminal() {
  const open = useUi((s) => s.terminalOpen);
  const setTerminal = useUi((s) => s.setTerminal);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState<TerminalLine[]>(WELCOME);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [cursor, setCursor] = useState(-1);
  const motion = useResolvedMotion();
  const go = useTransitionNavigate();
  const inputId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      audio.play('open', 'he');
      if (motion !== 'still') {
        dialog.animate([{ transform: 'translateY(-24px)', opacity: 0 }, { transform: 'none', opacity: 1 }], {
          duration: 360,
          easing: cssEase.out,
        });
      }
      requestAnimationFrame(() => inputRef.current?.focus());
    } else if (!open && dialog.open) {
      dialog.close();
      audio.play('close', 'he');
    }
  }, [open, motion]);

  // Keep the newest output in view.
  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [lines]);

  const context = (): TerminalContext => ({
    now: new Date(),
    progress: useProgress.getState(),
    settings: useSettings.getState(),
    history,
    go: (path) => go(path),
    set: (key, value) => useSettings.getState().set(key, value),
    sound: (on) => {
      useSettings.getState().set('sound', on);
      if (on) void audio.enable();
    },
    listen: () => {
      const ctx = audio.context;
      const bus = audio.bus;
      if (!ctx || !bus) return;
      spectralOrder.forEach((key, i) => {
        const t = ctx.currentTime + i * 0.22;
        const osc = ctx.createOscillator();
        osc.frequency.value = lineTone(key, 1);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.05, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
        osc.connect(gain).connect(bus);
        osc.start(t);
        osc.stop(t + 1.7);
      });
    },
    clear: () => setLines([]),
    close: () => setTerminal(false),
  });

  const submit = (): void => {
    const command = input.trim();
    setInput('');
    setCursor(-1);
    if (!command) return;
    const echo: TerminalLine = { kind: 'input', text: command };
    const nextHistory = [...history, command].slice(-50);
    setHistory(nextHistory);
    const result = runCommand(command, { ...context(), history: nextHistory });
    // `clear` empties the log itself; everything else appends.
    setLines((prev) => (command === 'clear' ? [] : [...prev, echo, ...result].slice(-300)));
    audio.play('tick', 'he');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!history.length) return;
      const next = cursor < 0 ? history.length - 1 : Math.max(0, cursor - 1);
      setCursor(next);
      setInput(history[next] ?? '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (cursor < 0) return;
      const next = cursor + 1;
      if (next >= history.length) {
        setCursor(-1);
        setInput('');
      } else {
        setCursor(next);
        setInput(history[next] ?? '');
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      setInput((value) => complete(value));
    } else if (e.key === '`') {
      e.preventDefault();
      setTerminal(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className={styles.terminal}
      aria-label="Array terminal"
      onCancel={(e) => {
        e.preventDefault();
        setTerminal(false);
      }}
    >
      <div className={styles.bar}>
        <span className={styles.lights} aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <span className={styles.titleText}>observer@halden — daedalus crater</span>
        <button type="button" className={styles.close} onClick={() => setTerminal(false)}>
          Close <kbd>Esc</kbd>
        </button>
      </div>
      <div ref={logRef} className={styles.log} role="log" aria-live="polite" data-lenis-prevent>
        {lines.map((line, i) => (
          <p key={i} className={styles.line} data-kind={line.kind}>
            {line.kind === 'input' && (
              <span className={styles.prompt} aria-hidden="true">
                ›{' '}
              </span>
            )}
            {line.text}
          </p>
        ))}
      </div>
      <div className={styles.inputRow}>
        <label htmlFor={inputId} className={styles.prompt}>
          ›<span className="sr-only">Command</span>
        </label>
        <input
          ref={inputRef}
          id={inputId}
          className={styles.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
        />
      </div>
    </dialog>
  );
}

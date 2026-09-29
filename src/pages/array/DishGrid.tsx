import { memo, useRef, useState, type KeyboardEvent } from 'react';
import { DISH_STATE_INFO, dishes, type DishState } from '../../content/array.ts';
import styles from './Array.module.css';

const COLUMNS = 8;

interface DishGridProps {
  states: readonly DishState[];
  selected: number | null;
  onSelect: (index: number | null) => void;
}

/**
 * All sixty-four dishes as an 8 × 8 board. One tab stop: arrow keys move
 * between dishes, Enter or Space selects (and flies the camera there).
 */
export const DishGrid = memo(function DishGrid({ states, selected, onSelect }: DishGridProps) {
  const [cursor, setCursor] = useState(selected ?? 0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const active = selected ?? cursor;

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number): void => {
    const moves: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      ArrowDown: index + COLUMNS,
      ArrowUp: index - COLUMNS,
      Home: 0,
      End: dishes.length - 1,
    };
    const next = moves[event.key];
    if (next === undefined) return;
    event.preventDefault();
    const clamped = Math.max(0, Math.min(dishes.length - 1, next));
    setCursor(clamped);
    refs.current[clamped]?.focus();
  };

  return (
    <div className={styles.dishGrid} role="group" aria-label="Dishes of the Array">
      {dishes.map((dish) => {
        const state = states[dish.index] ?? 'tracking';
        const info = DISH_STATE_INFO[state];
        return (
          <button
            key={dish.id}
            ref={(el) => {
              refs.current[dish.index] = el;
            }}
            type="button"
            className={styles.dishCell}
            data-state={state}
            aria-pressed={selected === dish.index}
            tabIndex={dish.index === active ? 0 : -1}
            aria-label={`${dish.id}${dish.name ? ` “${dish.name}”` : ''}, ${dish.group}, ${info.label}`}
            title={`${dish.id} · ${info.label}`}
            onFocus={() => setCursor(dish.index)}
            onKeyDown={(event) => onKeyDown(event, dish.index)}
            onClick={() => onSelect(selected === dish.index ? null : dish.index)}
          >
            <span aria-hidden="true">{String(dish.index + 1).padStart(2, '0')}</span>
          </button>
        );
      })}
    </div>
  );
});

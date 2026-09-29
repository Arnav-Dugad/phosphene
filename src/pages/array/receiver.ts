import { useEffect, useMemo } from 'react';
import type { ReceiverCommand, ReceiverRow } from '../../workers/receiver.worker.ts';

export type RowListener = (row: ReceiverRow) => void;

export interface RowHub {
  emit(row: ReceiverRow): void;
  subscribe(listener: RowListener): () => void;
}

/** A tiny fan-out for spectrogram rows: canvas, scene and sound all listen, React never re-renders. */
export function useRowHub(): RowHub {
  return useMemo(() => {
    const listeners = new Set<RowListener>();
    return {
      emit: (row) => listeners.forEach((listener) => listener(row)),
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
  }, []);
}

export const ROWS_PER_SECOND = 20;

/**
 * Runs the receiver worker while `live`; otherwise asks it once for a still
 * snapshot of the last few seconds. The worker also rests while the tab is
 * hidden.
 */
export function useReceiver(hub: RowHub, live: boolean, snapshotRows: number): void {
  useEffect(() => {
    const worker = new Worker(new URL('../../workers/receiver.worker.ts', import.meta.url), {
      type: 'module',
    });
    const send = (command: ReceiverCommand): void => worker.postMessage(command);
    worker.onmessage = (event: MessageEvent<ReceiverRow>) => hub.emit(event.data);
    if (live) send({ type: 'start', rate: ROWS_PER_SECOND });
    else send({ type: 'snapshot', rows: snapshotRows, rate: ROWS_PER_SECOND });
    const onVisibility = (): void => {
      if (live) send({ type: document.hidden ? 'pause' : 'resume' });
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      worker.terminate();
    };
  }, [hub, live, snapshotRows]);
}

import { useEffect, useState } from 'react';

/**
 * Samples a value from a mutable source (e.g. a WebGL scene) at a gentle
 * rate, so readouts stay live without re-rendering React every frame.
 */
export function usePoll<S, T>(source: S | null, read: (source: S) => T, intervalMs = 120, fallback: T): T {
  const [value, setValue] = useState<T>(fallback);
  useEffect(() => {
    if (!source) return;
    const id = window.setInterval(() => setValue(read(source)), intervalMs);
    return () => window.clearInterval(id);
    // `read` is expected to be a stable accessor; re-subscribing on every render would thrash.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, intervalMs]);
  return value;
}

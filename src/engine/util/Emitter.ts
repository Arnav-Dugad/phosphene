type Listener<Args extends unknown[]> = (...args: Args) => void;

/**
 * A minimal typed event emitter. Scenes announce what happens inside them
 * (a beam locks on, a dish is picked) and pages subscribe, rather than pages
 * assigning callbacks onto live scene objects.
 */
export class Emitter<Events extends Record<string, unknown[]>> {
  private readonly listeners: { [K in keyof Events]?: Set<Listener<Events[K]>> } = {};

  /** Subscribes to `event`; returns the unsubscribe function. */
  on<K extends keyof Events>(event: K, listener: Listener<Events[K]>): () => void {
    const set = (this.listeners[event] ??= new Set());
    set.add(listener);
    return () => {
      set.delete(listener);
    };
  }

  emit<K extends keyof Events>(event: K, ...args: Events[K]): void {
    this.listeners[event]?.forEach((listener) => listener(...args));
  }

  clear(): void {
    for (const key of Object.keys(this.listeners) as (keyof Events)[]) this.listeners[key]?.clear();
  }
}

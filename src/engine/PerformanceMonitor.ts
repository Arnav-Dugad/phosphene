/**
 * Measures real frame times and recommends tier changes with hysteresis:
 * sustained trouble steps quality down quickly; sustained headroom steps it up
 * slowly, and the monitor stops adapting once it has flip-flopped.
 */
export type Recommendation = 'down' | 'up' | null;

export interface MonitorOptions {
  /** Window length in seconds for one FPS sample. */
  window: number;
  /** Below this average FPS, a window counts as "struggling". */
  lowFps: number;
  /** Above this average FPS, a window counts as "comfortable". */
  highFps: number;
  /** Consecutive struggling windows before recommending "down". */
  downAfter: number;
  /** Consecutive comfortable windows before recommending "up". */
  upAfter: number;
  /** Maximum tier changes per session. */
  maxChanges: number;
}

const DEFAULTS: MonitorOptions = {
  window: 1,
  lowFps: 44,
  highFps: 58,
  downAfter: 2,
  upAfter: 12,
  maxChanges: 4,
};

export class PerformanceMonitor {
  private readonly options: MonitorOptions;
  private frames = 0;
  private elapsed = 0;
  private struggling = 0;
  private comfortable = 0;
  private changes = 0;
  private lastDirection: Recommendation = null;
  /** Most recent windowed FPS. */
  fps = 60;

  constructor(options: Partial<MonitorOptions> = {}) {
    this.options = { ...DEFAULTS, ...options };
  }

  /** Feed one frame's unscaled delta; returns a recommendation when a window closes. */
  sample(delta: number): Recommendation {
    // Ignore pathological gaps (tab restore, breakpoint) entirely.
    if (delta > 0.25) return null;
    this.frames++;
    this.elapsed += delta;
    if (this.elapsed < this.options.window) return null;

    this.fps = this.frames / this.elapsed;
    this.frames = 0;
    this.elapsed = 0;

    if (this.changes >= this.options.maxChanges) return null;

    if (this.fps < this.options.lowFps) {
      this.struggling++;
      this.comfortable = 0;
    } else if (this.fps > this.options.highFps) {
      this.comfortable++;
      this.struggling = 0;
    } else {
      this.struggling = 0;
      this.comfortable = Math.max(0, this.comfortable - 1);
    }

    if (this.struggling >= this.options.downAfter) return this.commit('down');
    // Never climb back up right after being forced down: that is the flip-flop we avoid.
    if (this.comfortable >= this.options.upAfter && this.lastDirection !== 'down') return this.commit('up');
    return null;
  }

  /** Reset counters, e.g. after a scene switch, whose first frames are always slow. */
  settle(): void {
    this.frames = 0;
    this.elapsed = 0;
    this.struggling = 0;
    this.comfortable = 0;
  }

  private commit(direction: Exclude<Recommendation, null>): Recommendation {
    this.changes++;
    this.lastDirection = direction;
    this.settle();
    return direction;
  }
}

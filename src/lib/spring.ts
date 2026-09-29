import type { SpringConfig } from '../design/tokens.ts';

/**
 * A critically-tunable damped spring integrated with semi-implicit Euler and
 * fixed sub-steps, so behaviour is identical at 30, 60 or 144 Hz.
 */
export class Spring {
  value: number;
  target: number;
  velocity = 0;
  private readonly config: SpringConfig;

  constructor(initial: number, config: SpringConfig) {
    this.value = initial;
    this.target = initial;
    this.config = config;
  }

  step(dt: number): number {
    const { stiffness, damping, mass } = this.config;
    // Clamp huge gaps (tab switches) so the spring never explodes.
    const total = Math.min(dt, 1 / 15);
    const steps = Math.max(1, Math.ceil(total / (1 / 240)));
    const h = total / steps;
    for (let i = 0; i < steps; i++) {
      const force = -stiffness * (this.value - this.target) - damping * this.velocity;
      this.velocity += (force / mass) * h;
      this.value += this.velocity * h;
    }
    return this.value;
  }

  snap(value: number): void {
    this.value = value;
    this.target = value;
    this.velocity = 0;
  }

  get settled(): boolean {
    return Math.abs(this.value - this.target) < 1e-3 && Math.abs(this.velocity) < 1e-3;
  }
}

export class Spring2 {
  readonly x: Spring;
  readonly y: Spring;

  constructor(x: number, y: number, config: SpringConfig) {
    this.x = new Spring(x, config);
    this.y = new Spring(y, config);
  }

  setTarget(x: number, y: number): void {
    this.x.target = x;
    this.y.target = y;
  }

  step(dt: number): void {
    this.x.step(dt);
    this.y.step(dt);
  }

  snap(x: number, y: number): void {
    this.x.snap(x);
    this.y.snap(y);
  }

  get speed(): number {
    return Math.hypot(this.x.velocity, this.y.velocity);
  }

  get settled(): boolean {
    return this.x.settled && this.y.settled;
  }
}

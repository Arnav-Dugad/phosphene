import { Vector3, type PerspectiveCamera } from 'three';
import { clamp, damp } from '../../lib/math.ts';

export interface OrbitRigOptions {
  distance: number;
  minDistance: number;
  maxDistance: number;
  theta?: number;
  phi?: number;
  minPhi?: number;
  maxPhi?: number;
  /** Idle azimuthal drift, radians per second. */
  autoRotate?: number;
}

/**
 * A spherical camera rig with inertia: drag to orbit, wheel or pinch to zoom,
 * and `flyTo` for smooth travel between subjects. Pointer input arrives in
 * normalised device coordinates from the stage.
 */
export class OrbitRig {
  readonly target = new Vector3();
  private readonly targetGoal = new Vector3();
  distance: number;
  private distanceGoal: number;
  theta: number;
  phi: number;
  private thetaVelocity = 0;
  private phiVelocity = 0;
  private phiGoal: number | null = null;
  private following = false;
  private readonly followed = new Vector3();
  private readonly carry = new Vector3();
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private lastMove = 0;
  private idleFor = 0;
  private readonly options: Required<OrbitRigOptions>;
  private readonly offset = new Vector3();
  /** Pointer travel (NDC) during the current press — used to tell clicks from drags. */
  travel = 0;

  constructor(options: OrbitRigOptions) {
    this.options = {
      theta: 0.8,
      phi: 1.15,
      minPhi: 0.12,
      maxPhi: Math.PI - 0.12,
      autoRotate: 0.03,
      ...options,
    };
    this.distance = this.distanceGoal = options.distance;
    this.theta = this.options.theta;
    this.phi = this.options.phi;
  }

  pointerDown(x: number, y: number): void {
    this.dragging = true;
    this.phiGoal = null;
    this.lastX = x;
    this.lastY = y;
    this.travel = 0;
    this.thetaVelocity = 0;
    this.phiVelocity = 0;
    this.lastMove = performance.now();
  }

  pointerMove(x: number, y: number): void {
    if (!this.dragging) return;
    const now = performance.now();
    const dx = x - this.lastX;
    const dy = y - this.lastY;
    this.travel += Math.hypot(dx, dy);
    const dt = Math.max(1, now - this.lastMove) / 1000;
    this.theta -= dx * 1.6;
    this.phi = clamp(this.phi + dy * 1.2, this.options.minPhi, this.options.maxPhi);
    this.thetaVelocity = (-dx * 1.6) / dt;
    this.phiVelocity = (dy * 1.2) / dt;
    this.lastX = x;
    this.lastY = y;
    this.lastMove = now;
    this.idleFor = 0;
  }

  pointerUp(): void {
    this.dragging = false;
    // Release velocity only if the pointer was still moving at release time.
    if (performance.now() - this.lastMove > 80) {
      this.thetaVelocity = 0;
      this.phiVelocity = 0;
    }
  }

  /** Multiplies distance by `factor` (>1 zooms out). */
  zoom(factor: number): void {
    this.distanceGoal = clamp(this.distanceGoal * factor, this.options.minDistance, this.options.maxDistance);
    this.idleFor = 0;
  }

  flyTo(target: Vector3, distance?: number): void {
    this.targetGoal.copy(target);
    this.following = false;
    if (distance !== undefined)
      this.distanceGoal = clamp(distance, this.options.minDistance, this.options.maxDistance);
  }

  /** Eases the polar angle to `phi` — e.g. a higher vantage for a close subject. Dragging cancels it. */
  tiltTo(phi: number): void {
    this.phiGoal = clamp(phi, this.options.minPhi, this.options.maxPhi);
  }

  /**
   * Follow a moving subject: the camera is carried along with the subject's
   * motion, so only the remaining approach from `flyTo` eases — a fast orbit
   * never leaves the subject trailing out of frame.
   */
  follow(target: Vector3): void {
    if (this.following) this.target.add(this.carry.copy(target).sub(this.followed));
    this.targetGoal.copy(target);
    this.followed.copy(target);
    this.following = true;
  }

  setLimits(minDistance: number, maxDistance: number): void {
    this.options.minDistance = minDistance;
    this.options.maxDistance = maxDistance;
    this.distanceGoal = clamp(this.distanceGoal, minDistance, maxDistance);
  }

  get isDragging(): boolean {
    return this.dragging;
  }

  update(dt: number, camera: PerspectiveCamera, still = false): void {
    this.idleFor += dt;
    if (!this.dragging) {
      this.theta += this.thetaVelocity * dt;
      this.phi = clamp(this.phi + this.phiVelocity * dt, this.options.minPhi, this.options.maxPhi);
      const decay = Math.exp(-4 * dt);
      this.thetaVelocity *= decay;
      this.phiVelocity *= decay;
      if (this.phiGoal !== null) {
        this.phi = damp(this.phi, this.phiGoal, still ? 1000 : 2.4, dt);
        if (Math.abs(this.phi - this.phiGoal) < 1e-3) this.phiGoal = null;
      }
      if (!still && this.idleFor > 2.5)
        this.theta += this.options.autoRotate * dt * Math.min(1, (this.idleFor - 2.5) / 3);
    }
    const k = still ? 1000 : 3.2;
    this.target.x = damp(this.target.x, this.targetGoal.x, k, dt);
    this.target.y = damp(this.target.y, this.targetGoal.y, k, dt);
    this.target.z = damp(this.target.z, this.targetGoal.z, k, dt);
    this.distance = damp(this.distance, this.distanceGoal, still ? 1000 : 3.6, dt);

    const sinPhi = Math.sin(this.phi);
    this.offset.set(
      this.distance * sinPhi * Math.sin(this.theta),
      this.distance * Math.cos(this.phi),
      this.distance * sinPhi * Math.cos(this.theta),
    );
    camera.position.copy(this.target).add(this.offset);
    camera.lookAt(this.target);
  }
}

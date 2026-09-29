import {
  BufferGeometry,
  Float32BufferAttribute,
  Mesh,
  OrthographicCamera,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector4,
} from 'three';
import { MAX_EMITTERS } from '../../../content/instruments.ts';
import { clamp, damp, TAU } from '../../../lib/math.ts';
import { createRng } from '../../../lib/random.ts';
import type { SceneParams } from '../../../stores/stage.ts';
import { gauss, glsl, spectrum } from '../../shaders/chunks.ts';
import type { FrameState, PostSettings, SceneFactory, StageContext, StageScene, Viewport } from '../../types.ts';
import { Emitter as SceneEvents } from '../../util/Emitter.ts';

export type InterferencePreset = 'slits' | 'ring' | 'array' | 'chaos';
export type InterferenceDisplay = 'intensity' | 'phase' | 'spectral';
const DISPLAY_INDEX: Record<InterferenceDisplay, number> = { intensity: 0, phase: 1, spectral: 2 };

interface Emitter {
  x: number;
  y: number;
  phase: number;
}

/**
 * Coherent-wave interference computed per pixel. Each emitter radiates
 * A·cos(k·r − ω·t + φ)/√(1 + r); the display maps the summed field (or its
 * intensity) to light. The same sum is evaluated on the CPU at the target to
 * judge whether the visitor has steered a beam onto it.
 */
const fragmentShader = glsl`
  uniform vec4 uEmitters[${MAX_EMITTERS}];
  uniform int uCount;
  uniform float uTime;
  uniform float uK;
  uniform float uOmega;
  uniform float uDisplay;
  uniform vec2 uAspect;
  uniform vec2 uTarget;
  uniform float uTargetOn;
  uniform float uLock;
  uniform int uSelected;
  varying vec2 vUv;
  ${spectrum}
  ${gauss}

  void main() {
    vec2 p = (vUv * 2.0 - 1.0) * uAspect;
    float field = 0.0;
    float envelope = 0.0;
    for (int i = 0; i < uCount; i++) {
      vec4 e = uEmitters[i];
      float r = length(p - e.xy);
      float a = 1.0 / sqrt(1.0 + r * 6.0);
      field += a * cos(uK * r - uOmega * uTime + e.z);
      envelope += a;
    }
    float norm = max(envelope, 0.001);
    float intensity = (field * field) / (norm * norm * 0.5 + 0.2);
    vec3 color;
    if (uDisplay < 0.5) {
      color = vec3(0.36, 0.95, 0.82) * pow(intensity, 1.4) * 0.9 + vec3(0.02, 0.05, 0.06) * intensity;
    } else if (uDisplay < 1.5) {
      float s = field / norm;
      color = s > 0.0 ? vec3(1.0, 0.7, 0.37) * s * s * 1.4 : vec3(0.38, 0.79, 1.0) * s * s * 1.4;
    } else {
      float nm = mix(660.0, 410.0, clamp(intensity * 0.55, 0.0, 1.0));
      color = wavelengthToRgb(nm) * pow(intensity, 0.8) * 0.8;
    }

    // Emitters: small luminous apertures, the selected one ringed.
    for (int i = 0; i < uCount; i++) {
      vec4 e = uEmitters[i];
      float d = length(p - e.xy);
      color += vec3(1.0, 0.95, 0.85) * exp(-d * d * 3200.0) * 2.0;
      color += vec3(1.0, 0.95, 0.85) * gauss((d - 0.028) * 260.0) * 0.9;
      if (i == uSelected) color += vec3(0.36, 0.95, 0.82) * gauss((d - 0.05) * 200.0) * 1.5;
    }

    // The target: a dashed ring that fills as the beam locks on.
    float td = length(p - uTarget);
    float ang = atan(p.y - uTarget.y, p.x - uTarget.x);
    float dash = step(0.5, fract(ang * 6.0 / 6.2831853 * 4.0));
    float ring = gauss((td - 0.07) * 220.0) * mix(dash, 1.0, uLock);
    color += mix(vec3(0.8, 0.8, 0.8), vec3(0.76, 0.6, 1.0), uLock) * ring * uTargetOn * 1.6;
    color += vec3(0.76, 0.6, 1.0) * exp(-td * td * 400.0) * uLock * uTargetOn * 1.5;

    float vignette = smoothstep(1.9, 0.6, length(p));
    gl_FragColor = vec4(color * vignette, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const vertexShader = glsl`
  varying vec2 vUv;
  void main() {
    vUv = position.xy * 0.5 + 0.5;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

class InterferenceScene implements StageScene {
  readonly scene = new Scene();
  readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  readonly post: Partial<PostSettings> = { bloomIntensity: 0.9, bloomThreshold: 0.5, vignette: 0.35, aberration: 0.8 };

  /** Fraction in [0, 1] of how well the beam is locked on the target. */
  lock = 0;
  /** `locked` fires once the beam has held the target long enough; `count` when emitters change. */
  readonly events = new SceneEvents<{ locked: []; count: [number] }>();

  private readonly material: ShaderMaterial;
  private readonly mesh: Mesh<BufferGeometry, ShaderMaterial>;
  private readonly uniformsEmitters: Vector4[];
  private emitters: Emitter[] = [];
  private preset: InterferencePreset = 'array';
  private wavelength = 0.12;
  private speed = 1;
  private steer = 0;
  private display: InterferenceDisplay = 'intensity';
  private readonly aspect = new Vector2(1, 1);
  private readonly target = new Vector2(0.62, 0.55);
  private dragging = -1;
  private selected = -1;
  private lastClick = 0;
  private lockHeld = 0;
  private locked = false;
  private time = 0;

  constructor(_ctx: StageContext, params: SceneParams) {
    this.uniformsEmitters = Array.from({ length: MAX_EMITTERS }, () => new Vector4());
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    this.material = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uEmitters: { value: this.uniformsEmitters },
        uCount: { value: 0 },
        uTime: { value: 0 },
        uK: { value: TAU / this.wavelength },
        uOmega: { value: 3 },
        uDisplay: { value: 0 },
        uAspect: { value: this.aspect },
        uTarget: { value: this.target },
        uTargetOn: { value: 1 },
        uLock: { value: 0 },
        uSelected: { value: -1 },
      },
    });
    this.mesh = new Mesh(geometry, this.material);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
    this.applyPreset('array');
    this.setParams(params);
  }

  setParams(params: SceneParams): void {
    if (typeof params.wavelength === 'number') this.wavelength = clamp(params.wavelength, 0.04, 0.4);
    if (typeof params.speed === 'number') this.speed = params.speed;
    if (typeof params.steer === 'number') {
      this.steer = params.steer;
      if (this.preset === 'array') this.applySteer();
    }
    if (typeof params.display === 'string' && params.display in DISPLAY_INDEX) {
      this.display = params.display as InterferenceDisplay;
    }
    if (typeof params.preset === 'string' && params.preset !== this.preset) {
      this.applyPreset(params.preset as InterferencePreset);
    }
  }

  /** Restores the current preset's emitters. */
  reset(): void {
    this.applyPreset(this.preset);
  }

  /** Rebuilds emitters for a preset. Deterministic for a given preset. */
  applyPreset(preset: InterferencePreset): void {
    this.preset = preset;
    this.selected = -1;
    const rng = createRng(`interference:${preset}`);
    switch (preset) {
      case 'slits':
        this.emitters = [
          { x: -0.16, y: -0.75, phase: 0 },
          { x: 0.16, y: -0.75, phase: 0 },
        ];
        break;
      case 'ring':
        this.emitters = Array.from({ length: 6 }, (_, i) => {
          const a = (i / 6) * TAU;
          return { x: Math.cos(a) * 0.55, y: Math.sin(a) * 0.55, phase: 0 };
        });
        break;
      case 'chaos':
        this.emitters = Array.from({ length: 5 }, () => ({
          x: rng.range(-0.9, 0.9),
          y: rng.range(-0.8, 0.8),
          phase: rng.range(0, TAU),
        }));
        break;
      case 'array':
      default:
        this.emitters = Array.from({ length: MAX_EMITTERS }, (_, i) => ({
          x: (i - (MAX_EMITTERS - 1) / 2) * this.wavelength * 0.5,
          y: -0.82,
          phase: 0,
        }));
        this.applySteer();
    }
    this.locked = false;
    this.lockHeld = 0;
    this.events.emit('count', this.emitters.length);
  }

  /**
   * Phase gradient across the array. With spacing d = λ/2, giving element i the
   * phase φᵢ = k·xᵢ·sin θ = π·i·sin θ makes the wavefronts add up along θ;
   * `steer` plays the role of sin θ (slightly over-ranged for reach).
   */
  private applySteer(): void {
    this.emitters.forEach((e, i) => {
      e.phase = i * this.steer * Math.PI * 1.1;
    });
  }

  resize(viewport: Readonly<Viewport>): void {
    // Shorter side spans [-1, 1]; the longer side extends.
    if (viewport.aspect >= 1) this.aspect.set(viewport.aspect, 1);
    else this.aspect.set(1, 1 / viewport.aspect);
    this.target.set(viewport.aspect >= 1 ? 0.62 : 0.3, viewport.aspect >= 1 ? 0.55 : 0.6);
  }

  private toWorld(x: number, y: number): Vector2 {
    return new Vector2(x * this.aspect.x, y * this.aspect.y);
  }

  private hit(p: Vector2): number {
    let best = -1;
    let bestD = 0.07;
    this.emitters.forEach((e, i) => {
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  }

  onPointerDown(x: number, y: number): void {
    const p = this.toWorld(x, y);
    const index = this.hit(p);
    const now = performance.now();
    if (index >= 0 && now - this.lastClick < 320 && this.selected === index) {
      this.emitters.splice(index, 1);
      this.selected = -1;
      this.events.emit('count', this.emitters.length);
    } else if (index >= 0) {
      this.dragging = index;
      this.selected = index;
    } else if (this.emitters.length < MAX_EMITTERS) {
      this.emitters.push({ x: p.x, y: p.y, phase: 0 });
      this.selected = this.emitters.length - 1;
      this.dragging = this.selected;
      this.events.emit('count', this.emitters.length);
    }
    this.lastClick = now;
  }

  onPointerMove(x: number, y: number): void {
    if (this.dragging < 0) return;
    const e = this.emitters[this.dragging];
    if (!e) return;
    const p = this.toWorld(x, y);
    e.x = clamp(p.x, -this.aspect.x, this.aspect.x);
    e.y = clamp(p.y, -this.aspect.y, this.aspect.y);
  }

  onPointerUp(): void {
    this.dragging = -1;
  }

  onKey(key: string): boolean {
    if (key === 'n' || key === 'N') {
      if (this.emitters.length < MAX_EMITTERS) {
        this.emitters.push({ x: 0, y: 0, phase: 0 });
        this.selected = this.emitters.length - 1;
        this.events.emit('count', this.emitters.length);
      }
      return true;
    }
    if (key === 'Tab') return false;
    const e = this.emitters[this.selected];
    if (!e) {
      if (key.startsWith('Arrow') && this.emitters.length) {
        this.selected = 0;
        return true;
      }
      return false;
    }
    const step = 0.04;
    if (key === 'ArrowLeft') e.x -= step;
    else if (key === 'ArrowRight') e.x += step;
    else if (key === 'ArrowUp') e.y += step;
    else if (key === 'ArrowDown') e.y -= step;
    else if (key === ']') this.selected = (this.selected + 1) % this.emitters.length;
    else if (key === '[') this.selected = (this.selected - 1 + this.emitters.length) % this.emitters.length;
    else if (key === 'Delete' || key === 'Backspace') {
      this.emitters.splice(this.selected, 1);
      this.selected = Math.min(this.selected, this.emitters.length - 1);
      this.events.emit('count', this.emitters.length);
    } else return false;
    return true;
  }

  /** Time-averaged intensity at a point, relative to the mean of the array (CPU). */
  private relativeIntensityAt(px: number, py: number): number {
    const k = TAU / this.wavelength;
    let re = 0;
    let im = 0;
    let env = 0;
    for (const e of this.emitters) {
      const r = Math.hypot(px - e.x, py - e.y);
      const a = 1 / Math.sqrt(1 + r * 6);
      re += a * Math.cos(k * r + e.phase);
      im += a * Math.sin(k * r + e.phase);
      env += a;
    }
    return env > 0 ? (re * re + im * im) / (env * env) : 0;
  }

  update(frame: FrameState): void {
    const raw = Math.min(frame.rawDelta, 0.1);
    this.time += frame.delta * this.speed;
    const u = this.material.uniforms;
    this.emitters.forEach((e, i) => this.uniformsEmitters[i]?.set(e.x, e.y, e.phase, 1));
    (u.uCount as { value: number }).value = this.emitters.length;
    (u.uTime as { value: number }).value = this.time;
    (u.uK as { value: number }).value = TAU / this.wavelength;
    (u.uOmega as { value: number }).value = 3;
    (u.uDisplay as { value: number }).value = DISPLAY_INDEX[this.display];
    (u.uSelected as { value: number }).value = this.selected;

    // A beam is "on target" when the time-averaged intensity there is near the coherent maximum.
    const targetOn = this.preset === 'array' ? 1 : 0;
    (u.uTargetOn as { value: number }).value = damp((u.uTargetOn as { value: number }).value, targetOn, 4, raw);
    const relative = this.preset === 'array' ? this.relativeIntensityAt(this.target.x, this.target.y) : 0;
    const onTarget = relative > 0.72;
    this.lockHeld = onTarget ? this.lockHeld + raw : Math.max(0, this.lockHeld - raw * 2);
    this.lock = clamp(this.lockHeld / 1.5);
    (u.uLock as { value: number }).value = this.lock;
    if (this.lock >= 1 && !this.locked) {
      this.locked = true;
      this.events.emit('locked');
    }
  }

  dispose(): void {
    this.events.clear();
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.scene.clear();
  }
}

const create: SceneFactory = (ctx, params) => new InterferenceScene(ctx, params);
export default create;
export type { InterferenceScene };

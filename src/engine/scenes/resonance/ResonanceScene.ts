import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  LineBasicMaterial,
  LineLoop,
  Mesh,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  Raycaster,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  Vector4,
  Float32BufferAttribute,
} from 'three';
import type { Variable } from 'three/examples/jsm/misc/GPUComputationRenderer.js';
import { clamp, damp } from '../../../lib/math.ts';
import { createRng } from '../../../lib/random.ts';
import type { SceneParams } from '../../../stores/stage.ts';
import { glsl, hash } from '../../shaders/chunks.ts';
import type {
  FrameState,
  PostSettings,
  SceneFactory,
  StageContext,
  StageScene,
  Viewport,
} from '../../types.ts';
import { Emitter } from '../../util/Emitter.ts';
import { Gpgpu, referenceUvs } from '../../util/gpgpu.ts';

/** Chladni mode shape for a free square plate: cos(nπx)cos(mπy) − cos(mπx)cos(nπy). */
const modeGlsl = glsl`
  float chladni(vec2 p, float m, float n) {
    vec2 q = (p + 1.0) * 0.5 * 3.14159265;
    return cos(n * q.x) * cos(m * q.y) - cos(m * q.x) * cos(n * q.y);
  }
`;

const computeShader = glsl`
  uniform float uSeed;
  uniform vec4 uModes;
  uniform float uMix;
  uniform float uStep;
  uniform vec3 uBow;
  uniform float uScatter;
  ${hash}
  ${modeGlsl}
  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec4 state = texture2D(texturePosition, uv);
    vec2 p = state.xy;
    float a1 = chladni(p, uModes.x, uModes.y);
    float a2 = chladni(p, uModes.z, uModes.w);
    float amp = abs(mix(a1, a2, uMix));
    vec2 d = p - uBow.xy;
    float bow = uBow.z * exp(-dot(d, d) * 30.0);
    float energy = amp * amp + bow + uScatter;
    float angle = hash12(uv * 91.7 + uSeed) * 6.2831853;
    float reach = 0.35 + hash12(uv * 17.3 - uSeed * 1.7);
    p += vec2(cos(angle), sin(angle)) * energy * uStep * reach;
    p = clamp(p, vec2(-1.0), vec2(1.0));
    gl_FragColor = vec4(p, energy, state.w);
  }
`;

const grainVertex = glsl`
  attribute vec2 aRef;
  uniform sampler2D uState;
  uniform float uSize;
  varying float vEnergy;
  varying float vSeed;
  void main() {
    vec4 s = texture2D(uState, aRef);
    vEnergy = s.z;
    vSeed = s.w;
    vec4 mv = modelViewMatrix * vec4(s.xy, 0.004, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * (0.8 + s.w * 0.6) * (3.0 / -mv.z);
  }
`;

const grainFragment = glsl`
  uniform vec3 uSand;
  uniform vec3 uGlow;
  varying float vEnergy;
  varying float vSeed;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.1, d);
    if (a < 0.02) discard;
    float settled = smoothstep(0.06, 0.0, vEnergy);
    vec3 color = mix(uGlow * 0.55, uSand * (0.75 + vSeed * 0.35), settled);
    gl_FragColor = vec4(color * a * mix(0.45, 1.0, settled), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const plateVertex = glsl`
  uniform vec4 uModes;
  uniform float uMix;
  uniform float uTime;
  uniform float uFreq;
  varying float vAmp;
  varying vec2 vPos;
  ${modeGlsl}
  void main() {
    vec2 p = position.xy;
    float amp = mix(chladni(p, uModes.x, uModes.y), chladni(p, uModes.z, uModes.w), uMix);
    vAmp = amp;
    vPos = p;
    vec3 displaced = position + vec3(0.0, 0.0, amp * sin(uTime * uFreq) * 0.012);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  }
`;

const plateFragment = glsl`
  uniform vec3 uGlow;
  uniform float uTime;
  varying float vAmp;
  varying vec2 vPos;
  void main() {
    float nodal = 1.0 - smoothstep(0.0, 0.08, abs(vAmp));
    float edge = max(abs(vPos.x), abs(vPos.y));
    vec3 base = vec3(0.012, 0.014, 0.02) + vec3(0.02) * (1.0 - edge * 0.6);
    vec3 color = base + uGlow * nodal * 0.035 + uGlow * abs(vAmp) * 0.012;
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const SWEEP: readonly [number, number][] = [
  [2, 1],
  [3, 1],
  [3, 2],
  [4, 1],
  [5, 2],
  [5, 3],
  [6, 1],
  [6, 5],
  [8, 3],
  [9, 4],
];

class ResonanceScene implements StageScene {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(32, 1, 0.05, 50);
  readonly post: Partial<PostSettings> = { bloomIntensity: 0.7, bloomThreshold: 0.55, vignette: 0.6 };

  /** Current mode numbers and how settled the sand is (0–1), for the page. */
  m = 5;
  n = 3;
  settled = 0;
  /** `settled` fires when the plate's figure has settled into mode (m, n). */
  readonly events = new Emitter<{ settled: [number, number] }>();

  private readonly ctx: StageContext;
  private readonly gpgpu: Gpgpu;
  private readonly variable: Variable;
  private readonly grains: Points<BufferGeometry, ShaderMaterial>;
  private readonly plate: Mesh<PlaneGeometry, ShaderMaterial>;
  private readonly frame: LineLoop;
  private readonly raycaster = new Raycaster();
  private readonly ndc = new Vector2();
  private readonly hit = new Vector3();
  private readonly bow = new Vector3(0, 0, 0);
  /** (m₁, n₁, m₂, n₂): the pattern being left and the pattern being approached. */
  private readonly modes = new Vector4(5, 3, 5, 3);
  private frameCount = 0;
  private bowing = false;
  private mix = 1;
  private scatter = 0.25;
  private sweep = false;
  private sweepIndex = 0;
  private sweepClock = 0;
  private settleClock = 0;
  private announced = '';
  private time = 0;

  constructor(ctx: StageContext, params: SceneParams) {
    this.ctx = ctx;
    const side = Math.min(512, ctx.profile.gpgpuSide);
    this.gpgpu = new Gpgpu(ctx.renderer, side);
    const rng = createRng('chladni');
    const initial = this.gpgpu.texture((data, i) => {
      data[i * 4] = rng.range(-1, 1);
      data[i * 4 + 1] = rng.range(-1, 1);
      data[i * 4 + 2] = 1;
      data[i * 4 + 3] = rng.next();
    });
    this.variable = this.gpgpu.variable('texturePosition', computeShader, initial, {
      uSeed: 0,
      uModes: this.modes,
      uMix: 1,
      uStep: 0.01,
      uBow: this.bow,
      uScatter: 0.25,
    });
    this.gpgpu.compute.setVariableDependencies(this.variable, [this.variable]);
    this.gpgpu.init();

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(new Float32Array(side * side * 3), 3));
    geometry.setAttribute('aRef', new BufferAttribute(referenceUvs(side), 2));
    const glow = new Color('#62c9ff');
    const grainMaterial = new ShaderMaterial({
      vertexShader: grainVertex,
      fragmentShader: grainFragment,
      uniforms: {
        uState: { value: null },
        uSize: { value: 1.6 },
        uSand: { value: new Color('#f1e6cf') },
        uGlow: { value: glow },
      },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    this.grains = new Points(geometry, grainMaterial);
    this.grains.frustumCulled = false;

    const plateMaterial = new ShaderMaterial({
      vertexShader: plateVertex,
      fragmentShader: plateFragment,
      uniforms: {
        uModes: { value: this.modes },
        uMix: { value: 1 },
        uTime: { value: 0 },
        uFreq: { value: 30 },
        uGlow: { value: glow },
      },
    });
    this.plate = new Mesh(new PlaneGeometry(2, 2, 160, 160), plateMaterial);

    const frameGeometry = new BufferGeometry();
    frameGeometry.setAttribute(
      'position',
      new Float32BufferAttribute([-1.02, -1.02, 0, 1.02, -1.02, 0, 1.02, 1.02, 0, -1.02, 1.02, 0], 3),
    );
    this.frame = new LineLoop(
      frameGeometry,
      new LineBasicMaterial({ color: new Color('#62c9ff'), transparent: true, opacity: 0.5 }),
    );

    const group = [this.plate, this.grains, this.frame];
    for (const object of group) {
      object.rotation.x = -Math.PI / 2 + 0.62;
      this.scene.add(object);
    }
    this.camera.position.set(0, 0.35, 5.4);
    this.camera.lookAt(0, -0.1, 0);
    this.setParams(params);
  }

  setParams(params: SceneParams): void {
    if (typeof params.sweep === 'boolean') this.sweep = params.sweep;
    const m = typeof params.m === 'number' ? Math.round(params.m) : this.m;
    const n = typeof params.n === 'number' ? Math.round(params.n) : this.n;
    if (m !== this.m || n !== this.n) this.setMode(m, n);
  }

  /** Throws the sand into the air; it will find the nodal lines again. */
  scatterSand(): void {
    this.scatter = 1.2;
    this.settleClock = 0;
    this.announced = '';
  }

  private setMode(m: number, n: number): void {
    const modes = this.modes;
    // Blend from the pattern currently on the plate toward the new one.
    modes.x = this.mix >= 0.5 ? modes.z : modes.x;
    modes.y = this.mix >= 0.5 ? modes.w : modes.y;
    modes.z = m;
    modes.w = n;
    this.mix = 0;
    this.m = m;
    this.n = n;
    this.settleClock = 0;
    this.scatter = Math.max(this.scatter, 0.12);
  }

  resize(viewport: Readonly<Viewport>): void {
    this.camera.aspect = viewport.aspect;
    this.camera.fov = viewport.aspect < 1 ? 32 / Math.max(0.55, viewport.aspect) : 32;
    // On wide screens, slide the plate left to leave room for the panel.
    const shift = viewport.compact ? 0 : viewport.width * 0.12;
    this.camera.setViewOffset(
      viewport.width,
      viewport.height,
      shift,
      viewport.compact ? viewport.height * 0.2 : 0,
      viewport.width,
      viewport.height,
    );
    this.camera.updateProjectionMatrix();
    (this.grains.material.uniforms.uSize as { value: number }).value = Math.max(
      1,
      viewport.dpr * (viewport.height / 900) * 1.5,
    );
  }

  private plateHit(x: number, y: number): boolean {
    this.ndc.set(x, y);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const hits = this.raycaster.intersectObject(this.plate, false);
    const first = hits[0];
    if (!first) return false;
    this.hit.copy(first.point);
    this.plate.worldToLocal(this.hit);
    this.bow.set(clamp(this.hit.x, -1, 1), clamp(this.hit.y, -1, 1), this.bow.z);
    return true;
  }

  onPointerDown(x: number, y: number): void {
    this.bowing = this.plateHit(x, y);
  }

  onPointerMove(x: number, y: number): void {
    if (this.bowing) this.plateHit(x, y);
  }

  onPointerUp(): void {
    this.bowing = false;
  }

  prerender(): void {
    this.gpgpu.compute.compute();
  }

  update(frame: FrameState): void {
    const raw = Math.min(frame.rawDelta, 0.1);
    const still = frame.motion === 'still';
    this.time += frame.delta;

    if (this.sweep) {
      this.sweepClock += raw;
      if (this.sweepClock > 6) {
        this.sweepClock = 0;
        this.sweepIndex = (this.sweepIndex + 1) % SWEEP.length;
        const [m, n] = SWEEP[this.sweepIndex] ?? [5, 3];
        this.setMode(m, n);
      }
    }

    this.mix = Math.min(1, this.mix + raw / 1.4);
    this.scatter = damp(this.scatter, 0, 1.6, raw);
    this.bow.z = damp(this.bow.z, this.bowing ? 0.9 : 0, 8, raw);

    const u = this.variable.material.uniforms;
    // A per-frame seed (not scene time, which "still" motion freezes) keeps the walk random.
    this.frameCount++;
    (u.uSeed as { value: number }).value = (this.frameCount * 0.6180339) % 1;
    (u.uMix as { value: number }).value = this.mix;
    (u.uScatter as { value: number }).value = this.scatter;
    (u.uStep as { value: number }).value = still ? 0.02 : 0.011;

    const pu = this.plate.material.uniforms;
    (pu.uMix as { value: number }).value = this.mix;
    (pu.uTime as { value: number }).value = this.time;
    (pu.uFreq as { value: number }).value = 18 + Math.hypot(this.m, this.n) * 4;
    (this.grains.material.uniforms.uState as { value: unknown }).value = this.gpgpu.current(this.variable);

    // Settled: the blend has finished and the plate has had time to organise the sand.
    this.settleClock += raw;
    this.settled = clamp(this.mix * Math.min(1, this.settleClock / 5));
    const key = `${this.m},${this.n}`;
    if (this.settled >= 1 && this.announced !== key) {
      this.announced = key;
      this.events.emit('settled', this.m, this.n);
    }
    // Keep simulating even when motion is "still" so the pattern can resolve.
    this.ctx.invalidate();
  }

  dispose(): void {
    this.events.clear();
    this.gpgpu.dispose();
    this.grains.geometry.dispose();
    this.grains.material.dispose();
    this.plate.geometry.dispose();
    this.plate.material.dispose();
    this.frame.geometry.dispose();
    (this.frame.material as LineBasicMaterial).dispose();
    this.scene.clear();
  }
}

const create: SceneFactory = (ctx, params) => new ResonanceScene(ctx, params);
export default create;
export type { ResonanceScene };

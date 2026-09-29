import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  Vector4,
  type WebGLRenderer,
} from 'three';
import type { Variable } from 'three/examples/jsm/misc/GPUComputationRenderer.js';
import { AURORA_PALETTES } from '../../../content/instruments.ts';
import { spectralLines } from '../../../design/tokens.ts';
import { clamp, TAU } from '../../../lib/math.ts';
import { createRng } from '../../../lib/random.ts';
import type { SceneParams } from '../../../stores/stage.ts';
import { glsl, hash } from '../../shaders/chunks.ts';
import {
  screenDensity,
  type FrameState,
  type PostSettings,
  type SceneFactory,
  type StageContext,
  type StageScene,
  type Viewport,
} from '../../types.ts';
import { Gpgpu, referenceUvs } from '../../util/gpgpu.ts';
import { TrailBuffer } from '../../util/TrailBuffer.ts';

const WAVES = 8;

/**
 * The flow is the curl of a stream function ψ = Σ sin(k·x + ωt + φ)/|k|:
 * v = (∂ψ/∂y, −∂ψ/∂x). Divergence-free by construction, so particles fold
 * into sheets and curtains instead of clumping.
 */
const computeShader = glsl`
  uniform vec4 uWaves[${WAVES}];
  uniform float uTime;
  uniform float uDt;
  uniform float uScale;
  uniform float uTurbulence;
  uniform float uFall;
  uniform float uSeed;
  ${hash}

  vec2 flow(vec2 p, float t) {
    vec2 v = vec2(0.0);
    for (int i = 0; i < ${WAVES}; i++) {
      vec4 w = uWaves[i];
      vec2 k = w.xy * uScale;
      float c = cos(dot(k, p) + w.z * t + w.w) / max(length(k), 0.2);
      v += c * vec2(k.y, -k.x);
    }
    return v;
  }

  vec3 spawn(vec2 uv) {
    float x = (hash12(uv * 91.1 + uSeed) - 0.5) * 15.0;
    float base = 2.6 + sin(x * 0.45 + uSeed * 3.0) * 0.6 + sin(x * 1.3 - uSeed) * 0.2;
    return vec3(x, base + hash12(uv * 13.7) * 0.9, (hash12(uv * 7.3 + uSeed) - 0.5) * 2.4);
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec4 state = texture2D(texturePosition, uv);
    vec3 p = state.xyz;
    float life = state.w - uDt;
    if (life <= 0.0 || p.y < -3.2 || abs(p.x) > 8.0) {
      p = spawn(uv + fract(uTime * 0.013));
      life = 4.0 + hash12(uv * 3.1 + uTime) * 8.0;
    } else {
      vec2 v = flow(p.xy * 0.55 + vec2(0.0, p.z * 0.3), uTime) * uTurbulence;
      p.xy += (v * vec2(0.55, 0.3) + vec2(0.0, -uFall)) * uDt;
      p.z += sin(uTime * 0.2 + p.x) * 0.02 * uDt;
    }
    gl_FragColor = vec4(p, life);
  }
`;

const pointVertex = glsl`
  attribute vec2 aRef;
  uniform sampler2D uState;
  uniform float uSize;
  varying float vHeight;
  varying float vLife;
  void main() {
    vec4 s = texture2D(uState, aRef);
    vHeight = s.y;
    vLife = s.w;
    vec4 mv = modelViewMatrix * vec4(s.xyz, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize;
  }
`;

const pointFragment = glsl`
  uniform vec3 uTop;
  uniform vec3 uBottom;
  uniform float uEnergy;
  varying float vHeight;
  varying float vLife;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    float h = clamp((vHeight + 1.8) / 4.6, 0.0, 1.0);
    vec3 color = mix(uBottom, uTop, smoothstep(0.35, 0.95, h));
    float fade = smoothstep(0.0, 1.2, vLife) * smoothstep(-3.2, -1.2, vHeight);
    gl_FragColor = vec4(color * a * fade * uEnergy, 1.0);
  }
`;

class AuroraScene implements StageScene {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(46, 1, 0.1, 100);
  readonly post: Partial<PostSettings> = { bloomIntensity: 1.2, bloomThreshold: 0.2, vignette: 0.65 };

  private readonly ctx: StageContext;
  private readonly gpgpu: Gpgpu;
  private readonly variable: Variable;
  private readonly points: Points<BufferGeometry, ShaderMaterial>;
  private readonly pointScene = new Scene();
  private readonly trails: TrailBuffer;
  private readonly waves: Vector4[] = Array.from({ length: WAVES }, () => new Vector4());
  private seed = 1;
  /** Particle brightness for this screen size (see screenDensity). */
  private density = 1;
  private scale = 1;
  private speed = 1;
  private turbulence = 1;
  private persistence = 0.955;
  private time = 0;
  private readonly top = new Color();
  private readonly bottom = new Color();

  constructor(ctx: StageContext, params: SceneParams) {
    this.ctx = ctx;
    const side = Math.min(512, ctx.profile.gpgpuSide);
    this.gpgpu = new Gpgpu(ctx.renderer, side);
    const rng = createRng('aurora-init');
    const initial = this.gpgpu.texture((data, i) => {
      data[i * 4] = rng.range(-6.5, 6.5);
      data[i * 4 + 1] = rng.range(-2.5, 3);
      data[i * 4 + 2] = rng.range(-1, 1);
      data[i * 4 + 3] = rng.range(0, 12);
    });
    this.variable = this.gpgpu.variable('texturePosition', computeShader, initial, {
      uWaves: this.waves,
      uTime: 0,
      uDt: 0,
      uScale: 1,
      uTurbulence: 1,
      uFall: 0.38,
      uSeed: 0,
    });
    this.gpgpu.compute.setVariableDependencies(this.variable, [this.variable]);
    this.gpgpu.init();

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(new Float32Array(side * side * 3), 3));
    geometry.setAttribute('aRef', new BufferAttribute(referenceUvs(side), 2));
    this.points = new Points(
      geometry,
      new ShaderMaterial({
        vertexShader: pointVertex,
        fragmentShader: pointFragment,
        uniforms: {
          uState: { value: null },
          uSize: { value: 1.5 },
          uTop: { value: this.top },
          uBottom: { value: this.bottom },
          uEnergy: { value: (side >= 512 ? 0.065 : side >= 256 ? 0.14 : 0.34) * this.density },
        },
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: AdditiveBlending,
      }),
    );
    this.points.frustumCulled = false;
    this.pointScene.add(this.points);

    this.trails = new TrailBuffer(ctx.viewport, ctx.profile.tier === 'eco' ? 0.6 : 0.9);
    this.scene.add(this.trails.mesh);
    this.camera.position.set(0, -0.6, 9);
    this.camera.lookAt(0, 0.4, 0);
    this.reseed(1);
    this.setPalette('oxygen');
    this.setParams(params);
  }

  /**
   * Wave vectors lie close to the horizontal: the curl of such a stream
   * function is mostly vertical, so particles fall in rays and the
   * horizontal variation folds those rays into curtains.
   */
  private reseed(seed: number): void {
    this.seed = seed;
    const rng = createRng(`aurora:${seed}`);
    this.waves.forEach((w, i) => {
      const angle = rng.range(-0.45, 0.45) + (rng.chance(0.5) ? Math.PI : 0);
      const k = 0.45 + rng.next() * (0.5 + i * 0.22);
      w.set(Math.cos(angle) * k, Math.sin(angle) * k, rng.range(-0.3, 0.3), rng.range(0, TAU));
    });
    (this.variable.material.uniforms.uSeed as { value: number }).value = (seed * 0.1377) % 1;
  }

  private setPalette(key: string): void {
    const palette = AURORA_PALETTES[key] ?? AURORA_PALETTES.oxygen;
    if (!palette) return;
    this.top.set(spectralLines[palette.top].nocturne);
    this.bottom.set(spectralLines[palette.bottom].nocturne);
  }

  setParams(params: SceneParams): void {
    if (typeof params.seed === 'number' && params.seed !== this.seed) {
      this.reseed(params.seed);
      this.trails.clear(this.ctx.renderer);
    }
    if (typeof params.palette === 'string') this.setPalette(params.palette);
    if (typeof params.scale === 'number') this.scale = clamp(params.scale, 0.3, 3);
    if (typeof params.speed === 'number') this.speed = clamp(params.speed, 0, 3);
    if (typeof params.turbulence === 'number') this.turbulence = clamp(params.turbulence, 0.1, 3);
    if (typeof params.persistence === 'number') this.persistence = clamp(params.persistence, 0.8, 0.99);
  }

  resize(viewport: Readonly<Viewport>): void {
    this.camera.aspect = viewport.aspect;
    this.camera.fov = viewport.aspect < 1 ? 70 : 46;
    const shift = viewport.compact ? 0 : viewport.width * 0.1;
    // Beside the panel on wide screens; above the bottom sheet on narrow ones.
    const lift = viewport.compact ? viewport.height * 0.22 : 0;
    this.camera.setViewOffset(viewport.width, viewport.height, shift, lift, viewport.width, viewport.height);
    this.camera.updateProjectionMatrix();
    this.trails.resize(viewport);
    const energy = this.points.material.uniforms.uEnergy as { value: number };
    energy.value *= screenDensity(viewport) / this.density;
    this.density = screenDensity(viewport);
    (this.points.material.uniforms.uSize as { value: number }).value = Math.max(
      1,
      viewport.dpr * (viewport.height / 900) * 1.4,
    );
  }

  prerender(renderer: WebGLRenderer, frame: FrameState): void {
    const dt = Math.min(frame.rawDelta, 1 / 30) * this.speed;
    this.time += dt;
    const u = this.variable.material.uniforms;
    (u.uTime as { value: number }).value = this.time;
    (u.uDt as { value: number }).value = dt;
    (u.uScale as { value: number }).value = this.scale;
    (u.uTurbulence as { value: number }).value = this.turbulence;
    if (dt > 0) this.gpgpu.compute.compute();
    (this.points.material.uniforms.uState as { value: unknown }).value = this.gpgpu.current(this.variable);
    this.trails.accumulate(
      renderer,
      this.pointScene,
      this.camera,
      frame.motion === 'still' ? 0.8 : this.persistence,
    );
  }

  update(): void {
    this.ctx.invalidate();
  }

  dispose(): void {
    this.gpgpu.dispose();
    this.points.geometry.dispose();
    this.points.material.dispose();
    this.trails.dispose();
    this.scene.clear();
    this.pointScene.clear();
  }
}

const create: SceneFactory = (ctx, params) => new AuroraScene(ctx, params);
export default create;
export type { AuroraScene };

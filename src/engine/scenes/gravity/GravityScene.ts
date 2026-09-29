import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Float32BufferAttribute,
  PerspectiveCamera,
  Plane,
  Points,
  Raycaster,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  Vector4,
  type WebGLRenderer,
} from 'three';
import type { Variable } from 'three/examples/jsm/misc/GPUComputationRenderer.js';
import { MAX_MASSES } from '../../../content/instruments.ts';
import { clamp, TAU } from '../../../lib/math.ts';
import { createRng } from '../../../lib/random.ts';
import type { SceneParams } from '../../../stores/stage.ts';
import { gauss, glsl, hash, spectrum } from '../../shaders/chunks.ts';
import type { FrameState, PostSettings, SceneFactory, StageContext, StageScene, Viewport } from '../../types.ts';
import { Gpgpu, referenceUvs } from '../../util/gpgpu.ts';
import { TrailBuffer } from '../../util/TrailBuffer.ts';

export type GravityPreset = 'accretion' | 'binary' | 'trinary' | 'vael' | 'drift';

interface Mass {
  position: Vector3;
  mass: number;
  /** Analytic orbit (for preset systems): radius, angular speed, phase. */
  orbit: { r: number; w: number; phase: number } | null;
}

/**
 * Respawning is deterministic from (uv, seed), so the position and velocity
 * shaders independently agree on where a recycled grain reappears.
 */
const respawnGlsl = glsl`
  uniform float uRespawnSeed;
  uniform float uTotalMass;
  uniform float uG;
  vec3 respawnPosition(vec2 uv) {
    float a = hash12(uv * 311.7 + uRespawnSeed) * 6.2831853;
    float r = 1.2 + pow(hash12(uv * 127.1 - uRespawnSeed), 0.7) * 5.5;
    return vec3(cos(a) * r, sin(a) * r, (hash12(uv * 51.3) - 0.5) * 0.08);
  }
  vec3 respawnVelocity(vec3 p) {
    float r = length(p.xy);
    float speed = sqrt(uG * max(uTotalMass, 0.05) / max(r, 0.3));
    return vec3(-p.y, p.x, 0.0) / max(r, 0.001) * speed;
  }
  bool shouldRespawn(vec3 p, int count) {
    if (length(p.xy) > 16.0) return true;
    for (int i = 0; i < count; i++) {
      if (length(p - uMasses[i].xyz) < 0.06 * uMasses[i].w + 0.02) return true;
    }
    return false;
  }
`;

const velocityShader = glsl`
  uniform vec4 uMasses[${MAX_MASSES}];
  uniform int uMassCount;
  uniform float uDt;
  uniform float uKick;
  ${hash}
  ${respawnGlsl}
  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec3 p = texture2D(texturePosition, uv).xyz;
    vec3 v = texture2D(textureVelocity, uv).xyz;
    if (shouldRespawn(p, uMassCount)) {
      gl_FragColor = vec4(respawnVelocity(respawnPosition(uv)), 1.0);
      return;
    }
    vec3 a = vec3(0.0);
    for (int i = 0; i < uMassCount; i++) {
      vec3 d = uMasses[i].xyz - p;
      float r2 = dot(d, d) + 0.015;
      a += d * (uMasses[i].w / (r2 * sqrt(r2)));
    }
    v += a * uG * uDt;
    v.z -= p.z * 2.0 * uDt;
    if (uKick > 0.0) {
      float k = hash12(uv * 91.3 + uRespawnSeed) * 6.2831853;
      v.xy += vec2(cos(k), sin(k)) * uKick * (0.4 + hash12(uv * 7.1));
    }
    v *= 1.0 - 0.015 * uDt;
    gl_FragColor = vec4(v, 1.0);
  }
`;

const positionShader = glsl`
  uniform vec4 uMasses[${MAX_MASSES}];
  uniform int uMassCount;
  uniform float uDt;
  ${hash}
  ${respawnGlsl}
  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec4 state = texture2D(texturePosition, uv);
    vec3 p = state.xyz;
    if (shouldRespawn(p, uMassCount)) {
      gl_FragColor = vec4(respawnPosition(uv), state.w);
      return;
    }
    vec3 v = texture2D(textureVelocity, uv).xyz;
    gl_FragColor = vec4(p + v * uDt, state.w);
  }
`;

const particleVertex = glsl`
  attribute vec2 aRef;
  uniform sampler2D uPosition;
  uniform sampler2D uVelocity;
  uniform float uSize;
  varying float vSpeed;
  varying float vSeed;
  void main() {
    vec4 s = texture2D(uPosition, aRef);
    vSpeed = length(texture2D(uVelocity, aRef).xyz);
    vSeed = s.w;
    vec4 mv = modelViewMatrix * vec4(s.xyz, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * (0.7 + s.w * 0.7);
  }
`;

const particleFragment = glsl`
  uniform float uEnergy;
  varying float vSpeed;
  varying float vSeed;
  ${spectrum}
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    // Slow grains glow hydrogen-red, fast ones shift toward calcium violet.
    float nm = mix(660.0, 400.0, clamp(vSpeed * 0.28, 0.0, 1.0));
    vec3 color = mix(wavelengthToRgb(nm), vec3(1.0, 0.95, 0.9), 0.25) * uEnergy;
    gl_FragColor = vec4(color * a * (0.4 + vSeed * 0.6), 1.0);
  }
`;

const massVertex = glsl`
  attribute float aMass;
  attribute float aSelected;
  uniform float uScale;
  varying float vSelected;
  void main() {
    vSelected = aSelected;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = (22.0 + aMass * 16.0) * uScale;
  }
`;

const massFragment = glsl`
  varying float vSelected;
  ${gauss}
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float core = smoothstep(0.12, 0.0, d);
    float halo = exp(-d * 9.0) * 0.6;
    float ring = gauss((d - 0.36) * 40.0) * vSelected;
    vec3 color = vec3(1.0, 0.93, 0.8) * (core * 2.5 + halo) + vec3(0.7, 0.95, 0.45) * ring * 1.5;
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

class GravityScene implements StageScene {
  /** The displayed scene: accumulated trails plus the masses. */
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(42, 1, 0.1, 100);
  readonly post: Partial<PostSettings> = { bloomIntensity: 0.9, bloomThreshold: 0.35, vignette: 0.7, aberration: 0.6 };

  onStable: (() => void) | null = null;
  onCount: ((count: number) => void) | null = null;

  private readonly ctx: StageContext;
  private gpgpu: Gpgpu;
  private positionVar: Variable;
  private velocityVar: Variable;
  private particles: Points<BufferGeometry, ShaderMaterial>;
  private readonly particleScene = new Scene();
  private readonly trails: TrailBuffer;
  private readonly massPoints: Points<BufferGeometry, ShaderMaterial>;
  private readonly massUniforms: Vector4[] = Array.from({ length: MAX_MASSES }, () => new Vector4());
  private masses: Mass[] = [];
  private preset: GravityPreset = 'accretion';
  private gravity = 1;
  private persistence = 0.93;
  private kick = 0;
  private respawnSeed = 0;
  private readonly raycaster = new Raycaster();
  private readonly plane = new Plane(new Vector3(0, 0, 1), 0);
  private readonly ndc = new Vector2();
  private readonly hit = new Vector3();
  private dragging = -1;
  private selected = -1;
  private lastDown = 0;
  private idle = 0;
  private stableAnnounced = false;
  private time = 0;
  private massValue = 1;

  constructor(ctx: StageContext, params: SceneParams) {
    this.ctx = ctx;
    const side = ctx.profile.gpgpuSide;
    this.gpgpu = new Gpgpu(ctx.renderer, side);
    const built = this.buildSimulation(side);
    this.positionVar = built.position;
    this.velocityVar = built.velocity;
    this.particles = built.points;
    this.particleScene.add(this.particles);

    this.trails = new TrailBuffer(ctx.viewport, ctx.profile.tier === 'eco' ? 0.6 : 0.85);
    this.scene.add(this.trails.mesh);

    const massGeometry = new BufferGeometry();
    massGeometry.setAttribute('position', new BufferAttribute(new Float32Array(MAX_MASSES * 3), 3));
    massGeometry.setAttribute('aMass', new BufferAttribute(new Float32Array(MAX_MASSES), 1));
    massGeometry.setAttribute('aSelected', new BufferAttribute(new Float32Array(MAX_MASSES), 1));
    this.massPoints = new Points(
      massGeometry,
      new ShaderMaterial({
        vertexShader: massVertex,
        fragmentShader: massFragment,
        uniforms: { uScale: { value: 1 } },
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    );
    this.massPoints.frustumCulled = false;
    this.scene.add(this.massPoints);

    this.camera.position.set(0, -7.5, 10.5);
    this.camera.lookAt(0, -0.4, 0);
    this.camera.up.set(0, 0, 1);
    this.camera.lookAt(0, 0, 0);
    this.applyPreset('accretion');
    this.setParams(params);
  }

  private buildSimulation(side: number): { position: Variable; velocity: Variable; points: Points<BufferGeometry, ShaderMaterial> } {
    const blank = this.gpgpu.texture((data, i) => {
      data[i * 4 + 3] = 1;
    });
    const position = this.gpgpu.variable('texturePosition', positionShader, blank, {});
    const velocity = this.gpgpu.variable('textureVelocity', velocityShader, this.gpgpu.texture(() => undefined), {});
    for (const v of [position, velocity]) {
      const u = v.material.uniforms;
      u.uMasses = { value: this.massUniforms };
      u.uMassCount = { value: 0 };
      u.uDt = { value: 0 };
      u.uRespawnSeed = { value: 0 };
      u.uTotalMass = { value: 1 };
      u.uG = { value: 1 };
    }
    velocity.material.uniforms.uKick = { value: 0 };
    this.gpgpu.compute.setVariableDependencies(position, [position, velocity]);
    this.gpgpu.compute.setVariableDependencies(velocity, [position, velocity]);
    this.gpgpu.init();

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(new Float32Array(side * side * 3), 3));
    geometry.setAttribute('aRef', new BufferAttribute(referenceUvs(side), 2));
    const material = new ShaderMaterial({
      vertexShader: particleVertex,
      fragmentShader: particleFragment,
      uniforms: {
        uPosition: { value: null },
        uVelocity: { value: null },
        uSize: { value: 1.4 },
        uEnergy: { value: side >= 512 ? 0.35 : side >= 256 ? 0.6 : 1 },
      },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: AdditiveBlending,
    });
    const points = new Points(geometry, material);
    points.frustumCulled = false;
    return { position, velocity, points };
  }

  /** Seeds every grain on a Keplerian disk around the current total mass. */
  private seedDisk(): void {
    const rng = createRng(`gravity:${this.preset}:${this.respawnSeed}`);
    const total = Math.max(0.05, this.masses.reduce((s, m) => s + m.mass, 0));
    const pos = this.gpgpu.texture((data, i) => {
      const a = rng.next() * TAU;
      const r = 1.1 + Math.pow(rng.next(), 0.75) * 5.6;
      data[i * 4] = Math.cos(a) * r;
      data[i * 4 + 1] = Math.sin(a) * r;
      data[i * 4 + 2] = rng.gaussian(0, 0.04);
      data[i * 4 + 3] = rng.next();
    });
    const posData = pos.image.data as Float32Array;
    const vel = this.gpgpu.texture((data, i) => {
      const x = posData[i * 4] as number;
      const y = posData[i * 4 + 1] as number;
      const r = Math.hypot(x, y);
      const speed = Math.sqrt((this.gravity * total) / Math.max(r, 0.3)) * (this.preset === 'drift' ? 0.2 : 1);
      data[i * 4] = (-y / r) * speed + rng.gaussian(0, 0.02);
      data[i * 4 + 1] = (x / r) * speed + rng.gaussian(0, 0.02);
      data[i * 4 + 2] = 0;
      data[i * 4 + 3] = 1;
    });
    const compute = this.gpgpu.compute;
    for (const target of [0, 1]) {
      compute.renderTexture(pos, this.positionVar.renderTargets[target]!);
      compute.renderTexture(vel, this.velocityVar.renderTargets[target]!);
    }
    pos.dispose();
    vel.dispose();
    this.trails.clear(this.ctx.renderer);
  }

  /** A random impulse to every grain. */
  kickAll(): void {
    this.kick = 0.9;
    this.idle = 0;
  }

  reset(): void {
    this.applyPreset(this.preset);
  }

  applyPreset(preset: GravityPreset): void {
    this.preset = preset;
    this.selected = -1;
    const at = (x: number, y: number): Vector3 => new Vector3(x, y, 0);
    switch (preset) {
      case 'binary':
        this.masses = [
          { position: at(0.9, 0), mass: 0.7, orbit: { r: 0.9, w: 0.55, phase: 0 } },
          { position: at(-0.9, 0), mass: 0.7, orbit: { r: 0.9, w: 0.55, phase: Math.PI } },
        ];
        break;
      case 'trinary':
        this.masses = [0, 1, 2].map((i) => ({
          position: at(0, 0),
          mass: 0.5,
          orbit: { r: 1.1, w: 0.42, phase: (i / 3) * TAU },
        }));
        break;
      case 'vael':
        this.masses = [
          { position: at(0, 0), mass: 1.2, orbit: null },
          { position: at(2.4, 0), mass: 0.08, orbit: { r: 2.4, w: 0.34, phase: 0.5 } },
          { position: at(4.3, 0), mass: 0.22, orbit: { r: 4.3, w: 0.14, phase: 2.6 } },
        ];
        break;
      case 'drift':
        this.masses = [];
        break;
      case 'accretion':
      default:
        this.masses = [{ position: at(0, 0), mass: 1.2, orbit: null }];
    }
    this.respawnSeed = (this.respawnSeed + 1) % 97;
    this.idle = 0;
    this.stableAnnounced = false;
    this.seedDisk();
    this.onCount?.(this.masses.length);
  }

  setParams(params: SceneParams): void {
    if (typeof params.gravity === 'number') this.gravity = clamp(params.gravity, 0.2, 3);
    if (typeof params.persistence === 'number') this.persistence = clamp(params.persistence, 0.5, 0.985);
    if (typeof params.mass === 'number') {
      this.massValue = clamp(params.mass, 0.1, 3);
      const selected = this.masses[this.selected];
      if (selected) selected.mass = this.massValue;
    }
    if (typeof params.preset === 'string' && params.preset !== this.preset) this.applyPreset(params.preset as GravityPreset);
  }

  resize(viewport: Readonly<Viewport>): void {
    this.camera.aspect = viewport.aspect;
    this.camera.fov = viewport.aspect < 1 ? 42 / Math.max(0.5, viewport.aspect) * 0.85 : 42;
    const shift = viewport.compact ? 0 : viewport.width * 0.1;
    this.camera.setViewOffset(viewport.width, viewport.height, shift, 0, viewport.width, viewport.height);
    this.camera.updateProjectionMatrix();
    this.trails.resize(viewport);
    const size = Math.max(1, viewport.dpr * (viewport.height / 900) * 1.2);
    (this.particles.material.uniforms.uSize as { value: number }).value = size;
    (this.massPoints.material.uniforms.uScale as { value: number }).value = viewport.dpr * (viewport.height / 900);
  }

  private project(x: number, y: number): Vector3 | null {
    this.ndc.set(x, y);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    return this.raycaster.ray.intersectPlane(this.plane, this.hit);
  }

  onPointerDown(x: number, y: number): void {
    this.idle = 0;
    const p = this.project(x, y);
    if (!p) return;
    const index = this.masses.findIndex((m) => m.position.distanceTo(p) < 0.45);
    const now = performance.now();
    if (index >= 0 && now - this.lastDown < 320 && index === this.selected) {
      this.masses.splice(index, 1);
      this.selected = -1;
      this.onCount?.(this.masses.length);
    } else if (index >= 0) {
      this.selected = index;
      this.dragging = index;
      const mass = this.masses[index];
      if (mass) mass.orbit = null;
    } else if (this.masses.length < MAX_MASSES) {
      this.masses.push({ position: p.clone(), mass: this.massValue, orbit: null });
      this.selected = this.masses.length - 1;
      this.dragging = this.selected;
      this.onCount?.(this.masses.length);
    }
    this.lastDown = now;
  }

  onPointerMove(x: number, y: number): void {
    if (this.dragging < 0) return;
    this.idle = 0;
    const p = this.project(x, y);
    const mass = this.masses[this.dragging];
    if (p && mass) mass.position.set(clamp(p.x, -9, 9), clamp(p.y, -9, 9), 0);
  }

  onPointerUp(): void {
    this.dragging = -1;
  }

  onZoom(factor: number): void {
    const distance = clamp(this.camera.position.length() * factor, 6, 26);
    this.camera.position.setLength(distance);
  }

  prerender(renderer: WebGLRenderer, frame: FrameState): void {
    // The simulation is the content here, so it runs on real time even when
    // ambient motion is reduced; only the smearing trails are switched off.
    const dt = Math.min(frame.rawDelta, 1 / 30) * 1.6;
    const pu = this.positionVar.material.uniforms;
    const vu = this.velocityVar.material.uniforms;
    const total = this.masses.reduce((s, m) => s + m.mass, 0);
    for (const u of [pu, vu]) {
      (u.uMassCount as { value: number }).value = this.masses.length;
      (u.uDt as { value: number }).value = dt;
      (u.uRespawnSeed as { value: number }).value = this.respawnSeed + this.time * 0.001;
      (u.uTotalMass as { value: number }).value = total;
      (u.uG as { value: number }).value = this.gravity;
    }
    (vu.uKick as { value: number }).value = this.kick;
    this.kick = 0;
    if (dt > 0) this.gpgpu.compute.compute();

    // Afterimage: fade the previous frame, then add this frame's light.
    const pm = this.particles.material.uniforms;
    (pm.uPosition as { value: unknown }).value = this.gpgpu.current(this.positionVar);
    (pm.uVelocity as { value: unknown }).value = this.gpgpu.current(this.velocityVar);
    this.trails.accumulate(renderer, this.particleScene, this.camera, frame.motion === 'still' ? 0 : this.persistence);
  }

  update(frame: FrameState): void {
    const raw = Math.min(frame.rawDelta, 0.1);
    this.time += raw;
    this.idle += raw;
    for (const m of this.masses) {
      if (!m.orbit) continue;
      const a = m.orbit.phase + this.time * m.orbit.w;
      m.position.set(Math.cos(a) * m.orbit.r, Math.sin(a) * m.orbit.r, 0);
    }
    const positions = this.massPoints.geometry.getAttribute('position') as BufferAttribute;
    const sizes = this.massPoints.geometry.getAttribute('aMass') as BufferAttribute;
    const selected = this.massPoints.geometry.getAttribute('aSelected') as BufferAttribute;
    this.massUniforms.forEach((u, i) => {
      const m = this.masses[i];
      u.set(m?.position.x ?? 0, m?.position.y ?? 0, 0, m?.mass ?? 0);
      positions.setXYZ(i, m?.position.x ?? 0, m?.position.y ?? 0, m ? 0 : -999);
      sizes.setX(i, m?.mass ?? 0);
      selected.setX(i, i === this.selected ? 1 : 0);
    });
    positions.needsUpdate = true;
    sizes.needsUpdate = true;
    selected.needsUpdate = true;
    this.massPoints.geometry.setDrawRange(0, this.masses.length);

    if (!this.stableAnnounced && this.masses.length >= 2 && this.idle > 15) {
      this.stableAnnounced = true;
      this.onStable?.();
    }
    this.ctx.invalidate();
  }

  dispose(): void {
    this.onStable = null;
    this.onCount = null;
    this.gpgpu.dispose();
    this.particles.geometry.dispose();
    this.particles.material.dispose();
    this.massPoints.geometry.dispose();
    this.massPoints.material.dispose();
    this.trails.dispose();
    this.scene.clear();
    this.particleScene.clear();
  }
}

const create: SceneFactory = (ctx, params) => new GravityScene(ctx, params);
export default create;
export type { GravityScene };

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  LineSegments,
  Mesh,
  PerspectiveCamera,
  Points,
  RingGeometry,
  Scene,
  ShaderMaterial,
  Vector3,
} from 'three';
import { relicById, relics } from '../../../content/relics.ts';
import { spectralLines } from '../../../design/tokens.ts';
import { clamp, damp } from '../../../lib/math.ts';
import { createRng } from '../../../lib/random.ts';
import type { SceneParams } from '../../../stores/stage.ts';
import type { RelicFormRequest, RelicFormResponse } from '../../../workers/relicForm.worker.ts';
import { gauss, glsl, hash, spectrum } from '../../shaders/chunks.ts';
import type {
  FrameState,
  PostSettings,
  SceneFactory,
  StageContext,
  StageScene,
  Viewport,
} from '../../types.ts';
import { OrbitRig } from '../../util/OrbitRig.ts';

export type RelicViewMode = 'hologram' | 'engraving' | 'spectral';
const MODE_INDEX: Record<RelicViewMode, number> = { hologram: 0, engraving: 1, spectral: 2 };

const pointsVertex = glsl`
  attribute float aWeight;
  attribute vec3 aScatter;
  attribute float aRandom;
  uniform float uTime;
  uniform float uDecode;
  uniform float uScale;
  uniform float uMode;
  varying float vWeight;
  varying float vDepth;
  varying float vResolved;
  varying float vHeight;
  void main() {
    // A scan plane sweeps upward; points below it have resolved into the form.
    float scan = uDecode * 3.4 - 1.6;
    float local = clamp((scan - position.y) * 2.2 + aRandom * 0.35, 0.0, 1.0);
    local = local * local * (3.0 - 2.0 * local);
    vec3 p = mix(position + aScatter, position, local);
    p += aScatter * 0.02 * sin(uTime * 2.0 + aRandom * 40.0) * (1.0 - local);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    vDepth = -mv.z;
    vWeight = aWeight;
    vResolved = local;
    vHeight = position.y;
    float size = mix(1.1, 2.2, aWeight) * (uMode > 0.5 && uMode < 1.5 ? 0.6 : 1.0);
    gl_PointSize = size * uScale * (6.0 / max(vDepth, 0.5));
  }
`;

const pointsFragment = glsl`
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uMode;
  varying float vWeight;
  varying float vDepth;
  varying float vResolved;
  varying float vHeight;
  ${spectrum}
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.05, d);
    if (a < 0.01) discard;
    float scanlines = 0.72 + 0.28 * sin(vHeight * 120.0 - uTime * 3.0);
    float flicker = 0.9 + 0.1 * sin(uTime * 23.0 + vHeight * 11.0);
    vec3 color = mix(uColor, vec3(1.0, 0.97, 0.92), vWeight * 0.55);
    if (uMode > 1.5) color = wavelengthToRgb(mix(680.0, 400.0, fract(vHeight * 0.45 + vDepth * 0.08 + uTime * 0.03))) * 1.4;
    float unresolved = 1.0 - vResolved;
    color = mix(color, uColor * 0.6, unresolved);
    float brightness = mix(0.35, 1.0, vWeight) * scanlines * flicker * mix(0.35, 1.0, vResolved);
    brightness *= smoothstep(14.0, 3.0, vDepth);
    gl_FragColor = vec4(color * a * brightness, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const linesVertex = glsl`
  uniform float uDecode;
  varying float vVisible;
  varying float vHeight;
  void main() {
    float scan = uDecode * 3.4 - 1.6;
    vVisible = smoothstep(0.0, 0.25, scan - position.y);
    vHeight = position.y;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const linesFragment = glsl`
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uTime;
  varying float vVisible;
  varying float vHeight;
  void main() {
    float pulse = 0.8 + 0.2 * sin(vHeight * 30.0 - uTime * 2.4);
    gl_FragColor = vec4(uColor * uOpacity * vVisible * pulse, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const pedestalFragment = glsl`
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uDecode;
  varying vec2 vUv;
  varying vec3 vPos;
  ${hash}
  ${gauss}
  void main() {
    float r = length(vPos.xy);
    float rings = 0.5 + 0.5 * sin(r * 60.0 - uTime * 1.5);
    float edge = smoothstep(1.45, 1.4, r) * smoothstep(0.3, 0.9, r);
    float rim = gauss((r - 1.42) / 0.02);
    float ticks = step(0.92, fract(atan(vPos.y, vPos.x) * 36.0 / 6.2831853)) * smoothstep(1.3, 1.42, r);
    float glow = (edge * rings * 0.08 + rim * 0.9 + ticks * 0.35) * (0.4 + 0.6 * uDecode);
    gl_FragColor = vec4(uColor * glow, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const pedestalVertex = glsl`
  varying vec2 vUv;
  varying vec3 vPos;
  void main() {
    vUv = uv;
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

let workerRequest = 0;

/** Holographic reconstruction of a single relic. */
class RelicScene implements StageScene {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(34, 1, 0.05, 100);
  readonly post: Partial<PostSettings> = { bloomIntensity: 1.35, bloomThreshold: 0.18, vignette: 0.7 };

  private readonly ctx: StageContext;
  private readonly rig = new OrbitRig({
    distance: 7.4,
    minDistance: 3,
    maxDistance: 12,
    phi: 1.3,
    theta: 0.7,
    autoRotate: 0.18,
  });
  private readonly worker: Worker;
  private readonly color = new Color();
  private readonly targetColor = new Color();
  private readonly pointsMaterial: ShaderMaterial;
  private readonly linesMaterial: ShaderMaterial;
  private readonly pedestal: Mesh<RingGeometry, ShaderMaterial>;
  private points: Points<BufferGeometry, ShaderMaterial> | null = null;
  private lines: LineSegments<BufferGeometry, ShaderMaterial> | null = null;
  private relicId: string | null = null;
  private pending = 0;
  private decode = 0;
  private decodeTarget = 1;
  private mode: RelicViewMode = 'hologram';
  private modeValue = 0;
  private offsetX = 0;
  private offsetY = 0;
  private pressed = false;

  constructor(ctx: StageContext, params: SceneParams) {
    this.ctx = ctx;
    this.worker = new Worker(new URL('../../../workers/relicForm.worker.ts', import.meta.url), {
      type: 'module',
    });
    this.worker.onmessage = (event: MessageEvent<RelicFormResponse>) => this.receive(event.data);

    this.pointsMaterial = new ShaderMaterial({
      vertexShader: pointsVertex,
      fragmentShader: pointsFragment,
      uniforms: {
        uTime: { value: 0 },
        uDecode: { value: 0 },
        uScale: { value: 1 },
        uMode: { value: 0 },
        uColor: { value: this.color },
      },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    this.linesMaterial = new ShaderMaterial({
      vertexShader: linesVertex,
      fragmentShader: linesFragment,
      uniforms: {
        uColor: { value: this.color },
        uOpacity: { value: 0.3 },
        uDecode: { value: 0 },
        uTime: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    const pedestalGeometry = new RingGeometry(0.2, 1.5, 128, 2);
    // The projector disc sits a little below the reconstruction, scaled to its footprint.
    this.pedestal = new Mesh(
      pedestalGeometry,
      new ShaderMaterial({
        vertexShader: pedestalVertex,
        fragmentShader: pedestalFragment,
        uniforms: { uColor: { value: this.color }, uTime: { value: 0 }, uDecode: { value: 0 } },
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    );
    this.pedestal.rotation.x = -Math.PI / 2;
    this.pedestal.position.y = -1.45;
    this.pedestal.scale.setScalar(0.8);
    this.scene.add(this.pedestal);
    this.setParams(params);
  }

  setParams(params: SceneParams): void {
    const id = typeof params.relic === 'string' ? params.relic : (relics[0]?.id ?? null);
    if (typeof params.decode === 'number') this.decodeTarget = clamp(params.decode);
    if (typeof params.mode === 'string' && params.mode in MODE_INDEX)
      this.mode = params.mode as RelicViewMode;
    if (id && id !== this.relicId) this.load(id);
  }

  private load(id: string): void {
    const relic = relicById(id);
    if (!relic) return;
    this.relicId = id;
    this.targetColor.set(spectralLines[relic.line].nocturne);
    this.decode = 0;
    this.pending = ++workerRequest;
    const detail = clamp(0.35 + this.ctx.profile.particleScale * 1.1, 0.35, 1.4);
    const request: RelicFormRequest = { id: this.pending, kind: relic.kind, seed: relic.seed, detail };
    this.worker.postMessage(request);
  }

  private receive(data: RelicFormResponse): void {
    if (data.id !== this.pending) return;
    this.clearForm();
    const count = data.points.length / 3;
    const rng = createRng(`scatter:${this.relicId ?? ''}`);
    const scatter = new Float32Array(count * 3);
    const random = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const [x, y, z] = rng.onSphere();
      const r = 0.6 + rng.next() * 2.2;
      scatter[i * 3] = x * r;
      scatter[i * 3 + 1] = y * r * 0.6;
      scatter[i * 3 + 2] = z * r;
      random[i] = rng.next();
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(data.points, 3));
    geometry.setAttribute('aWeight', new BufferAttribute(data.weights, 1));
    geometry.setAttribute('aScatter', new BufferAttribute(scatter, 3));
    geometry.setAttribute('aRandom', new BufferAttribute(random, 1));
    this.points = new Points(geometry, this.pointsMaterial);
    this.points.frustumCulled = false;
    this.scene.add(this.points);

    const lineGeometry = new BufferGeometry();
    lineGeometry.setAttribute('position', new BufferAttribute(data.segments, 3));
    this.lines = new LineSegments(lineGeometry, this.linesMaterial);
    this.lines.frustumCulled = false;
    this.scene.add(this.lines);
    this.ctx.invalidate();
  }

  private clearForm(): void {
    if (this.points) {
      this.scene.remove(this.points);
      this.points.geometry.dispose();
      this.points = null;
    }
    if (this.lines) {
      this.scene.remove(this.lines);
      this.lines.geometry.dispose();
      this.lines = null;
    }
  }

  resize(viewport: Readonly<Viewport>): void {
    this.camera.aspect = viewport.aspect;
    // Frame the relic beside the text: to the left on wide screens, in the top band on narrow ones.
    this.offsetX = viewport.compact ? 0 : viewport.width * 0.2;
    this.offsetY = viewport.compact ? viewport.height * 0.2 : 0;
    this.camera.setViewOffset(
      viewport.width,
      viewport.height,
      this.offsetX,
      this.offsetY,
      viewport.width,
      viewport.height,
    );
    this.camera.fov = viewport.compact ? 44 : 34;
    this.camera.updateProjectionMatrix();
    (this.pointsMaterial.uniforms.uScale as { value: number }).value =
      viewport.dpr * (viewport.height / 900) * 1.4;
  }

  onPointerDown(x: number, y: number): void {
    this.pressed = true;
    this.rig.pointerDown(x, y);
  }

  onPointerMove(x: number, y: number): void {
    if (this.pressed) this.rig.pointerMove(x, y);
  }

  onPointerUp(): void {
    this.pressed = false;
    this.rig.pointerUp();
  }

  onZoom(factor: number): void {
    this.rig.zoom(factor);
  }

  onKey(key: string): boolean {
    if (key === 'ArrowLeft') this.rig.theta += 0.25;
    else if (key === 'ArrowRight') this.rig.theta -= 0.25;
    else if (key === 'ArrowUp') this.rig.phi = clamp(this.rig.phi - 0.15, 0.2, 2.9);
    else if (key === 'ArrowDown') this.rig.phi = clamp(this.rig.phi + 0.15, 0.2, 2.9);
    else if (key === '+' || key === '=') this.rig.zoom(0.85);
    else if (key === '-') this.rig.zoom(1.18);
    else return false;
    return true;
  }

  /** Recentre the view (used by the page's "reset" control). */
  resetView(): void {
    this.rig.theta = 0.7;
    this.rig.phi = 1.28;
    this.rig.flyTo(new Vector3(0, 0, 0), 7.4);
  }

  update(frame: FrameState): void {
    const raw = Math.min(frame.rawDelta, 0.1);
    const still = frame.motion === 'still';
    this.decode = damp(this.decode, this.points ? this.decodeTarget : 0, still ? 1000 : 1.1, raw);
    this.modeValue = damp(this.modeValue, MODE_INDEX[this.mode], still ? 1000 : 8, raw);
    this.color.lerp(this.targetColor, still ? 1 : 1 - Math.exp(-4 * raw));

    const pu = this.pointsMaterial.uniforms;
    (pu.uTime as { value: number }).value = frame.time;
    (pu.uDecode as { value: number }).value = this.decode;
    (pu.uMode as { value: number }).value = this.modeValue;
    const lu = this.linesMaterial.uniforms;
    (lu.uTime as { value: number }).value = frame.time;
    (lu.uDecode as { value: number }).value = this.decode;
    (lu.uOpacity as { value: number }).value = this.mode === 'engraving' ? 1.1 : 0.22;
    if (this.points) this.points.visible = this.mode !== 'engraving' || this.decode < 0.98;
    const pedu = this.pedestal.material.uniforms;
    (pedu.uTime as { value: number }).value = frame.time;
    (pedu.uDecode as { value: number }).value = this.decode;

    this.rig.update(raw, this.camera, still);
    this.camera.updateMatrixWorld();
  }

  dispose(): void {
    this.worker.terminate();
    this.clearForm();
    this.pointsMaterial.dispose();
    this.linesMaterial.dispose();
    this.pedestal.geometry.dispose();
    this.pedestal.material.dispose();
    this.scene.clear();
  }
}

const create: SceneFactory = (ctx, params) => new RelicScene(ctx, params);
export default create;
export type { RelicScene };

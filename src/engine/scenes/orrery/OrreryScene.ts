import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  LineBasicMaterial,
  LineLoop,
  Matrix4,
  Mesh,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  Quaternion,
  Raycaster,
  RingGeometry,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Vector2,
  Vector3,
} from 'three';
import { worlds, type World } from '../../../content/worlds.ts';
import { spectralLines } from '../../../design/tokens.ts';
import { clamp, damp, TAU } from '../../../lib/math.ts';
import { createRng } from '../../../lib/random.ts';
import type { SceneParams } from '../../../stores/stage.ts';
import type { QualityProfile } from '../../quality.ts';
import type { FrameState, PostSettings, SceneFactory, StageContext, StageScene, Viewport } from '../../types.ts';
import { Emitter } from '../../util/Emitter.ts';
import { OrbitRig } from '../../util/OrbitRig.ts';
import {
  beltFragment,
  beltVertex,
  bodyVertex,
  coronaFragment,
  coronaVertex,
  planetFragment,
  ringFragment,
  starFragment,
  starfieldFragment,
  starfieldVertex,
} from './shaders.ts';

/** Compressed display radius: keeps a 0.4–19 AU system legible on one screen. */
const displayOrbit = (au: number): number => (au === 0 ? 0 : 5 + 7.5 * Math.sqrt(au));
/** Seconds per orbit at speed 1. */
const orbitSeconds = (years: number): number => Math.sqrt(years) * 18;

const STAR_SIZE_OLD = 10.8;

interface Body {
  world: World;
  group: Group;
  mesh: Mesh | null;
  material: ShaderMaterial | null;
  orbit: LineLoop | null;
  orbitMaterial: LineBasicMaterial | null;
  phase: number;
  highlight: number;
  fade: number;
}

export interface OrreryLabel {
  id: string;
  x: number;
  y: number;
  visible: boolean;
  scale: number;
}

class OrreryScene implements StageScene {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(40, 1, 0.1, 2000);
  readonly post: Partial<PostSettings> = { bloomIntensity: 1.25, bloomThreshold: 0.45, vignette: 0.55 };

  /** Screen-space label anchors, read by the Atlas page each frame. */
  readonly labels: OrreryLabel[];
  hovered: string | null = null;
  /** `select` fires when a body (or empty space: null) is clicked. */
  readonly events = new Emitter<{ select: [string | null] }>();

  private readonly ctx: StageContext;
  private readonly bodies: Body[] = [];
  private readonly rig: OrbitRig;
  private readonly raycaster = new Raycaster();
  private readonly ndc = new Vector2();
  private readonly tmp = new Vector3();
  private readonly toLabel = new Vector3();
  private readonly viewDir = new Vector3();
  private readonly origin = new Vector3();
  private readonly starMaterial: ShaderMaterial;
  private readonly starMesh: Mesh;
  private readonly corona: Mesh<PlaneGeometry, ShaderMaterial>;
  private readonly starfield: Points<BufferGeometry, ShaderMaterial>;
  private belt: InstancedMesh | null = null;
  private beltMaterial: ShaderMaterial | null = null;
  private ring: Mesh<RingGeometry, ShaderMaterial> | null = null;
  private readonly disposables: { dispose(): void }[] = [];

  private focus: string | null = null;
  private epoch = 0.45;
  private epochTarget = 0.45;
  private speed = 1;
  private clock = 0;
  private starScale = 1;
  private pressed = false;

  constructor(ctx: StageContext, params: SceneParams) {
    this.ctx = ctx;
    this.rig = new OrbitRig({ distance: 78, minDistance: 2.5, maxDistance: 140, theta: 0.6, phi: 1.12 });
    this.labels = worlds.map((w) => ({ id: w.id, x: 0, y: 0, visible: false, scale: 1 }));

    const detail = ctx.profile.shaderDetail;
    const octaves = detail > 0.7 ? 5 : detail > 0.4 ? 4 : 3;
    const sphere = new SphereGeometry(1, detail > 0.5 ? 96 : 56, detail > 0.5 ? 64 : 40);
    this.disposables.push(sphere);

    // The star.
    const vael = worlds[0] as World;
    this.starMaterial = new ShaderMaterial({
      vertexShader: bodyVertex,
      fragmentShader: starFragment(octaves),
      uniforms: {
        uYoung: { value: new Color('#ffb25c') },
        uOld: { value: new Color('#ff3d1f') },
        uHot: { value: new Color('#fff2c4') },
        uTime: { value: 0 },
        uEpoch: { value: this.epoch },
      },
    });
    this.starMesh = new Mesh(sphere, this.starMaterial);
    this.starMesh.scale.setScalar(vael.size);
    this.scene.add(this.starMesh);
    this.disposables.push(this.starMaterial);

    const coronaGeometry = new PlaneGeometry(2, 2);
    const coronaMaterial = new ShaderMaterial({
      vertexShader: coronaVertex,
      fragmentShader: coronaFragment,
      uniforms: { uColor: { value: new Color('#ff8a3c') }, uTime: { value: 0 }, uIntensity: { value: 1 } },
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    this.corona = new Mesh(coronaGeometry, coronaMaterial);
    this.corona.scale.setScalar(vael.size * 3.2);
    this.corona.renderOrder = 5;
    this.scene.add(this.corona);
    this.disposables.push(coronaGeometry, coronaMaterial);

    // Worlds.
    const rng = createRng('orrery');
    for (const world of worlds.slice(1)) {
      const group = new Group();
      const phase = rng.next() * TAU;
      let mesh: Mesh | null = null;
      let material: ShaderMaterial | null = null;
      if (world.surface !== 'belt' && world.surface !== 'star') {
        material = new ShaderMaterial({
          vertexShader: bodyVertex,
          fragmentShader: planetFragment(world.surface, octaves),
          uniforms: {
            uStarPos: { value: new Vector3() },
            uColorA: { value: new Color(world.palette[0]) },
            uColorB: { value: new Color(world.palette[1]) },
            uColorC: { value: new Color(world.palette[2]) },
            uGlow: { value: new Color(spectralLines[world.line].nocturne) },
            uTime: { value: 0 },
            uSeed: { value: rng.range(0, 50) },
            uHighlight: { value: 0 },
            uEpoch: { value: this.epoch },
            uFade: { value: 1 },
          },
        });
        mesh = new Mesh(sphere, material);
        mesh.scale.setScalar(world.size);
        mesh.rotation.z = (world.tilt * Math.PI) / 180;
        mesh.userData.id = world.id;
        group.add(mesh);
        this.disposables.push(material);
        if (world.rings) this.addRings(group, world);
      }
      let orbit: LineLoop | null = null;
      let orbitMaterial: LineBasicMaterial | null = null;
      const r = displayOrbit(world.orbit);
      if (world.surface !== 'belt') {
        const pts: number[] = [];
        for (let i = 0; i <= 256; i++) {
          const a = (i / 256) * TAU;
          pts.push(Math.cos(a) * r, 0, Math.sin(a) * r);
        }
        const geometry = new BufferGeometry();
        geometry.setAttribute('position', new Float32BufferAttribute(pts, 3));
        orbitMaterial = new LineBasicMaterial({
          color: new Color(spectralLines[world.line].nocturne),
          transparent: true,
          opacity: 0.16,
          depthWrite: false,
        });
        orbit = new LineLoop(geometry, orbitMaterial);
        this.scene.add(orbit);
        this.disposables.push(geometry, orbitMaterial);
      } else {
        this.buildBelt(world, ctx.profile);
      }
      this.scene.add(group);
      this.bodies.push({ world, group, mesh, material, orbit, orbitMaterial, phase, highlight: 0, fade: 1 });
    }

    this.starfield = this.buildStarfield(ctx.profile);
    this.scene.add(this.starfield);
    this.setParams(params);
  }

  private addRings(group: Group, world: World): void {
    const inner = world.size * 1.45;
    const outer = world.size * 2.6;
    const geometry = new RingGeometry(inner, outer, 160, 1);
    const material = new ShaderMaterial({
      vertexShader: bodyVertex,
      fragmentShader: ringFragment,
      uniforms: {
        uStarPos: { value: new Vector3() },
        uColorA: { value: new Color(world.palette[2]) },
        uColorB: { value: new Color(world.palette[1]) },
        uGarden: { value: new Color(spectralLines.mg.nocturne) },
        uInner: { value: inner },
        uOuter: { value: outer },
        uTime: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
    });
    const ring = new Mesh(geometry, material);
    ring.rotation.x = -Math.PI / 2 + 0.38;
    group.add(ring);
    this.ring = ring;
    this.disposables.push(geometry, material);
  }

  private buildBelt(world: World, profile: Readonly<QualityProfile>): void {
    const count = Math.max(300, Math.round(2400 * Math.max(0.25, profile.particleScale)));
    const geometry = new IcosahedronGeometry(1, 0);
    this.beltMaterial = new ShaderMaterial({
      vertexShader: beltVertex,
      fragmentShader: beltFragment,
      uniforms: { uStarPos: { value: new Vector3() }, uColor: { value: new Color(world.palette[2]) } },
    });
    const belt = new InstancedMesh(geometry, this.beltMaterial, count);
    const rng = createRng('scatter');
    const m = new Matrix4();
    const q = new Quaternion();
    const pos = new Vector3();
    const scale = new Vector3();
    const inner = displayOrbit(5.8);
    const outer = displayOrbit(6.9);
    for (let i = 0; i < count; i++) {
      const a = rng.next() * TAU;
      const r = inner + (outer - inner) * Math.pow(rng.next(), 0.9);
      pos.set(Math.cos(a) * r, rng.gaussian(0, 0.25), Math.sin(a) * r);
      q.setFromAxisAngle(new Vector3(...rng.onSphere()), rng.next() * TAU);
      const s = 0.03 + Math.pow(rng.next(), 5) * 0.16;
      scale.set(s, s * rng.range(0.6, 1), s * rng.range(0.6, 1));
      m.compose(pos, q, scale);
      belt.setMatrixAt(i, m);
    }
    belt.instanceMatrix.needsUpdate = true;
    this.belt = belt;
    this.scene.add(belt);
    this.disposables.push(geometry, this.beltMaterial);
  }

  private buildStarfield(profile: Readonly<QualityProfile>): Points<BufferGeometry, ShaderMaterial> {
    const count = Math.round(4000 + 6000 * profile.particleScale);
    const rng = createRng('orrery-sky');
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const [x, y, z] = rng.onSphere();
      positions.set([x * 700, y * 700, z * 700], i * 3);
      sizes[i] = 0.6 + Math.pow(rng.next(), 8) * 3.5;
      const warm = rng.next();
      colors.set([0.8 + 0.2 * warm, 0.82, 0.8 + 0.2 * (1 - warm)], i * 3);
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setAttribute('aSize', new BufferAttribute(sizes, 1));
    geometry.setAttribute('aColor', new BufferAttribute(colors, 3));
    const material = new ShaderMaterial({
      vertexShader: starfieldVertex,
      fragmentShader: starfieldFragment,
      uniforms: { uScale: { value: 1 }, uTime: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    this.disposables.push(geometry, material);
    return new Points(geometry, material);
  }

  setParams(params: SceneParams): void {
    const focus = typeof params.focus === 'string' ? params.focus : null;
    if (typeof params.epoch === 'number') this.epochTarget = clamp(params.epoch);
    if (typeof params.speed === 'number') this.speed = params.speed;
    if (focus !== this.focus) {
      this.focus = focus;
      if (!focus || focus === 'vael') {
        this.rig.flyTo(new Vector3(0, 0, 0), focus === 'vael' ? 30 : 78);
      } else {
        const body = this.bodies.find((b) => b.world.id === focus);
        if (body) this.rig.flyTo(body.group.position, Math.max(4, body.world.size * 8 + (body.world.rings ? 6 : 0)));
      }
    }
  }

  resize(viewport: Readonly<Viewport>): void {
    this.camera.aspect = viewport.aspect;
    this.camera.fov = viewport.aspect < 1 ? 52 : 40;
    this.camera.updateProjectionMatrix();
    (this.starfield.material.uniforms.uScale as { value: number }).value = viewport.dpr * (viewport.height / 900);
  }

  onPointerDown(x: number, y: number): void {
    this.pressed = true;
    this.rig.pointerDown(x, y);
  }

  onPointerMove(x: number, y: number): void {
    if (this.pressed) this.rig.pointerMove(x, y);
    else this.hovered = this.pick(x, y);
  }

  onPointerUp(x: number, y: number): void {
    const click = this.rig.travel < 0.012;
    this.pressed = false;
    this.rig.pointerUp();
    if (click) {
      const id = this.pick(x, y);
      this.events.emit('select', id);
    }
  }

  onZoom(factor: number): void {
    this.rig.zoom(factor);
  }

  private pick(x: number, y: number): string | null {
    this.ndc.set(x, y);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    let best: string | null = null;
    let bestDistance = Infinity;
    const ray = this.raycaster.ray;
    const test = (id: string, center: Vector3, radius: number): void => {
      // Generous hit radius so small worlds stay easy to target.
      const distance = ray.distanceSqToPoint(center);
      const reach = Math.max(radius * 1.6, center.distanceTo(this.camera.position) * 0.03);
      if (distance < reach * reach) {
        const along = this.tmp.copy(center).sub(ray.origin).dot(ray.direction);
        if (along > 0 && along < bestDistance) {
          bestDistance = along;
          best = id;
        }
      }
    };
    test('vael', this.starMesh.position, this.starMesh.scale.x);
    for (const body of this.bodies) {
      if (body.world.surface === 'belt' || body.fade < 0.2) continue;
      test(body.world.id, body.group.position, body.world.size);
    }
    return best;
  }

  update(frame: FrameState): void {
    const dt = frame.delta;
    const raw = Math.min(frame.rawDelta, 0.1);
    const still = frame.motion === 'still';
    this.clock += dt * this.speed;
    this.epoch = damp(this.epoch, this.epochTarget, still ? 1000 : 2.4, raw);
    this.starScale = 1 + (STAR_SIZE_OLD / 2.4 - 1) * Math.pow(this.epoch, 2.2);

    const vaelSize = (worlds[0] as World).size * this.starScale;
    this.starMesh.scale.setScalar(vaelSize);
    this.starMesh.rotation.y += dt * 0.02;
    this.corona.scale.setScalar(vaelSize * 3.2);
    const su = this.starMaterial.uniforms;
    (su.uTime as { value: number }).value = frame.time;
    (su.uEpoch as { value: number }).value = this.epoch;
    const cu = this.corona.material.uniforms;
    (cu.uTime as { value: number }).value = frame.time;
    (cu.uColor as { value: Color }).value.set(this.epoch > 0.5 ? '#ff4a24' : '#ff8a3c');

    for (const body of this.bodies) {
      const r = displayOrbit(body.world.orbit);
      const angle = body.phase + (this.clock / orbitSeconds(body.world.period)) * TAU;
      body.group.position.set(Math.cos(angle) * r, 0, Math.sin(angle) * r);
      // The swelling star swallows any world inside its surface.
      const engulfed = vaelSize > r - body.world.size * 0.5 && body.world.surface !== 'belt';
      body.fade = damp(body.fade, engulfed ? 0 : 1, still ? 1000 : 3, raw);
      body.group.visible = body.fade > 0.02;
      const active = this.focus === body.world.id || this.hovered === body.world.id;
      body.highlight = damp(body.highlight, active ? 1 : 0, still ? 1000 : 6, raw);
      if (body.mesh) body.mesh.rotation.y += dt * (0.12 / Math.max(0.5, body.world.size));
      if (body.material) {
        const u = body.material.uniforms;
        (u.uStarPos as { value: Vector3 }).value.set(0, 0, 0);
        (u.uTime as { value: number }).value = frame.time;
        (u.uHighlight as { value: number }).value = body.highlight;
        (u.uEpoch as { value: number }).value = this.epoch;
        (u.uFade as { value: number }).value = body.fade;
      }
      if (body.orbitMaterial) body.orbitMaterial.opacity = (0.12 + body.highlight * 0.5) * body.fade;
    }
    if (this.ring) (this.ring.material.uniforms.uTime as { value: number }).value = frame.time;
    if (this.belt) this.belt.rotation.y += dt * 0.004 * this.speed;
    (this.starfield.material.uniforms.uTime as { value: number }).value = frame.time;

    // Keep following a moving focus.
    if (this.focus && this.focus !== 'vael') {
      const body = this.bodies.find((b) => b.world.id === this.focus);
      if (body) this.rig.follow(body.group.position);
    }
    this.rig.update(raw, this.camera, still);
    this.camera.updateMatrixWorld();

    // Project label anchors for the DOM overlay (allocation-free).
    const { width, height } = this.ctx.viewport;
    this.camera.getWorldDirection(this.viewDir);
    for (const label of this.labels) {
      const body = label.id === 'vael' ? null : this.bodies.find((b) => b.world.id === label.id);
      if (label.id === 'vael') this.tmp.set(0, vaelSize * 1.05, 0);
      else if (body) this.tmp.copy(body.group.position).setY(body.group.position.y + body.world.size * 1.25 + 0.2);
      else continue;
      const inFront = this.toLabel.copy(this.tmp).sub(this.camera.position).dot(this.viewDir) > 0;
      const distance = this.camera.position.distanceTo(body ? body.group.position : this.origin);
      this.tmp.project(this.camera);
      label.x = (this.tmp.x * 0.5 + 0.5) * width;
      label.y = (-this.tmp.y * 0.5 + 0.5) * height;
      label.visible =
        inFront && Math.abs(this.tmp.x) < 1.05 && Math.abs(this.tmp.y) < 1.05 && (body ? body.fade > 0.3 : true);
      label.scale = clamp(1 - distance / 220, 0.5, 1);
    }
  }

  dispose(): void {
    this.events.clear();
    this.belt?.dispose();
    for (const d of this.disposables) d.dispose();
    this.scene.clear();
  }
}

const create: SceneFactory = (ctx, params) => new OrreryScene(ctx, params);
export default create;
export type { OrreryScene };

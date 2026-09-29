import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  ClampToEdgeWrapping,
  Color,
  DataTexture,
  DirectionalLight,
  DoubleSide,
  Float32BufferAttribute,
  HemisphereLight,
  InstancedMesh,
  LinearFilter,
  LinearMipmapLinearFilter,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  Points,
  Quaternion,
  RedFormat,
  RGBAFormat,
  RingGeometry,
  Scene,
  ShaderMaterial,
  UnsignedByteType,
  Vector3,
} from 'three';
import {
  DISH_COUNT,
  dishes,
  dishStates,
  dishTarget,
  lunarLight,
  pointingVector,
  sourcePointing,
  type DishState,
  type Pointing,
} from '../../../content/array.ts';
import { spectralLines, spectralOrder, type SpectralKey } from '../../../design/tokens.ts';
import { clamp, damp, degToRad } from '../../../lib/math.ts';
import type { SceneParams } from '../../../stores/stage.ts';
import { getNoiseTexture } from '../../textures/noiseTexture.ts';
import type { FrameState, PostSettings, SceneFactory, StageContext, StageScene, Viewport } from '../../types.ts';
import { Emitter } from '../../util/Emitter.ts';
import { OrbitRig } from '../../util/OrbitRig.ts';
import type { QualityProfile } from '../../quality.ts';
import { BOWL_RADIUS, FEED_POINT, feedGeometry, mountGeometry, reflectorGeometry } from './dishGeometry.ts';
import {
  beaconFragment,
  beaconVertex,
  skyFragment,
  skyVertex,
  terrainFragment,
  terrainVertex,
} from './shaders.ts';
import { bakeDishShadows, buildSiteMap, DISH_PIVOT, Heightfield, SITE_SIZE, type DishPose } from './terrain.ts';

export type LightMode = 'live' | 'day' | 'night';

export interface SourceLabel {
  x: number;
  y: number;
  visible: boolean;
}

const SLEW_RATE = degToRad(1.5);
const WAVE_SPEED = 21;
const WAVE_SPACING = 38;
const STATE_COLORS: Record<DishState, string> = {
  tracking: spectralLines.o3.nocturne,
  calibrating: spectralLines.na.nocturne,
  slewing: spectralLines.hb.nocturne,
  stowed: '#77736b',
  offline: spectralLines.ha.nocturne,
};
/** A fixed afternoon sun for the "day" view, low enough for long shadows. */
const DAY_SUN: Pointing = { az: 248, el: 12 };
const NIGHT_SUN: Pointing = { az: 90, el: -30 };
/** The overview looks over the dishes toward the horizon, leaving room for the sky. */
const OVERVIEW_TARGET = new Vector3(0, 11, 0);
const OVERVIEW_DISTANCE = 86;
const OVERVIEW_PHI = 1.47;

const segmentsFor = (profile: Readonly<QualityProfile>): number =>
  profile.tier === 'ultra' ? 320 : profile.tier === 'high' ? 256 : profile.tier === 'balanced' ? 192 : 128;

type Uniform<T> = { value: T };

interface DishRuntime {
  yaw: number;
  pitch: number;
  targetYaw: number;
  targetPitch: number;
  state: DishState;
  glow: number;
}

/** Converts an az/el pointing into the mount's yaw and the reflector's tilt from zenith. */
function aim(pointing: Pointing): { yaw: number; pitch: number } {
  const [x, y, z] = pointingVector(pointing);
  return { yaw: Math.atan2(x, z), pitch: Math.acos(clamp(y, -1, 1)) };
}

class ArrayScene implements StageScene {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(44, 1, 0.3, 3000);
  readonly post: Partial<PostSettings> = {
    bloomIntensity: 0.75,
    bloomThreshold: 0.5,
    bloomRadius: 0.62,
    vignette: 0.6,
    aberration: 0.25,
  };
  /** Screen position of the Lacuna, for the page's label. */
  readonly sourceLabel: SourceLabel = { x: 0, y: 0, visible: false };
  /** `pick` fires when the visitor picks a dish in the scene (null: empty ground). */
  readonly events = new Emitter<{ pick: [number | null] }>();

  private readonly ctx: StageContext;
  private readonly rig = new OrbitRig({
    distance: OVERVIEW_DISTANCE,
    minDistance: 7,
    maxDistance: 170,
    theta: 0.62,
    phi: OVERVIEW_PHI,
    minPhi: 0.3,
    maxPhi: 1.5,
    autoRotate: 0.012,
  });
  private heightfield: Heightfield;
  private terrain: Mesh<BufferGeometry, ShaderMaterial>;
  private sunVisibility: Float32Array;
  private readonly sky: Mesh<BufferGeometry, ShaderMaterial>;
  private readonly siteTexture: DataTexture;
  private readonly dishShadow = new Uint8Array(SITE_SIZE * SITE_SIZE).fill(255);
  private readonly dishShadowTexture: DataTexture;
  private readonly poses: DishPose[];
  private shadowClock = 0;
  private readonly shared: Record<string, Uniform<unknown>>;
  private readonly reflectors: InstancedMesh;
  private readonly feeds: InstancedMesh;
  private readonly mounts: InstancedMesh;
  private readonly beacons: Points<BufferGeometry, ShaderMaterial>;
  private readonly selection: Mesh<RingGeometry, MeshBasicMaterial>;
  private readonly sunLamp = new DirectionalLight(0xffffff, 0);
  private readonly hemisphere = new HemisphereLight(0x1a2030, 0x3a2614, 0.4);
  private readonly runtime: DishRuntime[];
  private readonly pads: Vector3[];

  private lightMode: LightMode = 'live';
  private readonly sunDir = new Vector3(0, 1, 0);
  private readonly sunGoal = new Vector3(0, 1, 0);
  private sunStrength = 0;
  private bakedFor = new Vector3(0, -1, 0);
  private focus = -1;
  private hovered = -1;
  private pressed = false;
  private stateClock = 1;
  private lightClock = 60;
  private waveTime = 0;
  private burstGain = 0;
  private readonly waveColors: Color[];
  private readonly srcDir = new Vector3();

  private readonly m = new Matrix4();
  private readonly q = new Quaternion();
  private readonly qPitch = new Quaternion();
  private readonly v = new Vector3();
  private readonly v2 = new Vector3();
  private readonly scaleOne = new Vector3(1, 1, 1);
  private readonly axisX = new Vector3(1, 0, 0);
  private readonly axisY = new Vector3(0, 1, 0);
  private readonly tint = new Color();
  private readonly dayAmbient = new Vector3(0.05, 0.05, 0.052);

  constructor(ctx: StageContext, params: SceneParams) {
    this.ctx = ctx;
    this.scene.add(this.sunLamp, this.sunLamp.target, this.hemisphere);

    const siteData = buildSiteMap();
    this.siteTexture = new DataTexture(siteData, SITE_SIZE, SITE_SIZE, RGBAFormat, UnsignedByteType);
    this.siteTexture.wrapS = ClampToEdgeWrapping;
    this.siteTexture.wrapT = ClampToEdgeWrapping;
    this.siteTexture.magFilter = LinearFilter;
    this.siteTexture.minFilter = LinearMipmapLinearFilter;
    this.siteTexture.generateMipmaps = true;
    this.siteTexture.needsUpdate = true;
    this.dishShadowTexture = new DataTexture(this.dishShadow, SITE_SIZE, SITE_SIZE, RedFormat, UnsignedByteType);
    this.dishShadowTexture.wrapS = ClampToEdgeWrapping;
    this.dishShadowTexture.wrapT = ClampToEdgeWrapping;
    this.dishShadowTexture.magFilter = LinearFilter;
    this.dishShadowTexture.minFilter = LinearFilter;
    this.dishShadowTexture.needsUpdate = true;

    this.waveColors = spectralOrder.map((key: SpectralKey) => new Color(spectralLines[key].nocturne));
    this.shared = {
      uNoise: { value: getNoiseTexture() },
      uSunDir: { value: this.sunDir },
      uSunLight: { value: new Vector3() },
      uAmbient: { value: new Vector3() },
      uSrcDir: { value: this.srcDir },
      uWaveColors: { value: this.waveColors },
      uWaveTime: { value: 0 },
      uWaveGain: { value: 0 },
    };

    this.heightfield = new Heightfield(segmentsFor(ctx.profile));
    this.sunVisibility = new Float32Array(this.heightfield.size * this.heightfield.size);
    this.terrain = this.buildTerrain();
    this.scene.add(this.terrain);

    this.sky = new Mesh(this.fullScreenTriangle(), this.skyMaterial(ctx.profile.shaderDetail));
    this.sky.frustumCulled = false;
    this.sky.renderOrder = 1000;
    this.scene.add(this.sky);

    this.pads = dishes.map((d) => new Vector3(d.x, this.heightfield.pads[d.index] as number, d.z));
    this.poses = dishes.map((d) => ({ x: d.x, z: d.z, pad: this.heightfield.pads[d.index] as number, nx: 0, ny: 1, nz: 0 }));
    const reflectorMaterial = new MeshStandardMaterial({ color: 0xdcd8cf, roughness: 0.38, metalness: 0.18, side: DoubleSide });
    const feedMaterial = new MeshStandardMaterial({ color: 0x8a8781, roughness: 0.55, metalness: 0.35 });
    const mountMaterial = new MeshStandardMaterial({ color: 0xbdb9b0, roughness: 0.72, metalness: 0.08 });
    this.reflectors = new InstancedMesh(reflectorGeometry(), reflectorMaterial, DISH_COUNT);
    this.feeds = new InstancedMesh(feedGeometry(), feedMaterial, DISH_COUNT);
    this.mounts = new InstancedMesh(mountGeometry(DISH_PIVOT), mountMaterial, DISH_COUNT);
    for (const mesh of [this.reflectors, this.feeds, this.mounts]) {
      mesh.frustumCulled = false;
      this.scene.add(mesh);
    }

    const now = new Date();
    const states = dishStates(now);
    this.runtime = dishes.map((dish) => {
      const state = states[dish.index] ?? 'tracking';
      const { yaw, pitch } = aim(dishTarget(dish, state, now));
      return { yaw, pitch, targetYaw: yaw, targetPitch: pitch, state, glow: 0 };
    });

    this.beacons = this.buildBeacons();
    this.scene.add(this.beacons);

    this.selection = new Mesh(
      new RingGeometry(1.9, 2.02, 64),
      new MeshBasicMaterial({ color: spectralLines.o3.nocturne, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false }),
    );
    this.selection.rotation.x = -Math.PI / 2;
    this.scene.add(this.selection);

    this.rig.flyTo(OVERVIEW_TARGET);
    this.applyLight(true);
    this.setParams(params);
    this.updateSource(now);
    this.refreshStates(now, true);
  }

  private fullScreenTriangle(): BufferGeometry {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    return geometry;
  }

  private skyMaterial(detail: number): ShaderMaterial {
    const src = new Vector3(...pointingVector({ az: 318, el: 12 }));
    // The Milky Way runs through Cygnus: a steep arch rising from the horizon
    // through the source, its bright heart higher up the same arc.
    const galNormal = new Vector3(-src.z, 0.3, src.x).normalize();
    const along = new Vector3().crossVectors(galNormal, src).normalize();
    if (along.y < 0) along.negate();
    const galCenter = src.clone().multiplyScalar(Math.cos(0.42)).addScaledVector(along, Math.sin(0.42)).normalize();
    const galSide = new Vector3().crossVectors(galNormal, galCenter).normalize();
    return new ShaderMaterial({
      vertexShader: skyVertex,
      fragmentShader: skyFragment(detail),
      depthWrite: false,
      uniforms: {
        ...this.shared,
        uInvProj: { value: this.camera.projectionMatrixInverse },
        uCamWorld: { value: this.camera.matrixWorld },
        uCamPos: { value: this.camera.position },
        uTime: { value: 0 },
        uDay: { value: 0 },
        uPulse: { value: 0 },
        uGalNormal: { value: galNormal },
        uGalCenter: { value: galCenter },
        uGalSide: { value: galSide },
        uMarker: { value: new Color(spectralLines.na.nocturne).multiplyScalar(0.9) },
      },
    });
  }

  private buildTerrain(): Mesh<BufferGeometry, ShaderMaterial> {
    const { positions, normals, indices } = this.heightfield.buildAttributes();
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new BufferAttribute(normals, 3));
    geometry.setAttribute('aSun', new BufferAttribute(this.sunVisibility, 1));
    geometry.setIndex(new BufferAttribute(indices, 1));
    geometry.computeBoundingSphere();
    const material = new ShaderMaterial({
      vertexShader: terrainVertex,
      fragmentShader: terrainFragment,
      uniforms: {
        ...this.shared,
        uSite: { value: this.siteTexture },
        uDishShadow: { value: this.dishShadowTexture },
        uLampColor: { value: new Vector3() },
      },
    });
    return new Mesh(geometry, material);
  }

  private buildBeacons(): Points<BufferGeometry, ShaderMaterial> {
    // Points 0–63: status lamps on each plinth. Points 64–127: feed glows at each focus.
    const count = DISH_COUNT * 2;
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3));
    geometry.setAttribute('color', new BufferAttribute(new Float32Array(count * 3), 3));
    const blink = new Float32Array(count);
    const size = new Float32Array(count).fill(1);
    for (let i = DISH_COUNT; i < count; i++) size[i] = 1.6;
    geometry.setAttribute('aBlink', new BufferAttribute(blink, 1));
    geometry.setAttribute('aSize', new BufferAttribute(size, 1));
    dishes.forEach((dish) => {
      const pad = this.pads[dish.index] as Vector3;
      (geometry.attributes.position as BufferAttribute).setXYZ(dish.index, pad.x + 0.6, pad.y + 0.34, pad.z + 0.6);
    });
    const material = new ShaderMaterial({
      vertexShader: beaconVertex,
      fragmentShader: beaconFragment,
      uniforms: { uTime: { value: 0 }, uScale: { value: 1 } },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    const points = new Points(geometry, material);
    points.frustumCulled = false;
    return points;
  }

  setParams(params: SceneParams): void {
    const light = params.light;
    if ((light === 'live' || light === 'day' || light === 'night') && light !== this.lightMode) {
      this.lightMode = light;
      this.lightClock = 60;
      this.applyLight(false);
    }
    if (typeof params.focus === 'number' && params.focus !== this.focus) {
      this.focus = params.focus;
      const pad = this.pads[this.focus];
      if (pad) {
        this.rig.flyTo(this.v.copy(pad).setY(pad.y + DISH_PIVOT), 15);
        this.rig.tiltTo(1.1);
      } else {
        this.rig.flyTo(OVERVIEW_TARGET, OVERVIEW_DISTANCE);
        this.rig.tiltTo(OVERVIEW_PHI);
      }
    }
  }

  setQuality(profile: Readonly<QualityProfile>): void {
    const segments = segmentsFor(profile);
    if (segments === this.heightfield.segments) return;
    this.scene.remove(this.terrain);
    this.terrain.geometry.dispose();
    this.terrain.material.dispose();
    this.heightfield = new Heightfield(segments);
    this.sunVisibility = new Float32Array(this.heightfield.size * this.heightfield.size);
    this.bakedFor.set(0, -1, 0);
    this.terrain = this.buildTerrain();
    this.scene.add(this.terrain);
    this.bake();
  }

  /** Sun direction for the current light mode. */
  private sunPointing(date: Date): Pointing {
    if (this.lightMode === 'day') return DAY_SUN;
    if (this.lightMode === 'night') return NIGHT_SUN;
    return lunarLight(date).sun;
  }

  private applyLight(snap: boolean): void {
    const [x, y, z] = pointingVector(this.sunPointing(new Date()));
    this.sunGoal.set(x, y, z);
    if (snap) this.sunDir.copy(this.sunGoal);
    this.bake();
  }

  /** Re-traces the dishes' shadows for their current poses and the sun's goal. */
  private bakeDishes(): void {
    this.runtime.forEach((run, i) => {
      const pose = this.poses[i] as DishPose;
      const s = Math.sin(run.pitch);
      pose.nx = s * Math.sin(run.yaw);
      pose.ny = Math.cos(run.pitch);
      pose.nz = s * Math.cos(run.yaw);
    });
    bakeDishShadows([this.sunGoal.x, this.sunGoal.y, this.sunGoal.z], this.poses, BOWL_RADIUS, this.dishShadow);
    this.dishShadowTexture.needsUpdate = true;
  }

  private bake(): void {
    if (this.sunGoal.y <= 0.002) return;
    this.bakeDishes();
    if (this.bakedFor.dot(this.sunGoal) > 0.99999) return;
    this.heightfield.bakeShadows([this.sunGoal.x, this.sunGoal.y, this.sunGoal.z], this.sunVisibility);
    (this.terrain.geometry.attributes.aSun as BufferAttribute).needsUpdate = true;
    this.bakedFor.copy(this.sunGoal);
    this.ctx.invalidate();
  }

  private updateSource(date: Date): void {
    const [x, y, z] = pointingVector(sourcePointing(date));
    this.srcDir.set(x, y, z);
  }

  private refreshStates(date: Date, snap: boolean): void {
    const states = dishStates(date);
    const color = this.beacons.geometry.attributes.color as BufferAttribute;
    const blink = this.beacons.geometry.attributes.aBlink as BufferAttribute;
    const tmp = this.tint;
    dishes.forEach((dish) => {
      const run = this.runtime[dish.index] as DishRuntime;
      run.state = states[dish.index] ?? 'tracking';
      // Slewing dishes are already moving toward their new state's target.
      const target = aim(dishTarget(dish, run.state === 'slewing' ? 'tracking' : run.state, date));
      run.targetYaw = target.yaw;
      run.targetPitch = target.pitch;
      if (snap) {
        run.yaw = target.yaw;
        run.pitch = target.pitch;
      }
      tmp.set(STATE_COLORS[run.state]).multiplyScalar(run.state === 'stowed' ? 0.5 : 2.2);
      color.setXYZ(dish.index, tmp.r, tmp.g, tmp.b);
      blink.setX(dish.index, run.state === 'calibrating' || run.state === 'slewing' ? 1 : 0);
    });
    color.needsUpdate = true;
    blink.needsUpdate = true;
  }

  resize(viewport: Readonly<Viewport>): void {
    this.camera.aspect = viewport.aspect;
    this.camera.fov = viewport.aspect < 1 ? 60 : 44;
    this.camera.updateProjectionMatrix();
    (this.beacons.material.uniforms.uScale as Uniform<number>).value = viewport.dpr * (viewport.height / 900);
  }

  onPointerDown(x: number, y: number): void {
    this.pressed = true;
    this.rig.pointerDown(x, y);
  }

  onPointerMove(x: number, y: number): void {
    if (this.pressed) this.rig.pointerMove(x, y);
    else this.hovered = this.pick(x, y) ?? -1;
  }

  onPointerUp(x: number, y: number): void {
    const click = this.rig.travel < 0.012;
    this.pressed = false;
    this.rig.pointerUp();
    if (click) this.events.emit('pick', this.pick(x, y));
  }

  onZoom(factor: number): void {
    this.rig.zoom(factor);
  }

  onKey(key: string): boolean {
    switch (key) {
      case 'ArrowLeft':
        this.rig.theta += 0.08;
        return true;
      case 'ArrowRight':
        this.rig.theta -= 0.08;
        return true;
      case 'ArrowUp':
        this.rig.phi = clamp(this.rig.phi - 0.05, 0.3, 1.5);
        return true;
      case 'ArrowDown':
        this.rig.phi = clamp(this.rig.phi + 0.05, 0.3, 1.5);
        return true;
      case '+':
      case '=':
        this.rig.zoom(0.85);
        return true;
      case '-':
      case '_':
        this.rig.zoom(1.18);
        return true;
      case 'Escape':
        if (this.focus < 0) return false;
        this.events.emit('pick', null);
        return true;
      default:
        return false;
    }
  }

  /** Nearest dish under a screen position, or null. */
  private pick(x: number, y: number): number | null {
    this.v.set(x, y, 0.5).unproject(this.camera).sub(this.camera.position).normalize();
    let best: number | null = null;
    let bestAlong = Infinity;
    for (const dish of dishes) {
      const pad = this.pads[dish.index] as Vector3;
      this.v2.copy(pad).setY(pad.y + DISH_PIVOT * 0.8).sub(this.camera.position);
      const along = this.v2.dot(this.v);
      if (along <= 0) continue;
      const miss = this.v2.lengthSq() - along * along;
      const reach = Math.max(1.9, along * 0.012);
      if (miss < reach * reach && along < bestAlong) {
        bestAlong = along;
        best = dish.index;
      }
    }
    return best;
  }

  update(frame: FrameState): void {
    const raw = Math.min(frame.rawDelta, 0.1);
    const still = frame.motion === 'still';
    const now = new Date();

    this.stateClock += raw;
    if (this.stateClock >= 1) {
      this.stateClock = 0;
      this.updateSource(now);
      this.refreshStates(now, false);
    }
    this.lightClock += raw;
    if (this.lightClock >= 60) {
      this.lightClock = 0;
      const [x, y, z] = pointingVector(this.sunPointing(now));
      this.sunGoal.set(x, y, z);
      this.bake();
    }

    // Light: the sun glides to its goal; strength follows its height above the horizon.
    const k = still ? 1000 : 1.6;
    this.sunDir.x = damp(this.sunDir.x, this.sunGoal.x, k, raw);
    this.sunDir.y = damp(this.sunDir.y, this.sunGoal.y, k, raw);
    this.sunDir.z = damp(this.sunDir.z, this.sunGoal.z, k, raw);
    this.sunDir.normalize();
    const daylight = clamp(this.sunDir.y / 0.035);
    this.sunStrength = damp(this.sunStrength, daylight, still ? 1000 : 2.5, raw);
    const sunLight = this.shared.uSunLight as Uniform<Vector3>;
    sunLight.value.set(3.1, 3.0, 2.85).multiplyScalar(this.sunStrength);
    const night = 1 - this.sunStrength;
    (this.terrain.material.uniforms.uLampColor as Uniform<Vector3>).value.set(1.0, 0.5, 0.17).multiplyScalar(0.05 + 0.85 * night);
    this.sunLamp.position.copy(this.sunDir).multiplyScalar(100);
    this.sunLamp.intensity = 3.4 * this.sunStrength;
    // Night: starlight from above, sodium lamps from below. Day: sunlit regolith bouncing back up.
    this.hemisphere.intensity = 0.7 + 1.0 * night;
    this.hemisphere.color.setRGB(0.09 + 0.16 * this.sunStrength, 0.11 + 0.15 * this.sunStrength, 0.18 + 0.1 * this.sunStrength);
    this.hemisphere.groundColor.setRGB(0.55 * night + 0.32 * this.sunStrength, 0.3 * night + 0.31 * this.sunStrength, 0.1 * night + 0.3 * this.sunStrength);
    (this.shared.uAmbient as Uniform<Vector3>).value.set(0.012, 0.014, 0.021).lerp(this.dayAmbient, this.sunStrength);

    // The signal: fronts sweep in from the source; bursts brighten them.
    // Wrapped every seven fronts, so the colour sequence is continuous and floats stay precise.
    if (!still) this.waveTime = (this.waveTime + raw * WAVE_SPEED) % (WAVE_SPACING * 7);
    this.burstGain = damp(this.burstGain, 0, 2.2, raw);
    const waveGain = (0.018 + this.burstGain * 0.1) * (0.25 + 0.75 * night);
    (this.shared.uWaveTime as Uniform<number>).value = this.waveTime;
    (this.shared.uWaveGain as Uniform<number>).value = waveGain;

    this.updateDishes(raw, still, waveGain);
    // Dishes move slowly as they track; their shadows follow every few seconds.
    this.shadowClock += raw;
    if (this.shadowClock > 4 && this.sunStrength > 0.01) {
      this.shadowClock = 0;
      this.bakeDishes();
    }

    const su = this.sky.material.uniforms;
    (su.uTime as Uniform<number>).value = frame.time;
    (su.uDay as Uniform<number>).value = this.sunStrength;
    (su.uPulse as Uniform<number>).value = 0.5 + 0.5 * Math.sin(frame.time * 0.9) * (still ? 0 : 1) + this.burstGain * 0.4;
    (this.beacons.material.uniforms.uTime as Uniform<number>).value = still ? 0 : frame.time;

    this.rig.update(raw, this.camera, still);
    const ground = this.heightfield.heightAt(this.camera.position.x, this.camera.position.z) + 1.4;
    if (this.camera.position.y < ground) {
      this.camera.position.y = ground;
      this.camera.lookAt(this.rig.target);
    }
    this.camera.updateMatrixWorld();

    // The Lacuna's screen position for the DOM label.
    this.v.copy(this.srcDir).multiplyScalar(1000).add(this.camera.position);
    this.camera.getWorldDirection(this.v2);
    const inFront = this.v2.dot(this.srcDir) > 0.1;
    this.v.project(this.camera);
    const { width, height } = this.ctx.viewport;
    this.sourceLabel.x = (this.v.x * 0.5 + 0.5) * width;
    this.sourceLabel.y = (-this.v.y * 0.5 + 0.5) * height;
    this.sourceLabel.visible = inFront && Math.abs(this.v.x) < 0.92 && Math.abs(this.v.y) < 0.9;
  }

  private updateDishes(raw: number, still: boolean, waveGain: number): void {
    const step = still ? Math.PI : SLEW_RATE * raw;
    const position = this.beacons.geometry.attributes.position as BufferAttribute;
    const color = this.beacons.geometry.attributes.color as BufferAttribute;
    const size = this.beacons.geometry.attributes.aSize as BufferAttribute;
    const toward = (from: number, to: number): number => from + clamp(to - from, -step, step);
    for (const dish of dishes) {
      const run = this.runtime[dish.index] as DishRuntime;
      run.yaw = toward(run.yaw, run.targetYaw);
      run.pitch = toward(run.pitch, run.targetPitch);
      const pad = this.pads[dish.index] as Vector3;

      this.q.setFromAxisAngle(this.axisY, run.yaw);
      this.m.compose(pad, this.q, this.scaleOne);
      this.mounts.setMatrixAt(dish.index, this.m);

      this.qPitch.setFromAxisAngle(this.axisX, run.pitch);
      this.q.multiply(this.qPitch);
      this.v.copy(pad).setY(pad.y + DISH_PIVOT);
      this.m.compose(this.v, this.q, this.scaleOne);
      this.reflectors.setMatrixAt(dish.index, this.m);
      this.feeds.setMatrixAt(dish.index, this.m);

      // Each feed lights as a wavefront passes over its dish.
      this.v2.copy(FEED_POINT).applyMatrix4(this.m);
      position.setXYZ(DISH_COUNT + dish.index, this.v2.x, this.v2.y, this.v2.z);
      const front = (this.v2.dot(this.v.copy(this.srcDir).negate()) - this.waveTime) / WAVE_SPACING;
      const f = front - Math.floor(front);
      const band = Math.min(1, f / 0.012) * Math.exp(-f * 16);
      const receiving = run.state === 'tracking' ? 1 : 0.08;
      run.glow = band * receiving * (waveGain / 0.018);
      const tint = this.waveColors[((Math.floor(front) % 7) + 7) % 7] as Color;
      color.setXYZ(DISH_COUNT + dish.index, tint.r * run.glow * 0.9, tint.g * run.glow * 0.9, tint.b * run.glow * 0.9);
      size.setX(dish.index, dish.index === this.hovered || dish.index === this.focus ? 2.2 : 1);
    }
    this.mounts.instanceMatrix.needsUpdate = true;
    this.reflectors.instanceMatrix.needsUpdate = true;
    this.feeds.instanceMatrix.needsUpdate = true;
    position.needsUpdate = true;
    color.needsUpdate = true;
    size.needsUpdate = true;

    const focused = this.pads[this.focus];
    const ring = this.selection.material;
    ring.opacity = damp(ring.opacity, focused ? 0.8 : 0, 6, raw);
    if (focused) this.selection.position.set(focused.x, focused.y + 0.06, focused.z);
  }

  /** A data burst: the fronts and the reticle brighten for a moment. */
  burst(): void {
    this.burstGain = Math.min(1.6, this.burstGain + 0.7);
  }

  dispose(): void {
    this.events.clear();
    this.terrain.geometry.dispose();
    this.terrain.material.dispose();
    this.sky.geometry.dispose();
    this.sky.material.dispose();
    this.siteTexture.dispose();
    this.dishShadowTexture.dispose();
    for (const mesh of [this.reflectors, this.feeds, this.mounts]) {
      mesh.geometry.dispose();
      (mesh.material as MeshStandardMaterial).dispose();
      mesh.dispose();
    }
    this.beacons.geometry.dispose();
    this.beacons.material.dispose();
    this.selection.geometry.dispose();
    this.selection.material.dispose();
    this.sunLamp.dispose();
    this.hemisphere.dispose();
    this.scene.clear();
  }
}

const create: SceneFactory = (ctx, params) => new ArrayScene(ctx, params);
export default create;
export type { ArrayScene };

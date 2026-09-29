import { Color, PerspectiveCamera, Ray, Scene, Vector2, Vector3 } from 'three';
import type { LacunaMode, SpectralKey } from '../../../content/types.ts';
import { spectralLines } from '../../../design/tokens.ts';
import { easing } from '../../../design/motion.ts';
import { clamp, damp, smoothstep } from '../../../lib/math.ts';
import type { SceneParams } from '../../../stores/stage.ts';
import { getChannel, stageInput } from '../../input.ts';
import type { QualityProfile } from '../../quality.ts';
import type { FrameState, PostSettings, SceneFactory, StageContext, StageScene, Viewport } from '../../types.ts';
import { HOME_PATH, MODE_POSES, samplePath, type Pose } from './cameraPath.ts';
import { Environment } from './environment.ts';
import { ERA_FORMATIONS, RING, type FormationKey } from './formations.ts';
import { Motes } from './motes.ts';

const BASE_MOTES = 110_000;

interface Look {
  ringIntensity: number;
  stars: number;
  seaRough: number;
  brightness: number;
  turbulence: number;
  orbitSpeed: number;
  tintMix: number;
  post: Partial<PostSettings>;
}

const LOOKS: Record<LacunaMode, Look> = {
  home: { ringIntensity: 1, stars: 1, seaRough: 1, brightness: 1, turbulence: 0.12, orbitSpeed: 0.05, tintMix: 0, post: {} },
  ambient: {
    ringIntensity: 0.8,
    stars: 1,
    seaRough: 0.9,
    brightness: 0.8,
    turbulence: 0.12,
    orbitSpeed: 0.035,
    tintMix: 0.1,
    post: { bloomIntensity: 0.95 },
  },
  chronicle: {
    ringIntensity: 0.16,
    stars: 0.8,
    seaRough: 0.7,
    brightness: 1.15,
    turbulence: 0.08,
    orbitSpeed: 0.02,
    tintMix: 0.55,
    post: { bloomIntensity: 1.25 },
  },
  dusk: {
    ringIntensity: 0.55,
    stars: 1.2,
    seaRough: 0.6,
    brightness: 0.6,
    turbulence: 0.1,
    orbitSpeed: 0.02,
    tintMix: 0.3,
    post: { bloomIntensity: 0.9, vignette: 0.75 },
  },
  finale: {
    ringIntensity: 1.6,
    stars: 0.6,
    seaRough: 0.5,
    brightness: 1.3,
    turbulence: 0.16,
    orbitSpeed: 0.08,
    tintMix: 0,
    post: { bloomIntensity: 1.6, exposure: 1.1 },
  },
  credits: {
    ringIntensity: 0.9,
    stars: 1.1,
    seaRough: 0.8,
    brightness: 0.9,
    turbulence: 0.1,
    orbitSpeed: 0.04,
    tintMix: 0.05,
    post: {},
  },
  lanterns: {
    ringIntensity: 0.12,
    stars: 0.9,
    seaRough: 0.45,
    brightness: 1.2,
    turbulence: 0.18,
    orbitSpeed: 0,
    tintMix: 0.65,
    post: { bloomIntensity: 1.4 },
  },
  choir: {
    ringIntensity: 0.7,
    stars: 0.7,
    seaRough: 0.6,
    brightness: 1.2,
    turbulence: 0.06,
    orbitSpeed: 0.01,
    tintMix: 0.45,
    post: { bloomIntensity: 1.35 },
  },
};

const MODE_FORMATION: Record<LacunaMode, FormationKey> = {
  home: 'drift',
  ambient: 'drift',
  chronicle: 'tidal',
  dusk: 'drift',
  finale: 'drift',
  credits: 'constellation',
  lanterns: 'field',
  choir: 'choir',
};

const colorOf = (key: SpectralKey): Color => new Color(spectralLines[key].nocturne);

class LacunaScene implements StageScene {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(36, 1, 0.05, 400);
  readonly post: Partial<PostSettings> = {};

  private readonly ctx: StageContext;
  private readonly env: Environment;
  private motes: Motes;
  private mode: LacunaMode = 'ambient';
  private era = 0;
  private formationOverride: FormationKey | null = null;
  private tintKey: SpectralKey = 'na';

  private readonly pose: Pose = { pos: [0, 1.5, 12.5], look: [0, 3, -16], fov: 36 };
  private readonly camPos = new Vector3(0, 1.5, 12.5);
  private readonly camLook = new Vector3(0, 3, -16);
  private camFov = 36;
  private readonly parallax = new Vector2();
  private fovScale = 1;
  private orbit = 0;

  private readonly look: Look = { ...LOOKS.ambient };
  private readonly tint = new Color('#ffb45e');
  private readonly targetTint = new Color('#ffb45e');
  private readonly ringColor = new Color('#fff1dc');
  private readonly haloColor = new Color('#ffb45e');
  private exposureKick = 0;
  private beyond = 0;

  private readonly ray = new Ray();
  private readonly pointerWorld = new Vector3(0, -100, 0);
  private readonly seaHit = new Vector3();
  private pointerStrength = 0;
  private lastRippleAt = 0;
  private lastImpulse = 0;
  private hasPose = false;

  constructor(ctx: StageContext, params: SceneParams) {
    this.ctx = ctx;
    this.env = new Environment(ctx.profile.shaderDetail);
    this.scene.add(this.env.mesh);
    this.motes = this.createMotes(ctx.profile, 'drift');
    this.setParams(params);
    this.motes.snapTo(this.currentFormation(0));
    this.lastImpulse = performance.now();
  }

  private createMotes(profile: Readonly<QualityProfile>, initial: FormationKey): Motes {
    const count = Math.max(6000, Math.round(BASE_MOTES * profile.particleScale));
    const motes = new Motes(count, initial, profile.tier === 'eco' ? 1.35 : 1);
    this.scene.add(motes.points);
    if (profile.tier !== 'eco') this.scene.add(motes.mirror);
    return motes;
  }

  setParams(params: SceneParams): void {
    const mode = (params.mode as LacunaMode | undefined) ?? 'ambient';
    this.mode = mode in LOOKS ? mode : 'ambient';
    this.era = typeof params.era === 'number' ? params.era : 0;
    this.formationOverride = (params.formation as FormationKey | undefined) ?? null;
    this.tintKey = (params.tint as SpectralKey | undefined) ?? (this.mode === 'chronicle' ? 'o3' : 'na');
    this.targetTint.copy(colorOf(this.tintKey));
    if (this.mode !== 'home') this.motes.setFormation(this.currentFormation(0));
  }

  setQuality(profile: Readonly<QualityProfile>): void {
    const formation = this.motes.formation;
    this.scene.remove(this.motes.points, this.motes.mirror);
    this.motes.dispose();
    this.motes = this.createMotes(profile, formation);
    this.motes.snapTo(formation);
  }

  private currentFormation(chapter: number): FormationKey {
    if (this.formationOverride) return this.formationOverride;
    if (this.mode === 'chronicle') return ERA_FORMATIONS[clamp(this.era, 0, 6)] ?? 'tidal';
    if (this.mode !== 'home') return MODE_FORMATION[this.mode];
    if (chapter < 1.05) return 'drift';
    if (chapter < 2.02) return 'signal';
    if (chapter < 3.0) return ERA_FORMATIONS[clamp(Math.floor((chapter - 2.02) * 7.4), 0, 6)] ?? 'tidal';
    return 'drift';
  }

  resize(viewport: Readonly<Viewport>): void {
    this.camera.aspect = viewport.aspect;
    // Portrait screens widen the lens instead of cropping the ring.
    this.fovScale = viewport.aspect < 1 ? 1 + (1 - viewport.aspect) * 0.75 : 1;
    this.camera.updateProjectionMatrix();
  }

  update(frame: FrameState): void {
    const dt = frame.delta;
    const raw = Math.min(frame.rawDelta, 0.1);
    const still = frame.motion === 'still';
    const reveal = getChannel('stage.reveal', 1);
    const chapter = this.mode === 'home' ? getChannel('home.chapter', 0) : 0;

    // ── Look (eased between modes) ─────────────────────────────────────────
    const target = LOOKS[this.mode];
    const k = still ? 60 : 1.6;
    const l = this.look;
    l.ringIntensity = damp(l.ringIntensity, target.ringIntensity, k, raw);
    l.stars = damp(l.stars, target.stars, k, raw);
    l.seaRough = damp(l.seaRough, target.seaRough, k, raw);
    l.brightness = damp(l.brightness, target.brightness, k, raw);
    l.turbulence = damp(l.turbulence, target.turbulence, k, raw);
    l.orbitSpeed = damp(l.orbitSpeed, target.orbitSpeed, k, raw);
    l.tintMix = damp(l.tintMix, target.tintMix, k, raw);
    this.tint.lerp(this.targetTint, 1 - Math.exp(-k * raw));

    if (this.mode === 'home') {
      const eraIndex = clamp(Math.floor((chapter - 2.02) * 7.4), 0, 6);
      const inAges = chapter > 2.02 && chapter < 3.0;
      const eraKeys: SpectralKey[] = ['o3', 'na', 'hb', 'he', 'mg', 'ha', 'ca'];
      this.targetTint.copy(colorOf(inAges ? (eraKeys[eraIndex] ?? 'na') : 'na'));
      l.tintMix = damp(l.tintMix, inAges ? 0.5 : 0, 2.5, raw);
      this.motes.setFormation(this.currentFormation(chapter), 2.2);
    }

    // ── Camera ─────────────────────────────────────────────────────────────
    const pose =
      this.mode === 'home' ? samplePath(HOME_PATH, chapter, this.pose) : MODE_POSES[this.mode] ?? MODE_POSES.ambient;
    const time = frame.time;
    let [px, py, pz] = pose.pos;
    if (this.mode === 'credits') {
      const a = time * 0.035;
      px = Math.sin(a) * 14;
      pz = RING.center[2] + Math.cos(a) * 14 + 16;
      py = 2.2 + Math.sin(a * 0.7) * 0.6;
    } else if (!still) {
      px += Math.sin(time * 0.05) * 0.35;
      py += Math.sin(time * 0.08) * 0.08;
    }
    const pointer = frame.pointer;
    const parallaxAmount = still ? 0 : frame.motion === 'gentle' ? 0.35 : 1;
    this.parallax.x = damp(this.parallax.x, pointer.x * 0.55 * parallaxAmount, 3, raw);
    this.parallax.y = damp(this.parallax.y, pointer.y * 0.28 * parallaxAmount, 3, raw);

    const follow = still || !this.hasPose ? 1000 : this.mode === 'home' ? 5.5 : 1.8;
    this.camPos.x = damp(this.camPos.x, px + this.parallax.x, follow, raw);
    this.camPos.y = damp(this.camPos.y, Math.max(0.12, py + this.parallax.y), follow, raw);
    this.camPos.z = damp(this.camPos.z, pz, follow, raw);
    // Editorial composition: on wide screens the hero frames the ring on the right third,
    // leaving the left for the headline; it eases back to centre as the story begins.
    const compose =
      this.mode === 'home' && !this.ctx.viewport.compact ? -3.8 * (1 - smoothstep(0.45, 1.2, chapter)) : 0;
    // Asymmetric poses (ring framed to one side) are re-centred on portrait screens.
    const lookX = this.mode !== 'home' && this.ctx.viewport.compact ? pose.look[0] * 0.2 : pose.look[0];
    this.camLook.x = damp(this.camLook.x, lookX + compose, follow, raw);
    this.camLook.y = damp(this.camLook.y, pose.look[1], follow, raw);
    this.camLook.z = damp(this.camLook.z, pose.look[2], follow, raw);
    this.camFov = damp(this.camFov, pose.fov * this.fovScale, follow, raw);
    this.hasPose = true;

    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
    if (Math.abs(this.camera.fov - this.camFov) > 0.01) {
      this.camera.fov = this.camFov;
      this.camera.updateProjectionMatrix();
    }
    this.camera.updateMatrixWorld();

    // Passing through the ring: an exposure bloom, then the far side.
    const ringZ = RING.center[2];
    const crossing = Math.exp(-Math.pow((this.camPos.z - ringZ) / 1.6, 2));
    this.exposureKick = damp(this.exposureKick, this.mode === 'home' ? crossing : 0, 8, raw);
    this.beyond = damp(this.beyond, smoothstep(ringZ + 0.4, ringZ - 3, this.camPos.z), 4, raw);
    const modePost = LOOKS[this.mode].post;
    for (const key of Object.keys(this.post) as (keyof PostSettings)[]) delete this.post[key];
    Object.assign(this.post, modePost);
    this.post.exposure = (modePost.exposure ?? 1) + this.exposureKick * 2.4;
    this.post.bloomIntensity = (modePost.bloomIntensity ?? 1.1) + this.exposureKick * 1.2;

    // ── Pointer: gravity well for motes, ripples on the sea ───────────────
    this.ray.origin.copy(this.camera.position);
    this.ray.direction.set(pointer.x, pointer.y, 0.5).unproject(this.camera).sub(this.camera.position).normalize();
    const reach = this.camera.position.distanceTo(this.camLook) * 0.55;
    this.pointerWorld.copy(this.ray.origin).addScaledVector(this.ray.direction, reach);
    const speed = Math.hypot(pointer.vx, pointer.vy);
    const wantStrength = still || !pointer.inside ? 0 : clamp(0.25 + speed * 0.35, 0, 1.6);
    this.pointerStrength = damp(this.pointerStrength, wantStrength, 4, raw);

    const now = performance.now();
    if (!still && this.ray.direction.y < -0.002 && this.camera.position.y > 0) {
      const t = -this.camera.position.y / this.ray.direction.y;
      if (t < 90) {
        this.seaHit.copy(this.ray.origin).addScaledVector(this.ray.direction, t);
        if (pointer.inside && speed > 0.35 && now - this.lastRippleAt > 110) {
          this.env.addRipple(this.seaHit.x, this.seaHit.z, time, clamp(speed * 0.25, 0.15, 0.9));
          this.lastRippleAt = now;
        }
        for (const impulse of stageInput.impulses) {
          if (impulse.t <= this.lastImpulse) continue;
          this.env.addRipple(this.seaHit.x, this.seaHit.z, time, 1.4);
        }
      }
    }
    this.lastImpulse = now;

    // ── Uniforms ───────────────────────────────────────────────────────────
    this.orbit += dt * l.orbitSpeed;
    const introRadius = easing.out(reveal);
    const pulse = this.mode === 'home' && chapter > 1 && chapter < 2 ? Math.pow(Math.max(0, Math.sin(time * 2.4)), 18) : 0;
    this.haloColor.copy(colorOf('na')).lerp(this.tint, l.tintMix * 0.6);
    // History plays out in the motes during the Seven Ages; the ring steps back so text stays legible.
    const agesDim =
      this.mode === 'home' ? 1 - 0.62 * smoothstep(1.92, 2.12, chapter) * (1 - smoothstep(2.9, 3.25, chapter)) : 1;
    this.env.sync(this.camera, time, {
      ringRadius: RING.radius * (0.04 + 0.96 * introRadius),
      ringIntensity: l.ringIntensity * agesDim * (0.2 + 0.8 * reveal),
      ringColor: this.ringColor,
      haloColor: this.haloColor,
      tint: this.tint,
      seaRough: l.seaRough,
      stars: l.stars * reveal,
      beyond: this.beyond,
      fade: 0.15 + 0.85 * reveal,
      pulse,
    });
    this.motes.update({
      time,
      delta: still ? 1 : dt,
      pointer: this.pointerWorld,
      pointerStrength: this.pointerStrength,
      // In the lantern field, the lanterns kindle as the reader counts them.
      brightness:
        l.brightness *
        reveal *
        (1 + this.exposureKick) *
        (this.mode === 'lanterns' ? 0.15 + 0.85 * getChannel('story.progress', 1) : 1),
      turbulence: l.turbulence,
      orbit: this.orbit,
      orbitMix: this.motes.formation === 'drift' ? 1 : 0.15,
      tint: this.tint,
      tintMix: l.tintMix,
      scale: this.ctx.viewport.height * this.ctx.viewport.dpr / 1000,
    });
  }

  dispose(): void {
    this.env.dispose();
    this.motes.dispose();
    this.scene.clear();
  }
}

const create: SceneFactory = (ctx, params) => new LacunaScene(ctx, params);
export default create;

import {
  ACESFilmicToneMapping,
  NoToneMapping,
  SRGBColorSpace,
  WebGLRenderer,
  type Camera,
  type Scene,
} from 'three';
import type { SceneKey } from '../content/types.ts';
import {
  resolveMotion,
  useSettings,
  type QualityTier,
  type ResolvedMotion,
  type Settings,
} from '../stores/settings.ts';
import { useStage, type SceneParams } from '../stores/stage.ts';
import { attachPointerInput, decayPointer, stageInput } from './input.ts';
import { PerformanceMonitor } from './PerformanceMonitor.ts';
import { Post } from './Post.ts';
import {
  classifyDevice,
  describeRenderer,
  QUALITY_PROFILES,
  readDeviceSignals,
  tierAt,
  tierIndex,
  type QualityProfile,
} from './quality.ts';
import { loaderFor } from './scenes/registry.ts';
import type { EngineHandle } from './handle.ts';
import type { FrameState, StageContext, StageScene, Viewport } from './types.ts';

const TIME_SCALE: Record<ResolvedMotion, number> = { full: 1, gentle: 0.4, still: 0 };
const MAX_DELTA = 1 / 20;

type Listener = (scene: StageScene) => void;

/**
 * The persistent stage. One WebGL context lives for the whole visit; routes
 * ask for scenes and the engine swaps them — usually while the aperture blink
 * hides the change — so navigation never tears the world down.
 */
export class Engine implements StageContext, EngineHandle {
  readonly renderer: WebGLRenderer;
  profile: QualityProfile;
  viewport: Viewport = { width: 1, height: 1, dpr: 1, aspect: 1, compact: false };
  theme: Settings['theme'];

  private readonly container: HTMLElement;
  private post: Post | null = null;
  private current: StageScene | null = null;
  private currentKey: SceneKey | null = null;
  private loadToken = 0;
  private readonly monitor = new PerformanceMonitor();
  private readonly resizeObserver: ResizeObserver;
  private readonly disposers: (() => void)[] = [];
  private readonly listeners = new Set<Listener>();
  private motion: ResolvedMotion;
  private spectral: boolean;
  private qualityPreference: Settings['quality'];
  private detectedTier: QualityTier = 'balanced';
  private running = false;
  private needsRender = true;
  private clockTime = 0;
  private lastNow = 0;
  private lastRender = 0;
  private contextLost = false;
  private frame: FrameState;

  constructor(canvas: HTMLCanvasElement, container: HTMLElement) {
    this.container = container;
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      stencil: false,
      depth: true,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.setClearColor(0x040406, 1);

    const settings = useSettings.getState();
    this.motion = resolveMotion(settings.motion);
    this.spectral = settings.spectral;
    this.theme = settings.theme;
    this.qualityPreference = settings.quality;

    const signals = readDeviceSignals(this.renderer.getContext() as WebGL2RenderingContext);
    this.detectedTier = classifyDevice(signals);
    useStage.getState().setDetected(this.detectedTier, describeRenderer(signals.renderer));
    this.profile = QUALITY_PROFILES[this.resolveTier()];
    useStage.getState().setTier(this.profile.tier);

    this.frame = {
      time: 0,
      delta: 0,
      rawDelta: 0,
      pointer: stageInput.pointer,
      scroll: stageInput.scroll,
      viewport: this.viewport,
      motion: this.motion,
      profile: this.profile,
    };

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();

    this.disposers.push(attachPointerInput());
    this.disposers.push(this.watchSettings());
    this.disposers.push(this.watchVisibility());
    this.disposers.push(this.watchContext(canvas));
  }

  /* ── StageContext ─────────────────────────────────────────────────────── */

  invalidate(): void {
    this.needsRender = true;
  }

  /* ── Scene management ─────────────────────────────────────────────────── */

  get sceneKey(): SceneKey | null {
    return this.currentKey;
  }

  get activeScene(): StageScene | null {
    return this.current;
  }

  onSceneReady(listener: Listener): () => void {
    this.listeners.add(listener);
    if (this.current) listener(this.current);
    return () => this.listeners.delete(listener);
  }

  /**
   * Shows `key` with `params`. Re-requesting the active scene only forwards
   * params, which lets scenes animate between modes instead of reloading.
   */
  async setScene(key: SceneKey, params: SceneParams): Promise<void> {
    if (this.current && this.currentKey === key) {
      this.current.setParams?.(params);
      this.invalidate();
      return;
    }
    const token = ++this.loadToken;
    useStage.getState().setStatus('loading');
    try {
      performance.mark(`phosphene:${key}:request`);
      const { default: factory } = await loaderFor(key)();
      if (token !== this.loadToken) return;
      const next = await factory(this, params);
      performance.mark(`phosphene:${key}:built`);
      if (token !== this.loadToken) {
        next.dispose();
        return;
      }
      next.resize(this.viewport);
      await this.compile(next.scene, next.camera);
      // Marks let real-user timing see where a scene's first appearance goes: code, build, shaders.
      performance.mark(`phosphene:${key}:compiled`);
      if (token !== this.loadToken) {
        next.dispose();
        return;
      }
      const previous = this.current;
      this.current = next;
      this.currentKey = key;
      previous?.dispose();

      this.attachPost(next, !previous);
      this.monitor.settle();
      this.invalidate();
      useStage.getState().setStatus('ready');
      for (const listener of this.listeners) listener(next);
      this.start();
    } catch (error) {
      if (token !== this.loadToken) return;
      console.error('[stage] scene failed to load', error);
      useStage.getState().setStatus('error');
    }
  }

  private async compile(scene: Scene, camera: Camera): Promise<void> {
    // KHR_parallel_shader_compile lets programs link off the main thread.
    try {
      await this.renderer.compileAsync(scene, camera);
    } catch {
      this.renderer.compile(scene, camera);
    }
  }

  /* ── Pointer forwarding from interaction surfaces ─────────────────────── */

  dispatchPointer(kind: 'down' | 'move' | 'up', e: PointerEvent): void {
    const s = this.current;
    if (!s) return;
    const rect = this.container.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    if (kind === 'down') s.onPointerDown?.(x, y, e);
    else if (kind === 'move') s.onPointerMove?.(x, y, e);
    else s.onPointerUp?.(x, y, e);
    this.invalidate();
  }

  dispatchWheel(e: WheelEvent): void {
    this.current?.onWheel?.(e.deltaY, e);
    this.current?.onZoom?.(Math.exp(Math.max(-120, Math.min(120, e.deltaY)) * 0.0016));
    this.invalidate();
  }

  dispatchZoom(factor: number): void {
    this.current?.onZoom?.(factor);
    this.invalidate();
  }

  /**
   * Renders the current frame and captures it as a PNG. Rendering and reading
   * in the same task works without preserveDrawingBuffer, because toBlob
   * snapshots the canvas synchronously.
   */
  capture(): Promise<Blob | null> {
    const scene = this.current;
    if (!scene) return Promise.resolve(null);
    if (this.post) this.post.render(0);
    else this.renderer.render(scene.scene, scene.camera);
    return new Promise((resolve) => this.renderer.domElement.toBlob((blob) => resolve(blob), 'image/png'));
  }

  /** Returns true when the scene consumed the key. */
  dispatchKey(key: string): boolean {
    const used = this.current?.onKey?.(key) ?? false;
    if (used) this.invalidate();
    return used;
  }

  /* ── Loop ─────────────────────────────────────────────────────────────── */

  start(): void {
    if (this.running || this.contextLost || document.hidden) return;
    this.running = true;
    this.lastNow = performance.now();
    this.renderer.setAnimationLoop(this.tick);
  }

  stop(): void {
    this.running = false;
    this.renderer.setAnimationLoop(null);
  }

  private readonly tick = (now: number): void => {
    const raw = Math.min(0.5, (now - this.lastNow) / 1000);
    this.lastNow = now;
    const scene = this.current;
    if (!scene) return;

    const still = this.motion === 'still';
    if (still && !this.needsRender) return;

    const cap = this.profile.fpsCap;
    if (cap > 0 && now - this.lastRender < 1000 / cap - 2) return;
    const sinceRender = this.lastRender === 0 ? raw : Math.min(0.5, (now - this.lastRender) / 1000);
    this.lastRender = now;

    const scale = TIME_SCALE[this.motion];
    const delta = Math.min(sinceRender, MAX_DELTA) * scale;
    this.clockTime += delta;
    decayPointer(sinceRender);

    const f = this.frame;
    f.time = this.clockTime;
    f.delta = delta;
    f.rawDelta = sinceRender;
    f.motion = this.motion;
    f.profile = this.profile;
    f.viewport = this.viewport;

    scene.update(f);
    scene.prerender?.(this.renderer, f);

    if (this.post) {
      this.post.setTarget(scene.post);
      this.post.update(sinceRender, {
        scrollVelocity: this.motion === 'full' ? stageInput.scroll.velocity : 0,
        spectral: this.spectral,
        time: this.clockTime,
      });
      this.post.render(sinceRender);
    } else {
      this.renderer.render(scene.scene, scene.camera);
    }
    this.needsRender = false;
    if (!still) this.adapt(sinceRender);
  };

  private adapt(delta: number): void {
    const recommendation = this.monitor.sample(delta);
    if (recommendation) useStage.getState().setFps(Math.round(this.monitor.fps));
    if (!recommendation || this.qualityPreference !== 'auto') return;
    const index = tierIndex(this.profile.tier);
    const ceiling = tierIndex(this.detectedTier);
    const next = recommendation === 'down' ? tierAt(index - 1) : tierAt(Math.min(ceiling, index + 1));
    if (next !== this.profile.tier) this.applyTier(next);
  }

  /* ── Quality ──────────────────────────────────────────────────────────── */

  private resolveTier(): QualityTier {
    return this.qualityPreference === 'auto' ? this.detectedTier : this.qualityPreference;
  }

  private applyTier(tier: QualityTier): void {
    const previous = this.profile;
    this.profile = QUALITY_PROFILES[tier];
    useStage.getState().setTier(tier);
    if (previous.post !== this.profile.post || previous.msaa !== this.profile.msaa) this.rebuildPost();
    this.resize();
    this.current?.setQuality?.(this.profile);
    this.monitor.settle();
    this.invalidate();
  }

  private rebuildPost(): void {
    this.post?.dispose();
    this.post = null;
    if (this.current) this.attachPost(this.current, true);
  }

  /** Creates or retargets the composer for a scene, per the active profile. */
  private attachPost(scene: StageScene, snap: boolean): void {
    if (this.profile.post) {
      if (!this.post) {
        this.post = new Post(this.renderer, scene.scene, scene.camera, this.profile);
        this.post.setSize(this.viewport.width, this.viewport.height);
        snap = true;
      } else {
        this.post.setScene(scene.scene, scene.camera);
      }
      this.post.setTarget(scene.post);
      if (snap) this.post.snap();
    }
    // With the composer, tone mapping happens in its final pass instead.
    this.renderer.toneMapping = this.post ? NoToneMapping : ACESFilmicToneMapping;
  }

  private resize(): void {
    const rect = this.container.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const dpr = Math.min(window.devicePixelRatio || 1, this.profile.maxDpr);
    Object.assign(this.viewport, { width, height, dpr, aspect: width / height, compact: width <= 768 });
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(width, height, false);
    this.post?.setSize(width, height);
    this.current?.resize(this.viewport);
    this.invalidate();
  }

  /* ── Environment watchers ─────────────────────────────────────────────── */

  private watchSettings(): () => void {
    return useSettings.subscribe((s, prev) => {
      if (s.motion !== prev.motion) {
        this.motion = resolveMotion(s.motion);
        this.invalidate();
      }
      if (s.spectral !== prev.spectral) this.spectral = s.spectral;
      if (s.theme !== prev.theme) {
        this.theme = s.theme;
        this.invalidate();
      }
      if (s.quality !== prev.quality) {
        this.qualityPreference = s.quality;
        this.applyTier(this.resolveTier());
      }
    });
  }

  private watchVisibility(): () => void {
    const onVisibility = (): void => {
      if (document.hidden) this.stop();
      else {
        this.monitor.settle();
        this.start();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onMotionPreference = (): void => {
      this.motion = resolveMotion(useSettings.getState().motion);
      this.invalidate();
    };
    reducedMotion.addEventListener('change', onMotionPreference);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      reducedMotion.removeEventListener('change', onMotionPreference);
    };
  }

  private watchContext(canvas: HTMLCanvasElement): () => void {
    const losses: number[] = [];
    const onLost = (e: Event): void => {
      e.preventDefault();
      this.contextLost = true;
      this.stop();
      losses.push(performance.now());
      useStage.getState().setStatus('error');
    };
    const onRestored = (): void => {
      this.contextLost = false;
      const recent = losses.filter((t) => performance.now() - t < 60_000).length;
      // Repeated losses mean this GPU cannot sustain the current load. Step down,
      // and after a third loss stop trying so the browser never blocks WebGL for the site.
      if (recent >= 3) return;
      if (recent >= 2) this.profile = QUALITY_PROFILES[tierAt(tierIndex(this.profile.tier) - 1)];
      // Old resources carry dispose listeners bound to three's pre-restore managers;
      // disposing them would try to delete handles from the dead context. Drop them instead.
      const key = this.currentKey;
      const params = useStage.getState().params;
      this.current = null;
      this.currentKey = null;
      this.post = null;
      useStage.getState().setTier(this.profile.tier);
      if (key) void this.setScene(key, params);
    };
    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);
    return () => {
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
    };
  }

  dispose(): void {
    this.stop();
    this.loadToken++;
    this.resizeObserver.disconnect();
    for (const dispose of this.disposers) dispose();
    this.current?.dispose();
    this.current = null;
    this.post?.dispose();
    this.listeners.clear();
    this.renderer.dispose();
  }
}

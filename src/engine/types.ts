import type { Camera, Scene, WebGLRenderer } from 'three';
import type { QualityTier, ResolvedMotion, ThemePreference } from '../stores/settings.ts';
import type { SceneParams } from '../stores/stage.ts';
import type { PointerInput, ScrollInput } from './input.ts';
import type { QualityProfile } from './quality.ts';

export interface Viewport {
  width: number;
  height: number;
  dpr: number;
  aspect: number;
  /** Narrow layouts (≤ 768 px) recompose scenes rather than just scaling them. */
  compact: boolean;
}

/**
 * How much additive particle light a screen can take: the same particle
 * count piles up on a phone's few pixels, so smaller screens get dimmer
 * grains to keep the image from saturating to white.
 */
export const screenDensity = (viewport: Readonly<Viewport>): number =>
  Math.min(1, Math.max(0.45, Math.sqrt((viewport.width * viewport.height) / (1440 * 900))));

export interface FrameState {
  /** Seconds since the engine started, scaled by the motion preference. */
  time: number;
  /** Scaled seconds since the previous frame (clamped to avoid jumps). */
  delta: number;
  /** Unscaled seconds since the previous frame. */
  rawDelta: number;
  pointer: Readonly<PointerInput>;
  scroll: Readonly<ScrollInput>;
  viewport: Readonly<Viewport>;
  motion: ResolvedMotion;
  profile: Readonly<QualityProfile>;
}

export interface PostSettings {
  bloomIntensity: number;
  bloomThreshold: number;
  bloomRadius: number;
  vignette: number;
  aberration: number;
  exposure: number;
}

export interface StageContext {
  readonly renderer: WebGLRenderer;
  readonly profile: Readonly<QualityProfile>;
  readonly viewport: Readonly<Viewport>;
  readonly theme: ThemePreference;
  /** Ask the engine to draw a frame even when motion is 'still'. */
  invalidate(): void;
}

/**
 * A scene the persistent stage can host. Scenes own their Three.js resources
 * and must release every one of them in `dispose()`.
 */
export interface StageScene {
  readonly scene: Scene;
  readonly camera: Camera;
  /** Post-processing preferences; the engine eases between scenes' values. */
  readonly post?: Partial<PostSettings>;
  resize(viewport: Readonly<Viewport>): void;
  update(frame: FrameState): void;
  setParams?(params: SceneParams): void;
  /** Rebuild tier-dependent resources (particle counts, simulation sizes). */
  setQuality?(profile: Readonly<QualityProfile>): void;
  /** Work that must happen before the main render, e.g. GPGPU passes. */
  prerender?(renderer: WebGLRenderer, frame: FrameState): void;
  /** Pointer interaction hooks with NDC coordinates. */
  onPointerDown?(x: number, y: number, e: PointerEvent): void;
  onPointerMove?(x: number, y: number, e: PointerEvent): void;
  onPointerUp?(x: number, y: number, e: PointerEvent): void;
  onWheel?(delta: number, e: WheelEvent): void;
  /** Zoom by a factor (>1 zooms out) — wheel and pinch both arrive here. */
  onZoom?(factor: number): void;
  /** Keyboard input forwarded from a focused interaction surface. */
  onKey?(key: string): boolean;
  dispose(): void;
}

export type SceneFactory = (ctx: StageContext, params: SceneParams) => StageScene | Promise<StageScene>;

export type { QualityTier };

import {
  BloomEffect,
  ChromaticAberrationEffect,
  Effect,
  EffectComposer,
  EffectPass,
  RenderPass,
  ShaderPass,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
} from 'postprocessing';
import {
  HalfFloatType,
  ShaderMaterial,
  Uniform,
  Vector2,
  type Camera,
  type Scene,
  type WebGLRenderer,
} from 'three';
import { damp } from '../lib/math.ts';
import type { QualityProfile } from './quality.ts';
import { glsl, spectrum } from './shaders/chunks.ts';
import type { PostSettings } from './types.ts';

export const DEFAULT_POST: PostSettings = {
  bloomIntensity: 0.85,
  bloomThreshold: 0.32,
  bloomRadius: 0.72,
  vignette: 0.62,
  aberration: 0.55,
  exposure: 1,
};

/**
 * The "lens" — one merged per-pixel effect that adds:
 *  - speed glow: exposure lifts slightly with scroll velocity (the matching
 *    colour fringing is driven through the chromatic aberration offset, since
 *    UV-warping effects cannot share a pass with convolution effects);
 *  - spectral vision: luminance re-mapped onto the visible spectrum (the
 *    easter-egg alternate mode), with a slow sweeping "scan".
 */
class LensEffect extends Effect {
  constructor() {
    super(
      'LensEffect',
      glsl`
      uniform float uWarp;
      uniform float uSpectral;
      uniform float uTime;
      uniform float uExposure;
      ${spectrum}

      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        vec3 col = inputColor.rgb * uExposure * (1.0 + uWarp * 1.5);
        if (uSpectral > 0.001) {
          float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
          float nm = mix(700.0, 390.0, clamp(pow(max(l, 0.0), 0.55) + 0.08 * sin(uv.y * 6.0 + uTime * 0.6), 0.0, 1.0));
          vec3 false_color = wavelengthToRgb(nm) * (0.25 + 1.6 * sqrt(l));
          float scan = smoothstep(0.0, 0.004, abs(fract(uv.y * 0.5 - uTime * 0.05) - 0.5) - 0.497);
          col = mix(col, false_color + scan * 0.06, uSpectral);
        }
        outputColor = vec4(col, inputColor.a);
      }
    `,
      {
        uniforms: new Map<string, Uniform>([
          ['uWarp', new Uniform(0)],
          ['uSpectral', new Uniform(0)],
          ['uTime', new Uniform(0)],
          ['uExposure', new Uniform(1)],
        ]),
      },
    );
  }

  set(name: 'uWarp' | 'uSpectral' | 'uTime' | 'uExposure', value: number): void {
    const u = this.uniforms.get(name);
    if (u) u.value = value;
  }
}

/**
 * Replaces any NaN or infinity in the scene render with black before bloom
 * sees it. A single invalid pixel would otherwise be smeared by the mip chain
 * across the entire frame — one misbehaving driver must not black out a page.
 */
function nanGuard(): ShaderPass {
  return new ShaderPass(
    new ShaderMaterial({
      uniforms: { inputBuffer: { value: null } },
      vertexShader: glsl`
        varying vec2 vUv;
        void main() {
          vUv = position.xy * 0.5 + 0.5;
          gl_Position = vec4(position.xy, 1.0, 1.0);
        }
      `,
      fragmentShader: glsl`
        uniform sampler2D inputBuffer;
        varying vec2 vUv;
        void main() {
          vec4 c = texture2D(inputBuffer, vUv);
          bvec4 valid = equal(c, c);
          c = vec4(valid.x ? c.x : 0.0, valid.y ? c.y : 0.0, valid.z ? c.z : 0.0, valid.w ? c.w : 1.0);
          gl_FragColor = clamp(c, vec4(0.0), vec4(60000.0));
        }
      `,
      depthTest: false,
      depthWrite: false,
    }),
  );
}

export interface PostExtras {
  /** Signed scroll velocity in px/s. */
  scrollVelocity: number;
  spectral: boolean;
  time: number;
}

/**
 * Wraps pmndrs/postprocessing with scene-aware settings that ease smoothly
 * when the stage changes scenes, so bloom never "pops".
 */
export class Post {
  readonly composer: EffectComposer;
  private readonly renderPass: RenderPass;
  private readonly bloom: BloomEffect;
  private readonly aberration: ChromaticAberrationEffect;
  private readonly vignette: VignetteEffect;
  private readonly lens: LensEffect;
  private readonly effectPass: EffectPass;
  private readonly current: PostSettings = { ...DEFAULT_POST };
  private readonly target: PostSettings = { ...DEFAULT_POST };
  private warp = 0;
  private spectral = 0;
  private readonly aberrationOffset = new Vector2();

  constructor(renderer: WebGLRenderer, scene: Scene, camera: Camera, profile: QualityProfile) {
    this.composer = new EffectComposer(renderer, {
      frameBufferType: HalfFloatType,
      multisampling: profile.msaa,
    });
    this.renderPass = new RenderPass(scene, camera);
    this.bloom = new BloomEffect({
      mipmapBlur: true,
      luminanceThreshold: DEFAULT_POST.bloomThreshold,
      luminanceSmoothing: 0.35,
      intensity: DEFAULT_POST.bloomIntensity,
      radius: DEFAULT_POST.bloomRadius,
      levels: profile.tier === 'ultra' ? 8 : 6,
    });
    this.aberration = new ChromaticAberrationEffect({
      offset: this.aberrationOffset,
      radialModulation: true,
      modulationOffset: 0.35,
    });
    this.vignette = new VignetteEffect({ offset: 0.32, darkness: DEFAULT_POST.vignette });
    this.lens = new LensEffect();
    const tone = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });
    this.effectPass = new EffectPass(camera, this.bloom, this.aberration, this.lens, this.vignette, tone);
    this.composer.addPass(this.renderPass);
    this.composer.addPass(nanGuard());
    this.composer.addPass(this.effectPass);
  }

  setScene(scene: Scene, camera: Camera): void {
    this.renderPass.mainScene = scene;
    this.renderPass.mainCamera = camera;
    this.effectPass.mainCamera = camera;
  }

  /** Called every frame with the active scene's preferences; allocation-free. */
  setTarget(settings: Partial<PostSettings> | undefined): void {
    Object.assign(this.target, DEFAULT_POST);
    if (settings) Object.assign(this.target, settings);
  }

  /** Jump straight to the target (used on first scene mount). */
  snap(): void {
    Object.assign(this.current, this.target);
  }

  update(dt: number, extras: PostExtras): void {
    const c = this.current;
    const t = this.target;
    const k = 3.2;
    c.bloomIntensity = damp(c.bloomIntensity, t.bloomIntensity, k, dt);
    c.bloomThreshold = damp(c.bloomThreshold, t.bloomThreshold, k, dt);
    c.bloomRadius = damp(c.bloomRadius, t.bloomRadius, k, dt);
    c.vignette = damp(c.vignette, t.vignette, k, dt);
    c.aberration = damp(c.aberration, t.aberration, k, dt);
    c.exposure = damp(c.exposure, t.exposure, k, dt);

    this.bloom.intensity = c.bloomIntensity;
    this.bloom.luminanceMaterial.threshold = c.bloomThreshold;
    this.bloom.mipmapBlurPass.radius = c.bloomRadius;
    this.vignette.darkness = c.vignette;

    const speed = Math.min(1, Math.abs(extras.scrollVelocity) / 4000);
    this.warp = damp(this.warp, speed * 0.06, 6, dt);
    this.spectral = damp(this.spectral, extras.spectral ? 1 : 0, 2.5, dt);
    const ab = (0.0006 + this.warp * 0.02 + this.spectral * 0.003) * c.aberration;
    this.aberrationOffset.set(ab, ab * 0.6);
    this.lens.set('uWarp', this.warp);
    this.lens.set('uSpectral', this.spectral);
    this.lens.set('uTime', extras.time);
    this.lens.set('uExposure', c.exposure);
  }

  render(delta: number): void {
    this.composer.render(delta);
  }

  setSize(width: number, height: number): void {
    this.composer.setSize(width, height, false);
  }

  dispose(): void {
    this.composer.dispose();
  }
}

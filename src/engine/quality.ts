import type { QualityTier } from '../stores/settings.ts';

/**
 * The graphics quality system. A tier maps to concrete numbers every scene
 * reads, so "quality" is never a vague flag scattered through the code.
 */
export interface QualityProfile {
  tier: QualityTier;
  /** Upper bound for devicePixelRatio. */
  maxDpr: number;
  /** Multiplier applied to every particle budget. */
  particleScale: number;
  /** Run the post-processing composer at all. */
  post: boolean;
  /** Multisample count for the composer's input buffer. */
  msaa: number;
  /** Side length of GPGPU state textures (count = side²). */
  gpgpuSide: number;
  /** Resolution of simulated fields (waves, heightmaps). */
  fieldResolution: number;
  /** 0–1 knob for loop counts inside shaders (fbm octaves, march steps). */
  shaderDetail: number;
  /** 0 = uncapped; otherwise the maximum frames per second for ambient scenes. */
  fpsCap: number;
}

export const QUALITY_PROFILES: Record<QualityTier, QualityProfile> = {
  ultra: {
    tier: 'ultra',
    maxDpr: 2,
    particleScale: 1,
    post: true,
    msaa: 4,
    gpgpuSide: 1024,
    fieldResolution: 512,
    shaderDetail: 1,
    fpsCap: 0,
  },
  high: {
    tier: 'high',
    maxDpr: 1.75,
    particleScale: 0.6,
    post: true,
    msaa: 4,
    gpgpuSide: 512,
    fieldResolution: 256,
    shaderDetail: 0.8,
    fpsCap: 0,
  },
  balanced: {
    tier: 'balanced',
    maxDpr: 1.35,
    particleScale: 0.32,
    post: true,
    msaa: 0,
    gpgpuSide: 256,
    fieldResolution: 192,
    shaderDetail: 0.55,
    fpsCap: 0,
  },
  eco: {
    tier: 'eco',
    maxDpr: 1,
    particleScale: 0.12,
    post: false,
    msaa: 0,
    gpgpuSide: 128,
    fieldResolution: 96,
    shaderDetail: 0.3,
    fpsCap: 30,
  },
};

const TIER_ORDER: readonly QualityTier[] = ['eco', 'balanced', 'high', 'ultra'];

export const tierIndex = (tier: QualityTier): number => TIER_ORDER.indexOf(tier);
export const tierAt = (index: number): QualityTier =>
  TIER_ORDER[Math.max(0, Math.min(TIER_ORDER.length - 1, index))] as QualityTier;

export interface DeviceSignals {
  renderer: string;
  cores: number;
  memoryGb: number | null;
  coarsePointer: boolean;
  /** CSS pixel area × dpr², i.e. physical pixels to fill. */
  physicalPixels: number;
  saveData: boolean;
  maxTextureSize: number;
  floatRenderable: boolean;
}

const SOFTWARE = /swiftshader|llvmpipe|softpipe|basic render|microsoft basic|software/i;
const DISCRETE_HIGH =
  /rtx\s?[2-9]\d{3}|rtx\s?a\d{3,4}|radeon rx\s?[67]\d{3}|radeon rx\s?9\d{3}|apple m[2-9]|apple m1 (pro|max|ultra)|arc a7/i;
const DISCRETE_MID =
  /gtx\s?1[06-9]\d{2}|gtx\s?16\d{2}|rtx|radeon rx|radeon pro|apple m1|apple gpu|arc|geforce/i;
const MOBILE_HIGH =
  /adreno.*(7[3-9]\d|8\d\d)|mali-g7[1-9]|mali-g[89]\d\d|immortalis|apple a1[6-9]|apple a[2-9]\d/i;
const MOBILE_LOW = /adreno.*[1-5]\d\d|mali-[4t]|mali-g[1-5]\d|powervr|videocore/i;

/**
 * Classifies the device from cheap signals. The result is a starting point:
 * the performance monitor refines it with measured frame times.
 */
export function classifyDevice(s: DeviceSignals): QualityTier {
  if (SOFTWARE.test(s.renderer)) return 'eco';
  if (s.saveData) return 'eco';
  if ((s.memoryGb !== null && s.memoryGb <= 2) || s.cores <= 2) return 'eco';
  if (!s.floatRenderable) return 'eco';

  let tier: QualityTier;
  if (s.coarsePointer) {
    tier = MOBILE_HIGH.test(s.renderer) ? 'high' : MOBILE_LOW.test(s.renderer) ? 'eco' : 'balanced';
  } else if (DISCRETE_HIGH.test(s.renderer)) tier = 'ultra';
  else if (DISCRETE_MID.test(s.renderer)) tier = 'high';
  else tier = 'balanced';

  // Very large physical canvases (5K, dense ultrawide) are fill-rate bound.
  if (s.physicalPixels > 11_000_000 && tier === 'ultra') tier = 'high';
  if (s.maxTextureSize < 8192 && tierIndex(tier) > tierIndex('balanced')) tier = 'balanced';
  return tier;
}

/** Reads device signals from a live WebGL2 context. */
export function readDeviceSignals(gl: WebGL2RenderingContext): DeviceSignals {
  const debug = gl.getExtension('WEBGL_debug_renderer_info');
  const renderer = debug
    ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL))
    : String(gl.getParameter(gl.RENDERER));
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  const dpr = window.devicePixelRatio || 1;
  return {
    renderer,
    cores: navigator.hardwareConcurrency || 4,
    memoryGb: typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null,
    coarsePointer: window.matchMedia('(pointer: coarse)').matches,
    physicalPixels: window.innerWidth * window.innerHeight * dpr * dpr,
    saveData: nav.connection?.saveData === true,
    maxTextureSize: Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)),
    floatRenderable: gl.getExtension('EXT_color_buffer_float') !== null,
  };
}

/** Friendly GPU label for the settings panel. */
export function describeRenderer(renderer: string): string {
  const angle = /ANGLE \(([^,]+),\s*([^,(]+)/.exec(renderer);
  const label = angle ? `${angle[2] ?? ''}`.trim() : renderer;
  return (
    label
      .replace(/\s+Direct3D.*$/i, '')
      .replace(/\s+\(0x[0-9a-f]+\)/i, '')
      .slice(0, 64) || 'Unknown GPU'
  );
}

import { describe, expect, it } from 'vitest';
import {
  classifyDevice,
  describeRenderer,
  QUALITY_PROFILES,
  tierAt,
  tierIndex,
  type DeviceSignals,
} from './quality.ts';

const base: DeviceSignals = {
  renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0, D3D11)',
  cores: 12,
  memoryGb: 16,
  coarsePointer: false,
  physicalPixels: 1920 * 1080,
  saveData: false,
  maxTextureSize: 16384,
  floatRenderable: true,
};

describe('quality classification', () => {
  it('gives strong discrete GPUs the ultra tier', () => {
    expect(classifyDevice(base)).toBe('ultra');
  });

  it('steps down for enormous canvases', () => {
    expect(classifyDevice({ ...base, physicalPixels: 5120 * 2880 })).toBe('high');
  });

  it('treats integrated graphics as balanced', () => {
    expect(
      classifyDevice({
        ...base,
        renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)',
      }),
    ).toBe('balanced');
  });

  it('protects weak, software or data-saving devices', () => {
    expect(classifyDevice({ ...base, renderer: 'Google SwiftShader' })).toBe('eco');
    expect(classifyDevice({ ...base, saveData: true })).toBe('eco');
    expect(classifyDevice({ ...base, memoryGb: 2 })).toBe('eco');
    expect(classifyDevice({ ...base, floatRenderable: false })).toBe('eco');
  });

  it('reads mobile GPUs', () => {
    expect(classifyDevice({ ...base, coarsePointer: true, renderer: 'Apple GPU' })).toBe('balanced');
    expect(classifyDevice({ ...base, coarsePointer: true, renderer: 'Adreno (TM) 740' })).toBe('high');
    expect(classifyDevice({ ...base, coarsePointer: true, renderer: 'Mali-G52' })).toBe('eco');
  });

  it('orders tiers and clamps stepping', () => {
    expect(tierAt(tierIndex('eco') - 1)).toBe('eco');
    expect(tierAt(tierIndex('ultra') + 1)).toBe('ultra');
    expect(QUALITY_PROFILES.eco.post).toBe(false);
    expect(QUALITY_PROFILES.ultra.gpgpuSide).toBeGreaterThan(QUALITY_PROFILES.eco.gpgpuSide);
  });

  it('turns renderer strings into friendly labels', () => {
    expect(describeRenderer(base.renderer)).toBe('NVIDIA GeForce RTX 4070');
    expect(describeRenderer('')).toBe('Unknown GPU');
  });
});

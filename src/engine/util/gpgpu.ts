import { FloatType, HalfFloatType, type DataTexture, type WebGLRenderer } from 'three';
import { GPUComputationRenderer, type Variable } from 'three/examples/jsm/misc/GPUComputationRenderer.js';

/**
 * Thin wrapper over three's GPUComputationRenderer: picks full-float state
 * textures where the device can render to them and half-float elsewhere, and
 * exposes typed uniform access for compute variables.
 */
export class Gpgpu {
  readonly compute: GPUComputationRenderer;
  readonly side: number;

  constructor(renderer: WebGLRenderer, side: number) {
    this.side = side;
    this.compute = new GPUComputationRenderer(side, side, renderer);
    const floatRenderable = renderer.extensions.has('EXT_color_buffer_float');
    this.compute.setDataType(floatRenderable ? FloatType : HalfFloatType);
  }

  /** Creates a state texture and lets `fill` write RGBA for each texel index. */
  texture(fill: (data: Float32Array, index: number) => void): DataTexture {
    const texture = this.compute.createTexture();
    const data = texture.image.data as Float32Array;
    for (let i = 0; i < this.side * this.side; i++) fill(data, i);
    return texture;
  }

  variable(name: string, shader: string, initial: DataTexture, uniforms: Record<string, unknown> = {}): Variable {
    const variable = this.compute.addVariable(name, shader, initial);
    for (const [key, value] of Object.entries(uniforms)) variable.material.uniforms[key] = { value };
    return variable;
  }

  init(): void {
    const error = this.compute.init();
    if (error) throw new Error(`GPGPU init failed: ${error}`);
  }

  current(variable: Variable) {
    return this.compute.getCurrentRenderTarget(variable).texture;
  }

  dispose(): void {
    this.compute.dispose();
  }
}

/** Per-particle UV lookup attribute for rendering `side²` points from a state texture. */
export function referenceUvs(side: number): Float32Array {
  const uvs = new Float32Array(side * side * 2);
  for (let i = 0; i < side * side; i++) {
    uvs[i * 2] = ((i % side) + 0.5) / side;
    uvs[i * 2 + 1] = (Math.floor(i / side) + 0.5) / side;
  }
  return uvs;
}

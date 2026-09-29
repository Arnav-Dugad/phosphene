import {
  BufferGeometry,
  Float32BufferAttribute,
  HalfFloatType,
  LinearFilter,
  Mesh,
  OrthographicCamera,
  Scene,
  ShaderMaterial,
  WebGLRenderTarget,
  type Camera,
  type Texture,
  type WebGLRenderer,
} from 'three';
import { glsl } from '../shaders/chunks.ts';
import type { Viewport } from '../types.ts';

const vertex = glsl`
  varying vec2 vUv;
  void main() {
    vUv = position.xy * 0.5 + 0.5;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fade = glsl`
  uniform sampler2D uPrevious;
  uniform float uFade;
  varying vec2 vUv;
  void main() {
    gl_FragColor = texture2D(uPrevious, vUv) * uFade;
  }
`;

const display = glsl`
  uniform sampler2D uTrails;
  varying vec2 vUv;
  void main() {
    gl_FragColor = vec4(texture2D(uTrails, vUv).rgb, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const fullscreen = (): BufferGeometry => {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  return g;
};

/**
 * Afterimage accumulation: each frame the previous image is faded and the new
 * light is added on top — the persistence of vision the site is named for.
 * `mesh` is a full-screen quad that displays the result in a host scene.
 */
export class TrailBuffer {
  readonly mesh: Mesh<BufferGeometry, ShaderMaterial>;
  private targets: [WebGLRenderTarget, WebGLRenderTarget];
  private readonly fadeScene = new Scene();
  private readonly fadeMaterial: ShaderMaterial;
  private readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly scale: number;

  constructor(viewport: Readonly<Viewport>, scale: number) {
    this.scale = scale;
    this.targets = [this.makeTarget(viewport), this.makeTarget(viewport)];
    this.fadeMaterial = new ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fade,
      uniforms: { uPrevious: { value: null }, uFade: { value: 0.92 } },
      depthTest: false,
      depthWrite: false,
    });
    const fadeMesh = new Mesh(fullscreen(), this.fadeMaterial);
    fadeMesh.frustumCulled = false;
    this.fadeScene.add(fadeMesh);
    this.mesh = new Mesh(
      fullscreen(),
      new ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: display,
        uniforms: { uTrails: { value: null } },
        depthTest: false,
        depthWrite: false,
      }),
    );
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1;
  }

  private makeTarget(viewport: Readonly<Viewport>): WebGLRenderTarget {
    return new WebGLRenderTarget(
      Math.max(2, Math.round(viewport.width * viewport.dpr * this.scale)),
      Math.max(2, Math.round(viewport.height * viewport.dpr * this.scale)),
      { type: HalfFloatType, minFilter: LinearFilter, magFilter: LinearFilter, depthBuffer: false },
    );
  }

  resize(viewport: Readonly<Viewport>): void {
    for (const t of this.targets) t.dispose();
    this.targets = [this.makeTarget(viewport), this.makeTarget(viewport)];
  }

  clear(renderer: WebGLRenderer): void {
    const previous = renderer.getRenderTarget();
    for (const t of this.targets) {
      renderer.setRenderTarget(t);
      renderer.clear();
    }
    renderer.setRenderTarget(previous);
  }

  /** Fades the history by `persistence`, draws `scene` on top, and swaps. */
  accumulate(renderer: WebGLRenderer, scene: Scene, camera: Camera, persistence: number): Texture {
    const [read, write] = this.targets;
    (this.fadeMaterial.uniforms.uPrevious as { value: unknown }).value = read.texture;
    (this.fadeMaterial.uniforms.uFade as { value: number }).value = persistence;
    const previous = renderer.getRenderTarget();
    const autoClear = renderer.autoClear;
    renderer.autoClear = false;
    renderer.setRenderTarget(write);
    renderer.clear();
    renderer.render(this.fadeScene, this.camera);
    renderer.render(scene, camera);
    renderer.setRenderTarget(previous);
    renderer.autoClear = autoClear;
    this.targets = [write, read];
    (this.mesh.material.uniforms.uTrails as { value: unknown }).value = write.texture;
    return write.texture;
  }

  dispose(): void {
    for (const t of this.targets) t.dispose();
    this.fadeMaterial.dispose();
    this.fadeScene.clear();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}

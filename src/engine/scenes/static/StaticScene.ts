import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Mesh,
  OrthographicCamera,
  Scene,
  ShaderMaterial,
  Vector2,
} from 'three';
import { spectralLines, spectralOrder } from '../../../design/tokens.ts';
import { clamp, damp } from '../../../lib/math.ts';
import type { SceneParams } from '../../../stores/stage.ts';
import { gauss, glsl, hash } from '../../shaders/chunks.ts';
import type {
  FrameState,
  PostSettings,
  SceneFactory,
  StageContext,
  StageScene,
  Viewport,
} from '../../types.ts';

/**
 * Lost signal: receiver snow with a rolling vertical hold, and underneath it
 * the Lacuna and the seven lines of the carrier. `clarity` (0–1, from the
 * page's tuning dial) steadies the roll, clears the snow and lets the image
 * through.
 */
const vertex = glsl`
  varying vec2 vUv;
  void main() {
    vUv = position.xy * 0.5 + 0.5;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragment = glsl`
  uniform float uTime;
  uniform float uClarity;
  uniform float uRoll;
  uniform vec2 uResolution;
  uniform vec3 uLines[7];
  uniform vec3 uRing;
  varying vec2 vUv;
  ${hash}
  ${gauss}

  vec3 signalImage(vec2 p) {
    // The carrier: seven soft horizontal bands, one per spectral line.
    vec3 col = vec3(0.0);
    for (int i = 0; i < 7; i++) {
      float y = (float(i) - 3.0) * 0.085;
      col += uLines[i] * gauss((p.y - y) / 0.012) * 0.22;
    }
    // The Lacuna: a ring of light around a void.
    float r = length(p);
    float ring = gauss((r - 0.26) / 0.008) * 1.6 + exp(-abs(r - 0.26) * 28.0) * 0.35;
    col *= smoothstep(0.2, 0.3, r);
    col += uRing * ring;
    col += uRing * gauss(r / 0.012) * 0.8;
    return col;
  }

  void main() {
    vec2 frag = vUv * uResolution;
    float t = uTime;
    float unsteady = 1.0 - uClarity;

    // Vertical hold: the picture rolls until the dial finds the frequency.
    vec2 uv = vUv;
    uv.y = fract(uv.y + uRoll);
    // Horizontal tearing, strongest in bands, fading as the signal steadies.
    float band = step(0.82, hash12(vec2(floor(uv.y * 24.0), floor(t * 9.0))));
    uv.x += (hash12(vec2(floor(uv.y * 180.0), floor(t * 30.0))) - 0.5) * 0.06 * unsteady * (0.3 + band);

    vec2 p = (uv - 0.5) * vec2(uResolution.x / uResolution.y, 1.0);
    vec3 signal = signalImage(p);

    // Snow: coarse grains that change every frame, brighter where the signal is weakest.
    vec2 grain = floor(frag / 2.0);
    float n = hash12(grain + vec2(floor(t * 24.0) * 17.0, floor(t * 24.0) * 131.0));
    float snow = n * n * n * (0.1 + 0.5 * unsteady) + n * 0.035;
    float scan = 0.85 + 0.15 * sin(frag.y * 3.14159);
    float bar = smoothstep(0.0, 0.12, abs(fract(vUv.y * 0.5 - t * 0.07) - 0.5)) * 0.25 + 0.75;

    vec3 col = vec3(snow) * vec3(0.72, 0.78, 0.9) * mix(1.0, bar, unsteady);
    col += signal * (0.08 + 0.92 * uClarity * uClarity);
    col *= scan;
    col *= 0.94 + 0.06 * sin(t * 50.0) * unsteady;
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

class StaticScene implements StageScene {
  readonly scene = new Scene();
  readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  readonly post: Partial<PostSettings> = {
    bloomIntensity: 1.2,
    bloomThreshold: 0.45,
    vignette: 0.9,
    aberration: 1.2,
  };

  private readonly mesh: Mesh<BufferGeometry, ShaderMaterial>;
  private clarity = 0;
  private clarityGoal = 0;
  private roll = 0;

  constructor(_ctx: StageContext, params: SceneParams) {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    this.mesh = new Mesh(
      geometry,
      new ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        depthTest: false,
        depthWrite: false,
        uniforms: {
          uTime: { value: 0 },
          uClarity: { value: 0 },
          uRoll: { value: 0 },
          uResolution: { value: new Vector2(1, 1) },
          uLines: { value: spectralOrder.map((key) => new Color(spectralLines[key].nocturne)) },
          uRing: { value: new Color(spectralLines.na.nocturne) },
        },
      }),
    );
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
    this.setParams(params);
  }

  setParams(params: SceneParams): void {
    if (typeof params.clarity === 'number') this.clarityGoal = clamp(params.clarity);
  }

  resize(viewport: Readonly<Viewport>): void {
    (this.mesh.material.uniforms.uResolution as { value: Vector2 }).value.set(
      viewport.width,
      viewport.height,
    );
  }

  update(frame: FrameState): void {
    const raw = Math.min(frame.rawDelta, 0.1);
    const still = frame.motion === 'still';
    this.clarity = damp(this.clarity, this.clarityGoal, still ? 1000 : 6, raw);
    // The roll slows as the signal steadies and stops once it is found.
    if (!still) this.roll = (this.roll + raw * 0.9 * Math.pow(1 - this.clarity, 1.5)) % 1;
    const u = this.mesh.material.uniforms;
    (u.uTime as { value: number }).value = still ? 0 : frame.time;
    (u.uClarity as { value: number }).value = this.clarity;
    (u.uRoll as { value: number }).value = this.roll;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.scene.clear();
  }
}

const create: SceneFactory = (ctx, params) => new StaticScene(ctx, params);
export default create;
export type { StaticScene };

import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Mesh,
  ShaderMaterial,
  Vector3,
  Vector4,
  type PerspectiveCamera,
} from 'three';
import { gauss, glsl, hash } from '../../shaders/chunks.ts';
import { getNoiseTexture, noiseTextureGlsl } from '../../textures/noiseTexture.ts';
import { RING } from './formations.ts';

export const MAX_RIPPLES = 16;

/**
 * The Lacuna environment is drawn by a single full-screen shader that
 * ray-traces an analytic world: a gradient sky with procedural stars, the
 * luminous ring (an exact ray–plane intersection) and a mirror-black sea.
 *
 * Sea pixels do not evaluate the sky twice: they bend their ray by the wave
 * and ripple normal and continue as a reflected ray, so the sky has a single
 * call site (the ring has two: the reflection, and its light hanging in front
 * of the water). That keeps the shader small — important on Windows, where
 * ANGLE's Direct3D compiler inlines every call site and unrolls every
 * constant-bound loop — and it keeps the cost per pixel nearly flat.
 */
function fragmentShader(detail: number): string {
  const twoStarLayers = detail > 0.5;
  return glsl`
  uniform mat4 uInvProj;
  uniform mat4 uCamWorld;
  uniform vec3 uCamPos;
  uniform float uTime;
  uniform vec3 uRingCenter;
  uniform float uRingRadius;
  uniform float uRingIntensity;
  uniform vec3 uRingColor;
  uniform vec3 uHaloColor;
  uniform vec3 uTint;
  uniform float uSeaRough;
  uniform vec4 uRipples[${MAX_RIPPLES}];
  uniform int uRippleCount;
  uniform float uStars;
  uniform float uBeyond;
  uniform float uFade;
  uniform float uPulse;
  varying vec2 vUv;

  ${hash}
  ${gauss}
  ${noiseTextureGlsl}

  const float TAU = 6.28318530718;

  vec3 starField(vec3 dir, float scale, float threshold, float gain) {
    vec3 p = dir * scale;
    vec3 cell = floor(p);
    vec3 f = fract(p) - 0.5;
    float h = hash13(cell);
    if (h < threshold) return vec3(0.0);
    vec3 offset = vec3(hash13(cell + 1.31), hash13(cell + 7.17), hash13(cell + 3.73)) - 0.5;
    float dist = length(f - offset * 0.62);
    float size = mix(0.018, 0.075, pow(hash13(cell + 11.0), 6.0));
    float twinkle = 0.7 + 0.3 * sin(uTime * (0.6 + 2.8 * h) + h * 91.0);
    float intensity = smoothstep(size, 0.0, dist) * twinkle * (h - threshold) / (1.0 - threshold);
    vec3 tint = mix(vec3(1.0, 0.78, 0.6), vec3(0.72, 0.84, 1.0), hash13(cell + 5.5));
    return tint * intensity * gain;
  }

  // Direction → tileable 2D coordinates (integer repeats keep the seam invisible).
  vec2 skyUv(vec3 rd) {
    return vec2(atan(rd.x, -rd.z) / TAU * 3.0, asin(clamp(rd.y, -1.0, 1.0)) / 3.14159265 * 1.5);
  }

  vec3 horizonColor() {
    return vec3(0.008, 0.007, 0.008) + uTint * 0.01 + uHaloColor * 0.028 * uRingIntensity;
  }

  // The ring: an exact intersection with its plane. Emissive light, not a surface.
  vec3 ringLight(vec3 ro, vec3 rd, out float inner) {
    inner = 0.0;
    if (abs(rd.z) < 1e-4) return vec3(0.0);
    float t = (uRingCenter.z - ro.z) / rd.z;
    if (t <= 0.0) return vec3(0.0);
    vec3 hit = ro + rd * t;
    vec2 p = hit.xy - uRingCenter.xy;
    float d = (length(p) - uRingRadius) / uRingRadius;
    // The halo belongs to the air: it thins to nothing at the waterline, so the
    // line where the ring's plane meets the sea never shows as a seam.
    float air = smoothstep(-0.02, 0.9, hit.y);
    float a = atan(p.y, p.x);
    float breath = 1.0 + 0.06 * sin(uTime * 0.7) + uPulse * 0.6;
    float core = gauss(d / 0.011);
    float glow = exp(-abs(d) / 0.04) * 0.5;
    float halo = exp(-abs(d) / 0.2) * 0.06;
    float n = noiseFbm(vec2(a / TAU * 3.0 + uTime * 0.004, uTime * 0.012 + max(d, 0.0) * 0.35));
    float flare = smoothstep(0.0, 0.03, d) * exp(-d / (0.06 + 0.42 * n * n)) * n * n * 0.7;
    float beaming = 1.0 + 0.5 * cos(a - 2.35);
    inner = smoothstep(0.02, -0.12, d);
    return (uRingColor * core * 3.2 * smoothstep(-0.02, 0.12, hit.y) + uHaloColor * (glow + halo + flare) * beaming * air)
      * uRingIntensity * breath;
  }

  // Sky: gradient, horizon glow, nebula, stars (dimmed inside the ring's void).
  vec3 skyLight(vec3 rd, float inner) {
    float h = rd.y;
    vec3 zenith = vec3(0.0012, 0.0014, 0.0026);
    vec3 col = mix(vec3(0.008, 0.007, 0.008) + uTint * 0.01, zenith, smoothstep(-0.02, 0.5, h));
    col += uHaloColor * exp(-abs(h) * 70.0) * 0.028 * uRingIntensity;
    vec2 suv = skyUv(rd);
    float nebula = noiseFbm(suv * 1.3 + vec2(uTime * 0.0015, 0.0));
    col += uTint * pow(nebula, 4.0) * 0.028;
    col += mix(uTint, uHaloColor, 0.5) * uBeyond * (0.02 + 0.09 * pow(noiseFbm(suv * 2.1 + 0.5), 2.0));
    vec3 stars = starField(rd, 230.0, 0.9, 1.0);
    ${twoStarLayers ? 'stars += starField(rd, 70.0, 0.975, 2.4);' : ''}
    col += stars * uStars * (1.0 - inner * 0.85) * smoothstep(-0.02, 0.08, rd.y);
    col += uHaloColor * inner * 0.012 * uRingIntensity;
    return col;
  }

  vec2 seaGradient(vec2 p) {
    vec2 d1 = vec2(0.287, 0.958);
    vec2 d2 = vec2(-0.8, 0.6);
    vec2 d3 = vec2(0.976, 0.217);
    float w1 = dot(d1, p) * 0.9 + uTime * 0.7;
    float w2 = dot(d2, p) * 1.7 + uTime * 1.1;
    float w3 = dot(d3, p) * 3.1 + uTime * 1.6;
    vec2 grad = (d1 * cos(w1) * 0.0085 + d2 * cos(w2) * 0.0085 + d3 * cos(w3) * 0.0075) * uSeaRough;
    // Pointer and tap ripples: expanding wave packets that interfere naturally.
    for (int i = 0; i < uRippleCount; i++) {
      vec4 r = uRipples[i];
      float age = uTime - r.z;
      if (r.w <= 0.0 || age < 0.0 || age > 7.0) continue;
      vec2 dp = p - r.xy;
      float dist = length(dp) + 1e-4;
      float x = dist - age * 1.9;
      float env = exp(-x * x * 0.9) * exp(-age * 0.55) * r.w / (1.0 + dist * 0.6);
      grad += cos(x * 6.5) * 0.24 * env * (dp / dist);
    }
    return grad;
  }

  void main() {
    vec4 ndc = vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
    vec4 view = uInvProj * ndc;
    view /= view.w;
    vec3 rd = normalize((uCamWorld * vec4(view.xyz, 0.0)).xyz);
    vec3 ro = uCamPos;

    float sea = 0.0;
    float fresnel = 0.0;
    float fog = 0.0;
    vec3 front = vec3(0.0);
    if (rd.y < -0.0004 && ro.y > 0.0) {
      float t = -ro.y / rd.y;
      // The ring may hang between the eye and the water: its light is in front.
      float tRing = abs(rd.z) > 1e-4 ? (uRingCenter.z - ro.z) / rd.z : -1.0;
      if (tRing > 0.0 && tRing < t) {
        float ignored;
        front = ringLight(ro, rd, ignored);
      }
      vec3 p = ro + rd * t;
      vec2 grad = seaGradient(p.xz);
      vec3 n = normalize(vec3(-grad.x, 1.0, -grad.y));
      fresnel = 0.02 + 0.98 * pow(1.0 - max(dot(-rd, n), 0.0), 5.0);
      vec3 rr = reflect(rd, n);
      rr.y = abs(rr.y) + 0.001;
      ro = p;
      rd = normalize(rr);
      fog = 1.0 - exp(-t * 0.011);
      sea = 1.0;
    }

    float inner;
    vec3 ring = ringLight(ro, rd, inner);
    vec3 col = skyLight(rd, inner) + ring;
    if (sea > 0.5) {
      vec3 water = vec3(0.0009, 0.0012, 0.0019) + uTint * 0.0015;
      col = mix(water, col, clamp(fresnel * 1.15, 0.0, 1.0));
      col = mix(col, horizonColor(), fog * 0.55);
      col += front;
    }

    gl_FragColor = vec4(col * uFade, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
  `;
}

const vertexShader = glsl`
  varying vec2 vUv;
  void main() {
    vUv = position.xy * 0.5 + 0.5;
    gl_Position = vec4(position.xy, 1.0, 1.0);
  }
`;

export interface EnvironmentUniforms {
  ringRadius: number;
  ringIntensity: number;
  ringColor: Color;
  haloColor: Color;
  tint: Color;
  seaRough: number;
  stars: number;
  beyond: number;
  fade: number;
  pulse: number;
}

export class Environment {
  readonly mesh: Mesh<BufferGeometry, ShaderMaterial>;
  readonly ripples: Vector4[];
  private rippleCursor = 0;

  constructor(detail: number) {
    const geometry = new BufferGeometry();
    // One oversized triangle covers the viewport with no diagonal seam.
    geometry.setAttribute('position', new Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    this.ripples = Array.from({ length: MAX_RIPPLES }, () => new Vector4(0, 0, -100, 0));
    const material = new ShaderMaterial({
      vertexShader,
      fragmentShader: fragmentShader(detail),
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uInvProj: { value: null },
        uCamWorld: { value: null },
        uCamPos: { value: new Vector3() },
        uTime: { value: 0 },
        uRingCenter: { value: new Vector3(...RING.center) },
        uRingRadius: { value: RING.radius },
        uRingIntensity: { value: 1 },
        uRingColor: { value: new Color('#fff1dc') },
        uHaloColor: { value: new Color('#ffb45e') },
        uTint: { value: new Color('#ffb45e') },
        uSeaRough: { value: 1 },
        uRipples: { value: this.ripples },
        uRippleCount: { value: MAX_RIPPLES },
        uStars: { value: 1 },
        uBeyond: { value: 0 },
        uFade: { value: 1 },
        uPulse: { value: 0 },
        uNoise: { value: getNoiseTexture() },
      },
    });
    this.mesh = new Mesh(geometry, material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1000;
  }

  /** Adds a ripple at a sea-plane position; `strength` in [0, 1.5]. */
  addRipple(x: number, z: number, time: number, strength: number): void {
    const r = this.ripples[this.rippleCursor];
    if (!r) return;
    r.set(x, z, time, strength);
    this.rippleCursor = (this.rippleCursor + 1) % MAX_RIPPLES;
  }

  sync(camera: PerspectiveCamera, time: number, values: EnvironmentUniforms): void {
    const u = this.mesh.material.uniforms;
    (u.uInvProj as { value: unknown }).value = camera.projectionMatrixInverse;
    (u.uCamWorld as { value: unknown }).value = camera.matrixWorld;
    (u.uCamPos as { value: Vector3 }).value.copy(camera.position);
    (u.uTime as { value: number }).value = time;
    (u.uRingRadius as { value: number }).value = values.ringRadius;
    (u.uRingIntensity as { value: number }).value = values.ringIntensity;
    (u.uRingColor as { value: Color }).value.copy(values.ringColor);
    (u.uHaloColor as { value: Color }).value.copy(values.haloColor);
    (u.uTint as { value: Color }).value.copy(values.tint);
    (u.uSeaRough as { value: number }).value = values.seaRough;
    (u.uStars as { value: number }).value = values.stars;
    (u.uBeyond as { value: number }).value = values.beyond;
    (u.uFade as { value: number }).value = values.fade;
    (u.uPulse as { value: number }).value = values.pulse;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}

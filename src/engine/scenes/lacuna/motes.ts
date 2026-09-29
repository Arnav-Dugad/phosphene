import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Points,
  ShaderMaterial,
  Vector3,
} from 'three';
import { spectralLines, spectralOrder } from '../../../design/tokens.ts';
import { clamp } from '../../../lib/math.ts';
import { createRng } from '../../../lib/random.ts';
import { glsl } from '../../shaders/chunks.ts';
import { formation, RING, type FormationKey } from './formations.ts';

const STAGGER = 0.35;

const vertexShader = glsl`
  attribute vec3 aFrom;
  attribute vec3 aTo;
  attribute vec4 aSeed;
  uniform float uTime;
  uniform float uMorph;
  uniform float uLift;
  uniform float uTurbulence;
  uniform float uOrbit;
  uniform float uOrbitMix;
  uniform vec3 uRingCenter;
  uniform vec3 uPointer;
  uniform float uPointerStrength;
  uniform float uSize;
  uniform float uScale;
  uniform float uBrightness;
  uniform float uMirror;
  uniform vec3 uColors[8];
  uniform vec3 uTint;
  uniform float uTintMix;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float delay = aSeed.x * ${STAGGER.toFixed(2)};
    float m = clamp((uMorph - delay) / ${(1 - STAGGER).toFixed(2)}, 0.0, 1.0);
    m = m * m * (3.0 - 2.0 * m);
    vec3 p = mix(aFrom, aTo, m);
    p.y += sin(m * 3.14159265) * (0.4 + aSeed.x) * uLift;

    // Differential orbit about the ring's axis: inner motes circle faster.
    vec2 rel = p.xy - uRingCenter.xy;
    float radius = length(rel);
    float angle = uOrbit * (3.0 / max(radius, 1.5)) * uOrbitMix;
    float s = sin(angle);
    float c = cos(angle);
    p.xy = uRingCenter.xy + mat2(c, -s, s, c) * rel;

    float t = uTime * 0.22 + aSeed.w * 6.2831;
    p += vec3(
      sin(t + p.y * 0.7),
      cos(t * 0.83 + p.x * 0.5),
      sin(t * 0.61 + p.z * 0.4)
    ) * uTurbulence * (0.25 + aSeed.x * 0.75);

    vec3 toPointer = uPointer - p;
    float d = length(toPointer);
    p += toPointer / (d + 0.001) * uPointerStrength * exp(-d * d * 0.22) * 0.9;

    float visible = 1.0;
    if (uMirror > 0.5) {
      visible = step(0.0, p.y);
      p.y = -p.y;
      p.x += sin(p.z * 2.0 + uTime * 1.3) * 0.04 * -p.y;
    }

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float depth = max(0.1, -mv.z);
    gl_PointSize = clamp(uSize * aSeed.y * uScale * (9.0 / depth), 0.0, 64.0);

    vColor = mix(uColors[int(aSeed.z)], uTint, uTintMix);
    float twinkle = 0.62 + 0.38 * sin(uTime * (0.4 + aSeed.x * 2.2) + aSeed.w * 41.0);
    vAlpha = twinkle * uBrightness * visible * smoothstep(90.0, 10.0, depth) * smoothstep(0.15, 1.2, depth)
      * (uMirror > 0.5 ? 0.32 : 1.0);
  }
`;

const fragmentShader = glsl`
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float a = smoothstep(0.5, 0.0, d);
    a = a * a * (0.6 + 0.4 * smoothstep(0.18, 0.0, d));
    if (a * vAlpha < 0.002) discard;
    gl_FragColor = vec4(vColor * a * vAlpha, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export interface MotesFrame {
  time: number;
  delta: number;
  pointer: Vector3;
  pointerStrength: number;
  brightness: number;
  turbulence: number;
  orbit: number;
  orbitMix: number;
  tint: Color;
  tintMix: number;
  scale: number;
}

/** Lacuna motes: GPU points that morph between procedural formations. */
export class Motes {
  readonly points: Points<BufferGeometry, ShaderMaterial>;
  readonly mirror: Points<BufferGeometry, ShaderMaterial>;
  private readonly geometry: BufferGeometry;
  private readonly from: BufferAttribute;
  private readonly to: BufferAttribute;
  private readonly seeds: Float32Array;
  readonly count: number;
  private target: FormationKey;
  private morph = 1;
  private morphDuration = 2.6;

  constructor(count: number, initial: FormationKey, sizeScale: number) {
    this.count = count;
    this.target = initial;
    const rng = createRng(`motes:${count}`);
    const start = formation(initial, count);
    this.from = new BufferAttribute(new Float32Array(start), 3);
    this.to = new BufferAttribute(new Float32Array(start), 3);
    this.seeds = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      this.seeds[i * 4] = rng.next();
      this.seeds[i * 4 + 1] = (0.55 + Math.pow(rng.next(), 7) * 7.5) * sizeScale;
      const roll = rng.next();
      // 0 = warm white; 1–7 = spectral lines, weighted toward sodium and oxygen.
      this.seeds[i * 4 + 2] =
        roll < 0.42 ? 0 : roll < 0.66 ? 2 : roll < 0.78 ? 4 : 1 + Math.floor(rng.next() * 7);
      this.seeds[i * 4 + 3] = rng.next();
    }

    this.geometry = new BufferGeometry();
    // `position` is required by three for bounding volumes; aFrom/aTo drive the shader.
    this.geometry.setAttribute('position', this.from);
    this.geometry.setAttribute('aFrom', this.from);
    this.geometry.setAttribute('aTo', this.to);
    this.geometry.setAttribute('aSeed', new BufferAttribute(this.seeds, 4));

    const colors = [new Color('#fff3e2'), ...spectralOrder.map((k) => new Color(spectralLines[k].nocturne))];
    const uniforms = {
      uTime: { value: 0 },
      uMorph: { value: 1 },
      uLift: { value: 0.8 },
      uTurbulence: { value: 0.12 },
      uOrbit: { value: 0 },
      uOrbitMix: { value: 1 },
      uRingCenter: { value: new Vector3(...RING.center) },
      uPointer: { value: new Vector3(0, -100, 0) },
      uPointerStrength: { value: 0 },
      uSize: { value: 1 },
      uScale: { value: 1 },
      uBrightness: { value: 1 },
      uMirror: { value: 0 },
      uColors: { value: colors },
      uTint: { value: new Color('#ffb45e') },
      uTintMix: { value: 0 },
    };
    const material = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    this.points = new Points(this.geometry, material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;

    const mirrorMaterial = material.clone();
    // Share the live uniform objects so both draws stay in lockstep…
    for (const key of Object.keys(uniforms)) {
      mirrorMaterial.uniforms[key] = (uniforms as Record<string, { value: unknown }>)[key] as {
        value: unknown;
      };
    }
    // …except the mirror flag.
    mirrorMaterial.uniforms.uMirror = { value: 1 };
    this.mirror = new Points(this.geometry, mirrorMaterial);
    this.mirror.frustumCulled = false;
    this.mirror.renderOrder = 9;
  }

  get formation(): FormationKey {
    return this.target;
  }

  /**
   * Morphs toward a new formation. Mid-morph requests bake the current
   * blended positions on the CPU (mirroring the shader's easing) so motes
   * never jump.
   */
  setFormation(key: FormationKey, duration = 2.6): void {
    if (key === this.target) return;
    const next = formation(key, this.count);
    const from = this.from.array as Float32Array;
    const to = this.to.array as Float32Array;
    if (this.morph < 1) {
      for (let i = 0; i < this.count; i++) {
        const delay = (this.seeds[i * 4] as number) * STAGGER;
        let m = clamp((this.morph - delay) / (1 - STAGGER));
        m = m * m * (3 - 2 * m);
        for (let k = 0; k < 3; k++) {
          const j = i * 3 + k;
          from[j] = (from[j] as number) + ((to[j] as number) - (from[j] as number)) * m;
        }
      }
    } else {
      from.set(to);
    }
    to.set(next);
    this.from.needsUpdate = true;
    this.to.needsUpdate = true;
    this.target = key;
    this.morph = 0;
    this.morphDuration = duration;
  }

  snapTo(key: FormationKey): void {
    const next = formation(key, this.count);
    (this.from.array as Float32Array).set(next);
    (this.to.array as Float32Array).set(next);
    this.from.needsUpdate = true;
    this.to.needsUpdate = true;
    this.target = key;
    this.morph = 1;
  }

  update(f: MotesFrame): void {
    if (this.morph < 1) this.morph = Math.min(1, this.morph + f.delta / this.morphDuration);
    const u = this.points.material.uniforms;
    (u.uTime as { value: number }).value = f.time;
    (u.uMorph as { value: number }).value = this.morph;
    (u.uPointer as { value: Vector3 }).value.copy(f.pointer);
    (u.uPointerStrength as { value: number }).value = f.pointerStrength;
    (u.uBrightness as { value: number }).value = f.brightness;
    (u.uTurbulence as { value: number }).value = f.turbulence;
    (u.uOrbit as { value: number }).value = f.orbit;
    (u.uOrbitMix as { value: number }).value = f.orbitMix;
    (u.uTint as { value: Color }).value.copy(f.tint);
    (u.uTintMix as { value: number }).value = f.tintMix;
    (u.uScale as { value: number }).value = f.scale;
  }

  dispose(): void {
    this.geometry.dispose();
    this.points.material.dispose();
    this.mirror.material.dispose();
  }
}

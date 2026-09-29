import type { WorldSurface } from '../../../content/worlds.ts';
import { fbm, glsl, hash, simplex } from '../../shaders/chunks.ts';

const SURFACE_IDS: Record<Exclude<WorldSurface, 'star' | 'belt'>, number> = {
  ocean: 1,
  desert: 2,
  gas: 3,
  ice: 4,
  dark: 5,
};

export const bodyVertex = glsl`
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying vec3 vObjPos;
  void main() {
    vObjPos = position;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPos = world.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

/** Planet surfaces, lit by the star. One compile-time variant per surface. */
export function planetFragment(surface: Exclude<WorldSurface, 'star' | 'belt'>, octaves: number): string {
  return glsl`
  #define SURFACE ${SURFACE_IDS[surface]}
  uniform vec3 uStarPos;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uColorC;
  uniform vec3 uGlow;
  uniform float uTime;
  uniform float uSeed;
  uniform float uHighlight;
  uniform float uEpoch;
  uniform float uFade;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying vec3 vObjPos;
  ${hash}
  ${simplex}
  ${fbm(octaves)}

  void main() {
    vec3 N = normalize(vNormal);
    vec3 L = normalize(uStarPos - vWorldPos);
    vec3 V = normalize(cameraPosition - vWorldPos);
    float ndl = dot(N, L);
    float day = smoothstep(-0.08, 0.3, ndl);
    vec3 p = normalize(vObjPos);
    vec3 albedo = uColorA;
    vec3 emissive = vec3(0.0);
    vec3 atmosphere = vec3(0.0);

    #if SURFACE == 1
      // Ithris: tidal seas, archipelagos, clouds, and lanterns on the night side.
      float h = fbm(p * 1.9 + uSeed);
      float land = smoothstep(0.04, 0.1, h);
      float shallow = smoothstep(-0.12, 0.05, h) * (1.0 - land);
      vec3 sea = mix(uColorB, uColorA, shallow);
      vec3 ground = mix(uColorC, uColorC * 0.55, smoothstep(0.1, 0.4, h));
      albedo = mix(sea, ground, land);
      // The Reddening boils the seas: the ocean browns and steam thickens.
      albedo = mix(albedo, vec3(0.34, 0.22, 0.14), smoothstep(0.55, 1.0, uEpoch) * (1.0 - land * 0.4));
      float clouds = smoothstep(0.08, 0.5, fbm(p * 3.1 + vec3(uTime * 0.012, 0.0, uSeed)));
      clouds = min(1.0, clouds + smoothstep(0.6, 1.0, uEpoch) * 0.5);
      albedo = mix(albedo, vec3(0.92, 0.9, 0.86), clouds * 0.62);
      float cell = hash13(floor(p * 90.0));
      float lanterns = step(0.972, cell) * land * (1.0 - clouds) * (1.0 - smoothstep(0.7, 0.95, uEpoch));
      emissive += vec3(1.0, 0.62, 0.25) * lanterns * (1.0 - day) * 2.4;
      float spec = pow(max(dot(reflect(-L, N), V), 0.0), 40.0) * (1.0 - land) * (1.0 - clouds);
      emissive += vec3(1.0, 0.85, 0.6) * spec * day * 0.6;
      atmosphere = vec3(0.35, 0.7, 1.0);
    #elif SURFACE == 2
      // Carrow: tidally locked. Molten dayside, frozen night, a band of twilight observatories.
      float h = fbm(p * 3.2 + uSeed);
      albedo = mix(uColorB, uColorA, smoothstep(-0.3, 0.4, h));
      float hot = smoothstep(0.55, 0.95, ndl);
      emissive += uColorC * hot * (0.6 + 0.4 * h) * 1.4;
      float band = exp(-pow(ndl / 0.06, 2.0));
      float site = step(0.9, hash13(floor(p * 70.0)));
      emissive += vec3(1.0, 0.8, 0.5) * band * site * 1.8;
      atmosphere = vec3(1.0, 0.55, 0.25) * 0.4;
    #elif SURFACE == 3
      // Sollen: banded giant with slow turbulence.
      float warp = fbm(p * vec3(2.0, 7.0, 2.0) + vec3(uTime * 0.01, 0.0, uSeed));
      float bands = sin(p.y * 16.0 + warp * 3.0) * 0.5 + 0.5;
      albedo = mix(uColorB, uColorA, bands);
      albedo = mix(albedo, uColorC, smoothstep(0.55, 0.9, sin(p.y * 5.0 + warp)) * 0.5);
      float storm = smoothstep(0.12, 0.0, length(vec2(atan(p.z, p.x) - 1.2, p.y + 0.35) * vec2(0.6, 2.0)));
      albedo = mix(albedo, vec3(0.8, 0.45, 0.3), storm);
      atmosphere = vec3(1.0, 0.85, 0.6) * 0.5;
    #elif SURFACE == 4
      // Mereth: ice cracked in long pale lines.
      float n = fbm(p * 4.0 + uSeed);
      float cracks = 1.0 - smoothstep(0.0, 0.035, abs(n));
      albedo = mix(uColorA, uColorB, smoothstep(-0.4, 0.5, fbm(p * 1.5)));
      albedo = mix(albedo, uColorC * 1.2, cracks * 0.7);
      emissive += vec3(0.5, 0.8, 1.0) * cracks * (1.0 - day) * 0.25;
      float spec = pow(max(dot(reflect(-L, N), V), 0.0), 24.0);
      emissive += vec3(0.8, 0.9, 1.0) * spec * day * 0.35;
      atmosphere = vec3(0.6, 0.85, 1.0) * 0.35;
    #else
      // Ennis: near-black, girdled by the Choir — a lattice that still sings.
      albedo = uColorB * (0.6 + 0.4 * fbm(p * 3.0 + uSeed));
      float lat = asin(clamp(p.y, -1.0, 1.0)) * 9.0 / 3.14159265;
      float lon = atan(p.z, p.x) * 18.0 / 6.2831853;
      float grid = max(
        1.0 - smoothstep(0.0, 0.05, abs(fract(lat + 0.5) - 0.5)),
        1.0 - smoothstep(0.0, 0.05, abs(fract(lon + 0.5) - 0.5))
      );
      float pulse = 0.55 + 0.45 * sin(uTime * 1.3 - p.y * 6.0);
      emissive += uColorC * grid * pulse * 2.2;
      atmosphere = uColorC * 0.5;
    #endif

    vec3 color = albedo * (day * max(ndl, 0.0) * 1.35 + 0.018) + emissive;
    float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.0);
    color += atmosphere * fresnel * (0.25 + 0.75 * day);
    color += uGlow * fresnel * uHighlight * 1.2;
    gl_FragColor = vec4(color * uFade, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
  `;
}

export function starFragment(octaves: number): string {
  return glsl`
  uniform vec3 uYoung;
  uniform vec3 uOld;
  uniform vec3 uHot;
  uniform float uTime;
  uniform float uEpoch;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying vec3 vObjPos;
  ${simplex}
  ${fbm(octaves)}
  void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(cameraPosition - vWorldPos);
    vec3 p = normalize(vObjPos);
    float scale = mix(3.2, 1.6, uEpoch);
    float granules = fbm(p * scale + vec3(0.0, uTime * 0.025, uTime * 0.018));
    float cells = fbm(p * scale * 3.1 - vec3(uTime * 0.04));
    vec3 base = mix(uYoung, uOld, smoothstep(0.1, 0.95, uEpoch));
    float mu = max(dot(N, V), 0.0);
    float limb = 0.28 + 0.72 * pow(mu, mix(0.45, 0.8, uEpoch));
    vec3 color = base * (1.1 + granules * 0.9 + cells * 0.35) * limb;
    color += uHot * pow(max(granules, 0.0), 3.0) * 2.2 * (1.0 - uEpoch * 0.6);
    gl_FragColor = vec4(color * 2.2, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
  `;
}

export const coronaVertex = glsl`
  varying vec2 vUv;
  void main() {
    vUv = uv * 2.0 - 1.0;
    // Billboard: expand in view space so the corona always faces the camera.
    vec4 center = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    float scale = length(modelMatrix[0].xyz);
    center.xy += position.xy * scale;
    gl_Position = projectionMatrix * center;
  }
`;

export const coronaFragment = glsl`
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uIntensity;
  varying vec2 vUv;
  ${simplex}
  void main() {
    float r = length(vUv);
    float a = atan(vUv.y, vUv.x);
    float rays = snoise(vec2(a * 3.0, uTime * 0.08)) * 0.5 + 0.5;
    float glow = exp(-max(r - 0.32, 0.0) * 5.5) * 0.9 + exp(-max(r - 0.32, 0.0) * 1.6) * 0.25 * rays;
    glow *= smoothstep(1.0, 0.7, r);
    gl_FragColor = vec4(uColor * glow * uIntensity, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export const ringFragment = glsl`
  uniform vec3 uStarPos;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uGarden;
  uniform float uInner;
  uniform float uOuter;
  uniform float uTime;
  varying vec3 vWorldPos;
  varying vec3 vObjPos;
  ${hash}
  void main() {
    float r = length(vObjPos.xy);
    float t = (r - uInner) / (uOuter - uInner);
    float bands = 0.55 + 0.45 * sin(t * 90.0) * sin(t * 23.0 + 1.3);
    float density = smoothstep(0.0, 0.06, t) * smoothstep(1.0, 0.9, t) * bands;
    float gap = smoothstep(0.52, 0.56, t) * smoothstep(0.66, 0.62, t);
    density *= 1.0 - gap * 0.85;
    vec3 color = mix(uColorB, uColorA, bands) * density;
    float lit = 0.35 + 0.65 * smoothstep(-0.3, 0.6, dot(normalize(uStarPos - vWorldPos), vec3(0.0, 1.0, 0.0)) + 0.5);
    float angle = atan(vObjPos.y, vObjPos.x);
    float gardens = step(0.93, hash12(floor(vec2(angle * 180.0, t * 60.0)))) * gap;
    vec3 emissive = uGarden * gardens * (0.7 + 0.3 * sin(uTime * 2.0 + angle * 40.0)) * 2.0;
    gl_FragColor = vec4(color * lit + emissive, density * 0.85 + gardens);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export const beltVertex = glsl`
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  void main() {
    vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vWorldPos = world.xyz;
    vNormal = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

export const beltFragment = glsl`
  uniform vec3 uStarPos;
  uniform vec3 uColor;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  void main() {
    vec3 L = normalize(uStarPos - vWorldPos);
    float d = max(dot(normalize(vNormal), L), 0.0);
    gl_FragColor = vec4(uColor * (0.04 + d * 1.1), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export const starfieldVertex = glsl`
  attribute float aSize;
  attribute vec3 aColor;
  uniform float uScale;
  uniform float uTime;
  varying vec3 vColor;
  void main() {
    vColor = aColor * (0.75 + 0.25 * sin(uTime * (0.5 + aSize) + position.x));
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uScale;
  }
`;

export const starfieldFragment = glsl`
  varying vec3 vColor;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(vColor * a * a, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

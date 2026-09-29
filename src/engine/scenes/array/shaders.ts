import { gauss, glsl, hash } from '../../shaders/chunks.ts';
import { noiseTextureGlsl } from '../../textures/noiseTexture.ts';
import { SITE_HALF } from './terrain.ts';

/**
 * Shaders for the Array. The regolith model is shared by the terrain mesh and
 * by the sky pass, which continues the same plain analytically to the horizon
 * so the edge of the modelled patch never shows.
 */

const lunarLighting = glsl`
  uniform vec3 uSunDir;
  uniform vec3 uSunLight;
  uniform vec3 uAmbient;
  uniform vec3 uSrcDir;
  uniform vec3 uWaveColors[7];
  uniform float uWaveTime;
  uniform float uWaveGain;

  // Dark mare basalt and brighter highland dust, with faint streaks of fresh ejecta.
  float regolithAlbedo(vec2 xz) {
    float broad = noiseFbm(xz * 0.0035);
    float mottle = texture2D(uNoise, xz * 0.019).g;
    float grit = texture2D(uNoise, xz * 0.17).b;
    return 0.1 + 0.06 * broad + 0.018 * (mottle - 0.5) + 0.01 * (grit - 0.5);
  }

  // Lommel–Seeliger blended with Lambert: the Moon's flat, back-scattering light,
  // with the grazing-angle brightening held in check.
  vec3 lunarShade(vec3 n, vec3 v, float albedo, float sunVisible) {
    float mu0 = max(dot(n, uSunDir), 0.0);
    float mu = max(dot(n, v), 0.2);
    float ls = mix(2.0 * mu0 / (mu0 + mu), mu0, 0.5);
    return albedo * (uSunLight * ls * sunVisible + uAmbient * (0.55 + 0.45 * n.y));
  }

  // Wavefronts of the Serein Signal washing over the Array, one spectral line per front.
  vec3 wavefronts(vec3 p) {
    float s = dot(p, -uSrcDir) - uWaveTime;
    float front = s / 38.0;
    float f = fract(front);
    float band = smoothstep(0.0, 0.012, f) * exp(-f * 16.0);
    float near = 1.0 - smoothstep(120.0, 230.0, length(p.xz));
    int index = int(mod(floor(front), 7.0));
    return uWaveColors[index] * band * near * uWaveGain;
  }
`;

export const terrainVertex = glsl`
  attribute float aSun;
  varying vec3 vWorld;
  varying vec3 vNormal;
  varying float vSun;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vNormal = normal;
    vSun = aSun;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

export const terrainFragment = glsl`
  uniform sampler2D uSite;
  uniform sampler2D uDishShadow;
  uniform vec3 uLampColor;
  varying vec3 vWorld;
  varying vec3 vNormal;
  varying float vSun;
  ${noiseTextureGlsl}
  ${lunarLighting}

  void main() {
    vec2 xz = vWorld.xz;
    vec3 v = normalize(cameraPosition - vWorld);
    // Micro-relief from the noise texture tilts the normal below the mesh's resolution.
    float h0 = texture2D(uNoise, xz * 0.09).a;
    float hx = texture2D(uNoise, (xz + vec2(0.35, 0.0)) * 0.09).a;
    float hz = texture2D(uNoise, (xz + vec2(0.0, 0.35)) * 0.09).a;
    float fade = 1.0 - smoothstep(60.0, 220.0, length(cameraPosition - vWorld));
    vec3 n = normalize(normalize(vNormal) + vec3(h0 - hx, 0.0, h0 - hz) * 0.7 * fade);
    vec2 siteUv = xz / ${(SITE_HALF * 2).toFixed(1)} + 0.5;
    vec4 site = texture2D(uSite, siteUv);
    float albedo = regolithAlbedo(xz) * (1.0 + site.b * 0.45);
    vec3 col = lunarShade(n, v, albedo, vSun * texture2D(uDishShadow, siteUv).r) * site.g;
    col += albedo * uLampColor * site.r * (0.6 + 0.4 * n.y);
    col += wavefronts(vWorld);
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export const skyVertex = glsl`
  varying vec2 vUv;
  void main() {
    vUv = position.xy * 0.5 + 0.5;
    // On the far plane: drawn last, the depth test skips every pixel already covered.
    gl_Position = vec4(position.xy, 1.0, 1.0);
  }
`;

export function skyFragment(detail: number): string {
  const denseStars = detail > 0.5;
  return glsl`
  uniform mat4 uInvProj;
  uniform mat4 uCamWorld;
  uniform vec3 uCamPos;
  uniform float uTime;
  uniform float uDay;
  uniform float uPulse;
  uniform vec3 uGalNormal;
  uniform vec3 uGalCenter;
  uniform vec3 uGalSide;
  uniform vec3 uMarker;
  varying vec2 vUv;
  ${hash}
  ${gauss}
  ${noiseTextureGlsl}
  ${lunarLighting}

  const float TAU = 6.28318530718;

  vec3 starField(vec3 dir, float scale, float threshold, float gain) {
    vec3 p = dir * scale;
    vec3 cell = floor(p);
    vec3 f = fract(p) - 0.5;
    float h = hash13(cell);
    if (h < threshold) return vec3(0.0);
    vec3 offset = vec3(hash13(cell + 1.31), hash13(cell + 7.17), hash13(cell + 3.73)) - 0.5;
    float dist = length(f - offset * 0.6);
    float size = mix(0.07, 0.2, pow(hash13(cell + 11.0), 4.0));
    float intensity = gauss(dist / (size * 0.5)) * (h - threshold) / (1.0 - threshold);
    vec3 tint = mix(vec3(1.0, 0.8, 0.62), vec3(0.74, 0.85, 1.0), hash13(cell + 5.5));
    return tint * intensity * gain;
  }

  // The rim of Daedalus, forty-six kilometres away, and its central peaks to the east:
  // the elevation (radians) of the skyline at an azimuth, without and with fine crags.
  float skylineBroad(float az) {
    float u = az / TAU;
    float broad = texture2D(uNoise, vec2(u * 3.0, 0.21)).r;
    float ridged = 1.0 - abs(2.0 * texture2D(uNoise, vec2(u * 11.0, 0.63)).g - 1.0);
    return 0.008 + 0.03 * broad + 0.012 * ridged + gauss((az - 1.45) / 0.22) * 0.05 + gauss((az - 1.78) / 0.09) * 0.022;
  }
  float skyline(float az) {
    return skylineBroad(az) + 0.004 * texture2D(uNoise, vec2(az / TAU * 37.0, 0.37)).b;
  }

  vec3 milkyWay(vec3 rd) {
    float lat = dot(rd, uGalNormal);
    float lon = atan(dot(rd, uGalSide), dot(rd, uGalCenter));
    float core = pow(max(dot(rd, uGalCenter), 0.0), 3.0);
    float width = 0.16 + 0.12 * core;
    float band = exp(-lat * lat / (width * width));
    vec2 guv = vec2(lon / TAU * 4.0, lat * 2.2);
    float clump = noiseFbm(guv + vec2(0.3, 0.7));
    float rift = smoothstep(0.42, 0.72, noiseFbm(guv * 1.7 + vec2(4.1, 1.3))) * exp(-lat * lat / 0.0025);
    vec3 tint = mix(vec3(0.52, 0.6, 0.78), vec3(1.0, 0.8, 0.6), core);
    return tint * band * (0.3 + 0.9 * clump * clump) * (1.0 - 0.85 * rift) * (0.035 + 0.17 * core);
  }

  void main() {
    vec4 ndc = vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
    vec4 view = uInvProj * ndc;
    view /= view.w;
    vec3 rd = normalize((uCamWorld * vec4(view.xyz, 0.0)).xyz);
    vec3 col;

    if (rd.y < 0.0) {
      // The plain, continued analytically beyond the modelled patch.
      float t = min(-max(uCamPos.y, 0.05) / rd.y, 60000.0);
      vec3 p = uCamPos + rd * t;
      // Broad swells and old, softened craters, fading out before they could alias.
      float near = 1.0 - smoothstep(1500.0, 9000.0, t);
      vec2 g = vec2(texture2D(uNoise, p.xz * 0.0021 + vec2(0.004, 0.0)).r - texture2D(uNoise, p.xz * 0.0021 - vec2(0.004, 0.0)).r,
                    texture2D(uNoise, p.xz * 0.0021 + vec2(0.0, 0.004)).r - texture2D(uNoise, p.xz * 0.0021 - vec2(0.0, 0.004)).r);
      vec3 n = normalize(vec3(-g.x * 9.0 * near, 1.0, -g.y * 9.0 * near));
      float albedo = mix(regolithAlbedo(p.xz), 0.12, smoothstep(2500.0, 12000.0, t));
      col = lunarShade(n, -rd, albedo, 1.0);
    } else if (rd.y < skyline(atan(rd.x, -rd.z))) {
      // Slopes lean with the broad ridge line, so a low sun lights one flank of each massif;
      // the foothills sit lower in the range's own shadow.
      float az = atan(rd.x, -rd.z);
      float crest = skyline(az);
      float slope = clamp((skylineBroad(az + 0.03) - skylineBroad(az - 0.03)) / 0.06, -0.8, 0.8);
      vec3 toward = normalize(vec3(-rd.x, 0.0, -rd.z));
      vec3 along = vec3(-toward.z, 0.0, toward.x);
      float h = clamp(rd.y / crest, 0.0, 1.0);
      float gully = noiseFbm(vec2(az / TAU * 14.0, rd.y * 22.0));
      float facets = noiseFbm(vec2(az / TAU * 36.0, rd.y * 70.0)) - 0.5;
      vec3 n = normalize(toward + vec3(0.0, 0.5 + 0.7 * h, 0.0) + along * (slope * 2.2 + (gully - 0.5) * 0.6 + facets * 2.4));
      col = lunarShade(n, -rd, 0.09 + 0.04 * gully, 1.0) * mix(0.5, 1.0, h);
    } else {
      float night = 1.0 - uDay * 0.55;
      float lat = dot(rd, uGalNormal);
      vec3 stars = starField(rd, 150.0, 0.86, 1.1) + starField(rd, 58.0, 0.965, 2.8);
      ${denseStars ? 'stars += starField(rd, 300.0, 0.95 - 0.12 * exp(-lat * lat / 0.03), 0.6);' : ''}
      // The Lacuna: a region with no visible stars, and the reticle the Array keeps around it.
      float angle = acos(clamp(dot(rd, uSrcDir), -1.0, 1.0));
      float voidMask = smoothstep(0.025, 0.07, angle);
      col = (stars * voidMask + milkyWay(rd) * mix(0.35, 1.0, voidMask)) * night;
      float ring = gauss((angle - 0.042) / 0.0011) * (0.35 + 0.65 * uPulse);
      float glow = gauss(angle / 0.012) * 0.05 * (0.6 + uPulse);
      col += uMarker * (ring * 0.9 + glow);
      // The Sun: a hard disc (there is no air to soften it) and lens glare.
      float sunAngle = acos(clamp(dot(rd, uSunDir), -1.0, 1.0));
      col += uSunLight * (smoothstep(0.0052, 0.0044, sunAngle) * 18.0 + exp(-sunAngle * 90.0) * 0.35 + exp(-sunAngle * 9.0) * 0.025);
    }

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
  `;
}

export const beaconVertex = glsl`
  attribute vec3 color;
  attribute float aBlink;
  attribute float aSize;
  uniform float uTime;
  uniform float uScale;
  varying vec3 vColor;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float blink = aBlink > 0.5 ? 0.15 + 0.85 * step(0.55, fract(uTime * 0.75 + position.x * 0.071)) : 1.0;
    vColor = color * blink;
    gl_PointSize = clamp(aSize * uScale * 60.0 / -mv.z, 1.5, 28.0);
  }
`;

export const beaconFragment = glsl`
  varying vec3 vColor;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = dot(c, c);
    float alpha = exp(-d * 30.0) + exp(-d * 400.0) * 1.5;
    gl_FragColor = vec4(vColor * alpha, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

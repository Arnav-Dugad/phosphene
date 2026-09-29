import {
  BufferGeometry,
  DataTexture,
  Float32BufferAttribute,
  LinearFilter,
  LineSegments,
  Mesh,
  PerspectiveCamera,
  RedFormat,
  Scene,
  ShaderMaterial,
  UnsignedByteType,
} from 'three';
import { FFT, hannWindow } from '../../../lib/fft.ts';
import { clamp } from '../../../lib/math.ts';
import { createRng } from '../../../lib/random.ts';
import { lineTone } from '../../../lib/spectral.ts';
import { spectralOrder } from '../../../design/tokens.ts';
import type { SceneParams } from '../../../stores/stage.ts';
import { glsl, spectrum } from '../../shaders/chunks.ts';
import type { FrameState, PostSettings, SceneFactory, StageContext, StageScene, Viewport } from '../../types.ts';

const BINS = 160;
const ROWS = 128;
const WIDTH = 14;
const DEPTH = 16;
const SAMPLE_RATE = 8192;
const FFT_SIZE = 2048;

/** Log-spaced frequency (Hz) for display bin i: 40 Hz → 3 kHz. */
const binFrequency = (i: number): number => 40 * Math.pow(3000 / 40, i / (BINS - 1));

const terrainVertex = glsl`
  uniform sampler2D uHistory;
  uniform float uHead;
  uniform float uHeight;
  varying float vHeight;
  varying float vDepth;
  varying float vX;
  float sampleHeight(vec2 uv) {
    float row = fract(uHead - uv.y + 1.0 / ${ROWS}.0);
    return texture2D(uHistory, vec2(uv.x, row)).r;
  }
  void main() {
    float h = sampleHeight(uv);
    vHeight = h;
    vDepth = uv.y;
    vX = uv.x;
    vec3 p = position + vec3(0.0, h * uHeight, 0.0);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const fillFragment = glsl`
  varying float vHeight;
  varying float vDepth;
  void main() {
    gl_FragColor = vec4(vec3(0.004, 0.005, 0.008) + vec3(0.02, 0.015, 0.01) * vHeight, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const lineFragment = glsl`
  uniform float uPalette;
  varying float vHeight;
  varying float vDepth;
  varying float vX;
  ${spectrum}
  void main() {
    // Ridges take the colour of their frequency: low tones red, high tones violet.
    vec3 hue = uPalette < 0.5 ? wavelengthToRgb(mix(660.0, 400.0, vX)) : vec3(1.0, 0.72, 0.4);
    float fade = smoothstep(1.0, 0.55, vDepth) * smoothstep(0.0, 0.08, vDepth);
    // Multisampling can extrapolate varyings slightly below zero; pow() needs a non-negative base.
    vec3 color = hue * (0.18 + pow(max(vHeight, 0.0), 1.4) * 2.6) * fade;
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

class TerrainScene implements StageScene {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(38, 1, 0.1, 100);
  readonly post: Partial<PostSettings> = { bloomIntensity: 1.1, bloomThreshold: 0.3, vignette: 0.7 };

  /** Most recent normalised spectrum, for the page's readout. */
  readonly latest = new Float32Array(BINS);

  private readonly history: DataTexture;
  private readonly data: Uint8Array;
  private readonly fill: Mesh<BufferGeometry, ShaderMaterial>;
  private readonly lines: LineSegments<BufferGeometry, ShaderMaterial>;
  private readonly fft = new FFT(FFT_SIZE);
  private readonly window = hannWindow(FFT_SIZE);
  private readonly signal = new Float32Array(FFT_SIZE);
  private readonly spectrumDb = new Float32Array(FFT_SIZE / 2);
  private readonly re = new Float32Array(FFT_SIZE);
  private readonly im = new Float32Array(FFT_SIZE);
  private readonly micBuffer = new Float32Array(FFT_SIZE);
  private analyser: AnalyserNode | null = null;
  private head = 0;
  private rowClock = 0;
  private sampleClock = 0;
  private speed = 30;
  private gain = 1;
  private frozen = false;
  private palette = 0;
  private readonly tones: { f: number; amp: number; rate: number; phase: number }[];

  constructor(_ctx: StageContext, params: SceneParams) {
    this.data = new Uint8Array(BINS * ROWS);
    this.history = new DataTexture(this.data, BINS, ROWS, RedFormat, UnsignedByteType);
    this.history.magFilter = LinearFilter;
    this.history.minFilter = LinearFilter;
    this.history.needsUpdate = true;

    // The carrier: each spectral line's tone and two harmonics, amplitude-modulated.
    const rng = createRng('terrain-carrier');
    this.tones = spectralOrder.flatMap((key) => {
      const base = lineTone(key);
      return [1, 2, 3].map((harmonic) => ({
        f: base * harmonic * (harmonic === 1 ? 0.5 : 0.5),
        amp: (harmonic === 1 ? 0.6 : 0.25 / harmonic) * rng.range(0.6, 1),
        rate: rng.range(0.05, 0.35),
        phase: rng.range(0, Math.PI * 2),
      }));
    });

    const geometry = new TerrainGeometry(WIDTH, DEPTH, BINS - 1, ROWS - 1);
    const uniforms = {
      uHistory: { value: this.history },
      uHead: { value: 0 },
      uHeight: { value: 2.6 },
      uPalette: { value: 0 },
    };
    this.fill = new Mesh(
      geometry.surface,
      new ShaderMaterial({ vertexShader: terrainVertex, fragmentShader: fillFragment, uniforms, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }),
    );
    this.lines = new LineSegments(
      geometry.ridges,
      new ShaderMaterial({ vertexShader: terrainVertex, fragmentShader: lineFragment, uniforms }),
    );
    this.scene.add(this.fill, this.lines);
    this.camera.position.set(0, 4.2, 9.5);
    this.camera.lookAt(0, 0.4, -3);
    this.setParams(params);
  }

  setParams(params: SceneParams): void {
    if (typeof params.speed === 'number') this.speed = clamp(params.speed, 5, 90);
    if (typeof params.gain === 'number') this.gain = clamp(params.gain, 0.2, 4);
    if (typeof params.frozen === 'boolean') this.frozen = params.frozen;
    if (typeof params.palette === 'string') this.palette = params.palette === 'ember' ? 1 : 0;
  }

  /** Attach (or detach) a live microphone analyser. */
  setAnalyser(analyser: AnalyserNode | null): void {
    this.analyser = analyser;
    if (analyser) analyser.fftSize = FFT_SIZE;
  }

  resize(viewport: Readonly<Viewport>): void {
    this.camera.aspect = viewport.aspect;
    this.camera.fov = viewport.aspect < 1 ? 58 : 38;
    const shift = viewport.compact ? 0 : viewport.width * 0.1;
    this.camera.setViewOffset(viewport.width, viewport.height, shift, 0, viewport.width, viewport.height);
    this.camera.updateProjectionMatrix();
  }

  private synthesise(time: number): void {
    const dt = 1 / SAMPLE_RATE;
    for (let i = 0; i < FFT_SIZE; i++) {
      const t = time + i * dt;
      let v = 0;
      for (const tone of this.tones) {
        const envelope = 0.5 + 0.5 * Math.sin(t * tone.rate * Math.PI * 2 + tone.phase);
        v += Math.sin(t * tone.f * Math.PI * 2) * tone.amp * envelope * envelope;
      }
      // Occasional data bursts: a chirp sweeping upward.
      const burst = Math.max(0, Math.sin(t * 0.7)) ** 12;
      v += Math.sin(t * Math.PI * 2 * (300 + ((t * 400) % 1600))) * burst * 0.5;
      v += (Math.random() - 0.5) * 0.02;
      this.signal[i] = v * 0.2;
    }
  }

  private writeRow(): void {
    let magnitudes: Float32Array;
    let binWidth: number;
    if (this.analyser) {
      this.analyser.getFloatTimeDomainData(this.micBuffer);
      this.fft.magnitudeDb(this.micBuffer, this.spectrumDb, this.re, this.im, this.window);
      binWidth = this.analyser.context.sampleRate / FFT_SIZE;
      magnitudes = this.spectrumDb;
    } else {
      this.synthesise(this.sampleClock);
      this.fft.magnitudeDb(this.signal, this.spectrumDb, this.re, this.im, this.window);
      binWidth = SAMPLE_RATE / FFT_SIZE;
      magnitudes = this.spectrumDb;
    }
    const row = this.head % ROWS;
    for (let i = 0; i < BINS; i++) {
      const index = Math.min(magnitudes.length - 1, Math.round(binFrequency(i) / binWidth));
      const db = magnitudes[index] ?? -120;
      const v = clamp(((db + 90) / 70) * this.gain);
      this.latest[i] = v;
      this.data[row * BINS + i] = Math.round(v * 255);
    }
    this.head++;
    this.history.needsUpdate = true;
  }

  update(frame: FrameState): void {
    const raw = Math.min(frame.rawDelta, 0.1);
    if (!this.frozen) {
      this.rowClock += raw * this.speed;
      this.sampleClock += raw;
      let rows = Math.min(4, Math.floor(this.rowClock));
      this.rowClock -= rows;
      while (rows-- > 0) this.writeRow();
    }
    const u = this.fill.material.uniforms;
    (u.uHead as { value: number }).value = ((this.head - 1 + ROWS) % ROWS) / ROWS;
    (u.uPalette as { value: number }).value = this.palette;
  }

  dispose(): void {
    this.analyser = null;
    this.history.dispose();
    this.fill.geometry.dispose();
    this.fill.material.dispose();
    this.lines.geometry.dispose();
    this.lines.material.dispose();
    this.scene.clear();
  }
}

/**
 * Builds the terrain's surface grid and its ridgelines (one polyline per
 * history row, running across frequency) with shared UVs.
 */
class TerrainGeometry {
  readonly surface: BufferGeometry;
  readonly ridges: BufferGeometry;

  constructor(width: number, depth: number, segX: number, segZ: number) {
    const positions: number[] = [];
    const uvs: number[] = [];
    for (let z = 0; z <= segZ; z++) {
      for (let x = 0; x <= segX; x++) {
        const u = x / segX;
        const v = z / segZ;
        positions.push((u - 0.5) * width, 0, -v * depth + depth * 0.25);
        uvs.push(u, v);
      }
    }
    const indices: number[] = [];
    const stride = segX + 1;
    for (let z = 0; z < segZ; z++) {
      for (let x = 0; x < segX; x++) {
        const a = z * stride + x;
        indices.push(a, a + stride, a + 1, a + 1, a + stride, a + stride + 1);
      }
    }
    this.surface = new BufferGeometry();
    this.surface.setAttribute('position', new Float32BufferAttribute(positions, 3));
    this.surface.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
    this.surface.setIndex(indices);

    const lineIndices: number[] = [];
    for (let z = 0; z <= segZ; z += 2) {
      for (let x = 0; x < segX; x++) lineIndices.push(z * stride + x, z * stride + x + 1);
    }
    this.ridges = new BufferGeometry();
    this.ridges.setAttribute('position', new Float32BufferAttribute(positions, 3));
    this.ridges.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
    this.ridges.setIndex(lineIndices);
  }
}

const create: SceneFactory = (ctx, params) => new TerrainScene(ctx, params);
export default create;
export type { TerrainScene };

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Line,
  LineSegments,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
} from 'three';
import { chartEdges, chartNodes, type NodeKind } from '../../../content/graph.ts';
import { spectralLines } from '../../../design/tokens.ts';
import { clamp, damp } from '../../../lib/math.ts';
import { createRng } from '../../../lib/random.ts';
import type { SceneParams } from '../../../stores/stage.ts';
import { glsl } from '../../shaders/chunks.ts';
import type { FrameState, PostSettings, SceneFactory, StageContext, StageScene, Viewport } from '../../types.ts';
import { Emitter } from '../../util/Emitter.ts';

/** Where a node sits on screen, for the page's DOM labels. */
export interface NodeAnchor {
  x: number;
  y: number;
  visible: boolean;
  /** 0–1: how much room the zoom level leaves for this node's label. */
  detail: number;
}

const MIN_DISTANCE = 45;
const MAX_DISTANCE = 330;
const HOME_DISTANCE = 300;
/** The chart's resting centre: a little right of and below Arrival, clear of the masthead. */
const HOME_X = -22;
const HOME_Y = -12;
const EDGE_ALPHA = { spine: 0.2, branch: 0.13, reference: 0.022 } as const;

const nodeVertex = glsl`
  attribute vec3 color;
  attribute float aSize;
  attribute float aState;
  uniform float uScale;
  uniform float uTime;
  uniform float uHover;
  uniform float uFocus;
  varying vec3 vColor;
  varying float vState;
  varying float vRing;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float index = float(gl_VertexID);
    float lit = (abs(index - uHover) < 0.5 || abs(index - uFocus) < 0.5) ? 1.0 : 0.0;
    float twinkle = 0.9 + 0.1 * sin(uTime * 1.3 + index * 1.7);
    // aState: 0 unseen, 1 observed, 2 dimmed by a filter, 3 hidden place.
    float seen = aState > 0.5 && aState < 1.5 ? 1.0 : 0.0;
    float dim = aState > 1.5 ? 0.12 : 1.0;
    vColor = color * (0.55 + 0.6 * seen + 0.9 * lit) * twinkle * dim;
    vState = seen;
    vRing = lit;
    gl_PointSize = clamp(aSize * uScale * (1.0 + 0.45 * lit) * 1500.0 / -mv.z, 4.0, 110.0);
    if (aState > 2.5) gl_PointSize = 0.0;
  }
`;

const nodeFragment = glsl`
  varying vec3 vColor;
  varying float vState;
  varying float vRing;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c) * 2.0;
    float core = smoothstep(0.34, 0.2, d);
    float glow = exp(-d * d * 7.0) * 0.55;
    // Observed stars wear a thin ring; the hovered one a brighter one.
    float ring = smoothstep(0.06, 0.0, abs(d - 0.78)) * (0.35 * vState + 0.8 * vRing);
    gl_FragColor = vec4(vColor * (core * 1.6 + glow + ring), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const edgeVertex = glsl`
  attribute vec3 color;
  attribute float aAlpha;
  attribute vec2 aEnds;
  uniform float uHover;
  uniform float uFocus;
  varying vec3 vColor;
  void main() {
    float lit = (abs(aEnds.x - uHover) < 0.5 || abs(aEnds.y - uHover) < 0.5 || abs(aEnds.x - uFocus) < 0.5 || abs(aEnds.y - uFocus) < 0.5) ? 1.0 : 0.0;
    vColor = color * mix(aAlpha, max(aAlpha * 3.0, 0.5), lit);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const edgeFragment = glsl`
  varying vec3 vColor;
  void main() {
    gl_FragColor = vec4(vColor, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const pathVertex = glsl`
  attribute float aDistance;
  varying float vDistance;
  void main() {
    vDistance = aDistance;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const pathFragment = glsl`
  uniform float uTime;
  uniform float uLength;
  uniform vec3 uColor;
  varying float vDistance;
  void main() {
    // Light flows along the observer's path, oldest steps faintest.
    float flow = 0.35 + 0.65 * smoothstep(0.55, 1.0, fract(vDistance * 0.045 - uTime * 0.35));
    float age = 0.3 + 0.7 * (vDistance / max(uLength, 1.0));
    gl_FragColor = vec4(uColor * flow * age * 1.4, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const starVertex = glsl`
  attribute float aSize;
  uniform float uScale;
  varying float vBright;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    vBright = aSize;
    gl_PointSize = clamp(aSize * uScale * 2.2, 1.0, 3.5);
  }
`;

const starFragment = glsl`
  varying float vBright;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    gl_FragColor = vec4(vec3(0.75, 0.8, 0.95) * smoothstep(1.0, 0.0, d) * vBright * 0.5, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

type Uniform<T> = { value: T };

class ConstellationScene implements StageScene {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(50, 1, 1, 2000);
  readonly post: Partial<PostSettings> = { bloomIntensity: 1.05, bloomThreshold: 0.2, bloomRadius: 0.7, vignette: 0.7, aberration: 0.35 };
  /** Screen anchors for every node, refreshed each frame (allocation-free). */
  readonly anchors: NodeAnchor[] = chartNodes.map(() => ({ x: 0, y: 0, visible: false, detail: 0 }));
  /** `hover` fires when the star under the pointer changes; `pick` when one is clicked. */
  readonly events = new Emitter<{ hover: [number | null]; pick: [number] }>();
  hovered: number | null = null;

  private readonly ctx: StageContext;
  private readonly nodes: Points<BufferGeometry, ShaderMaterial>;
  private readonly edges: LineSegments<BufferGeometry, ShaderMaterial>;
  private readonly path: Line<BufferGeometry, ShaderMaterial>;
  private readonly stars: Points<BufferGeometry, ShaderMaterial>;
  private readonly center = new Vector2(HOME_X, HOME_Y);
  private readonly centerGoal = new Vector2(HOME_X, HOME_Y);
  private distance = HOME_DISTANCE * 1.25;
  private distanceGoal = HOME_DISTANCE;
  private readonly velocity = new Vector2();
  private dragging = false;
  private travel = 0;
  private readonly last = new Vector2();
  private lastMove = 0;
  private focus = -1;
  private readonly v = new Vector3();
  private readonly pointer = new Vector2(-9, -9);
  /** performance.now() of the last pointer move over the chart itself (not over the page's panels). */
  private surfaceMoveAt = -1;

  constructor(ctx: StageContext, params: SceneParams) {
    this.ctx = ctx;
    this.stars = this.buildStars(Math.round(2600 * Math.max(0.35, ctx.profile.particleScale)));
    this.edges = this.buildEdges();
    this.nodes = this.buildNodes();
    this.path = this.buildPath();
    this.scene.add(this.stars, this.edges, this.path, this.nodes);
    this.setParams(params);
  }

  private buildStars(count: number): Points<BufferGeometry, ShaderMaterial> {
    const rng = createRng('chart-backdrop');
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = rng.range(-900, 900);
      positions[i * 3 + 1] = rng.range(-700, 700);
      positions[i * 3 + 2] = rng.range(-700, -120);
      sizes[i] = Math.pow(rng.next(), 3) * 1.4 + 0.2;
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setAttribute('aSize', new BufferAttribute(sizes, 1));
    const material = new ShaderMaterial({
      vertexShader: starVertex,
      fragmentShader: starFragment,
      uniforms: { uScale: { value: 1 } },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    return new Points(geometry, material);
  }

  private buildNodes(): Points<BufferGeometry, ShaderMaterial> {
    const count = chartNodes.length;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const tint = new Color();
    for (const node of chartNodes) {
      positions.set([node.x, -node.y, node.z], node.index * 3);
      tint.set(spectralLines[node.line].nocturne);
      colors.set([tint.r, tint.g, tint.b], node.index * 3);
      sizes[node.index] = node.size;
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setAttribute('color', new BufferAttribute(colors, 3));
    geometry.setAttribute('aSize', new BufferAttribute(sizes, 1));
    geometry.setAttribute('aState', new BufferAttribute(new Float32Array(count), 1));
    const material = new ShaderMaterial({
      vertexShader: nodeVertex,
      fragmentShader: nodeFragment,
      uniforms: { uScale: { value: 1 }, uTime: { value: 0 }, uHover: { value: -1 }, uFocus: { value: -1 } },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    const points = new Points(geometry, material);
    points.frustumCulled = false;
    return points;
  }

  private buildEdges(): LineSegments<BufferGeometry, ShaderMaterial> {
    const positions = new Float32Array(chartEdges.length * 6);
    const colors = new Float32Array(chartEdges.length * 6);
    const alphas = new Float32Array(chartEdges.length * 2);
    const ends = new Float32Array(chartEdges.length * 4);
    const tint = new Color();
    chartEdges.forEach((edge, i) => {
      const a = chartNodes[edge.a];
      const b = chartNodes[edge.b];
      if (!a || !b) return;
      positions.set([a.x, -a.y, a.z, b.x, -b.y, b.z], i * 6);
      tint.set(spectralLines[a.line].nocturne);
      colors.set([tint.r, tint.g, tint.b], i * 6);
      tint.set(spectralLines[b.line].nocturne);
      colors.set([tint.r, tint.g, tint.b], i * 6 + 3);
      alphas.set([EDGE_ALPHA[edge.kind], EDGE_ALPHA[edge.kind]], i * 2);
      ends.set([edge.a, edge.b, edge.a, edge.b], i * 4);
    });
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setAttribute('color', new BufferAttribute(colors, 3));
    geometry.setAttribute('aAlpha', new BufferAttribute(alphas, 1));
    geometry.setAttribute('aEnds', new BufferAttribute(ends, 2));
    const material = new ShaderMaterial({
      vertexShader: edgeVertex,
      fragmentShader: edgeFragment,
      uniforms: { uHover: { value: -1 }, uFocus: { value: -1 } },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    const lines = new LineSegments(geometry, material);
    lines.frustumCulled = false;
    return lines;
  }

  private buildPath(): Line<BufferGeometry, ShaderMaterial> {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(3), 3));
    geometry.setAttribute('aDistance', new BufferAttribute(new Float32Array(1), 1));
    const material = new ShaderMaterial({
      vertexShader: pathVertex,
      fragmentShader: pathFragment,
      uniforms: {
        uTime: { value: 0 },
        uLength: { value: 1 },
        uColor: { value: new Color(spectralLines.na.nocturne) },
      },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    const line = new Line(geometry, material);
    line.frustumCulled = false;
    return line;
  }

  /**
   * Params: `visited` (node indices, in visit order), `observed` (indices ever
   * seen), `hiddenKinds` (kinds filtered out), `revealed` (hidden places the
   * visitor has found), `focus` (index or -1).
   */
  setParams(params: SceneParams): void {
    const observed = new Set(Array.isArray(params.observed) ? (params.observed as number[]) : []);
    const filtered = new Set(Array.isArray(params.hiddenKinds) ? (params.hiddenKinds as NodeKind[]) : []);
    const revealed = new Set(Array.isArray(params.revealed) ? (params.revealed as number[]) : []);
    const state = this.nodes.geometry.attributes.aState as BufferAttribute;
    for (const node of chartNodes) {
      let value = observed.has(node.index) ? 1 : 0;
      if (filtered.has(node.kind)) value = 2;
      if (node.hidden && !revealed.has(node.index)) value = 3;
      state.setX(node.index, value);
    }
    state.needsUpdate = true;

    const visited = Array.isArray(params.visited) ? (params.visited as number[]) : [];
    this.setPath(visited.filter((i) => chartNodes[i] && !filtered.has((chartNodes[i] as { kind: NodeKind }).kind)));

    if (typeof params.focus === 'number' && params.focus !== this.focus) {
      this.focus = params.focus;
      const node = chartNodes[this.focus];
      if (node) {
        this.centerGoal.set(node.x, -node.y);
        this.distanceGoal = Math.min(this.distanceGoal, node.kind === 'place' ? 150 : 110);
      }
    }
    (this.nodes.material.uniforms.uFocus as Uniform<number>).value = this.focus;
    (this.edges.material.uniforms.uFocus as Uniform<number>).value = this.focus;
    this.ctx.invalidate();
  }

  private setPath(visited: readonly number[]): void {
    const points: number[] = [];
    const distances: number[] = [];
    let total = 0;
    let previous: { x: number; y: number; z: number } | null = null;
    for (const index of visited) {
      const node = chartNodes[index];
      if (!node) continue;
      const p = { x: node.x, y: -node.y, z: node.z + 0.5 };
      if (previous) total += Math.hypot(p.x - previous.x, p.y - previous.y);
      points.push(p.x, p.y, p.z);
      distances.push(total);
      previous = p;
    }
    const geometry = this.path.geometry;
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(points.length ? points : [0, 0, 0]), 3));
    geometry.setAttribute('aDistance', new BufferAttribute(new Float32Array(distances.length ? distances : [0]), 1));
    geometry.setDrawRange(0, points.length >= 6 ? points.length / 3 : 0);
    (this.path.material.uniforms.uLength as Uniform<number>).value = total;
  }

  /** Recentres on the whole chart. */
  home(): void {
    this.centerGoal.set(HOME_X, HOME_Y);
    this.distanceGoal = HOME_DISTANCE;
    this.velocity.set(0, 0);
  }

  zoomBy(factor: number): void {
    this.distanceGoal = clamp(this.distanceGoal * factor, MIN_DISTANCE, MAX_DISTANCE);
  }

  /** Pans by a fraction of the visible height. */
  panBy(dx: number, dy: number): void {
    const span = this.visibleHeight();
    this.centerGoal.x += dx * span;
    this.centerGoal.y += dy * span;
  }

  private visibleHeight(): number {
    return 2 * this.distance * Math.tan((this.camera.fov * Math.PI) / 360);
  }

  resize(viewport: Readonly<Viewport>): void {
    this.camera.aspect = viewport.aspect;
    this.camera.fov = viewport.aspect < 1 ? 62 : 50;
    this.camera.updateProjectionMatrix();
    const scale = viewport.dpr * (viewport.height / 900);
    (this.nodes.material.uniforms.uScale as Uniform<number>).value = scale;
    (this.stars.material.uniforms.uScale as Uniform<number>).value = viewport.dpr;
  }

  onPointerDown(x: number, y: number): void {
    this.dragging = true;
    this.travel = 0;
    this.last.set(x, y);
    this.lastMove = performance.now();
    this.velocity.set(0, 0);
  }

  onPointerMove(x: number, y: number): void {
    this.pointer.set(x, y);
    this.surfaceMoveAt = performance.now();
    if (!this.dragging) {
      this.setHovered(this.pickAt(x, y));
      return;
    }
    const dx = x - this.last.x;
    const dy = y - this.last.y;
    this.travel += Math.hypot(dx, dy);
    const span = this.visibleHeight() / 2;
    const now = performance.now();
    const dt = Math.max(1, now - this.lastMove) / 1000;
    const mx = -dx * span * this.camera.aspect;
    const my = -dy * span;
    this.centerGoal.x += mx;
    this.centerGoal.y += my;
    this.velocity.set(mx / dt, my / dt);
    this.last.set(x, y);
    this.lastMove = now;
  }

  onPointerUp(x: number, y: number): void {
    this.dragging = false;
    if (performance.now() - this.lastMove > 80) this.velocity.set(0, 0);
    if (this.travel < 0.012) {
      const index = this.pickAt(x, y);
      if (index !== null) this.events.emit('pick', index);
    }
  }

  onZoom(factor: number): void {
    // Zoom toward the pointer: the point under it stays put.
    const before = this.visibleHeight();
    this.zoomBy(factor);
    const after = 2 * this.distanceGoal * Math.tan((this.camera.fov * Math.PI) / 360);
    const shift = (before - after) / 2;
    if (this.pointer.x > -2) {
      this.centerGoal.x += this.pointer.x * shift * this.camera.aspect;
      this.centerGoal.y += this.pointer.y * shift;
    }
  }

  onKey(key: string): boolean {
    switch (key) {
      case 'ArrowLeft':
        this.panBy(-0.12, 0);
        return true;
      case 'ArrowRight':
        this.panBy(0.12, 0);
        return true;
      case 'ArrowUp':
        this.panBy(0, 0.12);
        return true;
      case 'ArrowDown':
        this.panBy(0, -0.12);
        return true;
      case '+':
      case '=':
        this.zoomBy(0.8);
        return true;
      case '-':
      case '_':
        this.zoomBy(1.25);
        return true;
      case '0':
        this.home();
        return true;
      default:
        return false;
    }
  }

  /** The nearest visible star within reach of a screen position (NDC). */
  private pickAt(x: number, y: number): number | null {
    const { width, height } = this.ctx.viewport;
    const px = (x * 0.5 + 0.5) * width;
    const py = (-y * 0.5 + 0.5) * height;
    let best: number | null = null;
    let bestDistance = 22;
    const state = this.nodes.geometry.attributes.aState as BufferAttribute;
    for (const node of chartNodes) {
      const anchor = this.anchors[node.index];
      if (!anchor?.visible || state.getX(node.index) >= 2) continue;
      const d = Math.hypot(anchor.x - px, anchor.y - py);
      if (d < bestDistance) {
        bestDistance = d;
        best = node.index;
      }
    }
    return best;
  }

  update(frame: FrameState): void {
    const raw = Math.min(frame.rawDelta, 0.1);
    const still = frame.motion === 'still';
    if (!this.dragging && !still) {
      this.centerGoal.x += this.velocity.x * raw;
      this.centerGoal.y += this.velocity.y * raw;
      const decay = Math.exp(-5 * raw);
      this.velocity.multiplyScalar(decay);
    }
    const bound = 170;
    this.centerGoal.set(clamp(this.centerGoal.x, -bound, bound), clamp(this.centerGoal.y, -bound, bound));
    const k = still ? 1000 : this.dragging ? 30 : 5;
    this.center.x = damp(this.center.x, this.centerGoal.x, k, raw);
    this.center.y = damp(this.center.y, this.centerGoal.y, k, raw);
    this.distance = damp(this.distance, this.distanceGoal, still ? 1000 : 4.5, raw);

    // A gentle parallax lean from the pointer keeps the chart feeling three-dimensional.
    const lean = still ? 0 : 1;
    const p = frame.pointer;
    this.camera.position.set(
      this.center.x + p.x * 6 * lean,
      this.center.y + p.y * 4 * lean,
      this.distance,
    );
    this.camera.lookAt(this.center.x, this.center.y, 0);
    this.camera.updateMatrixWorld();

    const time = still ? 0 : frame.time;
    (this.nodes.material.uniforms.uTime as Uniform<number>).value = time;
    (this.path.material.uniforms.uTime as Uniform<number>).value = time;

    // Screen anchors for labels; hover follows the pointer when it is not dragging.
    const { width, height } = this.ctx.viewport;
    const zoom = clamp((MAX_DISTANCE - this.distance) / (MAX_DISTANCE - MIN_DISTANCE));
    for (const node of chartNodes) {
      const anchor = this.anchors[node.index] as NodeAnchor;
      this.v.set(node.x, -node.y, node.z).project(this.camera);
      anchor.x = (this.v.x * 0.5 + 0.5) * width;
      anchor.y = (-this.v.y * 0.5 + 0.5) * height;
      anchor.visible = this.v.z < 1 && Math.abs(this.v.x) < 1.1 && Math.abs(this.v.y) < 1.1;
      const need = node.kind === 'place' ? 0 : node.kind === 'relic' ? 0.62 : 0.4;
      anchor.detail = clamp((zoom - need) / 0.15);
    }
    // The pointer has moved on over a panel: nothing on the chart is hovered any more.
    if (!p.inside || p.lastMove > this.surfaceMoveAt + 40) this.setHovered(null);
    const hover = this.hovered ?? -1;
    (this.nodes.material.uniforms.uHover as Uniform<number>).value = hover;
    (this.edges.material.uniforms.uHover as Uniform<number>).value = hover;
  }

  private setHovered(index: number | null): void {
    if (index === this.hovered) return;
    this.hovered = index;
    this.events.emit('hover', index);
  }

  dispose(): void {
    this.events.clear();
    for (const object of [this.nodes, this.edges, this.path, this.stars]) {
      object.geometry.dispose();
      object.material.dispose();
    }
    this.scene.clear();
  }
}


const create: SceneFactory = (ctx, params) => new ConstellationScene(ctx, params);
export default create;
export type { ConstellationScene };

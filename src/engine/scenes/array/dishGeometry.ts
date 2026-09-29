import {
  BoxGeometry,
  CylinderGeometry,
  LatheGeometry,
  Quaternion,
  Vector2,
  Vector3,
  type BufferGeometry,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * A 25-metre dish in three instanced parts: the mount (turns in azimuth), the
 * reflector and the feed structure (both tip in elevation about the pivot).
 * Geometry is authored in scene units with the elevation pivot at the origin
 * for the moving parts, and the pad at the origin for the mount.
 */
export const BOWL_RADIUS = 1.25;
const FOCAL_LENGTH = 0.95;
const bowlDepth = (r: number): number => (r * r) / (4 * FOCAL_LENGTH);

export function reflectorGeometry(): BufferGeometry {
  const points: Vector2[] = [];
  const steps = 14;
  for (let i = 0; i <= steps; i++) {
    const r = (i / steps) * BOWL_RADIUS;
    points.push(new Vector2(r, bowlDepth(r) + 0.08));
  }
  // A thin rolled lip gives the rim a highlight line.
  points.push(new Vector2(BOWL_RADIUS + 0.02, bowlDepth(BOWL_RADIUS) + 0.06));
  points.push(new Vector2(BOWL_RADIUS + 0.01, bowlDepth(BOWL_RADIUS) + 0.02));
  return new LatheGeometry(points, 56);
}

function strut(from: Vector3, to: Vector3, radius: number): BufferGeometry {
  const length = from.distanceTo(to);
  const geometry = new CylinderGeometry(radius, radius, length, 5, 1, true);
  const direction = to.clone().sub(from).normalize();
  geometry.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction));
  const middle = from.clone().add(to).multiplyScalar(0.5);
  geometry.translate(middle.x, middle.y, middle.z);
  return geometry;
}

export function feedGeometry(): BufferGeometry {
  const focus = new Vector3(0, FOCAL_LENGTH + 0.08, 0);
  const parts: BufferGeometry[] = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const r = BOWL_RADIUS * 0.93;
    parts.push(strut(new Vector3(Math.cos(a) * r, bowlDepth(r) + 0.08, Math.sin(a) * r), focus, 0.022));
  }
  const cabin = new BoxGeometry(0.2, 0.26, 0.2);
  cabin.translate(0, focus.y + 0.1, 0);
  parts.push(cabin);
  // The hub behind the reflector, where the yoke grips it.
  const hub = new CylinderGeometry(0.32, 0.26, 0.34, 12);
  hub.translate(0, -0.08, 0);
  parts.push(hub);
  const axle = new CylinderGeometry(0.06, 0.06, 0.86, 8);
  axle.rotateZ(Math.PI / 2);
  parts.push(axle);
  const merged = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)));
  parts.forEach((p) => p.dispose());
  return merged;
}

export function mountGeometry(pivot: number): BufferGeometry {
  const plinth = new BoxGeometry(1.5, 0.22, 1.5);
  plinth.translate(0, 0.11, 0);
  const pedestal = new CylinderGeometry(0.3, 0.44, pivot - 0.55, 16);
  pedestal.translate(0, 0.22 + (pivot - 0.55) / 2, 0);
  const turret = new BoxGeometry(0.9, 0.3, 0.56);
  turret.translate(0, pivot - 0.42, 0);
  const armL = new BoxGeometry(0.1, 0.62, 0.34);
  armL.translate(-0.4, pivot - 0.08, 0);
  const armR = new BoxGeometry(0.1, 0.62, 0.34);
  armR.translate(0.4, pivot - 0.08, 0);
  const parts = [plinth, pedestal, turret, armL, armR];
  const merged = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)));
  parts.forEach((p) => p.dispose());
  return merged;
}

/** Local position of the feed cabin (for the burst glow), in the reflector's frame. */
export const FEED_POINT = new Vector3(0, FOCAL_LENGTH + 0.2, 0);

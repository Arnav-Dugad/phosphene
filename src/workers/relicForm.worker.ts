import { generateRelicForm, type RelicKind } from '../lib/relicGeometry.ts';

/**
 * Generates relic reconstructions off the main thread. Tens of thousands of
 * surface samples and every engraving line are computed here and returned
 * as transferable buffers, so opening a relic never stalls the interface.
 */
export interface RelicFormRequest {
  id: number;
  kind: RelicKind;
  seed: number;
  detail: number;
}

export interface RelicFormResponse {
  id: number;
  points: Float32Array;
  weights: Float32Array;
  /** Line segments as pairs of xyz endpoints, for LineSegments. */
  segments: Float32Array;
}

/** The slice of the worker global scope used here (the app compiles against the DOM lib). */
interface WorkerScope {
  onmessage: ((event: MessageEvent<RelicFormRequest>) => void) | null;
  postMessage(message: RelicFormResponse, transfer: Transferable[]): void;
}

const scope = self as unknown as WorkerScope;

scope.onmessage = (event: MessageEvent<RelicFormRequest>) => {
  const { id, kind, seed, detail } = event.data;
  const form = generateRelicForm(kind, seed, detail);
  let count = 0;
  for (const pl of form.polylines) count += Math.max(0, pl.length / 3 - 1);
  const segments = new Float32Array(count * 6);
  let o = 0;
  for (const pl of form.polylines) {
    for (let i = 0; i + 5 < pl.length; i += 3) {
      for (let k = 0; k < 6; k++) segments[o++] = pl[i + k] as number;
    }
  }
  const response: RelicFormResponse = { id, points: form.points, weights: form.weights, segments };
  scope.postMessage(response, [form.points.buffer, form.weights.buffer, segments.buffer]);
};

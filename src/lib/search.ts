/**
 * Fuzzy subsequence matching for the command palette and archive search.
 *
 * A query matches a candidate when its characters appear in order. The score
 * rewards contiguous runs, matches at word starts and early positions, so
 * "arc" ranks "Archive" above "Resonant Library Carrier".
 */

export interface FuzzyMatch {
  score: number;
  /** Indices into the candidate string that matched, for highlighting. */
  indices: number[];
}

const WORD_BOUNDARY = /[\s\-_/·.:,()'’]/;

const normalize = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function fuzzyMatch(query: string, candidate: string): FuzzyMatch | null {
  const q = normalize(query.trim());
  if (!q) return { score: 0, indices: [] };
  const c = normalize(candidate);

  // Exact substring gets a large bonus and deterministic indices.
  const direct = c.indexOf(q);
  if (direct !== -1) {
    const atBoundary = direct === 0 || WORD_BOUNDARY.test(c[direct - 1] ?? ' ');
    return {
      score: 1000 + (atBoundary ? 200 : 0) - direct * 2 - (c.length - q.length) * 0.5,
      indices: Array.from({ length: q.length }, (_, i) => direct + i),
    };
  }

  const indices: number[] = [];
  let score = 0;
  let ci = 0;
  let run = 0;
  for (let qi = 0; qi < q.length; qi++) {
    const ch = q[qi];
    if (ch === ' ') continue;
    let found = -1;
    while (ci < c.length) {
      if (c[ci] === ch) {
        found = ci;
        break;
      }
      ci++;
    }
    if (found === -1) return null;
    const prev = indices[indices.length - 1];
    run = prev !== undefined && prev === found - 1 ? run + 1 : 0;
    const boundary = found === 0 || WORD_BOUNDARY.test(c[found - 1] ?? ' ');
    score += 10 + run * 12 + (boundary ? 24 : 0) - Math.min(found, 40) * 0.25;
    indices.push(found);
    ci = found + 1;
  }
  score -= (c.length - indices.length) * 0.15;
  return { score, indices };
}

export interface Searchable {
  /** Primary text shown to the user. */
  readonly title: string;
  /** Secondary fields searched with a lower weight. */
  readonly keywords?: readonly string[];
}

export interface RankedResult<T> {
  item: T;
  score: number;
  indices: number[];
}

/** Ranks items by best match over title (full weight) and keywords (reduced). */
export function rank<T extends Searchable>(
  query: string,
  items: readonly T[],
  limit = 50,
): RankedResult<T>[] {
  if (!query.trim()) return items.slice(0, limit).map((item) => ({ item, score: 0, indices: [] }));
  const results: RankedResult<T>[] = [];
  for (const item of items) {
    const titleMatch = fuzzyMatch(query, item.title);
    let best: RankedResult<T> | null = titleMatch
      ? { item, score: titleMatch.score, indices: titleMatch.indices }
      : null;
    for (const keyword of item.keywords ?? []) {
      const m = fuzzyMatch(query, keyword);
      if (m && (!best || m.score * 0.6 > best.score)) best = { item, score: m.score * 0.6, indices: [] };
    }
    if (best) results.push(best);
  }
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

/** Splits text into highlighted / plain segments for rendering. */
export function highlightSegments(
  text: string,
  indices: readonly number[],
): { text: string; hit: boolean }[] {
  if (indices.length === 0) return [{ text, hit: false }];
  const set = new Set(indices);
  const segments: { text: string; hit: boolean }[] = [];
  let current = '';
  let currentHit = set.has(0);
  for (let i = 0; i < text.length; i++) {
    const hit = set.has(i);
    if (hit !== currentHit && current) {
      segments.push({ text: current, hit: currentHit });
      current = '';
    }
    currentHit = hit;
    current += text[i];
  }
  if (current) segments.push({ text: current, hit: currentHit });
  return segments;
}

/**
 * Structural comparison between two JSON payloads.
 * The response comparison feature is not surfaced in Phase 1, but the viewer
 * and history already carry everything this needs, so the algorithm lives here
 * ready to be wired to a UI.
 */
import { typeOf } from './json.js';

const MAX_DIFFS = 2000;

export function compareJson(previous, current) {
  const added = [];
  const removed = [];
  const changed = [];
  const typeChanged = [];
  let truncated = false;

  const walk = (a, b, path) => {
    if (added.length + removed.length + changed.length + typeChanged.length >= MAX_DIFFS) {
      truncated = true;
      return;
    }
    const typeA = typeOf(a);
    const typeB = typeOf(b);

    if (typeA !== typeB) {
      typeChanged.push({ path, from: typeA, to: typeB, before: a, after: b });
      return;
    }
    if (typeA === 'object') {
      const keys = new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})]);
      for (const key of keys) {
        const childPath = path ? `${path}.${key}` : key;
        const inA = Object.prototype.hasOwnProperty.call(a, key);
        const inB = Object.prototype.hasOwnProperty.call(b, key);
        if (!inA) added.push({ path: childPath, value: b[key] });
        else if (!inB) removed.push({ path: childPath, value: a[key] });
        else walk(a[key], b[key], childPath);
      }
      return;
    }
    if (typeA === 'array') {
      const length = Math.max(a.length, b.length);
      for (let index = 0; index < length; index += 1) {
        const childPath = `${path}[${index}]`;
        if (index >= a.length) added.push({ path: childPath, value: b[index] });
        else if (index >= b.length) removed.push({ path: childPath, value: a[index] });
        else walk(a[index], b[index], childPath);
      }
      return;
    }
    if (a !== b) changed.push({ path, before: a, after: b });
  };

  walk(previous, current, '');
  return {
    added,
    removed,
    changed,
    typeChanged,
    truncated,
    identical: !added.length && !removed.length && !changed.length && !typeChanged.length,
  };
}

/** One line summary for a future comparison panel. */
export function summarizeDiff(diff) {
  if (diff.identical) return 'Both responses are identical.';
  const parts = [];
  if (diff.added.length) parts.push(`${diff.added.length} added`);
  if (diff.removed.length) parts.push(`${diff.removed.length} removed`);
  if (diff.changed.length) parts.push(`${diff.changed.length} changed`);
  if (diff.typeChanged.length) parts.push(`${diff.typeChanged.length} type changes`);
  return parts.join(', ');
}

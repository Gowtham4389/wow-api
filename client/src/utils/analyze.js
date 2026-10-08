import { typeOf } from './json.js';

const PAGINATION_KEYS = [
  'page', 'pages', 'per_page', 'perpage', 'pagesize', 'page_size', 'limit', 'offset', 'skip',
  'take', 'total', 'total_count', 'totalcount', 'totalpages', 'total_pages', 'count', 'next',
  'previous', 'prev', 'next_page', 'prev_page', 'next_cursor', 'cursor', 'has_more', 'hasmore',
  'has_next', 'hasnext', 'first', 'last', 'links', 'meta', 'pagination', 'results', 'data', 'items',
];

const ID_KEYS = /^(_?id|.*_id|.*id|uuid|guid|key|slug|code|ref|reference)$/i;
const DATE_KEYS = /(date|time|_at$|^at$|timestamp|created|updated|deleted|expires|issued|modified)/i;
const URL_KEYS = /(url|uri|link|href|src|image|avatar|photo|thumbnail|icon|website|endpoint)/i;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/;
const URL_VALUE = /^(https?:\/\/|\/\/|www\.)\S+$/i;

/** Ceiling on traversal so a pathological response cannot lock the UI. */
const MAX_NODES = 200_000;

/**
 * Walk a parsed JSON response and collect structural facts about it.
 * Everything here is descriptive; nothing is inferred that the data does not
 * actually show.
 */
export function analyzeJson(data) {
  const stats = {
    rootType: typeOf(data),
    records: 0,
    objects: 0,
    arrays: 0,
    maxDepth: 0,
    nullValues: 0,
    emptyValues: 0,
    totalKeys: 0,
    uniqueKeys: new Set(),
    types: {},
    rootProperties: [],
    pagination: [],
    idFields: [],
    dateFields: [],
    urlFields: [],
    truncated: false,
  };

  let visited = 0;
  const idFields = new Set();
  const dateFields = new Set();
  const urlFields = new Set();

  const countType = (value) => {
    const type = typeOf(value);
    stats.types[type] = (stats.types[type] ?? 0) + 1;
    return type;
  };

  const walk = (value, depth, key) => {
    if (visited >= MAX_NODES) {
      stats.truncated = true;
      return;
    }
    visited += 1;
    stats.maxDepth = Math.max(stats.maxDepth, depth);

    const type = countType(value);
    if (type === 'null') stats.nullValues += 1;
    if (value === '' || (type === 'array' && value.length === 0) ||
        (type === 'object' && Object.keys(value).length === 0)) {
      stats.emptyValues += 1;
    }

    if (key) {
      const lower = key.toLowerCase();
      if (ID_KEYS.test(lower)) idFields.add(key);
      if (DATE_KEYS.test(lower) || (type === 'string' && ISO_DATE.test(value))) dateFields.add(key);
      if (URL_KEYS.test(lower) || (type === 'string' && URL_VALUE.test(value))) urlFields.add(key);
    }

    if (type === 'array') {
      stats.arrays += 1;
      for (const item of value) walk(item, depth + 1, key);
      return;
    }
    if (type === 'object') {
      stats.objects += 1;
      for (const [childKey, childValue] of Object.entries(value)) {
        stats.totalKeys += 1;
        stats.uniqueKeys.add(childKey);
        walk(childValue, depth + 1, childKey);
      }
    }
  };

  walk(data, 1, null);

  // "Records" is the count that a developer would report for this payload:
  // the length of the root array, or of the first array of objects inside it.
  if (Array.isArray(data)) {
    stats.records = data.length;
  } else if (data && typeof data === 'object') {
    const collection = Object.entries(data).find(
      ([, value]) => Array.isArray(value) && value.some((item) => item && typeof item === 'object'),
    );
    stats.records = collection ? collection[1].length : 1;
    stats.recordsFrom = collection ? collection[0] : null;
  } else {
    stats.records = data === undefined ? 0 : 1;
  }

  if (data && typeof data === 'object' && !Array.isArray(data)) {
    stats.rootProperties = Object.entries(data).map(([key, value]) => ({
      key,
      type: typeOf(value),
      size: Array.isArray(value) ? value.length : undefined,
    }));
    stats.pagination = Object.keys(data).filter((key) =>
      PAGINATION_KEYS.includes(key.toLowerCase().replace(/[\s-]/g, '_')),
    );
    // Pagination metadata is often nested under meta/pagination/links.
    for (const container of ['meta', 'pagination', 'links', '_links', '_meta']) {
      const nested = data[container];
      if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
        for (const key of Object.keys(nested)) {
          if (PAGINATION_KEYS.includes(key.toLowerCase().replace(/[\s-]/g, '_'))) {
            stats.pagination.push(`${container}.${key}`);
          }
        }
      }
    }
  } else if (Array.isArray(data) && data.length && data[0] && typeof data[0] === 'object') {
    stats.rootProperties = Object.entries(data[0]).map(([key, value]) => ({
      key,
      type: typeOf(value),
      size: Array.isArray(value) ? value.length : undefined,
    }));
  }

  stats.pagination = [...new Set(stats.pagination)];
  stats.idFields = [...idFields].slice(0, 25);
  stats.dateFields = [...dateFields].slice(0, 25);
  stats.urlFields = [...urlFields].slice(0, 25);
  stats.uniqueKeyCount = stats.uniqueKeys.size;
  delete stats.uniqueKeys;
  return stats;
}

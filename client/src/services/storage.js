/**
 * Thin, namespaced wrapper around localStorage.
 * Every read is defensive: a corrupted or unavailable store must never stop
 * the app from loading.
 */
const PREFIX = 'api-inspector.';

export const STORAGE_KEYS = {
  theme: `${PREFIX}theme`,
  history: `${PREFIX}history`,
  saved: `${PREFIX}saved`,
  collections: `${PREFIX}collections`,
  settings: `${PREFIX}settings`,
  draft: `${PREFIX}draft`,
};

let available = null;

function isAvailable() {
  if (available !== null) return available;
  try {
    const probe = `${PREFIX}__probe__`;
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    available = true;
  } catch {
    available = false;
  }
  return available;
}

export function readStorage(key, fallback) {
  if (!isAvailable()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeStorage(key, value) {
  if (!isAvailable()) return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    // Most likely the quota was exceeded by a large history.
    console.warn('[api-inspector] could not persist', key, error?.name);
    return false;
  }
}

export function removeStorage(key) {
  if (!isAvailable()) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export const storageAvailable = () => isAvailable();

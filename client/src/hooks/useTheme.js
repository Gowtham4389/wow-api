import { useCallback, useEffect, useState } from 'react';
import { STORAGE_KEYS, readStorage, writeStorage } from '../services/storage.js';

export const THEMES = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

const prefersDark = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;

/** Theme preference with a `system` option that follows the OS live. */
export function useTheme() {
  const [theme, setTheme] = useState(() => readStorage(STORAGE_KEYS.theme, 'system'));
  const [resolved, setResolved] = useState(() =>
    (readStorage(STORAGE_KEYS.theme, 'system') === 'system' ? (prefersDark() ? 'dark' : 'light') : readStorage(STORAGE_KEYS.theme, 'system')),
  );

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const next = theme === 'system' ? (media.matches ? 'dark' : 'light') : theme;
      setResolved(next);
      document.documentElement.dataset.theme = next;
    };
    apply();
    if (theme !== 'system') return undefined;
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);

  const update = useCallback((next) => {
    setTheme(next);
    writeStorage(STORAGE_KEYS.theme, next);
  }, []);

  const toggle = useCallback(() => {
    update(resolved === 'dark' ? 'light' : 'dark');
  }, [resolved, update]);

  return { theme, resolvedTheme: resolved, setTheme: update, toggleTheme: toggle };
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { readStorage, writeStorage } from '../services/storage.js';

/** State that mirrors itself into localStorage, with lazy initial read. */
export function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => readStorage(key, initialValue));
  const keyRef = useRef(key);

  useEffect(() => {
    keyRef.current = key;
  }, [key]);

  const update = useCallback((next) => {
    setValue((previous) => {
      const resolved = typeof next === 'function' ? next(previous) : next;
      writeStorage(keyRef.current, resolved);
      return resolved;
    });
  }, []);

  return [value, update];
}

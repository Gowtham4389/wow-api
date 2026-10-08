import { useEffect } from 'react';

const isEditable = (element) =>
  element &&
  (element.tagName === 'INPUT' ||
    element.tagName === 'TEXTAREA' ||
    element.tagName === 'SELECT' ||
    element.isContentEditable);

/**
 * Global shortcuts. Handlers are keyed by a normalised combination such as
 * `mod+enter`, `mod+k` or `?`. Plain-letter shortcuts are ignored while the
 * user is typing in a field.
 */
export function useHotkeys(handlers, { enabled = true } = {}) {
  useEffect(() => {
    if (!enabled) return undefined;

    const onKeyDown = (event) => {
      const mod = event.metaKey || event.ctrlKey;
      const parts = [];
      if (mod) parts.push('mod');
      if (event.shiftKey) parts.push('shift');
      if (event.altKey) parts.push('alt');

      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key.toLowerCase();
      parts.push(key);
      const combination = parts.join('+');

      const handler = handlers[combination];
      if (!handler) return;
      if (!mod && !['escape', 'f1'].includes(key) && isEditable(event.target)) return;

      event.preventDefault();
      handler(event);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handlers, enabled]);
}

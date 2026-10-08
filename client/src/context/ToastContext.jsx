import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { uid } from '../utils/id.js';

const ToastContext = createContext(null);

const DEFAULT_DURATION = 4000;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (toast) => {
      const id = uid('toast');
      const entry = { id, tone: 'info', duration: DEFAULT_DURATION, ...toast };
      setToasts((current) => [...current.slice(-3), entry]);
      if (entry.duration > 0) {
        timers.current.set(id, setTimeout(() => dismiss(id), entry.duration));
      }
      return id;
    },
    [dismiss],
  );

  const value = useMemo(
    () => ({
      toasts,
      dismiss,
      notify: push,
      success: (message, options) => push({ tone: 'success', message, ...options }),
      error: (message, options) => push({ tone: 'error', message, duration: 6000, ...options }),
      info: (message, options) => push({ tone: 'info', message, ...options }),
      warning: (message, options) => push({ tone: 'warning', message, duration: 5000, ...options }),
    }),
    [toasts, push, dismiss],
  );

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside a ToastProvider');
  return context;
}

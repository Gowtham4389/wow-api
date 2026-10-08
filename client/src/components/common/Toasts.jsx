import { useToast } from '../../context/ToastContext.jsx';
import Icon from './Icon.jsx';

const ICONS = {
  success: 'check',
  error: 'alert',
  warning: 'alert',
  info: 'info',
};

/** Live region so notifications are announced to screen readers. */
export function Toasts() {
  const { toasts, dismiss } = useToast();

  return (
    <div className="toasts" role="region" aria-label="Notifications">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="toast"
          data-tone={toast.tone}
          role={toast.tone === 'error' ? 'alert' : 'status'}
          aria-live={toast.tone === 'error' ? 'assertive' : 'polite'}
        >
          <span className="toast__icon">
            <Icon name={ICONS[toast.tone] ?? 'info'} size={16} />
          </span>
          <div className="toast__body">
            <p className="toast__message">{toast.message}</p>
            {toast.description && <p className="toast__description">{toast.description}</p>}
          </div>
          <button type="button" className="btn btn--ghost btn--icon btn--sm" onClick={() => dismiss(toast.id)} aria-label="Dismiss notification">
            <Icon name="close" size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

export default Toasts;

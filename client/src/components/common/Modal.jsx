import { useCallback, useEffect, useRef } from 'react';
import Icon from './Icon.jsx';

/** Accessible dialog: focus trap, Escape to close, scrim click to dismiss. */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 640,
  flush = false,
  labelledBy = 'modal-title',
}) {
  const dialogRef = useRef(null);
  const previouslyFocused = useRef(null);

  const handleKeyDown = useCallback(
    (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose?.();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = dialogRef.current?.querySelectorAll(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return undefined;
    previouslyFocused.current = document.activeElement;
    const timer = setTimeout(() => {
      const target = dialogRef.current?.querySelector('[data-autofocus]') ?? dialogRef.current;
      target?.focus?.();
    }, 10);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    return () => {
      clearTimeout(timer);
      document.body.style.overflow = overflow;
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="modal" role="presentation">
      <div className="modal__scrim" onClick={onClose} />
      <div
        className="modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        style={{ '--modal-width': `${width}px` }}
        ref={dialogRef}
        onKeyDown={handleKeyDown}
        tabIndex={-1}
      >
        <header className="modal__header">
          <div>
            <h2 className="modal__title" id={labelledBy}>
              {title}
            </h2>
            {subtitle && <p className="modal__subtitle">{subtitle}</p>}
          </div>
          <div className="modal__spacer" />
          <button type="button" className="btn btn--ghost btn--icon btn--sm" onClick={onClose} aria-label="Close dialog">
            <Icon name="close" size={16} />
          </button>
        </header>

        <div className={`modal__body${flush ? ' modal__body--flush' : ''}`}>{children}</div>

        {footer && <footer className="modal__footer">{footer}</footer>}
      </div>
    </div>
  );
}

export default Modal;

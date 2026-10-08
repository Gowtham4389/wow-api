import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import Tooltip from './Tooltip.jsx';

/**
 * Two-step destructive action: the first click arms the button, the second
 * confirms. Avoids a modal for small deletions without risking a misclick.
 */
export function ConfirmButton({ label, confirmLabel = 'Click again to confirm', icon = 'trash', onConfirm, size = 'sm' }) {
  const [armed, setArmed] = useState(false);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <Tooltip label={armed ? confirmLabel : label}>
      <button
        type="button"
        className={`btn btn--icon btn--${armed ? 'danger' : 'ghost'}${size === 'sm' ? ' btn--sm' : ''}`}
        aria-label={armed ? confirmLabel : label}
        onClick={(event) => {
          event.stopPropagation();
          if (armed) {
            clearTimeout(timer.current);
            setArmed(false);
            onConfirm();
            return;
          }
          setArmed(true);
          timer.current = setTimeout(() => setArmed(false), 3000);
        }}
      >
        <Icon name={armed ? 'alert' : icon} size={14} />
      </button>
    </Tooltip>
  );
}

export default ConfirmButton;

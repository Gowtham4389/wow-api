import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import Tooltip from './Tooltip.jsx';
import { copyToClipboard } from '../../utils/download.js';

/** Copy control with inline confirmation, used across the whole app. */
export function CopyButton({
  value,
  label = 'Copy',
  copiedLabel = 'Copied',
  withText = false,
  size = 'sm',
  tone = 'ghost',
  onCopied,
  disabled = false,
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const handleCopy = useCallback(
    async (event) => {
      event.stopPropagation();
      const text = typeof value === 'function' ? value() : value;
      const ok = await copyToClipboard(String(text ?? ''));
      if (!ok) return;
      setCopied(true);
      onCopied?.();
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1600);
    },
    [value, onCopied],
  );

  const button = (
    <button
      type="button"
      className={`btn btn--${tone}${size === 'sm' ? ' btn--sm' : ''}${withText ? '' : ' btn--icon'}`}
      onClick={handleCopy}
      disabled={disabled}
      aria-label={withText ? undefined : copied ? copiedLabel : label}
    >
      <Icon name={copied ? 'check' : 'copy'} size={14} />
      {withText && <span>{copied ? copiedLabel : label}</span>}
    </button>
  );

  return withText ? button : <Tooltip label={copied ? copiedLabel : label}>{button}</Tooltip>;
}

export default CopyButton;

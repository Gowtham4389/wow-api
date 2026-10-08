import Icon from './Icon.jsx';
import Tooltip from './Tooltip.jsx';

/** Icon-only button that always carries an accessible label. */
export function IconButton({
  icon,
  label,
  onClick,
  size = 'sm',
  tone = 'ghost',
  placement = 'bottom',
  iconSize = 15,
  disabled = false,
  active = false,
  type = 'button',
  ...rest
}) {
  return (
    <Tooltip label={label} placement={placement}>
      <button
        type={type}
        className={`btn btn--icon btn--${tone}${size === 'sm' ? ' btn--sm' : ''}`}
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        aria-pressed={active || undefined}
        {...rest}
      >
        <Icon name={icon} size={iconSize} />
      </button>
    </Tooltip>
  );
}

export default IconButton;

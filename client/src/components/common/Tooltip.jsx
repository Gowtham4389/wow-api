/** Lightweight CSS tooltip. `label` is also used as the accessible name. */
export function Tooltip({ label, placement = 'bottom', children, className = '' }) {
  if (!label) return children;
  return (
    <span className={`tooltip ${className}`} data-placement={placement}>
      {children}
      <span className="tooltip__bubble" role="tooltip">
        {label}
      </span>
    </span>
  );
}

export default Tooltip;

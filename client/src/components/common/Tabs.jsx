/**
 * Tab strip following the WAI-ARIA tabs pattern, including arrow key support.
 * Tabs are rendered as buttons; the caller renders the matching panel.
 */
export function Tabs({ tabs, value, onChange, className = '', ariaLabel = 'Tabs' }) {
  const handleKeyDown = (event) => {
    const index = tabs.findIndex((tab) => tab.value === value);
    if (index === -1) return;

    let next = null;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = tabs.length - 1;
    if (next === null) return;

    event.preventDefault();
    onChange(tabs[next].value);
  };

  return (
    <div className={`tabs ${className}`} role="tablist" aria-label={ariaLabel} onKeyDown={handleKeyDown}>
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          id={`tab-${tab.value}`}
          aria-selected={tab.value === value}
          aria-controls={`panel-${tab.value}`}
          tabIndex={tab.value === value ? 0 : -1}
          className="tabs__tab"
          onClick={() => onChange(tab.value)}
        >
          {tab.label}
          {tab.count ? <span className="badge badge--count">{tab.count}</span> : null}
          {tab.dot ? <span className="badge badge--accent">•</span> : null}
        </button>
      ))}
    </div>
  );
}

export default Tabs;

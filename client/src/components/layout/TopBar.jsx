import { useApp } from '../../context/AppContext.jsx';
import Icon from '../common/Icon.jsx';
import IconButton from '../common/IconButton.jsx';

const THEME_ICON = { light: 'sun', dark: 'moon', system: 'monitor' };

export function TopBar({
  onToggleSidebar,
  sidebarCollapsed,
  theme,
  onCycleTheme,
  onImportCurl,
  onPerformance,
  onShortcuts,
  title,
  isMobile,
}) {
  const { request, sending, proxyInfo, settings } = useApp();

  return (
    <header className="topbar">
      <IconButton
        icon={isMobile ? 'menu' : sidebarCollapsed ? 'chevronRight' : 'chevronLeft'}
        label={isMobile ? 'Open navigation' : sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
        onClick={onToggleSidebar}
        size="md"
      />

      <span className="topbar__title truncate">
        {title ?? (request.name || 'Untitled request')}
      </span>

      {sending && (
        <span className="badge badge--accent">
          <span className="spinner" style={{ width: 11, height: 11 }} />
          Sending
        </span>
      )}

      <div className="topbar__spacer" />

      <div className="topbar__actions">
        {!proxyInfo && settings.sendMode === 'proxy' && (
          <span className="badge badge--warning" title="The backend proxy did not answer. Start the server or switch to Direct mode in Settings.">
            <Icon name="alert" size={12} />
            Proxy offline
          </span>
        )}
        <IconButton icon="terminal" label="Import cURL command" onClick={onImportCurl} size="md" />
        <IconButton icon="activity" label="Performance test" onClick={onPerformance} size="md" />
        <IconButton icon="info" label="Keyboard shortcuts" onClick={onShortcuts} size="md" />
        <IconButton
          icon={THEME_ICON[theme] ?? 'monitor'}
          label={`Theme: ${theme}. Click to change.`}
          onClick={onCycleTheme}
          size="md"
        />
      </div>
    </header>
  );
}

export default TopBar;

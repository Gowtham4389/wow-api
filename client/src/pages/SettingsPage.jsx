import { useApp } from '../context/AppContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { THEMES } from '../hooks/useTheme.js';
import { formatBytes } from '../utils/format.js';
import Icon from '../components/common/Icon.jsx';
import { storageAvailable } from '../services/storage.js';

function Row({ label, description, children }) {
  return (
    <div className="settings__row">
      <div>
        <p className="settings__label">{label}</p>
        <p className="settings__description">{description}</p>
      </div>
      <div className="settings__control">{children}</div>
    </div>
  );
}

export function SettingsPage({ theme, onThemeChange }) {
  const { settings, updateSettings, proxyInfo, history, saved, historyActions, savedActions } = useApp();
  const toast = useToast();

  return (
    <div className="page">
      <div className="page__inner">
        <header className="page__header">
          <h1 className="page__title">Settings</h1>
          <p className="page__subtitle">Preferences are stored in this browser only. Nothing is sent to a server.</p>
        </header>

        <div className="stack" style={{ gap: 'var(--space-4)' }}>
          <section className="card">
            <header className="card__header">
              <h2 className="card__title">Appearance</h2>
            </header>
            <div className="card__body settings">
              <Row label="Theme" description="System follows your operating system setting.">
                <div className="settings__segment">
                  {THEMES.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={theme === option.value}
                      onClick={() => onThemeChange(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </Row>

              <Row label="Wrap long lines" description="Applies to the raw response view.">
                <label className="switch">
                  <input
                    type="checkbox"
                    className="visually-hidden"
                    checked={settings.wrapLines}
                    onChange={(event) => updateSettings({ wrapLines: event.target.checked })}
                  />
                  <span className="switch__track">
                    <span className="switch__thumb" />
                  </span>
                  <span>{settings.wrapLines ? 'On' : 'Off'}</span>
                </label>
              </Row>
            </div>
          </section>

          <section className="card">
            <header className="card__header">
              <h2 className="card__title">Requests</h2>
            </header>
            <div className="card__body settings">
              <Row
                label="Send mode"
                description="Proxy routes requests through the backend: no CORS limits and all response headers are visible. Direct sends from the browser, which is the only way to reach a localhost API."
              >
                <div className="settings__segment">
                  <button type="button" aria-pressed={settings.sendMode === 'proxy'} onClick={() => updateSettings({ sendMode: 'proxy' })}>
                    Proxy
                  </button>
                  <button type="button" aria-pressed={settings.sendMode === 'direct'} onClick={() => updateSettings({ sendMode: 'direct' })}>
                    Direct
                  </button>
                </div>
              </Row>

              <Row label="Request timeout" description="How long to wait for a response before giving up.">
                <select
                  className="select"
                  value={settings.timeout}
                  onChange={(event) => updateSettings({ timeout: Number(event.target.value) })}
                >
                  {[5000, 10000, 30000, 60000].map((value) => (
                    <option key={value} value={value}>
                      {value / 1000} seconds
                    </option>
                  ))}
                </select>
              </Row>

              <Row
                label="Large response warning"
                description="Above this size the JSON tree is only built after you confirm, so the interface stays responsive."
              >
                <select
                  className="select"
                  value={settings.largeResponseThreshold}
                  onChange={(event) => updateSettings({ largeResponseThreshold: Number(event.target.value) })}
                >
                  {[512 * 1024, 1024 * 1024, 2 * 1024 * 1024, 5 * 1024 * 1024].map((value) => (
                    <option key={value} value={value}>
                      {formatBytes(value)}
                    </option>
                  ))}
                </select>
              </Row>
            </div>
          </section>

          <section className="card">
            <header className="card__header">
              <h2 className="card__title">Privacy & storage</h2>
            </header>
            <div className="card__body settings">
              <Row
                label="Save credentials"
                description="Off by default. When off, tokens and passwords are kept in memory for the session only; history and saved requests store everything except the secret values."
              >
                <label className="switch">
                  <input
                    type="checkbox"
                    className="visually-hidden"
                    checked={settings.saveSecrets}
                    onChange={(event) => {
                      updateSettings({ saveSecrets: event.target.checked });
                      if (event.target.checked) {
                        toast.warning('Credentials will now be written to this browser’s local storage.');
                      }
                    }}
                  />
                  <span className="switch__track">
                    <span className="switch__thumb" />
                  </span>
                  <span>{settings.saveSecrets ? 'On' : 'Off'}</span>
                </label>
              </Row>

              <Row label="Stored data" description={`${history.length} history entries and ${saved.length} saved requests in this browser.`}>
                <div className="row" style={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn--sm btn--danger"
                    onClick={() => {
                      historyActions.clearAll();
                      toast.success('History cleared.');
                    }}
                  >
                    Clear history
                  </button>
                  <button
                    type="button"
                    className="btn btn--sm btn--danger"
                    onClick={() => {
                      savedActions.clear();
                      toast.success('Saved requests cleared.');
                    }}
                  >
                    Clear saved
                  </button>
                </div>
              </Row>

              {!storageAvailable() && (
                <div className="notice notice--warning">
                  <Icon name="alert" size={15} />
                  <span>Local storage is unavailable in this browser, so history and settings will not persist.</span>
                </div>
              )}
            </div>
          </section>

          <section className="card">
            <header className="card__header">
              <h2 className="card__title">Backend</h2>
              <div className="card__spacer" />
              <span className={`badge ${proxyInfo ? 'badge--success' : 'badge--warning'}`}>
                {proxyInfo ? 'Connected' : 'Unavailable'}
              </span>
            </header>
            <div className="card__body settings">
              {proxyInfo ? (
                <>
                  <Row label="Maximum response size" description="Larger responses are truncated by the proxy.">
                    <span className="mono">{formatBytes(proxyInfo.maxResponseSize)}</span>
                  </Row>
                  <Row label="Proxy timeout" description="Server-side ceiling for a single request.">
                    <span className="mono">{proxyInfo.requestTimeout / 1000} s</span>
                  </Row>
                  <Row label="Redirects followed" description="Each hop is re-checked against the SSRF rules.">
                    <span className="mono">{proxyInfo.maxRedirects}</span>
                  </Row>
                  <Row label="Rate limit" description="Per client, per window.">
                    <span className="mono">
                      {proxyInfo.rateLimit.max} / {proxyInfo.rateLimit.windowMs / 1000}s
                    </span>
                  </Row>
                  {proxyInfo.allowPrivateNetwork && (
                    <div className="notice notice--warning">
                      <Icon name="alert" size={15} />
                      <span>
                        The server runs with ALLOW_PRIVATE_NETWORK enabled. That is fine for local development but must
                        never be used in production.
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <div className="notice notice--warning">
                  <Icon name="alert" size={15} />
                  <span>
                    The backend is not reachable. Start it with <code>npm run dev:server</code>, or switch Send mode to
                    Direct to send requests straight from the browser.
                  </span>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;

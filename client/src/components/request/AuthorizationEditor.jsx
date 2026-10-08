import { useApp } from '../../context/AppContext.jsx';
import { AUTH_TYPES, resolveAuth } from '../../utils/auth.js';
import Icon from '../common/Icon.jsx';

export function AuthorizationEditor() {
  const { request, setAuth, settings } = useApp();
  const auth = request.auth;
  const resolved = resolveAuth(auth);

  const setType = (type) => setAuth((current) => ({ ...current, type }));
  const patch = (section, values) =>
    setAuth((current) => ({ ...current, [section]: { ...current[section], ...values } }));

  return (
    <div className="auth-editor">
      <div className="field" style={{ maxWidth: 260 }}>
        <label className="field__label" htmlFor="auth-type">
          Type
        </label>
        <select id="auth-type" className="select" value={auth.type} onChange={(event) => setType(event.target.value)}>
          {AUTH_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>

      {auth.type === 'bearer' && (
        <div className="field">
          <label className="field__label" htmlFor="auth-bearer">
            Token
          </label>
          <input
            id="auth-bearer"
            className="input mono"
            type="password"
            autoComplete="off"
            spellCheck="false"
            placeholder="eyJhbGciOi..."
            value={auth.bearer.token}
            onChange={(event) => patch('bearer', { token: event.target.value })}
          />
          <p className="field__hint">Sent as <code>Authorization: Bearer &lt;token&gt;</code>.</p>
        </div>
      )}

      {auth.type === 'basic' && (
        <div className="auth-editor__grid">
          <div className="field">
            <label className="field__label" htmlFor="auth-user">
              Username
            </label>
            <input
              id="auth-user"
              className="input"
              autoComplete="off"
              value={auth.basic.username}
              onChange={(event) => patch('basic', { username: event.target.value })}
            />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="auth-password">
              Password
            </label>
            <input
              id="auth-password"
              className="input"
              type="password"
              autoComplete="off"
              value={auth.basic.password}
              onChange={(event) => patch('basic', { password: event.target.value })}
            />
          </div>
        </div>
      )}

      {auth.type === 'apikey' && (
        <>
          <div className="auth-editor__grid">
            <div className="field">
              <label className="field__label" htmlFor="auth-key">
                Key
              </label>
              <input
                id="auth-key"
                className="input mono"
                autoComplete="off"
                placeholder="X-API-Key"
                value={auth.apiKey.key}
                onChange={(event) => patch('apiKey', { key: event.target.value })}
              />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="auth-value">
                Value
              </label>
              <input
                id="auth-value"
                className="input mono"
                type="password"
                autoComplete="off"
                value={auth.apiKey.value}
                onChange={(event) => patch('apiKey', { value: event.target.value })}
              />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="auth-in">
                Add to
              </label>
              <select
                id="auth-in"
                className="select"
                value={auth.apiKey.in}
                onChange={(event) => patch('apiKey', { in: event.target.value })}
              >
                <option value="header">Header</option>
                <option value="query">Query parameter</option>
              </select>
            </div>
          </div>
          {auth.apiKey.key && (
            <p className="auth-editor__preview">
              {auth.apiKey.in === 'query'
                ? `Appended to the URL as ?${auth.apiKey.key}=…`
                : `Sent as the header ${auth.apiKey.key}: …`}
            </p>
          )}
        </>
      )}

      {auth.type === 'none' && (
        <p className="field__hint">This request is sent without an Authorization header.</p>
      )}

      <div className="auth-editor__note">
        <Icon name="shield" size={15} />
        <span>
          {settings.saveSecrets
            ? 'Credentials are stored in this browser because "Save credentials" is enabled in Settings. Anyone with access to this browser profile can read them.'
            : 'Credentials stay in memory for this session only. History and saved requests keep the configuration but not the secret values.'}
          {Object.keys(resolved.headers).length > 0 && ' The generated header is visible in the Headers tab.'}
        </span>
      </div>
    </div>
  );
}

export default AuthorizationEditor;

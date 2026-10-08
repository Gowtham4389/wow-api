import { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { validateUrl } from '../../utils/url.js';
import MethodSelector from './MethodSelector.jsx';
import Icon from '../common/Icon.jsx';
import Tooltip from '../common/Tooltip.jsx';

export function RequestBar({ onSave, onGenerateCode }) {
  const { request, updateRequest, setUrl, send, cancel, sending, settings } = useApp();
  const [touched, setTouched] = useState(false);

  const validation = useMemo(() => validateUrl(request.url), [request.url]);
  const showError = touched && request.url.trim() !== '' && !validation.ok;

  const handleSubmit = (event) => {
    event.preventDefault();
    setTouched(true);
    send();
  };

  return (
    <form className="request-bar" onSubmit={handleSubmit} noValidate>
      <MethodSelector value={request.method} onChange={(method) => updateRequest({ method })} disabled={sending} />

      <div className="request-bar__url" data-invalid={showError}>
        <label className="visually-hidden" htmlFor="request-url">
          Request URL
        </label>
        <input
          id="request-url"
          type="text"
          value={request.url}
          placeholder="https://api.example.com/users"
          spellCheck="false"
          autoComplete="off"
          autoCapitalize="off"
          aria-invalid={showError}
          aria-describedby={showError ? 'request-url-error' : undefined}
          onChange={(event) => setUrl(event.target.value)}
          onBlur={() => setTouched(true)}
        />
      </div>

      {sending ? (
        <button type="button" className="btn btn--lg btn--danger" onClick={cancel}>
          <Icon name="square" size={14} />
          Cancel
        </button>
      ) : (
        <Tooltip label="Send request (Ctrl/Cmd + Enter)" placement="bottom">
          <button type="submit" className="btn btn--lg btn--primary" disabled={!request.url.trim()}>
            <Icon name="send" size={15} />
            Send
          </button>
        </Tooltip>
      )}

      <div className="row">
        <Tooltip label="Generate request code (Ctrl/Cmd + G)">
          <button type="button" className="btn btn--icon" onClick={onGenerateCode} aria-label="Generate request code">
            <Icon name="code" size={15} />
          </button>
        </Tooltip>
        <Tooltip label="Save request (Ctrl/Cmd + S)">
          <button type="button" className="btn btn--icon" onClick={onSave} aria-label="Save request">
            <Icon name="bookmark" size={15} />
          </button>
        </Tooltip>
      </div>

      {showError && (
        <p className="request-bar__error" id="request-url-error" role="alert">
          {validation.message}
        </p>
      )}

      {settings.sendMode === 'direct' && (
        <span className="badge badge--warning" title="Requests are sent straight from the browser and are subject to CORS">
          Direct mode
        </span>
      )}
    </form>
  );
}

export default RequestBar;

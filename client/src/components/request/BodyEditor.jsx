import { useMemo } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { BODY_MODES, METHODS_WITHOUT_BODY } from '../../utils/request.js';
import { formatJson, minifyJson, parseJson } from '../../utils/json.js';
import { useToast } from '../../context/ToastContext.jsx';
import CodeEditor from '../common/CodeEditor.jsx';
import KeyValueEditor from './KeyValueEditor.jsx';
import Icon from '../common/Icon.jsx';
import CopyButton from '../common/CopyButton.jsx';

export function BodyEditor() {
  const { request, setBody } = useApp();
  const toast = useToast();
  const { body, method } = request;

  const bodyNotAllowed = METHODS_WITHOUT_BODY.has(method);

  const validation = useMemo(() => {
    if (body.mode !== 'json' || !body.json.trim()) return null;
    return parseJson(body.json);
  }, [body.mode, body.json]);

  const handleFormat = () => {
    const result = formatJson(body.json);
    if (!result.ok) {
      toast.error(`Cannot format: ${result.error}`);
      return;
    }
    setBody({ json: result.text });
    toast.success('JSON formatted.');
  };

  const handleMinify = () => {
    const result = minifyJson(body.json);
    if (!result.ok) {
      toast.error(`Cannot minify: ${result.error}`);
      return;
    }
    setBody({ json: result.text });
  };

  return (
    <div className="body-editor">
      <div className="body-editor__toolbar">
        <div className="field" style={{ minWidth: 190 }}>
          <label className="visually-hidden" htmlFor="body-mode">
            Body type
          </label>
          <select
            id="body-mode"
            className="select"
            value={body.mode}
            onChange={(event) => setBody({ mode: event.target.value })}
          >
            {BODY_MODES.map((mode) => (
              <option key={mode.value} value={mode.value}>
                {mode.label}
              </option>
            ))}
          </select>
        </div>

        {body.mode === 'json' && (
          <>
            <button type="button" className="btn btn--sm" onClick={handleFormat}>
              <Icon name="code" size={14} />
              Format
            </button>
            <button type="button" className="btn btn--sm" onClick={handleMinify}>
              Minify
            </button>
            <CopyButton value={body.json} label="Copy body" />
            {validation && (
              <span className="body-editor__status" data-tone={validation.ok ? 'ok' : 'error'}>
                <Icon name={validation.ok ? 'check' : 'alert'} size={14} />
                {validation.ok ? 'Valid JSON' : validation.error}
              </span>
            )}
          </>
        )}
      </div>

      {bodyNotAllowed && body.mode !== 'none' && (
        <div className="notice notice--warning">
          <Icon name="alert" size={15} />
          <span>A {method} request is sent without a body. Choose another method to include one.</span>
        </div>
      )}

      {body.mode === 'none' && (
        <p className="field__hint">This request has no body. Pick a type above to add one.</p>
      )}

      {body.mode === 'json' && (
        <CodeEditor
          id="body-json"
          value={body.json}
          onChange={(value) => setBody({ json: value })}
          language="json"
          invalid={Boolean(validation && !validation.ok)}
          placeholder={'{\n  "name": "Ada"\n}'}
          ariaLabel="JSON request body"
        />
      )}

      {body.mode === 'text' && (
        <CodeEditor
          id="body-text"
          value={body.text}
          onChange={(value) => setBody({ text: value })}
          language="text"
          placeholder="Raw request body"
          ariaLabel="Raw request body"
        />
      )}

      {body.mode === 'form-data' && (
        <>
          <KeyValueEditor
            rows={body.formData}
            onChange={(formData) => setBody({ formData })}
            keyPlaceholder="Field"
            valuePlaceholder="Value"
            ariaLabel="Multipart form fields"
            emptyLabel="No form fields."
          />
          <p className="field__hint">Text fields only. File uploads are not part of Phase 1.</p>
        </>
      )}

      {body.mode === 'urlencoded' && (
        <KeyValueEditor
          rows={body.urlencoded}
          onChange={(urlencoded) => setBody({ urlencoded })}
          keyPlaceholder="Field"
          valuePlaceholder="Value"
          ariaLabel="URL encoded form fields"
          emptyLabel="No fields."
        />
      )}
    </div>
  );
}

export default BodyEditor;

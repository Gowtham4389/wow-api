import { useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '../context/ToastContext.jsx';
import Icon from '../components/common/Icon.jsx';
import CopyButton from '../components/common/CopyButton.jsx';
import { formatJson, minifyJson, parseJson } from '../utils/json.js';
import { csvToJson, jsonToCsv } from '../utils/csv.js';
import { decodeBase64, encodeBase64 } from '../utils/auth.js';
import { analyzeJson } from '../utils/analyze.js';
import { downloadText } from '../utils/download.js';

function ToolCard({ id, title, description, children, highlighted }) {
  return (
    <section
      className="card"
      id={id}
      style={highlighted ? { borderColor: 'var(--accent)', boxShadow: '0 0 0 3px var(--focus-ring)' } : undefined}
    >
      <header className="card__header">
        <div>
          <h2 className="card__title">{title}</h2>
          <p className="card__subtitle">{description}</p>
        </div>
      </header>
      <div className="card__body">{children}</div>
    </section>
  );
}

function JsonTools({ highlighted }) {
  const toast = useToast();
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [status, setStatus] = useState(null);

  const run = (action) => {
    if (action === 'validate') {
      const result = parseJson(input);
      if (result.ok) {
        const stats = analyzeJson(result.data);
        setStatus({
          tone: 'ok',
          message: `Valid JSON — root ${stats.rootType}, ${stats.objects} objects, ${stats.arrays} arrays, depth ${stats.maxDepth}.`,
        });
        setOutput(JSON.stringify(result.data, null, 2));
      } else {
        setStatus({ tone: 'error', message: result.error });
        setOutput('');
      }
      return;
    }

    const result = action === 'minify' ? minifyJson(input) : formatJson(input, action === 'format4' ? 4 : 2);
    if (!result.ok) {
      setStatus({ tone: 'error', message: result.error });
      setOutput('');
      return;
    }
    setOutput(result.text);
    setStatus({ tone: 'ok', message: `${action === 'minify' ? 'Minified' : 'Formatted'} — ${result.text.length.toLocaleString()} characters.` });
  };

  return (
    <ToolCard
      id="json-formatter"
      title="JSON Formatter, Minifier & Validator"
      description="Pretty-print, compress and validate JSON with precise error positions."
      highlighted={highlighted}
    >
      <div className="tools">
        <div className="tools__io">
          <div className="field">
            <label className="field__label" htmlFor="json-input">
              Input
            </label>
            <textarea
              id="json-input"
              className="textarea"
              value={input}
              placeholder='{"name":"Ada","roles":["admin"]}'
              spellCheck="false"
              onChange={(event) => setInput(event.target.value)}
            />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="json-output">
              Output
            </label>
            <textarea id="json-output" className="textarea" value={output} readOnly spellCheck="false" />
          </div>
        </div>

        <div className="tools__actions">
          <button type="button" className="btn btn--primary btn--sm" onClick={() => run('format')}>
            Format (2 spaces)
          </button>
          <button type="button" className="btn btn--sm" onClick={() => run('format4')}>
            Format (4 spaces)
          </button>
          <button type="button" className="btn btn--sm" onClick={() => run('minify')}>
            Minify
          </button>
          <button type="button" className="btn btn--sm" onClick={() => run('validate')} id="json-validator">
            Validate
          </button>
          <CopyButton value={output} label="Copy output" withText disabled={!output} />
          <button
            type="button"
            className="btn btn--sm btn--ghost"
            onClick={() => {
              setInput('');
              setOutput('');
              setStatus(null);
            }}
          >
            Clear
          </button>
          {output && (
            <button type="button" className="btn btn--sm btn--ghost" onClick={() => { downloadText('formatted.json', output, 'application/json'); toast.success('Downloaded.'); }}>
              <Icon name="download" size={13} />
              Download
            </button>
          )}
        </div>

        {status && (
          <p className="tools__result" data-tone={status.tone}>
            {status.message}
          </p>
        )}
      </div>
    </ToolCard>
  );
}

function CsvTools({ highlighted }) {
  const [jsonText, setJsonText] = useState('');
  const [csvText, setCsvText] = useState('');
  const [status, setStatus] = useState(null);

  const toCsv = () => {
    const parsed = parseJson(jsonText);
    if (!parsed.ok) {
      setStatus({ tone: 'error', message: parsed.error });
      return;
    }
    const result = jsonToCsv(parsed.data);
    if (!result.ok) {
      setStatus({ tone: 'error', message: result.error });
      return;
    }
    setCsvText(result.text);
    setStatus({
      tone: 'ok',
      message: `${result.rows} rows × ${result.columns} columns${result.source ? ` from "${result.source}"` : ''}.`,
    });
  };

  const toJson = () => {
    const result = csvToJson(csvText);
    if (!result.ok) {
      setStatus({ tone: 'error', message: result.error });
      return;
    }
    setJsonText(result.text);
    setStatus({ tone: 'ok', message: `${result.rows} records parsed (delimiter "${result.delimiter === '\t' ? 'tab' : result.delimiter}").` });
  };

  return (
    <ToolCard
      id="json-csv"
      title="JSON ↔ CSV"
      description="Convert arrays of objects to CSV and back. Nested fields are flattened to dot paths."
      highlighted={highlighted}
    >
      <div className="tools">
        <div className="tools__io">
          <div className="field">
            <label className="field__label" htmlFor="csv-json">
              JSON
            </label>
            <textarea
              id="csv-json"
              className="textarea"
              value={jsonText}
              placeholder='[{"id":1,"name":"Ada"},{"id":2,"name":"Grace"}]'
              spellCheck="false"
              onChange={(event) => setJsonText(event.target.value)}
            />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="csv-csv">
              CSV
            </label>
            <textarea
              id="csv-csv"
              className="textarea"
              value={csvText}
              placeholder={'id,name\n1,Ada\n2,Grace'}
              spellCheck="false"
              onChange={(event) => setCsvText(event.target.value)}
            />
          </div>
        </div>

        <div className="tools__actions">
          <button type="button" className="btn btn--primary btn--sm" onClick={toCsv}>
            JSON → CSV
          </button>
          <button type="button" className="btn btn--sm" onClick={toJson}>
            CSV → JSON
          </button>
          <CopyButton value={csvText} label="Copy CSV" withText disabled={!csvText} />
          <CopyButton value={jsonText} label="Copy JSON" withText disabled={!jsonText} />
        </div>

        {status && (
          <p className="tools__result" data-tone={status.tone}>
            {status.message}
          </p>
        )}
      </div>
    </ToolCard>
  );
}

function Base64Tools({ highlighted }) {
  const [plain, setPlain] = useState('');
  const [encoded, setEncoded] = useState('');
  const [status, setStatus] = useState(null);

  return (
    <ToolCard id="base64" title="Base64" description="Encode and decode Base64, with full unicode support." highlighted={highlighted}>
      <div className="tools">
        <div className="tools__io">
          <div className="field">
            <label className="field__label" htmlFor="b64-plain">
              Plain text
            </label>
            <textarea
              id="b64-plain"
              className="textarea"
              value={plain}
              spellCheck="false"
              onChange={(event) => setPlain(event.target.value)}
            />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="b64-encoded">
              Base64
            </label>
            <textarea
              id="b64-encoded"
              className="textarea"
              value={encoded}
              spellCheck="false"
              onChange={(event) => setEncoded(event.target.value)}
            />
          </div>
        </div>

        <div className="tools__actions">
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={() => {
              setEncoded(encodeBase64(plain));
              setStatus(null);
            }}
          >
            Encode →
          </button>
          <button
            type="button"
            className="btn btn--sm"
            onClick={() => {
              try {
                setPlain(decodeBase64(encoded));
                setStatus(null);
              } catch {
                setStatus({ tone: 'error', message: 'This is not valid Base64.' });
              }
            }}
          >
            ← Decode
          </button>
          <CopyButton value={encoded} label="Copy Base64" withText disabled={!encoded} />
        </div>

        {status && (
          <p className="tools__result" data-tone={status.tone}>
            {status.message}
          </p>
        )}
      </div>
    </ToolCard>
  );
}

function UrlTools({ highlighted }) {
  const [decoded, setDecoded] = useState('');
  const [encoded, setEncoded] = useState('');
  const [mode, setMode] = useState('component');
  const [status, setStatus] = useState(null);

  return (
    <ToolCard
      id="url-encoder"
      title="URL Encoder / Decoder"
      description="Percent-encode a full URL or a single component."
      highlighted={highlighted}
    >
      <div className="tools">
        <div className="settings__segment" style={{ alignSelf: 'flex-start' }}>
          <button type="button" aria-pressed={mode === 'component'} onClick={() => setMode('component')}>
            Component
          </button>
          <button type="button" aria-pressed={mode === 'full'} onClick={() => setMode('full')}>
            Full URL
          </button>
        </div>

        <div className="tools__io">
          <div className="field">
            <label className="field__label" htmlFor="url-decoded">
              Decoded
            </label>
            <textarea
              id="url-decoded"
              className="textarea"
              value={decoded}
              spellCheck="false"
              onChange={(event) => setDecoded(event.target.value)}
            />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="url-encoded">
              Encoded
            </label>
            <textarea
              id="url-encoded"
              className="textarea"
              value={encoded}
              spellCheck="false"
              onChange={(event) => setEncoded(event.target.value)}
            />
          </div>
        </div>

        <div className="tools__actions">
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={() => {
              setEncoded(mode === 'full' ? encodeURI(decoded) : encodeURIComponent(decoded));
              setStatus(null);
            }}
          >
            Encode →
          </button>
          <button
            type="button"
            className="btn btn--sm"
            onClick={() => {
              try {
                setDecoded(mode === 'full' ? decodeURI(encoded) : decodeURIComponent(encoded));
                setStatus(null);
              } catch {
                setStatus({ tone: 'error', message: 'This text contains an invalid percent-encoding sequence.' });
              }
            }}
          >
            ← Decode
          </button>
          <CopyButton value={encoded} label="Copy encoded" withText disabled={!encoded} />
        </div>

        {status && (
          <p className="tools__result" data-tone={status.tone}>
            {status.message}
          </p>
        )}
      </div>
    </ToolCard>
  );
}

export function ToolsPage({ activeTool }) {
  const containerRef = useRef(null);
  const [highlight, setHighlight] = useState(activeTool);

  useEffect(() => {
    setHighlight(activeTool);
    if (!activeTool) return undefined;
    const element = document.getElementById(activeTool === 'json-validator' ? 'json-formatter' : activeTool);
    element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const timer = setTimeout(() => setHighlight(null), 1600);
    return () => clearTimeout(timer);
  }, [activeTool]);

  const highlighted = useMemo(
    () => (highlight === 'json-validator' ? 'json-formatter' : highlight),
    [highlight],
  );

  return (
    <div className="page" ref={containerRef}>
      <div className="page__inner">
        <header className="page__header">
          <h1 className="page__title">Tools</h1>
          <p className="page__subtitle">
            Everyday conversions that would otherwise mean leaving the app. Everything runs locally in your browser.
          </p>
        </header>

        <div className="tools__grid" style={{ gridTemplateColumns: '1fr' }}>
          <JsonTools highlighted={highlighted === 'json-formatter'} />
          <CsvTools highlighted={highlighted === 'json-csv'} />
          <Base64Tools highlighted={highlighted === 'base64'} />
          <UrlTools highlighted={highlighted === 'url-encoder'} />
        </div>
      </div>
    </div>
  );
}

export default ToolsPage;

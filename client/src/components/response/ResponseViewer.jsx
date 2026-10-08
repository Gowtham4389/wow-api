import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import Tabs from '../common/Tabs.jsx';
import Icon from '../common/Icon.jsx';
import CopyButton from '../common/CopyButton.jsx';
import EmptyState from '../common/EmptyState.jsx';
import StatusBar from './StatusBar.jsx';
import JsonViewer, { LARGE_NODE_COUNT } from './JsonViewer.jsx';
import RawViewer from './RawViewer.jsx';
import ResponseHeaders from './ResponseHeaders.jsx';
import ResponsePreview from './ResponsePreview.jsx';
import ResponseAnalysis from './ResponseAnalysis.jsx';
import { formatBytes } from '../../utils/format.js';
import { downloadText, suggestFilename } from '../../utils/download.js';
import { jsonToCsv } from '../../utils/csv.js';

const TABS = [
  { value: 'pretty', label: 'Pretty' },
  { value: 'raw', label: 'Raw' },
  { value: 'headers', label: 'Headers' },
  { value: 'preview', label: 'Preview' },
  { value: 'analysis', label: 'Analysis' },
];

/** Rough node count so huge documents can be gated before rendering. */
function estimateNodes(data) {
  let count = 0;
  const stack = [data];
  while (stack.length && count <= LARGE_NODE_COUNT) {
    const value = stack.pop();
    count += 1;
    if (Array.isArray(value)) stack.push(...value.slice(0, 5000));
    else if (value && typeof value === 'object') stack.push(...Object.values(value).slice(0, 5000));
  }
  return count;
}

export function ResponseViewer({ onGenerateModels, onGenerateDocs }) {
  const { response, parsedResponse, error, sending, clearResponse, settings, updateSettings } = useApp();
  const toast = useToast();

  const [tab, setTab] = useState('pretty');
  const [query, setQuery] = useState('');
  const [matchCount, setMatchCount] = useState(0);
  const [activeMatch, setActiveMatch] = useState(0);
  const [forceRender, setForceRender] = useState(false);
  const searchRef = useRef(null);
  const downloadMenuRef = useRef(null);

  const { data, isJson, parseError } = parsedResponse;

  useEffect(() => {
    setActiveMatch(0);
  }, [query, tab]);

  useEffect(() => {
    // A new response resets the view to a predictable state.
    setForceRender(false);
    setQuery('');
    setTab((current) => (current === 'analysis' && !isJson ? 'pretty' : current));
  }, [response, isJson]);

  const nodeCount = useMemo(() => (isJson ? estimateNodes(data) : 0), [isJson, data]);
  const isLarge = nodeCount >= LARGE_NODE_COUNT || (response?.size ?? 0) > settings.largeResponseThreshold;

  const rawMatchCount = useMemo(() => {
    if (tab !== 'raw' || !query || !response?.body) return 0;
    return response.body.toLowerCase().split(query.toLowerCase()).length - 1;
  }, [tab, query, response]);

  const totalMatches = tab === 'raw' ? rawMatchCount : matchCount;

  const goToMatch = useCallback(
    (delta) => {
      if (!totalMatches) return;
      setActiveMatch((current) => (current + delta + totalMatches) % totalMatches);
    },
    [totalMatches],
  );

  const handleDownload = (format) => {
    if (downloadMenuRef.current) downloadMenuRef.current.open = false;
    if (!response) return;
    const name = suggestFilename(response.finalUrl ?? '', format);

    if (format === 'csv') {
      if (!isJson) {
        toast.error('CSV export needs a JSON response.');
        return;
      }
      const result = jsonToCsv(data);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      downloadText(name, result.text, 'text/csv;charset=utf-8');
      toast.success(`Exported ${result.rows} rows to CSV.`);
      return;
    }

    if (response.bodyEncoding === 'base64') {
      toast.error('This binary response cannot be exported as text.');
      return;
    }
    const text = format === 'json' && isJson ? JSON.stringify(data, null, 2) : response.body;
    downloadText(name, text, format === 'json' ? 'application/json' : 'text/plain;charset=utf-8');
    toast.success(`Response downloaded as ${format.toUpperCase()}.`);
  };

  if (sending && !response) {
    return (
      <div className="response-viewer">
        <EmptyState
          icon="activity"
          title="Sending request…"
          description="Waiting for the API to respond. Press Cancel in the request bar to stop."
        />
      </div>
    );
  }

  if (error && !response) {
    return (
      <div className="response-viewer">
        <div className="error-panel">
          <div className="notice notice--danger">
            <Icon name="alert" size={16} />
            <div>
              <p className="notice__title">{error.message}</p>
              {error.hint && <p className="notice__body">{error.hint}</p>}
            </div>
          </div>
          {error.code && <p className="field__hint mono">Error code: {error.code}</p>}
        </div>
      </div>
    );
  }

  if (!response) {
    return (
      <div className="response-viewer">
        <EmptyState
          icon="send"
          title="No response yet"
          description="Configure the request above and press Send. The status, timing, size and full body will appear here."
        />
      </div>
    );
  }

  const searchable = tab === 'pretty' || tab === 'raw';

  return (
    <div className="response-viewer">
      <StatusBar response={response} />

      <Tabs tabs={TABS} value={tab} onChange={setTab} className="response-viewer__tabs" ariaLabel="Response views" />

      <div className="response-viewer__toolbar">
        {searchable && (
          <div className="search-box">
            <Icon name="search" size={14} />
            <input
              ref={searchRef}
              type="search"
              value={query}
              placeholder="Search response"
              aria-label="Search response"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  goToMatch(event.shiftKey ? -1 : 1);
                }
              }}
            />
            {query && (
              <>
                <span className="search-box__count">
                  {totalMatches ? `${activeMatch + 1}/${totalMatches}` : '0'}
                </span>
                <button type="button" className="btn btn--ghost btn--icon btn--sm" onClick={() => goToMatch(-1)} aria-label="Previous match">
                  <Icon name="chevronUp" size={13} />
                </button>
                <button type="button" className="btn btn--ghost btn--icon btn--sm" onClick={() => goToMatch(1)} aria-label="Next match">
                  <Icon name="chevronDown" size={13} />
                </button>
              </>
            )}
          </div>
        )}

        {tab === 'raw' && (
          <label className="checkbox">
            <input
              type="checkbox"
              checked={settings.wrapLines}
              onChange={(event) => updateSettings({ wrapLines: event.target.checked })}
            />
            Wrap
          </label>
        )}

        <div style={{ flex: 1 }} />

        <CopyButton
          value={() => (isJson && tab === 'pretty' ? JSON.stringify(data, null, 2) : response.body)}
          label="Copy response"
          withText
        />

        <details className="menu" ref={downloadMenuRef}>
          <summary className="btn btn--sm" aria-haspopup="menu">
            <Icon name="download" size={14} />
            Download
          </summary>
          <div className="menu__list" role="menu">
            <button type="button" role="menuitem" onClick={() => handleDownload('json')}>
              JSON
            </button>
            <button type="button" role="menuitem" onClick={() => handleDownload('txt')}>
              Plain text
            </button>
            <button type="button" role="menuitem" onClick={() => handleDownload('csv')} disabled={!isJson}>
              CSV
            </button>
          </div>
        </details>

        {onGenerateDocs && (
          <button type="button" className="btn btn--sm" onClick={onGenerateDocs}>
            <Icon name="fileText" size={14} />
            Docs
          </button>
        )}

        <button type="button" className="btn btn--sm btn--ghost" onClick={clearResponse}>
          <Icon name="close" size={14} />
          Clear
        </button>
      </div>

      <div className="response-viewer__content" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'pretty' && (
          <>
            {!isJson && (
              <div style={{ padding: 'var(--space-3)' }}>
                <div className="notice">
                  <Icon name="info" size={15} />
                  <span>
                    {parseError
                      ? `This response is not valid JSON (${parseError}). The raw body is shown below.`
                      : 'This response is not JSON, so it is shown as received.'}
                  </span>
                </div>
              </div>
            )}
            {isJson && isLarge && !forceRender ? (
              <div style={{ padding: 'var(--space-4)' }}>
                <div className="notice notice--warning">
                  <Icon name="alert" size={16} />
                  <div>
                    <p className="notice__title">Large response ({formatBytes(response.size)})</p>
                    <p className="notice__body">
                      Building an interactive tree for roughly {nodeCount.toLocaleString()}+ nodes can be slow. The raw
                      body and analysis are available immediately.
                    </p>
                  </div>
                </div>
                <div className="row" style={{ marginTop: 'var(--space-3)' }}>
                  <button type="button" className="btn btn--primary btn--sm" onClick={() => setForceRender(true)}>
                    Build the tree anyway
                  </button>
                  <button type="button" className="btn btn--sm" onClick={() => setTab('raw')}>
                    Show raw body
                  </button>
                </div>
              </div>
            ) : isJson ? (
              <JsonViewer
                data={data}
                query={query}
                activeMatch={activeMatch}
                onMatchesChange={setMatchCount}
              />
            ) : (
              <RawViewer text={response.body} query={query} wrap activeMatch={activeMatch} />
            )}
          </>
        )}

        {tab === 'raw' && (
          <RawViewer text={response.body} query={query} wrap={settings.wrapLines} activeMatch={activeMatch} />
        )}

        {tab === 'headers' && <ResponseHeaders response={response} />}

        {tab === 'preview' && <ResponsePreview response={response} parsed={isJson ? data : undefined} />}

        {tab === 'analysis' && (
          <ResponseAnalysis data={isJson ? data : undefined} response={response} onGenerateModels={onGenerateModels} />
        )}
      </div>
    </div>
  );
}

export default ResponseViewer;

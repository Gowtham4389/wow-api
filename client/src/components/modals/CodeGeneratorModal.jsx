import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import Modal from '../common/Modal.jsx';
import Tabs from '../common/Tabs.jsx';
import CopyButton from '../common/CopyButton.jsx';
import Icon from '../common/Icon.jsx';
import EmptyState from '../common/EmptyState.jsx';
import { REQUEST_GENERATORS, generateRequestCode } from '../../utils/codegen.js';
import { MODEL_GENERATORS, inferSchema } from '../../utils/schema.js';
import { generateDocumentation } from '../../utils/docs.js';
import { downloadText, suggestFilename } from '../../utils/download.js';
import { endpointOf } from '../../utils/request.js';

const EXTENSIONS = {
  curl: 'sh', fetch: 'js', axios: 'js', node: 'js', python: 'py', php: 'php', java: 'java', csharp: 'cs', go: 'go',
  typescript: 'ts', javascript: 'js', jsonschema: 'json', zod: 'ts', dataclass: 'py', pydantic: 'py',
};

/**
 * One dialog for every generator: request snippets, response models and the
 * Markdown documentation. They all read from the same request/response state.
 */
export function CodeGeneratorModal({ open, onClose, initialTab = 'request' }) {
  const { request, response, parsedResponse } = useApp();
  const toast = useToast();

  const [tab, setTab] = useState(initialTab);
  const [requestTarget, setRequestTarget] = useState('curl');
  const [modelTarget, setModelTarget] = useState('typescript');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);

  const rootName = useMemo(() => {
    const path = endpointOf(request.url).split('/').filter(Boolean).pop();
    return request.name?.trim() || path || 'Root';
  }, [request.url, request.name]);

  const requestCode = useMemo(
    () => (open && tab === 'request' ? generateRequestCode(request, requestTarget) : ''),
    [open, tab, request, requestTarget],
  );

  const modelCode = useMemo(() => {
    if (!open || tab !== 'models' || !parsedResponse.isJson) return '';
    const generator = MODEL_GENERATORS.find((item) => item.id === modelTarget) ?? MODEL_GENERATORS[0];
    const schema = inferSchema(parsedResponse.data);
    return generator.run(schema, parsedResponse.data, rootName);
  }, [open, tab, parsedResponse, modelTarget, rootName]);

  const docs = useMemo(() => {
    if (!open || tab !== 'docs') return null;
    return generateDocumentation({
      request,
      response,
      parsedBody: parsedResponse.isJson ? parsedResponse.data : undefined,
      description,
    });
  }, [open, tab, request, response, parsedResponse, description]);

  const activeText = tab === 'request' ? requestCode : tab === 'models' ? modelCode : docs?.text ?? '';

  const handleDownload = () => {
    if (!activeText) return;
    const extension =
      tab === 'docs' ? 'md' : EXTENSIONS[tab === 'request' ? requestTarget : modelTarget] ?? 'txt';
    downloadText(suggestFilename(request.url, extension), activeText);
    toast.success('File downloaded.');
  };

  const options = tab === 'request' ? REQUEST_GENERATORS : tab === 'models' ? MODEL_GENERATORS : [];
  const selected = tab === 'request' ? requestTarget : modelTarget;
  const setSelected = tab === 'request' ? setRequestTarget : setModelTarget;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Generate code"
      subtitle="Snippets stay in sync with the request you have configured"
      width={880}
      flush
      footer={
        <>
          <span className="field__hint" style={{ marginRight: 'auto' }}>
            {tab === 'docs' ? 'HTML and PDF export can reuse the same document model.' : null}
          </span>
          <button type="button" className="btn" onClick={handleDownload} disabled={!activeText}>
            <Icon name="download" size={14} />
            Download
          </button>
          <CopyButton value={activeText} label="Copy" withText tone="primary" disabled={!activeText} />
        </>
      }
    >
      <Tabs
        tabs={[
          { value: 'request', label: 'Request code' },
          { value: 'models', label: 'Models & schema' },
          { value: 'docs', label: 'Documentation' },
        ]}
        value={tab}
        onChange={setTab}
        className="request-tabs__list"
        ariaLabel="Generator type"
      />

      {tab === 'docs' ? (
        <div className="generator__content" style={{ padding: 'var(--space-4)' }}>
          <div className="field">
            <label className="field__label" htmlFor="doc-description">
              Description (optional)
            </label>
            <input
              id="doc-description"
              className="input"
              value={description}
              placeholder="What this endpoint does"
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          {!response && (
            <div className="notice notice--info">
              <Icon name="info" size={15} />
              <span>Send the request first to include the live response, status and schema in the documentation.</span>
            </div>
          )}
          <pre className="code-block generator__output">{docs?.text}</pre>
        </div>
      ) : (
        <div className="generator" style={{ minHeight: 420 }}>
          <div className="generator__list" role="listbox" aria-label="Target">
            {options.map((option) => (
              <button
                key={option.id}
                type="button"
                role="option"
                aria-selected={option.id === selected}
                className="generator__option"
                onClick={() => setSelected(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="generator__content">
            {tab === 'models' && !parsedResponse.isJson ? (
              <EmptyState
                icon="database"
                title="No JSON response yet"
                description="Send a request that returns JSON and the models are generated from the actual response shape."
              />
            ) : (
              <pre className="code-block generator__output">{activeText}</pre>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

export default CodeGeneratorModal;

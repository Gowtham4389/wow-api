import { useState } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import Modal from '../common/Modal.jsx';
import Icon from '../common/Icon.jsx';
import { parseCurl } from '../../utils/curl.js';

const EXAMPLE = `curl https://api.example.com/users \\
  -H "Authorization: Bearer TOKEN" \\
  -H "Accept: application/json"`;

export function ImportCurlModal({ open, onClose }) {
  const { loadRequest } = useApp();
  const toast = useToast();
  const [text, setText] = useState('');
  const [error, setError] = useState(null);

  const handleImport = () => {
    const result = parseCurl(text);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    loadRequest(result.request);
    for (const warning of result.warnings ?? []) toast.warning(warning);
    toast.success('cURL command imported.');
    setText('');
    setError(null);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Import cURL"
      subtitle="Paste a command to fill in the method, URL, headers, auth and body"
      width={640}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" onClick={handleImport} disabled={!text.trim()}>
            <Icon name="terminal" size={14} />
            Import
          </button>
        </>
      }
    >
      <div className="stack">
        <textarea
          className="textarea"
          data-autofocus
          value={text}
          placeholder={EXAMPLE}
          spellCheck="false"
          aria-label="cURL command"
          onChange={(event) => {
            setText(event.target.value);
            setError(null);
          }}
        />
        {error && (
          <div className="notice notice--danger">
            <Icon name="alert" size={15} />
            <span>{error}</span>
          </div>
        )}
        <p className="field__hint">
          Supported flags: <code>-X</code>, <code>-H</code>, <code>-d</code>/<code>--data*</code>, <code>-F</code>,{' '}
          <code>-u</code> and <code>--url</code>. File uploads (<code>@file</code>) are skipped.
        </p>
      </div>
    </Modal>
  );
}

export default ImportCurlModal;

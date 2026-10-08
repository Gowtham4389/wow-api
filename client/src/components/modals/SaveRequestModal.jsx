import { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import Modal from '../common/Modal.jsx';
import Icon from '../common/Icon.jsx';
import { endpointOf } from '../../utils/request.js';

export function SaveRequestModal({ open, onClose }) {
  const { request, savedActions, settings, requestHasSecrets, updateRequest } = useApp();
  const toast = useToast();
  const [name, setName] = useState('');

  useEffect(() => {
    if (open) setName(request.name || `${request.method} ${endpointOf(request.url)}`);
  }, [open, request.name, request.method, request.url]);

  const handleSave = () => {
    const entry = savedActions.save(name);
    updateRequest({ name: entry.name });
    toast.success(`Saved "${entry.name}".`);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Save request"
      width={520}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" onClick={handleSave} disabled={!name.trim()}>
            <Icon name="bookmark" size={14} />
            Save
          </button>
        </>
      }
    >
      <div className="stack">
        <div className="field">
          <label className="field__label" htmlFor="save-name">
            Name
          </label>
          <input
            id="save-name"
            className="input"
            data-autofocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && name.trim()) handleSave();
            }}
          />
        </div>

        <p className="field__hint mono truncate" title={request.url}>
          {request.method} {request.url}
        </p>

        {requestHasSecrets && !settings.saveSecrets && (
          <div className="notice notice--info">
            <Icon name="shield" size={15} />
            <span>
              The token or password in this request is not stored. Everything else — URL, parameters, headers and body —
              is saved. Enable “Save credentials” in Settings to keep secrets in this browser.
            </span>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default SaveRequestModal;

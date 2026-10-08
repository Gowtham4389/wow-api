import { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { shortUrl } from '../../utils/format.js';
import Icon from '../common/Icon.jsx';
import IconButton from '../common/IconButton.jsx';
import ConfirmButton from '../common/ConfirmButton.jsx';
import EmptyState from '../common/EmptyState.jsx';

export function SavedPanel({ onPick }) {
  const { saved, savedActions, loadRequest } = useApp();
  const [filter, setFilter] = useState('');
  const [editing, setEditing] = useState(null);
  const [draftName, setDraftName] = useState('');

  const entries = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return saved;
    return saved.filter(
      (entry) => entry.name.toLowerCase().includes(needle) || entry.request.url.toLowerCase().includes(needle),
    );
  }, [saved, filter]);

  return (
    <>
      <div className="panel-toolbar">
        <div className="search-box">
          <Icon name="search" size={14} />
          <input
            type="search"
            value={filter}
            placeholder="Filter saved"
            aria-label="Filter saved requests"
            onChange={(event) => setFilter(event.target.value)}
          />
        </div>
      </div>

      {entries.length === 0 ? (
        <EmptyState
          icon="bookmark"
          title={saved.length ? 'Nothing matches' : 'No saved requests'}
          description={
            saved.length
              ? 'Try a different filter.'
              : 'Save a request from the request bar to keep its URL, parameters, headers and body for later.'
          }
        />
      ) : (
        <div className="panel-list">
          {entries.map((entry) => (
            <div className="list-item" key={entry.id}>
              <button
                type="button"
                className="list-item__main"
                style={{ border: 0, background: 'none', textAlign: 'left', padding: 0 }}
                onClick={() => {
                  loadRequest({ ...entry.request, name: entry.name });
                  onPick?.();
                }}
              >
                <span className="list-item__top">
                  <span className="method-tag" data-method={entry.request.method}>
                    {entry.request.method}
                  </span>
                  {editing === entry.id ? (
                    <input
                      className="input"
                      style={{ height: 24 }}
                      value={draftName}
                      autoFocus
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) => setDraftName(event.target.value)}
                      onBlur={() => {
                        savedActions.rename(entry.id, draftName.trim() || entry.name);
                        setEditing(null);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') event.currentTarget.blur();
                        if (event.key === 'Escape') setEditing(null);
                      }}
                      aria-label="Saved request name"
                    />
                  ) : (
                    <span className="list-item__label list-item__name">{entry.name}</span>
                  )}
                </span>
                <span className="list-item__meta">
                  <span className="truncate" title={entry.request.url}>
                    {shortUrl(entry.request.url, 34)}
                  </span>
                </span>
              </button>

              <span className="list-item__actions">
                <IconButton
                  icon="edit"
                  label="Rename"
                  onClick={() => {
                    setEditing(entry.id);
                    setDraftName(entry.name);
                  }}
                  iconSize={12}
                />
                <IconButton icon="copy" label="Duplicate" onClick={() => savedActions.duplicate(entry.id)} iconSize={12} />
                <ConfirmButton label="Delete" onConfirm={() => savedActions.remove(entry.id)} />
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export default SavedPanel;

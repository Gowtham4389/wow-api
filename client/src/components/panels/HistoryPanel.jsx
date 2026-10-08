import { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { formatDuration, formatRelativeTime, shortUrl, statusCategory } from '../../utils/format.js';
import Icon from '../common/Icon.jsx';
import IconButton from '../common/IconButton.jsx';
import ConfirmButton from '../common/ConfirmButton.jsx';
import EmptyState from '../common/EmptyState.jsx';

export function HistoryPanel({ onPick }) {
  const { history, historyActions, loadRequest, send } = useApp();
  const toast = useToast();
  const [filter, setFilter] = useState('');
  const [editing, setEditing] = useState(null);
  const [draftName, setDraftName] = useState('');

  const entries = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    const list = needle
      ? history.filter(
          (entry) =>
            entry.summary.url.toLowerCase().includes(needle) ||
            entry.summary.method.toLowerCase().includes(needle) ||
            (entry.name ?? '').toLowerCase().includes(needle),
        )
      : history;
    // Favourites float to the top, newest first within each group.
    return [...list].sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.at - a.at);
  }, [history, filter]);

  const rerun = (entry) => {
    loadRequest(entry.request);
    onPick?.();
    // Send the restored request on the next tick so state has settled.
    setTimeout(() => send(entry.request), 0);
  };

  const commitRename = (entry) => {
    historyActions.rename(entry.id, draftName.trim());
    setEditing(null);
  };

  return (
    <>
      <div className="panel-toolbar">
        <div className="search-box">
          <Icon name="search" size={14} />
          <input
            type="search"
            value={filter}
            placeholder="Filter history"
            aria-label="Filter history"
            onChange={(event) => setFilter(event.target.value)}
          />
        </div>
        {history.length > 0 && (
          <ConfirmButton
            label="Clear history (favourites are kept)"
            confirmLabel="Click again to clear"
            onConfirm={() => {
              historyActions.clear();
              toast.success('History cleared. Favourites were kept.');
            }}
          />
        )}
      </div>

      {entries.length === 0 ? (
        <EmptyState
          icon="history"
          title={history.length ? 'Nothing matches' : 'No requests yet'}
          description={
            history.length
              ? 'Try a different filter.'
              : 'Every request you send is listed here with its status and timing, ready to run again.'
          }
        />
      ) : (
        <div className="panel-list">
          {entries.map((entry) => (
            <div className="list-item" key={entry.id}>
              <button
                type="button"
                className="list-item__main"
                onClick={() => {
                  loadRequest(entry.request);
                  onPick?.();
                }}
                style={{ border: 0, background: 'none', textAlign: 'left', padding: 0 }}
              >
                <span className="list-item__top">
                  <span className="method-tag" data-method={entry.summary.method}>
                    {entry.summary.method}
                  </span>
                  {editing === entry.id ? (
                    <input
                      className="input"
                      style={{ height: 24 }}
                      value={draftName}
                      autoFocus
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) => setDraftName(event.target.value)}
                      onBlur={() => commitRename(entry)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') commitRename(entry);
                        if (event.key === 'Escape') setEditing(null);
                      }}
                      aria-label="Request name"
                    />
                  ) : (
                    <span className={`list-item__label${entry.name ? ' list-item__name' : ''}`} title={entry.summary.url}>
                      {entry.name || shortUrl(entry.summary.url)}
                    </span>
                  )}
                </span>
                <span className="list-item__meta">
                  <span className="list-item__status" data-category={statusCategory(entry.summary.status)}>
                    {entry.summary.status ?? '—'}
                  </span>
                  <span>{formatDuration(entry.summary.time)}</span>
                  <span>{formatRelativeTime(entry.at)}</span>
                </span>
              </button>

              <span className="list-item__actions">
                <IconButton
                  icon="play"
                  label="Run again"
                  onClick={() => rerun(entry)}
                  iconSize={12}
                />
                <IconButton
                  icon="star"
                  label={entry.favorite ? 'Remove favourite' : 'Mark as favourite'}
                  active={entry.favorite}
                  onClick={() => historyActions.toggleFavorite(entry.id)}
                  iconSize={12}
                  style={entry.favorite ? { color: 'var(--warning)' } : undefined}
                />
                <IconButton
                  icon="edit"
                  label="Rename"
                  onClick={() => {
                    setEditing(entry.id);
                    setDraftName(entry.name ?? '');
                  }}
                  iconSize={12}
                />
                <IconButton icon="copy" label="Duplicate" onClick={() => historyActions.duplicate(entry.id)} iconSize={12} />
                <ConfirmButton label="Delete" onConfirm={() => historyActions.remove(entry.id)} />
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export default HistoryPanel;

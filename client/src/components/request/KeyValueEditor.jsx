import { createRow } from '../../utils/request.js';
import Icon from '../common/Icon.jsx';
import IconButton from '../common/IconButton.jsx';

/**
 * Reusable enabled/key/value row editor used for query parameters, headers and
 * form bodies. A trailing blank row is always appended so adding an entry never
 * needs a button press.
 */
export function KeyValueEditor({
  rows,
  onChange,
  keyPlaceholder = 'Key',
  valuePlaceholder = 'Value',
  keySuggestions = [],
  suggestionsId,
  ariaLabel = 'Key value editor',
  emptyLabel = 'No entries yet.',
  disabled = false,
}) {
  const update = (id, patch) => onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  const remove = (id) => onChange(rows.filter((row) => row.id !== id));
  const add = () => onChange([...rows, createRow()]);

  // Typing in the trailing placeholder row materialises it as a real row.
  const handleGhostChange = (field, value) => {
    if (!value) return;
    onChange([...rows, createRow({ [field]: value })]);
  };

  return (
    <div className="kv-editor">
      <div className="kv-editor__table" role="group" aria-label={ariaLabel}>
        <div className="kv-editor__head" aria-hidden="true">
          <span />
          <span>Key</span>
          <span>Value</span>
          <span />
        </div>

        {rows.map((row) => (
          <div className="kv-editor__row" key={row.id} data-disabled={!row.enabled}>
            <span className="kv-editor__toggle">
              <input
                type="checkbox"
                checked={row.enabled}
                disabled={disabled}
                onChange={(event) => update(row.id, { enabled: event.target.checked })}
                aria-label={`${row.key || 'Entry'} enabled`}
              />
            </span>
            <input
              className="kv-editor__input"
              value={row.key}
              placeholder={keyPlaceholder}
              list={suggestionsId}
              disabled={disabled}
              spellCheck="false"
              autoComplete="off"
              onChange={(event) => update(row.id, { key: event.target.value })}
              aria-label={`${keyPlaceholder} name`}
            />
            <input
              className="kv-editor__input"
              value={row.value}
              placeholder={valuePlaceholder}
              disabled={disabled}
              spellCheck="false"
              autoComplete="off"
              onChange={(event) => update(row.id, { value: event.target.value })}
              aria-label={`${row.key || keyPlaceholder} value`}
            />
            <span className="kv-editor__remove">
              <IconButton icon="close" label={`Remove ${row.key || 'entry'}`} onClick={() => remove(row.id)} iconSize={13} />
            </span>
          </div>
        ))}

        {/* Ghost row: types straight into a new entry. */}
        <div className="kv-editor__row" data-ghost="true">
          <span className="kv-editor__toggle">
            <input type="checkbox" checked={false} readOnly tabIndex={-1} aria-hidden="true" />
          </span>
          <input
            className="kv-editor__input"
            value=""
            placeholder={keyPlaceholder}
            list={suggestionsId}
            disabled={disabled}
            spellCheck="false"
            autoComplete="off"
            onChange={(event) => handleGhostChange('key', event.target.value)}
            aria-label={`New ${keyPlaceholder.toLowerCase()}`}
          />
          <input
            className="kv-editor__input"
            value=""
            placeholder={valuePlaceholder}
            disabled={disabled}
            spellCheck="false"
            autoComplete="off"
            onChange={(event) => handleGhostChange('value', event.target.value)}
            aria-label={`New ${valuePlaceholder.toLowerCase()}`}
          />
          <span />
        </div>
      </div>

      {keySuggestions.length > 0 && suggestionsId && (
        <datalist id={suggestionsId}>
          {keySuggestions.map((suggestion) => (
            <option key={suggestion} value={suggestion} />
          ))}
        </datalist>
      )}

      {rows.length === 0 && <p className="kv-editor__empty">{emptyLabel}</p>}

      <div className="kv-editor__footer">
        <button type="button" className="btn btn--sm" onClick={add} disabled={disabled}>
          <Icon name="plus" size={14} />
          Add row
        </button>
        {rows.length > 0 && (
          <button type="button" className="btn btn--sm btn--ghost" onClick={() => onChange([])}>
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}

export default KeyValueEditor;

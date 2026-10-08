import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { displayValue, typeOf } from '../../utils/json.js';
import { copyToClipboard } from '../../utils/download.js';
import Icon from '../common/Icon.jsx';

const ROW_HEIGHT = 22;
const OVERSCAN = 12;
/** Above this many nodes the tree is only built on request. */
export const LARGE_NODE_COUNT = 40_000;

/**
 * Flatten a JSON value into display rows.
 * Collapsed containers contribute a single summary row, so the row count stays
 * proportional to what is actually on screen.
 */
function flatten(data, collapsed, { limit = Infinity } = {}) {
  const rows = [];

  const walk = (value, key, path, depth, isLast) => {
    if (rows.length >= limit) return;
    const type = typeOf(value);
    const isContainer = type === 'object' || type === 'array';

    if (!isContainer) {
      rows.push({ path, key, depth, type, value, isContainer: false, isLast });
      return;
    }

    const entries = type === 'array'
      ? value.map((item, index) => [String(index), item])
      : Object.entries(value);
    const isCollapsed = collapsed.has(path);

    rows.push({
      path,
      key,
      depth,
      type,
      isContainer: true,
      childCount: entries.length,
      collapsed: isCollapsed,
      isLast,
      value,
    });

    if (isCollapsed) return;
    entries.forEach(([childKey, childValue], index) => {
      walk(childValue, childKey, path ? `${path}.${childKey}` : childKey, depth + 1, index === entries.length - 1);
    });
  };

  walk(data, null, '', 0, true);
  return rows;
}

/** Ancestor paths of a dotted path, so a match can be revealed. */
function ancestorsOf(path) {
  const parts = path.split('.');
  const result = [''];
  let current = '';
  for (let i = 0; i < parts.length - 1; i += 1) {
    current = current ? `${current}.${parts[i]}` : parts[i];
    result.push(current);
  }
  return result;
}

function Highlighted({ text, query }) {
  if (!query) return text;
  const lower = String(text).toLowerCase();
  const needle = query.toLowerCase();
  const index = lower.indexOf(needle);
  if (index === -1) return text;

  return (
    <>
      {String(text).slice(0, index)}
      <mark>{String(text).slice(index, index + needle.length)}</mark>
      {String(text).slice(index + needle.length)}
    </>
  );
}

export function JsonViewer({ data, query = '', activeMatch = 0, onMatchesChange, showLineNumbers = true }) {
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [scrollTop, setScrollTop] = useState(0);
  const [height, setHeight] = useState(560);
  const containerRef = useRef(null);

  const rows = useMemo(() => flatten(data, collapsed), [data, collapsed]);

  // Matches are computed over the fully expanded document so collapsed
  // branches are still searchable.
  const allRows = useMemo(
    () => (query ? flatten(data, new Set()) : []),
    [data, query],
  );

  const matches = useMemo(() => {
    if (!query) return [];
    const needle = query.toLowerCase();
    return allRows
      .filter((row) => {
        if (row.key !== null && String(row.key).toLowerCase().includes(needle)) return true;
        if (!row.isContainer) return displayValue(row.value).toLowerCase().includes(needle);
        return false;
      })
      .map((row) => row.path);
  }, [allRows, query]);

  useEffect(() => {
    onMatchesChange?.(matches.length);
  }, [matches.length, onMatchesChange]);

  // Reveal the active match by expanding every ancestor on the way to it.
  useEffect(() => {
    const path = matches[activeMatch];
    if (path === undefined) return;
    setCollapsed((current) => {
      const ancestors = ancestorsOf(path);
      if (!ancestors.some((ancestor) => current.has(ancestor))) return current;
      const next = new Set(current);
      for (const ancestor of ancestors) next.delete(ancestor);
      return next;
    });
  }, [matches, activeMatch]);

  const matchSet = useMemo(() => new Set(matches), [matches]);
  const activePath = matches[activeMatch];

  // Scroll the active match into view.
  useEffect(() => {
    if (activePath === undefined) return;
    const index = rows.findIndex((row) => row.path === activePath);
    if (index === -1) return;
    const container = containerRef.current;
    if (!container) return;
    const target = index * ROW_HEIGHT;
    if (target < container.scrollTop || target > container.scrollTop + container.clientHeight - ROW_HEIGHT * 2) {
      container.scrollTo({ top: Math.max(0, target - container.clientHeight / 2), behavior: 'smooth' });
    }
  }, [activePath, rows]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const observer = new ResizeObserver(() => setHeight(container.clientHeight));
    observer.observe(container);
    setHeight(container.clientHeight);
    return () => observer.disconnect();
  }, []);

  const toggle = useCallback((path) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => setCollapsed(new Set()), []);
  const collapseAll = useCallback(() => {
    setCollapsed(new Set(flatten(data, new Set()).filter((row) => row.isContainer && row.depth > 0).map((row) => row.path)));
  }, [data]);

  const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const visibleCount = Math.ceil(height / ROW_HEIGHT) + OVERSCAN * 2;
  const slice = rows.slice(start, start + visibleCount);

  return (
    <>
      <div className="json-viewer__controls">
        <button type="button" className="btn btn--sm btn--ghost" onClick={expandAll}>
          <Icon name="maximize" size={13} />
          Expand all
        </button>
        <button type="button" className="btn btn--sm btn--ghost" onClick={collapseAll}>
          <Icon name="minimize" size={13} />
          Collapse all
        </button>
        <span className="field__hint">{rows.length.toLocaleString()} visible lines</span>
      </div>

      <div
        className="json-viewer"
        ref={containerRef}
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
        role="tree"
        aria-label="JSON response"
        tabIndex={0}
      >
        <div className="json-viewer__spacer" style={{ height: rows.length * ROW_HEIGHT }}>
          <div className="json-viewer__rows" style={{ transform: `translateY(${start * ROW_HEIGHT}px)` }}>
            {slice.map((row, index) => {
              const lineNumber = start + index + 1;
              const isMatch = matchSet.has(row.path);
              const isActive = row.path === activePath;

              return (
                <div
                  key={row.path || 'root'}
                  className="json-viewer__row"
                  data-match={isMatch}
                  data-active={isActive}
                  role="treeitem"
                  aria-expanded={row.isContainer ? !row.collapsed : undefined}
                  aria-level={row.depth + 1}
                >
                  {showLineNumbers && <span className="json-viewer__line-number">{lineNumber}</span>}
                  <span style={{ paddingLeft: row.depth * 14 }} />

                  {row.isContainer ? (
                    <button
                      type="button"
                      className="json-viewer__toggle"
                      data-collapsed={row.collapsed ? 'true' : 'false'}
                      onClick={() => toggle(row.path)}
                      aria-label={`${row.collapsed ? 'Expand' : 'Collapse'} ${row.key ?? 'root'}`}
                    >
                      <Icon name="chevronRight" size={12} />
                    </button>
                  ) : (
                    <span className="json-viewer__toggle-space" />
                  )}

                  {row.key !== null && (
                    <>
                      <span className="json-viewer__key">
                        <Highlighted text={row.key} query={query} />
                      </span>
                      <span className="json-viewer__colon">:</span>
                    </>
                  )}

                  {row.isContainer ? (
                    <span className="json-viewer__meta">
                      {row.type === 'array' ? `Array(${row.childCount})` : `Object{${row.childCount}}`}
                      {row.collapsed ? ' …' : ''}
                    </span>
                  ) : (
                    <span className="json-viewer__value" data-type={row.type}>
                      <Highlighted text={displayValue(row.value)} query={query} />
                    </span>
                  )}

                  <button
                    type="button"
                    className="btn btn--ghost btn--icon btn--sm json-viewer__copy"
                    aria-label={`Copy value of ${row.key ?? 'root'}`}
                    onClick={() =>
                      copyToClipboard(
                        row.isContainer ? JSON.stringify(row.value, null, 2) : String(row.value ?? ''),
                      )
                    }
                  >
                    <Icon name="copy" size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

export default JsonViewer;

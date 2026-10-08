import { useMemo } from 'react';

/** Above this the raw text is clipped so the browser is not asked to lay out megabytes. */
const MAX_RENDER = 500_000;

/** Split text around every occurrence of the query for highlighting. */
function segments(text, query) {
  if (!query) return [{ text, match: false }];
  const parts = [];
  const lower = text.toLowerCase();
  const needle = query.toLowerCase();
  let index = 0;
  let found = lower.indexOf(needle, index);

  while (found !== -1 && parts.length < 4000) {
    if (found > index) parts.push({ text: text.slice(index, found), match: false });
    parts.push({ text: text.slice(found, found + needle.length), match: true });
    index = found + needle.length;
    found = lower.indexOf(needle, index);
  }
  parts.push({ text: text.slice(index), match: false });
  return parts;
}

export function RawViewer({ text = '', query = '', wrap = false, activeMatch = 0 }) {
  const clipped = text.length > MAX_RENDER;
  const visible = clipped ? text.slice(0, MAX_RENDER) : text;
  const parts = useMemo(() => segments(visible, query), [visible, query]);

  let matchIndex = -1;

  return (
    <>
      {clipped && (
        <div className="notice notice--warning" style={{ margin: 'var(--space-3)' }}>
          <span>
            Showing the first {(MAX_RENDER / 1000).toFixed(0)} KB of {(text.length / 1000).toFixed(0)} KB. Download the
            response to read all of it.
          </span>
        </div>
      )}
      <pre className="raw-view" data-wrap={wrap}>
        {parts.map((part, index) => {
          if (!part.match) return <span key={index}>{part.text}</span>;
          matchIndex += 1;
          return (
            <mark key={index} data-active={matchIndex === activeMatch}>
              {part.text}
            </mark>
          );
        })}
      </pre>
    </>
  );
}

export default RawViewer;

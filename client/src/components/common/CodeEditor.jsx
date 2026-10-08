import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';

/** Minimal JSON tokenizer used for the editor overlay. */
function highlightJson(source) {
  const tokens = [];
  const pattern = /("(?:\\.|[^"\\])*"\s*:)|("(?:\\.|[^"\\])*")|(\b-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)|(\btrue\b|\bfalse\b)|(\bnull\b)|([{}[\],:])/g;
  let lastIndex = 0;
  let match = pattern.exec(source);

  while (match !== null) {
    if (match.index > lastIndex) tokens.push({ type: 'plain', text: source.slice(lastIndex, match.index) });
    const [text] = match;
    const type = match[1] ? 'key' : match[2] ? 'string' : match[3] ? 'number' : match[4] ? 'boolean' : match[5] ? 'null' : 'punctuation';
    tokens.push({ type, text });
    lastIndex = match.index + text.length;
    match = pattern.exec(source);
  }
  if (lastIndex < source.length) tokens.push({ type: 'plain', text: source.slice(lastIndex) });
  return tokens;
}

/**
 * Textarea with an aligned syntax-highlight overlay and a line-number gutter.
 * Highlighting is skipped for very large documents so typing stays responsive.
 */
const MAX_HIGHLIGHT_LENGTH = 100_000;

export function CodeEditor({
  value,
  onChange,
  language = 'json',
  placeholder = '',
  invalid = false,
  readOnly = false,
  minHeight = 240,
  ariaLabel = 'Code editor',
  id,
}) {
  const textareaRef = useRef(null);
  const overlayRef = useRef(null);
  const gutterRef = useRef(null);

  const lineCount = useMemo(() => (value ? value.split('\n').length : 1), [value]);
  const shouldHighlight = language === 'json' && value.length <= MAX_HIGHLIGHT_LENGTH;

  const tokens = useMemo(
    () => (shouldHighlight ? highlightJson(value) : null),
    [shouldHighlight, value],
  );

  const syncScroll = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    if (overlayRef.current) {
      overlayRef.current.scrollTop = textarea.scrollTop;
      overlayRef.current.scrollLeft = textarea.scrollLeft;
    }
    if (gutterRef.current) gutterRef.current.scrollTop = textarea.scrollTop;
  }, []);

  useLayoutEffect(syncScroll, [value, syncScroll]);

  // Tab inserts two spaces instead of moving focus out of the editor.
  const handleKeyDown = (event) => {
    if (event.key !== 'Tab' || event.shiftKey) return;
    event.preventDefault();
    const textarea = event.target;
    const { selectionStart, selectionEnd } = textarea;
    const next = `${value.slice(0, selectionStart)}  ${value.slice(selectionEnd)}`;
    onChange(next);
    requestAnimationFrame(() => {
      textarea.selectionStart = selectionStart + 2;
      textarea.selectionEnd = selectionStart + 2;
    });
  };

  return (
    <div className="code-editor" data-invalid={invalid} style={{ minHeight }}>
      <div className="code-editor__gutter" ref={gutterRef} aria-hidden="true">
        {Array.from({ length: lineCount }, (_, index) => (
          <div key={index}>{index + 1}</div>
        ))}
      </div>

      <div className="code-editor__surface">
        {shouldHighlight && (
          <pre className="code-editor__overlay" ref={overlayRef} aria-hidden="true">
            {tokens.map((token, index) => (
              <span key={index} data-token={token.type}>
                {token.text}
              </span>
            ))}
            {'\n'}
          </pre>
        )}
        <textarea
          id={id}
          ref={textareaRef}
          className="code-editor__input"
          data-transparent={shouldHighlight}
          value={value}
          placeholder={placeholder}
          readOnly={readOnly}
          spellCheck="false"
          autoCapitalize="off"
          autoCorrect="off"
          aria-label={ariaLabel}
          aria-invalid={invalid}
          onChange={(event) => onChange(event.target.value)}
          onScroll={syncScroll}
          onKeyDown={handleKeyDown}
        />
      </div>
    </div>
  );
}

export default CodeEditor;

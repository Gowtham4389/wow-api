import { useMemo } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import KeyValueEditor from './KeyValueEditor.jsx';
import CopyButton from '../common/CopyButton.jsx';
import { buildOutgoingRequest } from '../../utils/request.js';

/** Header names offered as autocomplete suggestions. */
const COMMON_HEADERS = [
  'Accept', 'Accept-Encoding', 'Accept-Language', 'Authorization', 'Cache-Control', 'Content-Type',
  'Cookie', 'If-Match', 'If-None-Match', 'Origin', 'Referer', 'User-Agent', 'X-Api-Key',
  'X-Correlation-Id', 'X-Request-Id', 'X-Requested-With',
];

export function HeadersEditor() {
  const { request, setHeaders } = useApp();

  // Everything the request will actually send, including generated auth headers.
  const effective = useMemo(() => buildOutgoingRequest(request).headers, [request]);
  const generated = Object.entries(effective).filter(
    ([name]) => !request.headers.some((row) => row.enabled && row.key.trim().toLowerCase() === name.toLowerCase()),
  );

  return (
    <div className="stack">
      <KeyValueEditor
        rows={request.headers}
        onChange={setHeaders}
        keyPlaceholder="Header"
        valuePlaceholder="Value"
        keySuggestions={COMMON_HEADERS}
        suggestionsId="common-headers"
        ariaLabel="Request headers"
        emptyLabel="No headers set."
      />

      {generated.length > 0 && (
        <div className="notice">
          <div>
            <p className="notice__title">Added automatically</p>
            <p className="notice__body">
              {generated.map(([name]) => name).join(', ')} — from the Authorization tab and the body type.
            </p>
          </div>
        </div>
      )}

      <div className="row">
        <CopyButton
          withText
          label="Copy all headers"
          value={() =>
            Object.entries(effective)
              .map(([name, value]) => `${name}: ${value}`)
              .join('\n')
          }
        />
      </div>
    </div>
  );
}

export default HeadersEditor;

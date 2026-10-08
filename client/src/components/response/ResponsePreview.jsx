import { useMemo } from 'react';
import EmptyState from '../common/EmptyState.jsx';
import Icon from '../common/Icon.jsx';

/**
 * Renders a response where it is safe to do so.
 * HTML is shown inside a fully sandboxed iframe: no scripts, no same-origin
 * access, no forms, so nothing from the response can touch this app.
 */
export function ResponsePreview({ response, parsed }) {
  const contentType = (response?.contentType ?? '').split(';')[0].toLowerCase();

  const dataUrl = useMemo(() => {
    if (!response || response.bodyEncoding !== 'base64') return null;
    return `data:${contentType || 'application/octet-stream'};base64,${response.body}`;
  }, [response, contentType]);

  if (!response) return null;

  if (contentType.startsWith('image/')) {
    const source = dataUrl ?? `data:${contentType};charset=utf-8,${encodeURIComponent(response.body)}`;
    return (
      <div style={{ padding: 'var(--space-3)' }}>
        <img className="preview-image" src={source} alt="Response preview" />
      </div>
    );
  }

  if (contentType.includes('html') || contentType.includes('xhtml')) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div className="notice notice--info" style={{ margin: 'var(--space-3)' }}>
          <Icon name="shield" size={15} />
          <span>
            Rendered in a sandboxed frame with scripts, forms and same-origin access disabled, so the page cannot reach
            API Inspector.
          </span>
        </div>
        <iframe
          className="preview-frame"
          title="HTML response preview"
          sandbox=""
          referrerPolicy="no-referrer"
          srcDoc={response.body}
        />
      </div>
    );
  }

  if (contentType.includes('pdf') || response.bodyEncoding === 'base64') {
    return (
      <EmptyState
        icon="fileText"
        title="Binary response"
        description={`This response is ${contentType || 'binary'} and cannot be previewed inline. Download it from the toolbar to open it locally.`}
      />
    );
  }

  if (parsed !== undefined) {
    return <pre className="raw-view" data-wrap="true">{JSON.stringify(parsed, null, 2)}</pre>;
  }

  return <pre className="raw-view" data-wrap="true">{response.body}</pre>;
}

export default ResponsePreview;

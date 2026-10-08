import { useMemo } from 'react';
import CopyButton from '../common/CopyButton.jsx';
import EmptyState from '../common/EmptyState.jsx';

export function ResponseHeaders({ response }) {
  const entries = useMemo(() => Object.entries(response?.headers ?? {}).sort(([a], [b]) => a.localeCompare(b)), [response]);

  if (!entries.length) {
    return <EmptyState icon="info" title="No response headers" description="The response did not include any headers." />;
  }

  return (
    <div>
      {response.via === 'direct' && (
        <div className="notice notice--info" style={{ margin: 'var(--space-3)' }}>
          <span>
            Sent directly from the browser, so only headers the API exposes through
            <code> Access-Control-Expose-Headers</code> are visible. Switch to Proxy mode to see all of them.
          </span>
        </div>
      )}

      <table className="headers-table">
        <thead>
          <tr>
            <th scope="col">Header</th>
            <th scope="col">Value</th>
            <th scope="col" aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {entries.map(([name, value]) => (
            <tr key={name}>
              <td>{name}</td>
              <td>{value}</td>
              <td style={{ width: 1 }}>
                <CopyButton value={`${name}: ${value}`} label={`Copy ${name}`} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ResponseHeaders;

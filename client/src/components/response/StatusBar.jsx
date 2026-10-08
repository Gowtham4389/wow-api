import { STATUS_LABELS, formatBytes, formatDuration, statusCategory } from '../../utils/format.js';
import Icon from '../common/Icon.jsx';
import Tooltip from '../common/Tooltip.jsx';

const CATEGORY_ICONS = {
  success: 'check',
  redirect: 'arrowRight',
  'client-error': 'alert',
  'server-error': 'alert',
  info: 'info',
  none: 'info',
};

/** Status is conveyed by icon, label and colour together, never colour alone. */
export function StatusBar({ response }) {
  if (!response) return null;

  const category = statusCategory(response.status);
  const contentType = (response.contentType || '').split(';')[0] || 'unknown';

  return (
    <div className="status-bar" role="status" aria-live="polite">
      <span className="status-bar__status" data-category={category}>
        <Icon name={CATEGORY_ICONS[category]} size={14} />
        {response.status} {response.statusText}
        <span className="visually-hidden">— {STATUS_LABELS[category]}</span>
      </span>

      <span className="status-bar__divider" />

      <Tooltip label="Total round trip measured by the sender" placement="top">
        <span className="status-bar__metric">
          <Icon name="clock" size={13} />
          <strong>{formatDuration(response.time ?? response.roundTrip)}</strong>
        </span>
      </Tooltip>

      <Tooltip label="Size of the response body" placement="top">
        <span className="status-bar__metric">
          <Icon name="database" size={13} />
          <strong>{formatBytes(response.size)}</strong>
        </span>
      </Tooltip>

      <span className="status-bar__metric mono">{contentType}</span>

      {response.redirects?.length > 0 && (
        <Tooltip
          label={response.redirects.map((hop) => `${hop.status ?? ''} ${hop.from} → ${hop.to}`).join('\n')}
          placement="top"
        >
          <span className="badge badge--info">
            {response.redirects.length} redirect{response.redirects.length > 1 ? 's' : ''}
          </span>
        </Tooltip>
      )}

      {response.truncated && (
        <Tooltip label="The body exceeded the configured maximum response size" placement="top">
          <span className="badge badge--warning">Truncated</span>
        </Tooltip>
      )}

      <Tooltip
        label={response.via === 'direct' ? 'Sent straight from the browser' : 'Sent through the API Inspector proxy'}
        placement="top"
      >
        <span className="badge">{response.via === 'direct' ? 'Direct' : 'Proxy'}</span>
      </Tooltip>

      <span className="status-bar__spacer" />

      <span className="status-bar__url" title={response.finalUrl}>
        {response.finalUrl}
      </span>
    </div>
  );
}

export default StatusBar;

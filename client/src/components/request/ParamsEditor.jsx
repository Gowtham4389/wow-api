import { useApp } from '../../context/AppContext.jsx';
import KeyValueEditor from './KeyValueEditor.jsx';
import { previewUrl } from '../../utils/request.js';
import CopyButton from '../common/CopyButton.jsx';

export function ParamsEditor() {
  const { request, setParams } = useApp();
  const finalUrl = previewUrl(request);

  return (
    <div className="stack">
      <p className="field__hint">
        Rows are written straight into the URL. Pasting a URL that already contains a query string fills this table in.
      </p>

      <KeyValueEditor
        rows={request.params}
        onChange={setParams}
        keyPlaceholder="Parameter"
        valuePlaceholder="Value"
        ariaLabel="Query parameters"
        emptyLabel="No query parameters."
      />

      {finalUrl && (
        <div className="row">
          <span className="field__hint truncate mono" title={finalUrl}>
            {finalUrl}
          </span>
          <CopyButton value={finalUrl} label="Copy final URL" />
        </div>
      )}
    </div>
  );
}

export default ParamsEditor;

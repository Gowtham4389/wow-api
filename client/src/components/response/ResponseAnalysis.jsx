import { useMemo } from 'react';
import { analyzeJson } from '../../utils/analyze.js';
import { inferSchema, schemaToRows } from '../../utils/schema.js';
import { formatBytes } from '../../utils/format.js';
import EmptyState from '../common/EmptyState.jsx';
import CopyButton from '../common/CopyButton.jsx';
import Icon from '../common/Icon.jsx';

function Stat({ label, value }) {
  return (
    <div className="analysis__stat">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Chips({ title, items, icon }) {
  if (!items?.length) return null;
  return (
    <section>
      <h3 className="analysis__section-title">
        <Icon name={icon} size={13} /> {title}
      </h3>
      <div className="analysis__chips">
        {items.map((item) => (
          <span className="analysis__chip" key={item}>
            {item}
          </span>
        ))}
      </div>
    </section>
  );
}

export function ResponseAnalysis({ data, response, onGenerateModels }) {
  const analysis = useMemo(() => (data === undefined ? null : analyzeJson(data)), [data]);
  const schemaRows = useMemo(() => (data === undefined ? [] : schemaToRows(inferSchema(data)).slice(0, 400)), [data]);

  if (!analysis) {
    return (
      <EmptyState
        icon="info"
        title="Analysis needs JSON"
        description="This response is not JSON, so there is nothing to analyse. The Raw and Preview tabs still show the full body."
      />
    );
  }

  const schemaText = schemaRows
    .map((row) => `${'  '.repeat(row.depth)}${row.key}  ${row.type}${row.optional ? '  (optional)' : ''}`)
    .join('\n');

  return (
    <div className="analysis">
      <section>
        <h3 className="analysis__section-title">Structure</h3>
        <dl className="analysis__grid">
          <Stat label="Root type" value={analysis.rootType} />
          <Stat label="Records" value={analysis.records.toLocaleString()} />
          <Stat label="Objects" value={analysis.objects.toLocaleString()} />
          <Stat label="Arrays" value={analysis.arrays.toLocaleString()} />
          <Stat label="Max depth" value={analysis.maxDepth} />
          <Stat label="Unique keys" value={analysis.uniqueKeyCount.toLocaleString()} />
          <Stat label="Null values" value={analysis.nullValues.toLocaleString()} />
          <Stat label="Empty values" value={analysis.emptyValues.toLocaleString()} />
          <Stat label="Body size" value={formatBytes(response?.size)} />
        </dl>
        {analysis.recordsFrom && (
          <p className="field__hint" style={{ marginTop: 'var(--space-2)' }}>
            Records counted from the <code>{analysis.recordsFrom}</code> array.
          </p>
        )}
      </section>

      <section>
        <h3 className="analysis__section-title">Value types</h3>
        <div className="analysis__chips">
          {Object.entries(analysis.types)
            .sort((a, b) => b[1] - a[1])
            .map(([type, count]) => (
              <span className="analysis__chip" key={type}>
                {type} <strong>{count.toLocaleString()}</strong>
              </span>
            ))}
        </div>
      </section>

      {analysis.rootProperties.length > 0 && (
        <section>
          <h3 className="analysis__section-title">Root properties</h3>
          <div className="analysis__chips">
            {analysis.rootProperties.map((property) => (
              <span className="analysis__chip" key={property.key}>
                {property.key}
                <span style={{ color: 'var(--text-muted)' }}>
                  {property.type}
                  {property.size !== undefined ? `(${property.size})` : ''}
                </span>
              </span>
            ))}
          </div>
        </section>
      )}

      <Chips title="Detected pagination" items={analysis.pagination} icon="layers" />
      <Chips title="Identifier fields" items={analysis.idFields} icon="database" />
      <Chips title="Date and time fields" items={analysis.dateFields} icon="clock" />
      <Chips title="URL fields" items={analysis.urlFields} icon="link" />

      {schemaRows.length > 0 && (
        <section>
          <div className="row" style={{ marginBottom: 'var(--space-2)' }}>
            <h3 className="analysis__section-title" style={{ margin: 0 }}>
              Detected schema
            </h3>
            <div style={{ flex: 1 }} />
            <CopyButton value={schemaText} label="Copy schema" />
            {onGenerateModels && (
              <button type="button" className="btn btn--sm" onClick={onGenerateModels}>
                <Icon name="code" size={13} />
                Generate code
              </button>
            )}
          </div>

          <table className="schema-table">
            <thead>
              <tr>
                <th scope="col">Field</th>
                <th scope="col">Type</th>
                <th scope="col">Required</th>
              </tr>
            </thead>
            <tbody>
              {schemaRows.map((row) => (
                <tr key={row.path}>
                  <td style={{ paddingLeft: `calc(var(--space-3) + ${row.depth * 14}px)` }}>{row.key}</td>
                  <td>{row.type}</td>
                  <td>{row.optional ? 'optional' : 'always'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {analysis.truncated && (
        <div className="notice notice--warning">
          <span>The response is very large, so analysis stopped after 200,000 nodes. The numbers above are a lower bound.</span>
        </div>
      )}
    </div>
  );
}

export default ResponseAnalysis;

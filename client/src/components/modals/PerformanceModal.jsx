import { useCallback, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import Modal from '../common/Modal.jsx';
import Icon from '../common/Icon.jsx';
import { PERF_RUN_OPTIONS, runPerformanceTest } from '../../services/apiClient.js';
import { formatDuration } from '../../utils/format.js';
import { validateUrl } from '../../utils/url.js';

function Metric({ label, value }) {
  return (
    <div className="analysis__stat">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

/**
 * Sequential benchmark of the current request. Runs are capped and spaced out:
 * this measures an endpoint, it is not a load testing tool.
 */
export function PerformanceModal({ open, onClose }) {
  const { request, settings } = useApp();
  const toast = useToast();

  const [runs, setRuns] = useState(5);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);
  const abortRef = useRef(null);

  const start = useCallback(async () => {
    const check = validateUrl(request.url);
    if (!check.ok) {
      toast.error(check.message);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setResult(null);
    setProgress({ completed: 0, total: runs });

    try {
      const summary = await runPerformanceTest(
        { ...request, url: check.url },
        {
          runs,
          mode: settings.sendMode,
          signal: controller.signal,
          onProgress: setProgress,
        },
      );
      setResult(summary);
      if (summary.successes === 0) toast.error('Every request failed. Check the endpoint and try again.');
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }, [request, runs, settings.sendMode, toast]);

  const stop = () => abortRef.current?.abort();

  const maxTime = result?.slowest ?? 1;

  return (
    <Modal
      open={open}
      onClose={() => {
        stop();
        onClose();
      }}
      title="Performance test"
      subtitle={`${request.method} ${request.url || 'no URL set'}`}
      width={640}
      footer={
        running ? (
          <button type="button" className="btn btn--danger" onClick={stop}>
            <Icon name="square" size={14} />
            Stop
          </button>
        ) : (
          <>
            <button type="button" className="btn" onClick={onClose}>
              Close
            </button>
            <button type="button" className="btn btn--primary" onClick={start} disabled={!request.url.trim()}>
              <Icon name="play" size={14} />
              Run {runs} requests
            </button>
          </>
        )
      }
    >
      <div className="perf">
        <div className="field">
          <span className="field__label">Number of requests</span>
          <div className="perf__options" role="group" aria-label="Number of requests">
            {PERF_RUN_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                className="perf__chip"
                aria-pressed={runs === option}
                disabled={running}
                onClick={() => setRuns(option)}
              >
                {option}
              </button>
            ))}
          </div>
          <p className="field__hint">
            Requests run one after another with a short pause, so this measures latency without hammering the API.
          </p>
        </div>

        {(running || progress) && (
          <div className="stack">
            <div className="perf__progress" role="progressbar" aria-valuenow={progress?.completed ?? 0} aria-valuemin={0} aria-valuemax={progress?.total ?? runs}>
              <span style={{ width: `${((progress?.completed ?? 0) / (progress?.total ?? runs)) * 100}%` }} />
            </div>
            <p className="field__hint">
              {progress?.completed ?? 0} of {progress?.total ?? runs} completed
            </p>
          </div>
        )}

        {result && (
          <>
            <dl className="perf__grid">
              <Metric label="Fastest" value={formatDuration(result.fastest)} />
              <Metric label="Slowest" value={formatDuration(result.slowest)} />
              <Metric label="Average" value={formatDuration(result.average)} />
              <Metric label="Median" value={formatDuration(result.median)} />
              <Metric label="Success rate" value={`${result.successRate.toFixed(0)}%`} />
              <Metric label="Failed" value={result.failures.length} />
            </dl>

            {result.samples.length > 1 && (
              <div>
                <p className="field__hint" style={{ marginBottom: 'var(--space-1)' }}>
                  Response time per request
                </p>
                <div className="perf__bars" aria-hidden="true">
                  {result.samples.map((sample) => (
                    <span key={sample.index} style={{ height: `${Math.max(4, (sample.time / maxTime) * 100)}%` }} />
                  ))}
                </div>
              </div>
            )}

            <div className="analysis__chips">
              {Object.entries(result.statuses).map(([status, count]) => (
                <span className="analysis__chip" key={status}>
                  {status} × {count}
                </span>
              ))}
            </div>

            {result.failures.length > 0 && (
              <div className="notice notice--warning">
                <Icon name="alert" size={15} />
                <div>
                  <p className="notice__title">{result.failures.length} request(s) failed</p>
                  <p className="notice__body">{result.failures[0].message}</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

export default PerformanceModal;

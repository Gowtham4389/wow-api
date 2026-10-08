import { HTTP_METHODS } from '../../utils/request.js';

export function MethodSelector({ value, onChange, disabled = false }) {
  return (
    <div className="method-selector" data-method={value}>
      <label className="visually-hidden" htmlFor="request-method">
        HTTP method
      </label>
      <select
        id="request-method"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        {HTTP_METHODS.map((method) => (
          <option key={method} value={method}>
            {method}
          </option>
        ))}
      </select>
    </div>
  );
}

export default MethodSelector;

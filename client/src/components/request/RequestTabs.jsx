import { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import Tabs from '../common/Tabs.jsx';
import ParamsEditor from './ParamsEditor.jsx';
import HeadersEditor from './HeadersEditor.jsx';
import AuthorizationEditor from './AuthorizationEditor.jsx';
import BodyEditor from './BodyEditor.jsx';

export function RequestTabs() {
  const { request } = useApp();
  const [active, setActive] = useState('params');

  const tabs = useMemo(
    () => [
      { value: 'params', label: 'Params', count: request.params.filter((row) => row.enabled && row.key).length },
      { value: 'authorization', label: 'Authorization', dot: request.auth.type !== 'none' },
      { value: 'headers', label: 'Headers', count: request.headers.filter((row) => row.enabled && row.key).length },
      { value: 'body', label: 'Body', dot: request.body.mode !== 'none' },
    ],
    [request],
  );

  return (
    <div className="request-tabs">
      <Tabs tabs={tabs} value={active} onChange={setActive} className="request-tabs__list" ariaLabel="Request configuration" />
      <div
        className="request-tabs__panel"
        role="tabpanel"
        id={`panel-${active}`}
        aria-labelledby={`tab-${active}`}
        tabIndex={0}
      >
        {active === 'params' && <ParamsEditor />}
        {active === 'authorization' && <AuthorizationEditor />}
        {active === 'headers' && <HeadersEditor />}
        {active === 'body' && <BodyEditor />}
      </div>
    </div>
  );
}

export default RequestTabs;

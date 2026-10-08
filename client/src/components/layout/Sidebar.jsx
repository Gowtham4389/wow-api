import { useApp } from '../../context/AppContext.jsx';
import Icon from '../common/Icon.jsx';
import HistoryPanel from '../panels/HistoryPanel.jsx';
import SavedPanel from '../panels/SavedPanel.jsx';
import CollectionsPanel from '../panels/CollectionsPanel.jsx';

const TOOL_LINKS = [
  { id: 'json-formatter', label: 'JSON Formatter' },
  { id: 'json-validator', label: 'JSON Validator' },
  { id: 'json-csv', label: 'JSON ↔ CSV' },
  { id: 'base64', label: 'Base64' },
  { id: 'url-encoder', label: 'URL Encoder' },
];

/**
 * Sidebar navigation. `section` selects which list is shown; `view` switches
 * between the inspector, the tools page and settings.
 */
export function Sidebar({ view, onViewChange, section, onSectionChange, onNewRequest, onToolSelect, onNavigate }) {
  const { history, saved } = useApp();

  const navigate = (next) => {
    onViewChange(next);
    onNavigate?.();
  };

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <span className="sidebar__logo">
          <Icon name="zap" size={15} />
        </span>
        <span className="sidebar__title">API Inspector</span>
      </div>

      <div className="sidebar__body">
        <button
          type="button"
          className="btn btn--primary btn--block"
          onClick={() => {
            onNewRequest();
            onNavigate?.();
          }}
        >
          <Icon name="plus" size={15} />
          New request
        </button>

        <nav className="sidebar__nav" aria-label="Workspace">
          <button
            type="button"
            className="sidebar__link"
            aria-current={view === 'inspector' && section === 'history'}
            onClick={() => {
              onSectionChange('history');
              navigate('inspector');
            }}
          >
            <Icon name="history" size={15} />
            History
            {history.length > 0 && <span className="badge badge--count">{history.length}</span>}
          </button>

          <button
            type="button"
            className="sidebar__link"
            aria-current={view === 'inspector' && section === 'saved'}
            onClick={() => {
              onSectionChange('saved');
              navigate('inspector');
            }}
          >
            <Icon name="bookmark" size={15} />
            Saved
            {saved.length > 0 && <span className="badge badge--count">{saved.length}</span>}
          </button>

          <button
            type="button"
            className="sidebar__link"
            aria-current={view === 'inspector' && section === 'collections'}
            onClick={() => {
              onSectionChange('collections');
              navigate('inspector');
            }}
          >
            <Icon name="folder" size={15} />
            Collections
          </button>
        </nav>

        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <div className="sidebar__section-title">
            {section === 'history' ? 'Recent requests' : section === 'saved' ? 'Saved requests' : 'Collections'}
          </div>
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              overflowX: 'hidden',
              margin: '0 calc(var(--space-3) * -1)',
            }}
          >
            {section === 'history' && <HistoryPanel onPick={onNavigate} />}
            {section === 'saved' && <SavedPanel onPick={onNavigate} />}
            {section === 'collections' && <CollectionsPanel />}
          </div>
        </div>

        <nav className="sidebar__nav" aria-label="Tools">
          <div className="sidebar__section-title">Tools</div>
          {TOOL_LINKS.map((tool) => (
            <button
              key={tool.id}
              type="button"
              className="sidebar__link"
              onClick={() => {
                onToolSelect(tool.id);
                navigate('tools');
              }}
            >
              <Icon name="tool" size={15} />
              {tool.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="sidebar__footer">
        <button
          type="button"
          className="sidebar__link"
          aria-current={view === 'settings'}
          onClick={() => navigate('settings')}
          style={{ width: 'auto' }}
        >
          <Icon name="settings" size={15} />
          Settings
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;

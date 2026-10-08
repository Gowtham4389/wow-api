import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { AppProvider, useApp } from './context/AppContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import { useTheme } from './hooks/useTheme.js';
import { useHotkeys } from './hooks/useHotkeys.js';
import { useMediaQuery } from './hooks/useMediaQuery.js';
import Sidebar from './components/layout/Sidebar.jsx';
import TopBar from './components/layout/TopBar.jsx';
import Toasts from './components/common/Toasts.jsx';
import InspectorPage from './pages/InspectorPage.jsx';
import SaveRequestModal from './components/modals/SaveRequestModal.jsx';
import ImportCurlModal from './components/modals/ImportCurlModal.jsx';
import PerformanceModal from './components/modals/PerformanceModal.jsx';
import ShortcutsModal from './components/modals/ShortcutsModal.jsx';

/* Pages and the generator dialog are split out of the initial bundle. */
const ToolsPage = lazy(() => import('./pages/ToolsPage.jsx'));
const SettingsPage = lazy(() => import('./pages/SettingsPage.jsx'));
const CodeGeneratorModal = lazy(() => import('./components/modals/CodeGeneratorModal.jsx'));

const PAGE_TITLES = { inspector: null, tools: 'Tools', settings: 'Settings' };

function Workspace() {
  const { send, sending, cancel, newRequest } = useApp();
  const { theme, setTheme, toggleTheme } = useTheme();
  const isMobile = useMediaQuery('(max-width: 960px)');

  const [view, setView] = useState('inspector');
  const [section, setSection] = useState('history');
  const [activeTool, setActiveTool] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [modal, setModal] = useState(null);
  const [generatorTab, setGeneratorTab] = useState('request');

  const closeModal = useCallback(() => setModal(null), []);

  const openGenerator = useCallback((tab) => {
    setGeneratorTab(tab);
    setModal('generator');
  }, []);

  const cycleTheme = useCallback(() => {
    const order = ['light', 'dark', 'system'];
    setTheme(order[(order.indexOf(theme) + 1) % order.length]);
  }, [theme, setTheme]);

  const hotkeys = useMemo(
    () => ({
      'mod+enter': () => {
        if (view !== 'inspector') setView('inspector');
        send();
      },
      'mod+s': () => setModal('save'),
      'mod+g': () => openGenerator('request'),
      'mod+i': () => setModal('curl'),
      'mod+b': () => (isMobile ? setDrawerOpen((open) => !open) : setSidebarCollapsed((collapsed) => !collapsed)),
      'mod+j': toggleTheme,
      'mod+k': () => {
        setView('inspector');
        requestAnimationFrame(() => document.getElementById('request-url')?.focus());
      },
      escape: () => {
        if (modal) {
          closeModal();
          return;
        }
        if (drawerOpen) {
          setDrawerOpen(false);
          return;
        }
        if (sending) cancel();
      },
    }),
    [send, view, openGenerator, isMobile, toggleTheme, modal, closeModal, drawerOpen, sending, cancel],
  );

  useHotkeys(hotkeys);

  // The drawer only exists on small screens.
  useEffect(() => {
    if (!isMobile) setDrawerOpen(false);
  }, [isMobile]);

  const sidebar = (
    <Sidebar
      view={view}
      onViewChange={setView}
      section={section}
      onSectionChange={setSection}
      onNewRequest={() => {
        newRequest();
        setView('inspector');
      }}
      onToolSelect={setActiveTool}
      onNavigate={() => setDrawerOpen(false)}
    />
  );

  return (
    <div className="app" data-sidebar={sidebarCollapsed ? 'collapsed' : 'expanded'}>
      {!isMobile && sidebar}

      {isMobile && drawerOpen && (
        <div className="drawer" role="dialog" aria-label="Navigation">
          <div className="drawer__scrim" onClick={() => setDrawerOpen(false)} />
          <div className="drawer__panel">{sidebar}</div>
        </div>
      )}

      <div className="main">
        <TopBar
          isMobile={isMobile}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={() => (isMobile ? setDrawerOpen(true) : setSidebarCollapsed((collapsed) => !collapsed))}
          theme={theme}
          onCycleTheme={cycleTheme}
          onImportCurl={() => setModal('curl')}
          onPerformance={() => setModal('performance')}
          onShortcuts={() => setModal('shortcuts')}
          title={PAGE_TITLES[view]}
        />

        <Suspense
          fallback={
            <div className="empty-state" style={{ flex: 1 }}>
              <span className="spinner" />
            </div>
          }
        >
          {view === 'inspector' && (
            <InspectorPage
              onSave={() => setModal('save')}
              onGenerateCode={() => openGenerator('request')}
              onGenerateModels={() => openGenerator('models')}
              onGenerateDocs={() => openGenerator('docs')}
            />
          )}
          {view === 'tools' && <ToolsPage activeTool={activeTool} />}
          {view === 'settings' && <SettingsPage theme={theme} onThemeChange={setTheme} />}
        </Suspense>
      </div>

      <SaveRequestModal open={modal === 'save'} onClose={closeModal} />
      <ImportCurlModal open={modal === 'curl'} onClose={closeModal} />
      <PerformanceModal open={modal === 'performance'} onClose={closeModal} />
      <ShortcutsModal open={modal === 'shortcuts'} onClose={closeModal} />
      {modal === 'generator' && (
        <Suspense fallback={null}>
          <CodeGeneratorModal open onClose={closeModal} initialTab={generatorTab} />
        </Suspense>
      )}

      <Toasts />
    </div>
  );
}

export function App() {
  return (
    <ToastProvider>
      <AppProvider>
        <Workspace />
      </AppProvider>
    </ToastProvider>
  );
}

export default App;

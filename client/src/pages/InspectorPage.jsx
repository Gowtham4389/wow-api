import RequestBar from '../components/request/RequestBar.jsx';
import RequestTabs from '../components/request/RequestTabs.jsx';
import ResponseViewer from '../components/response/ResponseViewer.jsx';

export function InspectorPage({ onSave, onGenerateCode, onGenerateModels, onGenerateDocs }) {
  return (
    <div className="workspace">
      <RequestBar onSave={onSave} onGenerateCode={onGenerateCode} />

      <div className="workspace__panels">
        <section className="panel" aria-label="Request configuration">
          <RequestTabs />
        </section>

        <section className="panel" aria-label="Response">
          <ResponseViewer onGenerateModels={onGenerateModels} onGenerateDocs={onGenerateDocs} />
        </section>
      </div>
    </div>
  );
}

export default InspectorPage;

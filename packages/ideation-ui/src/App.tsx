import { Routes, Route, useParams, useLocation } from 'react-router-dom';
import { IdeationLayout, Sidebar } from '@/components/layout';
import { HomePage } from '@/pages/HomePage';
import { SessionPage } from '@/pages/SessionPage';
import { usePanelState } from '@/hooks/usePanelState';
import { useUnderstanding } from '@/hooks/useUnderstanding';
import { SpecialistsPanel } from '@/components/specialists';

// Component that provides the specialists panel for the current session
function SpecialistsPanelWrapper() {
  const { id } = useParams<{ id: string }>();
  const { understanding, activeSpecialists } = useUnderstanding(id);

  return (
    <SpecialistsPanel
      understanding={understanding}
      activeSpecialists={activeSpecialists}
    />
  );
}

// Empty placeholder when not on a session page
function EmptyPanel() {
  return (
    <div className="p-4">
      <h2 className="text-sm font-semibold text-text-primary mb-4">Specialists</h2>
      <p className="text-text-muted text-sm">
        Select a session to see specialist insights.
      </p>
    </div>
  );
}

export function App() {
  const { isCollapsed, togglePanel } = usePanelState();
  const location = useLocation();

  // Check if we're on a session page
  const isSessionPage = location.pathname.startsWith('/session/');

  // Render the appropriate panel based on current route
  const panel = isSessionPage ? (
    <Routes>
      <Route path="/session/:id" element={<SpecialistsPanelWrapper />} />
    </Routes>
  ) : (
    <EmptyPanel />
  );

  return (
    <IdeationLayout
      sidebar={<Sidebar />}
      panel={panel}
      panelCollapsed={isCollapsed}
      onTogglePanel={togglePanel}
    >
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/session/:id" element={<SessionPage />} />
      </Routes>
    </IdeationLayout>
  );
}

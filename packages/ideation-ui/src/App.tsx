import { Routes, Route, useParams, useLocation } from 'react-router-dom';
import { IdeationLayout, Sidebar } from '@/components/layout';
import { HomePage } from '@/pages/HomePage';
import { SessionPage } from '@/pages/SessionPage';
import { MockupPage } from '@/pages/MockupPage';
import { usePanelState } from '@/hooks/usePanelState';
import { useUnderstanding } from '@/hooks/useUnderstanding';
import { SpecialistsPanel } from '@/components/specialists';
import { ChevronIcon } from '@/components/icons';

// Component that provides the specialists panel for the current session
function SpecialistsPanelWrapper({ isCollapsed, onTogglePanel }: { isCollapsed: boolean; onTogglePanel: () => void }) {
  const { id } = useParams<{ id: string }>();
  const { understanding, activeSpecialists } = useUnderstanding(id);

  return (
    <SpecialistsPanel
      understanding={understanding}
      activeSpecialists={activeSpecialists}
      isCollapsed={isCollapsed}
      onToggleCollapse={onTogglePanel}
    />
  );
}

// Empty placeholder when not on a session page
function EmptyPanel({ isCollapsed, onTogglePanel }: { isCollapsed: boolean; onTogglePanel: () => void }) {
  if (isCollapsed) {
    return (
      <button
        onClick={onTogglePanel}
        className="fixed right-0 top-1/2 -translate-y-1/2 bg-bg-secondary border border-border-subtle rounded-l-lg p-2 hover:bg-bg-tertiary transition-colors z-50 shadow-lg"
        aria-label="Expand specialists panel"
      >
        <ChevronIcon direction="left" size="sm" className="text-text-secondary" />
      </button>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-text-primary">Specialists</h2>
        <button
          onClick={onTogglePanel}
          className="p-1 hover:bg-bg-tertiary rounded transition-colors"
          aria-label="Collapse panel"
        >
          <ChevronIcon direction="right" size="sm" className="text-text-secondary" />
        </button>
      </div>
      <p className="text-text-muted text-sm">
        Select a session to see specialist insights.
      </p>
    </div>
  );
}

export function App() {
  const { isCollapsed, togglePanel } = usePanelState();
  const location = useLocation();

  // Mockup page bypasses IdeationLayout
  if (location.pathname === '/mockup') {
    return <MockupPage />;
  }

  // Check if we're on a session page
  const isSessionPage = location.pathname.startsWith('/session/');

  // Render the appropriate panel based on current route
  const panel = isSessionPage ? (
    <Routes>
      <Route
        path="/session/:id/*"
        element={<SpecialistsPanelWrapper isCollapsed={isCollapsed} onTogglePanel={togglePanel} />}
      />
    </Routes>
  ) : (
    <EmptyPanel isCollapsed={isCollapsed} onTogglePanel={togglePanel} />
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
        <Route path="/session/:id/*" element={<SessionPage />} />
      </Routes>
    </IdeationLayout>
  );
}

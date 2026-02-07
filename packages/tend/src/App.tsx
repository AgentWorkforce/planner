import { Routes, Route, useParams, useLocation } from 'react-router-dom';
import { IdeationLayout, Sidebar, TendLayout } from '@/components/layout';
import { HomePage } from '@/pages/HomePage';
import { SessionPage } from '@/pages/SessionPage';
import { MockupPage } from '@/pages/MockupPage';
import { CanvasPage } from '@/pages/CanvasPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { ProjectPage } from '@/pages/ProjectPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { usePanelState } from '@/hooks/usePanelState';
import { useUnderstanding } from '@/hooks/useUnderstanding';
import { useSessions } from '@/hooks/useSessions';
import { useCommandPalette } from '@/hooks/useCommandPalette';
import { SpecialistsPanel } from '@/components/specialists';
import { CommandPalette } from '@/components/ui/CommandPalette';
import { Toaster } from '@/components/ui/Toaster';
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
  const { sessions } = useSessions();
  const commandPalette = useCommandPalette({ sessions });

  // Legacy session routes need IdeationLayout with specialists panel
  const isSessionPage = location.pathname.startsWith('/session/') && !location.pathname.includes('/canvas');

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
    <>
      <Routes>
        {/* Dashboard */}
        <Route path="/" element={<DashboardPage />} />
        <Route path="/ideation" element={<DashboardPage />} />

        {/* Canvas - full-screen immersive */}
        <Route path="/session/:id/canvas" element={<CanvasPage />} />
        <Route path="/ideation/session/:id" element={<CanvasPage />} />

        {/* Tend routes */}
        <Route path="/projects/:id" element={<ProjectPage />} />
        <Route path="/settings" element={<SettingsPage />} />

        {/* Development */}
        <Route path="/mockup" element={<MockupPage />} />

        {/* Legacy routes using IdeationLayout */}
        <Route path="/legacy" element={<HomePage />} />
        <Route path="/session/:id/*" element={
          <IdeationLayout
            sidebar={<Sidebar />}
            panel={panel}
            panelCollapsed={isCollapsed}
            onTogglePanel={togglePanel}
          >
            <SessionPage />
          </IdeationLayout>
        } />
      </Routes>

      <CommandPalette
        isOpen={commandPalette.isOpen}
        query={commandPalette.query}
        onQueryChange={commandPalette.setQuery}
        selectedIndex={commandPalette.selectedIndex}
        groupedActions={commandPalette.groupedActions}
        onClose={commandPalette.close}
        onExecuteAction={commandPalette.executeAction}
        onSelectNext={commandPalette.selectNext}
        onSelectPrevious={commandPalette.selectPrevious}
        onExecuteSelected={commandPalette.executeSelected}
      />
      <Toaster />
    </>
  );
}

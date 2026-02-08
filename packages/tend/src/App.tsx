import { Routes, Route } from 'react-router-dom';
import { DashboardPage } from '@/pages/DashboardPage';
import { ProjectPage } from '@/pages/ProjectPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { CommandPalette } from '@/components/ui/CommandPalette';
import { Toaster } from '@/components/ui/Toaster';
import { useCommandPalette } from '@/hooks/useCommandPalette';
import { useSessions } from '@/hooks/useSessions';
import { RelayProvider } from '@/contexts/RelayContext';

export function App() {
  const { sessions } = useSessions();

  // Command palette
  const commandPalette = useCommandPalette({ sessions });

  return (
    <RelayProvider>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/projects/:id" element={<ProjectPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>

      {/* Global Command Palette */}
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

      {/* Global Toast Notifications */}
      <Toaster />
    </RelayProvider>
  );
}

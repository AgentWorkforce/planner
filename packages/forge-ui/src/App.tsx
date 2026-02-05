import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ForgeLayout } from '@/components/ForgeLayout';
import { RunsListPage, RunDashboardPage, TimelinePage, PreflightPage } from '@/pages';

/**
 * Forge UI Application
 *
 * Routes:
 * - /forge -> RunsListPage (list of all runs)
 * - /forge/runs/:runId -> RunDashboardPage (single run dashboard)
 * - /forge/runs/:runId/timeline -> TimelinePage (timeline view)
 * - /forge/preflight/:planId -> PreflightPage (preflight checks)
 */
export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/forge" element={<ForgeLayout />}>
          <Route index element={<RunsListPage />} />
          <Route path="runs/:runId" element={<RunDashboardPage />} />
          <Route path="runs/:runId/timeline" element={<TimelinePage />} />
          <Route path="preflight/:planId" element={<PreflightPage />} />
        </Route>
        {/* Redirect root to /forge */}
        <Route path="/" element={<Navigate to="/forge" replace />} />
        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/forge" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

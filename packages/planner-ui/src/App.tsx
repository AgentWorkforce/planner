import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@/components';
import { PlansListPage, NewPlanPage, PlanEditorPage, ChannelPage } from '@/pages';
import { InitiativesListPage } from './pages/InitiativesListPage';
import { InitiativeDetailPage } from './pages/InitiativeDetailPage';
import { PipelinePage } from './pages/PipelinePage';
import { RelayProvider } from '@/contexts';

export function App() {
  return (
    <BrowserRouter>
      <RelayProvider>
        <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/plans" replace />} />
          <Route path="plans" element={<PlansListPage />} />
          {/* /plans/my will be handled by PlansListPage reading ?owner=me from URL and replacing with actual user_id */}
          <Route path="plans/my" element={<PlansListPage />} />
          <Route path="plans/new" element={<NewPlanPage />} />
          <Route path="plans/:planId" element={<PlanEditorPage />} />
          <Route path="plans/:planId/understanding" element={<PlanEditorPage />} />
          <Route path="plans/:planId/context" element={<PlanEditorPage />} />
          <Route path="plans/:planId/decisions" element={<PlanEditorPage />} />
          <Route path="initiatives" element={<InitiativesListPage />} />
          <Route path="initiatives/:id" element={<InitiativeDetailPage />} />
          <Route path="pipeline" element={<PipelinePage />} />
          <Route path="channels/:channelId" element={<ChannelPage />} />
        </Route>
        </Routes>
      </RelayProvider>
    </BrowserRouter>
  );
}

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@/components';
import { PlansListPage, NewPlanPage, PlanEditorPage } from '@/pages';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/plans" replace />} />
          <Route path="plans" element={<PlansListPage />} />
          <Route path="plans/new" element={<NewPlanPage />} />
          <Route path="plans/:planId" element={<PlanEditorPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

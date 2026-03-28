import { SessionDashboard } from '@/components/dashboard';

/**
 * DashboardPage
 *
 * Page wrapper for SessionDashboard component.
 *
 * This is the main dashboard view at /ideation route,
 * showing all sessions in a physics-based layout with
 * Navigator meta-chat and planner handoff tracking.
 *
 * @route /ideation
 */
export function DashboardPage() {
  return <SessionDashboard />;
}

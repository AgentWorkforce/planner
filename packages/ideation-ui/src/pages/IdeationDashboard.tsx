import { Link } from 'react-router-dom';
import { BrainIcon, PlusIcon } from '@/components/icons';

/**
 * IdeationDashboard
 *
 * Placeholder dashboard view for /ideation route.
 * Shows session overview and navigation.
 *
 * Future enhancements:
 * - List of recent sessions
 * - Session stats and metrics
 * - Quick actions (create, search)
 *
 * @route /ideation
 */
export function IdeationDashboard() {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8">
      <div className="max-w-2xl w-full">
        {/* Icon and Title */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-accent-cyan/10 flex items-center justify-center">
            <BrainIcon size="xl" className="text-accent-cyan" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-text-primary">Ideation Dashboard</h1>
            <p className="text-text-muted mt-1">Explore ideas with AI specialists</p>
          </div>
        </div>

        {/* Placeholder content */}
        <div className="bg-bg-secondary border border-border-subtle rounded-lg p-8 mb-6">
          <h2 className="text-xl font-semibold text-text-primary mb-3">Session Overview</h2>
          <p className="text-text-muted mb-4">
            Session list and metrics coming soon. For now, use the sidebar to navigate to existing sessions.
          </p>

          {/* Quick action hint */}
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <PlusIcon size="sm" />
            <span>Click "New Session" in the sidebar to create a new brainstorming session</span>
          </div>
        </div>

        {/* Navigation hint */}
        <div className="text-center">
          <p className="text-text-muted text-sm">
            Select a session from the sidebar to view the{' '}
            <Link
              to="/session/example-id/canvas"
              className="text-accent-cyan hover:underline"
            >
              canvas view
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

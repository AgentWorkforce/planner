import { cn } from '@/lib/utils';

/**
 * Status of a session's plan in the planner
 */
export type PlanStatus = 'planning' | 'plan_ready' | 'approved' | 'executing';

/**
 * Session that has been sent to planner
 */
export interface SentSession {
  id: string;
  title: string;
  sentAt: string; // ISO 8601
  planId?: string;
  planStatus: PlanStatus;
}

/**
 * Props for SentToPlannerColumn component
 */
export interface SentToPlannerColumnProps {
  sessions: SentSession[];
  onSessionClick?: (sessionId: string) => void;
  onViewPlan?: (planId: string) => void;
  className?: string;
}

/**
 * Status badge color mapping
 */
const statusColors: Record<PlanStatus, string> = {
  planning: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  plan_ready: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  approved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  executing: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
};

/**
 * Status labels
 */
const statusLabels: Record<PlanStatus, string> = {
  planning: 'Planning',
  plan_ready: 'Plan Ready',
  approved: 'Approved',
  executing: 'Executing',
};

/**
 * Format a date as relative time (e.g., "2 hours ago", "yesterday")
 */
function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

/**
 * SentToPlannerColumn
 *
 * Right column of the dashboard showing sessions that have been sent to Planner.
 * Static list (no physics) with status badges indicating plan progress.
 *
 * Features:
 * - Shows sessions that have been handed off to Planner
 * - Status badges: Planning, Plan Ready, Approved, Executing
 * - Click session to reopen in canvas (continue ideating)
 * - Click "View Plan" to open in Planner view
 * - Sorted by most recently sent
 * - Empty state when no sessions sent yet
 *
 * @example
 * ```tsx
 * <SentToPlannerColumn
 *   sessions={[
 *     { id: '1', title: 'Feature Idea', sentAt: '2024-01-01', planStatus: 'planning' },
 *     { id: '2', title: 'Analytics', sentAt: '2024-01-02', planId: 'p1', planStatus: 'approved' },
 *   ]}
 *   onSessionClick={(id) => navigate(`/ideation/session/${id}`)}
 *   onViewPlan={(planId) => navigate(`/plans/${planId}`)}
 * />
 * ```
 */
export function SentToPlannerColumn({
  sessions = [],
  onSessionClick,
  onViewPlan,
  className,
}: SentToPlannerColumnProps) {
  // Sort by most recently sent
  const sortedSessions = [...sessions].sort(
    (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()
  );

  return (
    <div className={cn('h-full flex flex-col', className)}>
      {/* Header */}
      <div className="p-4">
        <h2 className="text-sm font-medium text-text-primary">
          Sent to Planner ({sessions.length})
        </h2>
        <p className="text-xs text-text-muted mt-1">
          Track handoff status
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {sortedSessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-12 h-12 rounded-full bg-bg-tertiary flex items-center justify-center mb-3">
              <span className="text-2xl">📤</span>
            </div>
            <p className="text-sm text-text-muted">
              No sessions sent to Planner yet
            </p>
            <p className="text-xs text-text-tertiary mt-1">
              Curate blocks and click "→ Planner" to send
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {sortedSessions.map((session) => (
              <div
                key={session.id}
                className={cn(
                  'p-3 rounded-lg border border-border-subtle bg-bg-card',
                  'hover:border-border-default transition-colors',
                  onSessionClick && 'cursor-pointer'
                )}
                onClick={() => onSessionClick?.(session.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">
                      {session.title}
                    </p>
                    <p className="text-xs text-text-muted mt-0.5">
                      Sent {formatRelativeTime(session.sentAt)}
                    </p>
                  </div>

                  <span
                    className={cn(
                      'text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap',
                      statusColors[session.planStatus]
                    )}
                  >
                    {statusLabels[session.planStatus]}
                  </span>
                </div>

                {session.planId && onViewPlan && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewPlan(session.planId!);
                    }}
                    className="mt-2 text-xs text-accent-blue hover:underline"
                  >
                    View Plan →
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

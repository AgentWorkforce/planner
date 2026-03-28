import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';

/**
 * Props for ModifiedSinceHandoffBanner component
 */
export interface ModifiedSinceHandoffBannerProps {
  session: {
    updated_at: string;
    lastHandoffAt?: string;
    lastHandoffPlanId?: string;
    lastHandoffVersionId?: number;
  };
  onDismiss?: () => void;
  onViewPlan?: () => void;
  className?: string;
}

/**
 * ModifiedSinceHandoffBanner
 *
 * Shows a warning banner when reopening a session that was previously
 * handed off to Planner if the session has been modified since the handoff.
 *
 * Features:
 * - Compares session.updated_at vs session.lastHandoffAt
 * - Yellow/warning color scheme
 * - Dismissible banner (local state)
 * - Optional link to view the plan that was sent
 * - Dark mode support
 *
 * Logic:
 * - Only shows if session has been handed off at least once
 * - Only shows if updated_at > lastHandoffAt
 * - Can be dismissed (doesn't persist across sessions)
 *
 * @example
 * ```tsx
 * <ModifiedSinceHandoffBanner
 *   session={session}
 *   onViewPlan={() => navigate(`/plans/${session.lastHandoffPlanId}`)}
 * />
 * ```
 */
export function ModifiedSinceHandoffBanner({
  session,
  onDismiss,
  onViewPlan,
  className,
}: ModifiedSinceHandoffBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  // Check if we should show the banner
  const showBanner = useMemo(() => {
    if (!session.lastHandoffAt) return false; // Never handed off
    return new Date(session.updated_at) > new Date(session.lastHandoffAt);
  }, [session.updated_at, session.lastHandoffAt]);

  if (!showBanner || dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <div
      className={cn(
        'flex items-center justify-between px-4 py-2 bg-yellow-100 dark:bg-yellow-900/30 border-b border-yellow-200 dark:border-yellow-800',
        className
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-yellow-600 dark:text-yellow-400">⚠️</span>
        <span className="text-sm text-yellow-800 dark:text-yellow-200">
          This session has been modified since it was last sent to Planner.
        </span>
      </div>

      <div className="flex items-center gap-3">
        {session.lastHandoffPlanId && onViewPlan && (
          <button
            onClick={onViewPlan}
            className="text-sm text-yellow-700 dark:text-yellow-300 hover:underline"
          >
            View sent plan
          </button>
        )}
        <button
          onClick={handleDismiss}
          className="text-yellow-600 dark:text-yellow-400 hover:text-yellow-700 dark:hover:text-yellow-300"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

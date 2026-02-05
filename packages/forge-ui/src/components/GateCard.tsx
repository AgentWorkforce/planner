/**
 * GateCard - Display card for a pending gate requiring approval
 *
 * Shows gate icon, task title, approver role, time waiting,
 * and a review button to open the detail panel.
 */

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import type { Gate } from '@/types';

interface GateCardProps {
  gate: Gate;
  onReview: (gate: Gate) => void;
  className?: string;
}

/**
 * Format time waiting as human-readable string
 */
function formatWaitingTime(createdAt: string): string {
  const created = new Date(createdAt).getTime();
  const now = Date.now();
  const diffMs = now - created;

  if (diffMs < 0) return 'Just now';

  const minutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `Waiting ${days}d ${hours % 24}h`;
  }
  if (hours > 0) {
    return `Waiting ${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `Waiting ${minutes}m`;
  }
  return 'Just now';
}

export function GateCard({ gate, onReview, className }: GateCardProps) {
  return (
    <div
      className={cn(
        'relative bg-bg-card border border-amber-500/20 rounded-lg p-4',
        'hover:border-amber-500/40 transition-colors',
        className
      )}
    >
      <div className="flex items-start gap-3">
        {/* Gate icon */}
        <div className="flex-shrink-0 p-2 bg-amber-500/10 rounded-lg">
          <GateIcon className="h-5 w-5 text-amber-500" />
        </div>

        <div className="flex-1 min-w-0">
          {/* Task title */}
          <h3 className="font-medium text-text-primary truncate">
            {gate.title}
          </h3>

          {/* Approver role and waiting time */}
          <div className="flex items-center gap-2 mt-1 text-sm text-text-muted">
            {gate.approver_role && (
              <>
                <span className="text-amber-500">{gate.approver_role}</span>
                <span className="text-text-dim">|</span>
              </>
            )}
            <span className="flex items-center gap-1">
              <ClockIcon className="h-3.5 w-3.5" />
              {formatWaitingTime(gate.created_at)}
            </span>
          </div>
        </div>

        {/* Review button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onReview(gate)}
          className="flex-shrink-0 border-amber-500/30 text-amber-500 hover:bg-amber-500/10 hover:border-amber-500/50"
        >
          Review
        </Button>
      </div>
    </div>
  );
}

/**
 * Gate icon (shield with checkmark)
 */
function GateIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

/**
 * Clock icon
 */
function ClockIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

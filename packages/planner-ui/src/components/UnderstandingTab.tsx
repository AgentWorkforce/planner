import type { Understanding, AgentObservations } from '@/types';
import { AgentObservationCard } from './AgentObservationCard';
import { BrainIcon } from '@/components/icons';

interface UnderstandingTabProps {
  understanding?: Understanding;
  isEditable?: boolean;
  onUpdate?: (role: string, observations: AgentObservations) => void;
}

/**
 * Role ordering for consistent display.
 * Common roles first, then alphabetical for others.
 */
const ROLE_ORDER = ['architect', 'designer', 'tester', 'security'];

/**
 * Sort roles for consistent display order.
 */
function sortRoles(roles: string[]): string[] {
  return [...roles].sort((a, b) => {
    const aIndex = ROLE_ORDER.indexOf(a.toLowerCase());
    const bIndex = ROLE_ORDER.indexOf(b.toLowerCase());

    // Both in preferred order
    if (aIndex !== -1 && bIndex !== -1) {
      return aIndex - bIndex;
    }
    // Only a in preferred order
    if (aIndex !== -1) return -1;
    // Only b in preferred order
    if (bIndex !== -1) return 1;
    // Neither in preferred order, sort alphabetically
    return a.localeCompare(b);
  });
}

/**
 * Count total observations across all roles.
 */
function countObservations(understanding?: Understanding): number {
  if (!understanding) return 0;

  return Object.values(understanding).reduce((total, obs) => {
    return (
      total +
      (obs.observations?.length || 0) +
      (obs.keywords?.length || 0) +
      (obs.questions?.length || 0) +
      (obs.concerns?.length || 0)
    );
  }, 0);
}

/**
 * Empty state component when no observations exist.
 */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="p-4 rounded-full bg-bg-tertiary mb-4">
        <BrainIcon size="xl" className="text-text-muted" />
      </div>
      <h3 className="text-lg font-medium text-text-primary mb-2">No agent observations yet</h3>
      <p className="text-sm text-text-muted max-w-md">
        Chat with PlannerLead to start ideation. Agent observations will appear here as specialists
        analyze your plan and share their insights.
      </p>
    </div>
  );
}

/**
 * Tab content showing plan-level agent observations from ideation.
 *
 * Displays:
 * - Header with title and observation count
 * - AgentObservationCard for each role that has observations
 * - Empty state when no observations exist
 */
export function UnderstandingTab({
  understanding,
  isEditable = false,
  onUpdate,
}: UnderstandingTabProps) {
  const roles = understanding ? sortRoles(Object.keys(understanding)) : [];
  const hasObservations = roles.length > 0;
  const observationCount = countObservations(understanding);

  const handleUpdate = (role: string) => (observations: AgentObservations) => {
    onUpdate?.(role, observations);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-display font-semibold text-text-primary">
            Agent Observations
          </h2>
          {observationCount > 0 && (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-accent-purple/20 text-accent-purple">
              {observationCount}
            </span>
          )}
        </div>
        {hasObservations && (
          <span className="text-xs text-text-muted">
            {roles.length} {roles.length === 1 ? 'role' : 'roles'}
          </span>
        )}
      </div>

      {/* Content */}
      {!hasObservations ? (
        <EmptyState />
      ) : (
        <div className="space-y-4">
          {roles.map((role) => (
            <AgentObservationCard
              key={role}
              role={role}
              observations={understanding![role]}
              isEditable={isEditable}
              onUpdate={handleUpdate(role)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

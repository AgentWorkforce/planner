import { BoardColumn } from './BoardColumn';
import type { StatusGroup } from '@/hooks/usePipelinePlans';

interface BoardViewProps {
  statusGroups: StatusGroup[];
  onPlanClick?: (planId: string) => void;
  className?: string;
}

/**
 * Board (Kanban) view for pipeline - plans organized by workflow status.
 *
 * Features:
 * - 5 columns: Drafting, Gate, Approved, Running, Complete
 * - Gate column highlighted with orange accent (awaiting human approval)
 * - Running column highlighted with cyan accent (active execution)
 * - Complete column highlighted with green accent (finished)
 * - Kanban layout: columns fill available width equally
 *
 * Columns:
 * - Drafting: Plans being written (status=draft, not submitted)
 * - Gate: Plans awaiting human approval (awaiting_approval attention type)
 * - Approved: Plans ready to execute (status=approved)
 * - Running: Plans currently executing (status=published, active attention type)
 * - Complete: Finished plans (status=published, no active attention)
 *
 * Usage:
 * ```tsx
 * const { statusGroups } = usePipelinePlans();
 * <BoardView statusGroups={statusGroups} onPlanClick={handlePlanClick} />
 * ```
 */
export function BoardView({
  statusGroups,
  className = '',
}: BoardViewProps) {
  // Map status to variant
  const getVariant = (
    status: string
  ): 'default' | 'gate' | 'running' | 'complete' => {
    switch (status) {
      case 'gate':
        return 'gate';
      case 'running':
        return 'running';
      case 'complete':
        return 'complete';
      default:
        return 'default';
    }
  };

  return (
    <div
      className={`
        flex h-full gap-3 p-3
        ${className}
      `}
    >
      {statusGroups.map((group) => (
        <BoardColumn
          key={group.status}
          title={group.label}
          plans={group.plans}
          variant={getVariant(group.status)}
        />
      ))}
    </div>
  );
}

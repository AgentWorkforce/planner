import type { Step } from '@/types';
import { CheckIcon, AlertIcon } from './icons';

interface ScopeSummaryStatsProps {
  steps: Step[];
  compact?: boolean;
}

interface StatCounts {
  total: number;
  completed: number;
  inProgress: number;
  blocked: number;
  pending: number;
  criticalPath: number;
}

function computeStats(steps: Step[]): StatCounts {
  const counts: StatCounts = {
    total: steps.length,
    completed: 0,
    inProgress: 0,
    blocked: 0,
    pending: 0,
    criticalPath: 0,
  };

  for (const step of steps) {
    const status = (step as Step & { execution_status?: string }).execution_status;

    if (status === 'done' || status === 'completed') {
      counts.completed++;
    } else if (status === 'running' || status === 'in_progress') {
      counts.inProgress++;
    } else if (status === 'blocked') {
      counts.blocked++;
    } else if (status === 'failed') {
      counts.blocked++;
    } else {
      counts.pending++;
    }
  }

  return counts;
}

function ProgressBar({ percentage, compact }: { percentage: number; compact?: boolean }) {
  return (
    <div className={`h-1.5 rounded-full bg-bg-tertiary overflow-hidden ${compact ? 'w-full' : 'w-20'}`}>
      <div
        className="h-full bg-success transition-all duration-300"
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

interface StatBadgeProps {
  type: 'completed' | 'in_progress' | 'blocked' | 'critical';
  count: number;
  label?: string;
}

function StatBadge({ type, count, label }: StatBadgeProps) {
  if (count === 0) return null;

  const typeClasses: Record<string, string> = {
    completed: 'bg-success/10 text-success',
    in_progress: 'bg-accent-cyan/10 text-accent-cyan',
    blocked: 'bg-warning/10 text-warning',
    critical: 'bg-error/10 text-error',
  };

  const icons: Record<string, React.ReactNode> = {
    completed: <CheckIcon size="sm" />,
    in_progress: <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />,
    blocked: <AlertIcon size="sm" />,
    critical: <AlertIcon size="sm" />,
  };

  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs ${typeClasses[type]}`}>
      {icons[type]}
      {label || count}
    </span>
  );
}

export function ScopeSummaryStats({ steps, compact = false }: ScopeSummaryStatsProps) {
  const stats = computeStats(steps);
  const percentage = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  if (compact) {
    return (
      <div className="space-y-1">
        <ProgressBar percentage={percentage} compact />
        <div className="text-xs text-text-muted">
          {stats.completed}/{stats.total} complete
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <ProgressBar percentage={percentage} />
      <span className="text-sm font-medium text-text-primary min-w-9">
        {percentage}%
      </span>
      <StatBadge type="completed" count={stats.completed} />
      <StatBadge type="in_progress" count={stats.inProgress} />
      <StatBadge type="blocked" count={stats.blocked} />
      {stats.criticalPath > 0 && (
        <StatBadge type="critical" count={stats.criticalPath} label="Critical" />
      )}
    </div>
  );
}

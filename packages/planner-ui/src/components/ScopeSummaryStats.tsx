import type { Step } from '@/types';

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
    // Use execution_status if available, otherwise infer from step state
    const status = (step as Step & { execution_status?: string }).execution_status;

    if (status === 'done' || status === 'completed') {
      counts.completed++;
    } else if (status === 'running' || status === 'in_progress') {
      counts.inProgress++;
    } else if (status === 'blocked') {
      counts.blocked++;
    } else if (status === 'failed') {
      // Count failed as blocked for visibility
      counts.blocked++;
    } else {
      counts.pending++;
    }
  }

  return counts;
}

function ProgressBar({ percentage, compact }: { percentage: number; compact?: boolean }) {
  return (
    <div
      className="scope-progress-bar"
      style={{
        width: compact ? '100%' : '80px',
        height: '6px',
        borderRadius: '3px',
        backgroundColor: 'var(--color-border)',
        overflow: 'hidden',
      }}
    >
      <div
        className="scope-progress-fill"
        style={{
          width: `${percentage}%`,
          height: '100%',
          backgroundColor: 'var(--color-success)',
          transition: 'width 0.3s ease',
        }}
      />
    </div>
  );
}

interface StatBadgeProps {
  type: 'completed' | 'in_progress' | 'blocked' | 'critical';
  count: number;
  icon: string;
  label?: string;
}

function StatBadge({ type, count, icon, label }: StatBadgeProps) {
  if (count === 0) return null;

  const styles: Record<string, { bg: string; color: string }> = {
    completed: { bg: '#dcfce7', color: '#166534' },
    in_progress: { bg: '#dbeafe', color: '#1e40af' },
    blocked: { bg: '#fef3c7', color: '#92400e' },
    critical: { bg: '#fee2e2', color: '#991b1b' },
  };

  const { bg, color } = styles[type];

  return (
    <span
      className={`stat-badge stat-badge--${type}`}
      style={{
        fontSize: '0.75rem',
        padding: '2px 6px',
        borderRadius: 'var(--radius-sm)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        backgroundColor: bg,
        color: color,
      }}
    >
      <span className="stat-badge-icon">{icon}</span>
      {label ? label : count}
    </span>
  );
}

export function ScopeSummaryStats({ steps, compact = false }: ScopeSummaryStatsProps) {
  const stats = computeStats(steps);
  const percentage = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  if (compact) {
    // Swimlane layout: bar + fraction below scope name
    return (
      <div className="scope-summary-stats scope-summary-stats--compact">
        <ProgressBar percentage={percentage} compact />
        <div
          className="scope-summary-fraction"
          style={{
            fontSize: '0.75rem',
            color: 'var(--color-text-muted)',
            marginTop: '4px',
          }}
        >
          {stats.completed}/{stats.total} complete
        </div>
      </div>
    );
  }

  // List view: bar + percent + all badges inline
  return (
    <div
      className="scope-summary-stats"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-sm)',
      }}
    >
      <ProgressBar percentage={percentage} />
      <span
        style={{
          fontSize: '0.875rem',
          fontWeight: 500,
          color: 'var(--color-text)',
          minWidth: '36px',
        }}
      >
        {percentage}%
      </span>
      <StatBadge type="completed" count={stats.completed} icon="✓" />
      <StatBadge type="in_progress" count={stats.inProgress} icon="◌" />
      <StatBadge type="blocked" count={stats.blocked} icon="⏸" />
      {stats.criticalPath > 0 && (
        <StatBadge type="critical" count={stats.criticalPath} icon="" label="Critical" />
      )}
    </div>
  );
}

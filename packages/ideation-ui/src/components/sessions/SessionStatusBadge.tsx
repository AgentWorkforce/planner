import { cn } from '@/lib/utils';
import { LinkIcon } from '@/components/icons';

interface SessionStatusBadgeProps {
  status: 'active' | 'abandoned';
  sendCount?: number;
}

export function SessionStatusBadge({ status, sendCount = 0 }: SessionStatusBadgeProps) {
  const baseClasses = 'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium';

  const statusClasses = {
    active: 'bg-accent-cyan/20 text-accent-cyan',
    abandoned: 'bg-bg-tertiary text-text-muted',
  };

  return (
    <div className="flex items-center gap-1.5">
      <span className={cn(baseClasses, statusClasses[status])}>
        {status}
      </span>
      {sendCount > 0 && (
        <span className="inline-flex items-center gap-0.5 text-accent-purple" title="Sent to Planner">
          <LinkIcon size="sm" />
          {sendCount > 1 && (
            <span className="text-xs font-medium">{sendCount}</span>
          )}
        </span>
      )}
    </div>
  );
}

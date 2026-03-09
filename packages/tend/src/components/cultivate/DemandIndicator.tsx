import { cn } from '@/lib/utils';

interface DemandIndicatorProps {
  score: number;
  label: string;
  requestRatio?: number;
  compact?: boolean;
}

function getDemandColors(label: string): { bar: string; text: string; dot: string } {
  switch (label) {
    case 'high':
      return { bar: 'bg-red-500', text: 'text-orange-400', dot: 'bg-orange-400' };
    case 'medium':
      return { bar: 'bg-amber-500', text: 'text-amber-400', dot: 'bg-amber-400' };
    default:
      return { bar: 'bg-bg-tertiary', text: 'text-text-tertiary', dot: 'bg-text-tertiary' };
  }
}

export function DemandIndicator({
  score,
  label,
  requestRatio,
  compact = false,
}: DemandIndicatorProps) {
  const colors = getDemandColors(label);

  if (compact) {
    if (score < 25) return null;

    return (
      <span className="inline-flex items-center gap-1 shrink-0">
        <span className={cn('w-1.5 h-1.5 rounded-full', colors.dot)} />
        <span className={cn('text-[10px] capitalize', colors.text)}>
          {label === 'high' ? 'High' : 'Medium'} demand
        </span>
      </span>
    );
  }

  return (
    <div className="px-1">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-xs text-text-muted font-medium uppercase tracking-wider">
          Demand
        </p>
        <span className={cn('text-xs font-medium tabular-nums', colors.text)}>
          {score}/100
        </span>
      </div>

      {label !== 'low' && (
        <div className="h-2 w-full rounded-full bg-bg-tertiary overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', colors.bar)}
            style={{ width: `${Math.min(score, 100)}%` }}
          />
        </div>
      )}

      {requestRatio != null && requestRatio > 0 && (
        <p className="text-xs text-text-muted mt-1.5">
          {Math.round(requestRatio * 100)}% are actionable requests
        </p>
      )}
    </div>
  );
}

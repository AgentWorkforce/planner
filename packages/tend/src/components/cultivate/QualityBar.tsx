import { cn } from '@/lib/utils';

interface QualityBarProps {
  depthScore: number;
  substantiveCount: number;
  total: number;
}

function getScoreColor(score: number): { bar: string; text: string } {
  if (score > 70) return { bar: 'bg-emerald-500', text: 'text-emerald-400' };
  if (score >= 40) return { bar: 'bg-amber-500', text: 'text-amber-400' };
  return { bar: 'bg-red-500', text: 'text-red-400' };
}

export function QualityBar({
  depthScore,
  substantiveCount,
  total,
}: QualityBarProps) {
  const clampedScore = Math.min(100, Math.max(0, depthScore));
  const colors = getScoreColor(clampedScore);
  const substantivePercent = total > 0 ? (substantiveCount / total) * 100 : 0;

  return (
    <div className="px-1">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-xs text-text-muted font-medium uppercase tracking-wider">
          Signal Quality
        </p>
        <span className={cn('text-xs font-medium tabular-nums', colors.text)}>
          {clampedScore}/100
        </span>
      </div>

      <div className="h-2 w-full rounded-full bg-bg-tertiary overflow-hidden">
        {total > 0 && (
          <div
            className={cn('h-full rounded-full transition-all', colors.bar)}
            style={{ width: `${substantivePercent}%` }}
          />
        )}
      </div>

      <p className="text-xs text-text-muted mt-1.5">
        {substantiveCount} of {total} substantive signal{total !== 1 ? 's' : ''}
      </p>
    </div>
  );
}

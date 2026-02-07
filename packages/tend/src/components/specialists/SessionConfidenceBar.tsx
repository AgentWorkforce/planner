import { aggregateSessionConfidence } from '@/lib/confidence-utils';

interface SessionConfidenceBarProps {
  understanding: Record<string, Record<string, unknown>>;
}

/**
 * SessionConfidenceBar displays an aggregated confidence score across all specialists.
 *
 * Features:
 * - Full-width progress bar with color-coded confidence levels
 * - Hover tooltip showing per-specialist breakdown
 * - Weighted average calculation (weight = category count per specialist)
 */
export function SessionConfidenceBar({ understanding }: SessionConfidenceBarProps) {
  const { score, bySpecialist } = aggregateSessionConfidence(understanding);

  // Determine bar color based on thresholds
  const getBarColor = (value: number): string => {
    if (value < 40) return 'bg-error';
    if (value <= 60) return 'bg-warning';
    return 'bg-success';
  };

  // Format specialist breakdown for tooltip
  const tooltipContent = Object.entries(bySpecialist)
    .map(([name, confidence]) => `${name}: ${Math.round(confidence)}%`)
    .join('\n');

  const barColor = getBarColor(score);
  const percentage = Math.round(score);

  return (
    <div className="w-full" title={tooltipContent || 'No specialists yet'}>
      {/* Container */}
      <div className="flex items-center gap-3">
        {/* Progress bar background */}
        <div className="flex-1 h-2 bg-bg-tertiary rounded-full overflow-hidden">
          {/* Progress bar fill */}
          <div
            className={`h-full ${barColor} transition-all duration-300 ease-out`}
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* Percentage label */}
        <span className="text-xs font-medium text-text-secondary min-w-[3ch] text-right">
          {percentage}%
        </span>
      </div>
    </div>
  );
}

import { cn } from '@/lib/utils';

interface ConfidencePercentProps {
  value: number | undefined | null;
  size?: 'sm' | 'md';
}

/**
 * Badge-style percentage indicator with color coding based on confidence value.
 *
 * Color thresholds:
 * - < 40: error (red)
 * - 40-60: warning (orange)
 * - > 60: success (green)
 *
 * @example
 * ```tsx
 * <ConfidencePercent value={75} />
 * <ConfidencePercent value={45} size="sm" />
 * <ConfidencePercent value={null} /> // Shows '--'
 * ```
 */
export function ConfidencePercent({ value, size = 'md' }: ConfidencePercentProps) {
  // Determine color based on value
  const getColorClass = (val: number): string => {
    if (val < 40) return 'text-error';
    if (val <= 60) return 'text-warning';
    return 'text-success';
  };

  // Size variant classes
  const sizeClass = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center',
        'font-medium tabular-nums',
        'transition-colors',
        sizeClass,
        value !== null && value !== undefined ? getColorClass(value) : 'text-text-muted'
      )}
    >
      {value !== null && value !== undefined ? `${Math.round(value)}%` : '--'}
    </span>
  );
}

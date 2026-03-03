import { cn } from '@/lib/utils';

interface HealthIndicatorProps {
  score: number;           // 0-100
  size?: 'sm' | 'md';     // sm = 8px, md = 12px
  showTooltip?: boolean;   // Show score on hover
  className?: string;
}

/**
 * HealthIndicator - A colored dot that indicates health status
 *
 * Color mapping:
 * - Green (score > 70): Healthy
 * - Yellow (40-70): Warning
 * - Red (score < 40): Critical
 *
 * Usage:
 * ```tsx
 * <HealthIndicator score={85} size="sm" showTooltip />
 * ```
 */
export function HealthIndicator({
  score,
  size = 'md',
  showTooltip = false,
  className
}: HealthIndicatorProps) {
  // Determine color based on score thresholds
  const colorClass = score > 70
    ? 'bg-emerald-500'
    : score >= 40
    ? 'bg-amber-500'
    : 'bg-red-500';

  // Size mapping
  const sizeClass = size === 'sm' ? 'w-2 h-2' : 'w-3 h-3';

  return (
    <div
      className={cn(
        'rounded-full',
        colorClass,
        sizeClass,
        className
      )}
      title={showTooltip ? `Health: ${score}%` : undefined}
      aria-label={`Health score ${score}%`}
    />
  );
}

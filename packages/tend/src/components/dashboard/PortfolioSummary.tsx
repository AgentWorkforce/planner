import { HealthIndicator } from './HealthIndicator';

interface PortfolioSummaryProps {
  initiativeCount: number;
  activePlanCount: number;
  healthSummary: { healthy: number; warning: number; critical: number };
  opportunityCount: number;
  loading?: boolean;
}

/**
 * PortfolioSummary - Compact summary card for portfolio metrics
 *
 * Displays:
 * - Initiative and active plan counts
 * - Health status distribution (green/yellow/red dots)
 * - Opportunity count (when > 0)
 * - Loading state with pulse animation
 *
 * Usage:
 * ```tsx
 * <PortfolioSummary
 *   initiativeCount={12}
 *   activePlanCount={8}
 *   healthSummary={{ healthy: 5, warning: 2, critical: 1 }}
 *   opportunityCount={3}
 * />
 * ```
 */
export function PortfolioSummary({
  initiativeCount,
  activePlanCount,
  healthSummary,
  opportunityCount,
  loading = false
}: PortfolioSummaryProps) {
  if (loading) {
    return (
      <div className="bg-bg-secondary rounded-2xl p-4 space-y-2 animate-pulse">
        <div className="h-4 bg-bg-tertiary rounded w-48" />
        <div className="h-4 bg-bg-tertiary rounded w-32" />
      </div>
    );
  }

  return (
    <div className="bg-bg-secondary rounded-2xl p-4 space-y-2">
      {/* First line: Initiative and plan counts */}
      <div className="text-sm text-text-secondary">
        {initiativeCount} {initiativeCount === 1 ? 'initiative' : 'initiatives'} · {activePlanCount} active {activePlanCount === 1 ? 'plan' : 'plans'}
      </div>

      {/* Second line: Health dots */}
      <div className="flex items-center gap-1.5">
        {/* Healthy (green) dots */}
        {Array.from({ length: healthSummary.healthy }).map((_, i) => (
          <HealthIndicator
            key={`healthy-${i}`}
            score={100}
            size="sm"
            showTooltip={false}
          />
        ))}

        {/* Warning (yellow) dots */}
        {Array.from({ length: healthSummary.warning }).map((_, i) => (
          <HealthIndicator
            key={`warning-${i}`}
            score={55}
            size="sm"
            showTooltip={false}
          />
        ))}

        {/* Critical (red) dots */}
        {Array.from({ length: healthSummary.critical }).map((_, i) => (
          <HealthIndicator
            key={`critical-${i}`}
            score={20}
            size="sm"
            showTooltip={false}
          />
        ))}
      </div>

      {/* Third line: Opportunities (conditional) */}
      {opportunityCount > 0 && (
        <div className="text-sm text-[var(--color-accent-primary)]">
          {opportunityCount} {opportunityCount === 1 ? 'opportunity' : 'opportunities'}
        </div>
      )}
    </div>
  );
}

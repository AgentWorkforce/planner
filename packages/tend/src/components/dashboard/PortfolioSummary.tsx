import { HealthIndicator } from './HealthIndicator';

interface PortfolioSummaryProps {
  initiativeCount: number;
  activePlanCount: number;
  healthSummary: { healthy: number; warning: number; critical: number };
  opportunityCount: number;
  loading?: boolean;
}

export function PortfolioSummary({
  initiativeCount,
  activePlanCount,
  healthSummary,
  opportunityCount,
  loading = false
}: PortfolioSummaryProps) {
  if (loading) {
    return (
      <div className="flex gap-4 animate-pulse">
        <div className="h-12 bg-bg-tertiary rounded-xl flex-1" />
        <div className="h-12 bg-bg-tertiary rounded-xl flex-1" />
        <div className="h-12 bg-bg-tertiary rounded-xl flex-1" />
      </div>
    );
  }

  const totalHealth = healthSummary.healthy + healthSummary.warning + healthSummary.critical;

  return (
    <div className="flex gap-3">
      {/* Initiatives */}
      <div className="flex-1 bg-bg-secondary rounded-xl px-3 py-2.5">
        <div className="text-lg font-semibold text-text-primary leading-tight">
          {initiativeCount}
        </div>
        <div className="text-[11px] text-text-muted mt-0.5">
          {initiativeCount === 1 ? 'initiative' : 'initiatives'}
        </div>
      </div>

      {/* Active plans */}
      <div className="flex-1 bg-bg-secondary rounded-xl px-3 py-2.5">
        <div className="text-lg font-semibold text-text-primary leading-tight">
          {activePlanCount}
        </div>
        <div className="text-[11px] text-text-muted mt-0.5">
          active plans
        </div>
      </div>

      {/* Health */}
      <div className="flex-1 bg-bg-secondary rounded-xl px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          {healthSummary.healthy > 0 && (
            <span className="flex items-center gap-0.5">
              <HealthIndicator score={100} size="sm" showTooltip={false} />
              <span className="text-xs text-text-muted">{healthSummary.healthy}</span>
            </span>
          )}
          {healthSummary.warning > 0 && (
            <span className="flex items-center gap-0.5">
              <HealthIndicator score={55} size="sm" showTooltip={false} />
              <span className="text-xs text-text-muted">{healthSummary.warning}</span>
            </span>
          )}
          {healthSummary.critical > 0 && (
            <span className="flex items-center gap-0.5">
              <HealthIndicator score={20} size="sm" showTooltip={false} />
              <span className="text-xs text-text-muted">{healthSummary.critical}</span>
            </span>
          )}
          {totalHealth === 0 && (
            <span className="text-xs text-text-muted">--</span>
          )}
        </div>
        <div className="text-[11px] text-text-muted mt-0.5">
          health
        </div>
      </div>

      {/* Opportunities (only if > 0) */}
      {opportunityCount > 0 && (
        <div className="flex-1 bg-bg-secondary rounded-xl px-3 py-2.5">
          <div className="text-lg font-semibold text-[var(--color-accent-primary)] leading-tight">
            {opportunityCount}
          </div>
          <div className="text-[11px] text-text-muted mt-0.5">
            {opportunityCount === 1 ? 'opportunity' : 'opportunities'}
          </div>
        </div>
      )}
    </div>
  );
}

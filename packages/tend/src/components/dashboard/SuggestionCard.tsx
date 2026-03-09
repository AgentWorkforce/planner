import { cn } from '@/lib/utils';
import type { Suggestion } from '@/hooks/useSuggestions';
import { DemandIndicator } from '@/components/cultivate/DemandIndicator';

interface SuggestionCardProps {
  suggestion: Suggestion;
  onOpen?: (suggestion: Suggestion) => void;
}

/** For opportunity cards, find the dominant intent from the breakdown */
function getDominantIntent(breakdown?: Record<string, number>): string | null {
  if (!breakdown) return null;
  let best: string | null = null;
  let bestCount = 0;
  for (const [intent, count] of Object.entries(breakdown)) {
    if (count > bestCount) {
      best = intent;
      bestCount = count;
    }
  }
  return best;
}

const INTENT_DOT_COLORS: Record<string, string> = {
  bug_report: 'bg-red-400',
  feature_request: 'bg-emerald-400',
  product_feedback: 'bg-blue-400',
  question: 'bg-amber-400',
};

export function SuggestionCard({ suggestion, onOpen }: SuggestionCardProps) {
  const topReason = suggestion.reasons[0] || null;
  const isOpportunity = suggestion.type === 'opportunity';
  const dominantIntent = isOpportunity ? getDominantIntent(suggestion.intent_breakdown) : null;

  return (
    <button
      onClick={() => onOpen?.(suggestion)}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left",
        "bg-bg-secondary hover:bg-bg-tertiary transition-colors"
      )}
    >
      {/* Accent bar */}
      <div className="w-0.5 self-stretch rounded-full bg-[var(--color-accent-primary)] shrink-0" />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-text-primary font-medium truncate">
            {suggestion.plan_goal}
          </span>
          {suggestion.phase && (
            <span className="text-[10px] text-text-muted shrink-0">
              {suggestion.phase}
            </span>
          )}
          {isOpportunity && suggestion.signal_count > 0 && (
            <span className="text-[10px] text-text-muted bg-bg-tertiary px-1.5 py-0.5 rounded shrink-0">
              {suggestion.signal_count} signal{suggestion.signal_count !== 1 ? 's' : ''}
            </span>
          )}
          {dominantIntent && INTENT_DOT_COLORS[dominantIntent] && (
            <span
              className={cn('w-1.5 h-1.5 rounded-full shrink-0', INTENT_DOT_COLORS[dominantIntent])}
              title={dominantIntent.replace(/_/g, ' ')}
            />
          )}
          {isOpportunity && suggestion.demand_score != null && suggestion.demand_score >= 25 && (
            <DemandIndicator
              score={suggestion.demand_score}
              label={suggestion.demand_score >= 50 ? 'high' : 'medium'}
              compact
            />
          )}
        </div>
        {isOpportunity && suggestion.top_quote ? (
          <p className="text-xs text-text-muted mt-0.5 truncate italic">
            &ldquo;{suggestion.top_quote}&rdquo;
          </p>
        ) : topReason ? (
          <p className="text-xs text-text-muted mt-0.5 truncate">
            {topReason}
          </p>
        ) : null}
      </div>

      {/* Arrow */}
      <span className="text-text-muted text-xs shrink-0">&rsaquo;</span>
    </button>
  );
}

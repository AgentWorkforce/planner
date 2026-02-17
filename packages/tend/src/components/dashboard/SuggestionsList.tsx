import { cn } from '@/lib/utils';

interface Suggestion {
  type: 'plan' | 'opportunity';
  plan_id: string | null;
  plan_goal: string;
  initiative_id: string | null;
  initiative_name: string | null;
  score: number;
  reasons: string[];
  project_id: string | null;
  phase: 'ideating' | 'planning' | 'forging' | null;
  cluster_id: string | null;
  cluster_label: string | null;
  signal_count: number;
}

interface SuggestionsListProps {
  suggestions: Suggestion[];
  onSelect?: (suggestion: Suggestion) => void;
}

export function SuggestionsList({ suggestions, onSelect }: SuggestionsListProps) {
  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-1">
      {suggestions.map((suggestion, index) => {
        const firstReason = suggestion.reasons[0];

        return (
          <div
            key={index}
            onClick={() => onSelect?.(suggestion)}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg",
              "hover:bg-bg-secondary cursor-pointer transition-colors"
            )}
          >
            {/* Type badge */}
            <span
              className={cn(
                "text-[10px] px-1.5 py-0.5 rounded shrink-0",
                suggestion.type === 'plan'
                  ? "bg-bg-secondary text-text-muted"
                  : "bg-[var(--color-accent-primary)]/10 text-[var(--color-accent-primary)]"
              )}
            >
              {suggestion.type}
            </span>

            {/* Goal */}
            <span className="text-sm text-text-primary flex-1 truncate">
              {suggestion.plan_goal}
            </span>

            {/* First reason */}
            {firstReason && (
              <span className="text-xs text-text-muted hidden sm:block max-w-[200px] truncate">
                {firstReason}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

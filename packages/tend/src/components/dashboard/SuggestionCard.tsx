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

interface SuggestionCardProps {
  suggestion: Suggestion;
  onOpen?: (suggestion: Suggestion) => void;
}

export function SuggestionCard({ suggestion, onOpen }: SuggestionCardProps) {
  const topReason = suggestion.reasons[0] || null;

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
        </div>
        {topReason && (
          <p className="text-xs text-text-muted mt-0.5 truncate">
            {topReason}
          </p>
        )}
      </div>

      {/* Arrow */}
      <span className="text-text-muted text-xs shrink-0">&rsaquo;</span>
    </button>
  );
}

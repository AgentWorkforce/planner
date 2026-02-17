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
  const topReasons = suggestion.reasons.slice(0, 3);

  return (
    <div className="bg-bg-card rounded-2xl p-4 border border-[var(--color-accent-primary)]/20">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        {suggestion.type === 'plan' ? (
          <svg
            className="w-4 h-4 text-[var(--color-accent-primary)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <circle cx="12" cy="12" r="10" strokeWidth="2" />
            <circle cx="12" cy="12" r="4" strokeWidth="2" />
          </svg>
        ) : (
          <svg
            className="w-4 h-4 text-[var(--color-accent-primary)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 2l3 7h7l-5.5 4 2 7-6.5-5-6.5 5 2-7L2 9h7l3-7z"
            />
          </svg>
        )}
        <span className="text-xs text-text-muted font-medium uppercase tracking-wider">
          Suggested Next
        </span>
      </div>

      {/* Title */}
      <h3 className="text-base font-medium text-text-primary line-clamp-2 mb-1">
        {suggestion.plan_goal}
      </h3>

      {/* Subtitle */}
      {suggestion.initiative_name && (
        <p className="text-xs text-text-secondary mb-3">
          {suggestion.initiative_name}
        </p>
      )}

      {/* Reasons */}
      {topReasons.length > 0 && (
        <ul className="space-y-1 mb-3">
          {topReasons.map((reason, index) => (
            <li key={index} className="flex items-start gap-2 text-sm text-text-secondary">
              <span className="text-[var(--color-accent-primary)] mt-1">•</span>
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Signal count */}
      {suggestion.signal_count > 0 && (
        <p className="text-xs text-[var(--color-accent-primary)] mb-3">
          Backed by {suggestion.signal_count} external signal{suggestion.signal_count !== 1 ? 's' : ''}
        </p>
      )}

      {/* Footer */}
      <div className="flex justify-end">
        <button
          onClick={() => onOpen?.(suggestion)}
          className={cn(
            "text-sm font-medium text-[var(--color-accent-primary)]",
            "hover:underline transition-all"
          )}
        >
          {suggestion.type === 'opportunity' ? 'Create Plan' : 'Open'}
        </button>
      </div>
    </div>
  );
}

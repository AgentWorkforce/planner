import { cn } from '@/lib/utils';
import type { Suggestion } from '@/hooks/useSuggestions';

interface SuggestionsListProps {
  suggestions: Suggestion[];
  onSelect?: (suggestion: Suggestion) => void;
}

export function SuggestionsList({ suggestions, onSelect }: SuggestionsListProps) {
  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-0.5">
      {suggestions.map((suggestion, index) => (
        <div
          key={index}
          onClick={() => onSelect?.(suggestion)}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-lg",
            "hover:bg-bg-secondary cursor-pointer transition-colors"
          )}
        >
          {/* Bullet */}
          <span className="text-text-muted text-xs shrink-0">·</span>

          {/* Goal */}
          <span className="text-sm text-text-primary flex-1 truncate">
            {suggestion.plan_goal}
          </span>

          {/* Phase badge (more useful than reason text) */}
          {suggestion.phase && (
            <span className="text-[10px] text-text-muted shrink-0">
              {suggestion.phase}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

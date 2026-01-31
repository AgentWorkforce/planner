import type { Initiative } from '@/types/initiative';
import { useInitiatives } from '@/hooks/useInitiatives';

interface PipelineInitiativeTabsProps {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  className?: string;
}

/**
 * InitiativeTabs - Horizontal scrollable pill tabs for pipeline toolbar.
 *
 * Shows "All" option first, followed by each initiative with icon + name.
 * Uses simpler styling than the plans version to fit in the toolbar context.
 * Horizontal scroll for overflow.
 *
 * Design: follows ui-pipeline-view feature spec p004 requirements.
 *
 * @example
 * ```tsx
 * function PipelineToolbar() {
 *   const [selectedInitiative, setSelectedInitiative] = useState<string | null>(null);
 *
 *   return (
 *     <InitiativeTabs
 *       selectedId={selectedInitiative}
 *       onSelect={setSelectedInitiative}
 *     />
 *   );
 * }
 * ```
 */
export function InitiativeTabs({
  selectedId,
  onSelect,
  className = ''
}: PipelineInitiativeTabsProps) {
  const { initiatives, isLoading } = useInitiatives();

  // Show loading skeleton
  if (isLoading) {
    return (
      <div className={`flex gap-1 overflow-x-auto scrollbar-hide ${className}`}>
        {/* Loading placeholder pills */}
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-8 w-20 bg-bg-secondary/50 rounded-md animate-pulse flex-shrink-0"
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-1 overflow-x-auto scrollbar-hide ${className}`}
      role="tablist"
      aria-label="Filter plans by initiative"
    >
      {/* All pill - always first */}
      <button
        type="button"
        role="tab"
        aria-selected={selectedId === null}
        onClick={() => onSelect(null)}
        className={`flex-shrink-0 inline-flex items-center px-3 py-1.5 text-sm rounded-md transition-colors ${
          selectedId === null
            ? 'bg-accent-cyan/10 text-accent-cyan font-medium'
            : 'bg-transparent text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
        }`}
      >
        All
      </button>

      {/* Initiative pills */}
      {initiatives.map((initiative) => (
        <InitiativePill
          key={initiative.initiative_id}
          initiative={initiative}
          isSelected={selectedId === initiative.initiative_id}
          onSelect={() => onSelect(initiative.initiative_id)}
        />
      ))}
    </div>
  );
}

interface InitiativePillProps {
  initiative: Initiative;
  isSelected: boolean;
  onSelect: () => void;
}

/**
 * Individual initiative pill for pipeline toolbar.
 * Shows icon (emoji) + name, with active state styling.
 */
function InitiativePill({ initiative, isSelected, onSelect }: InitiativePillProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isSelected}
      onClick={onSelect}
      className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
        isSelected
          ? 'bg-accent-cyan/10 text-accent-cyan font-medium'
          : 'bg-transparent text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
      }`}
    >
      {/* Initiative icon (emoji) */}
      {initiative.icon && (
        <span className="text-sm leading-none" role="img" aria-label="Initiative icon">
          {initiative.icon}
        </span>
      )}

      {/* Initiative name */}
      <span className="truncate max-w-[120px]">{initiative.name}</span>
    </button>
  );
}

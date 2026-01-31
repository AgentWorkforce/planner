import type { Initiative } from '@/types/initiative';
import { useInitiatives } from '@/hooks/useInitiatives';

interface InitiativeTabsProps {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  className?: string;
}

/**
 * Horizontal scrollable pill tabs for filtering plans by initiative.
 *
 * Shows "All" pill (always first), followed by each initiative as a pill
 * with color dot + name. Selected pill has elevated bg and shadow.
 *
 * Design: follows catalog design_system two_row_toolbar pattern for row2 filter tabs.
 *
 * @example
 * ```tsx
 * function PlansToolbar() {
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
export function InitiativeTabs({ selectedId, onSelect, className = '' }: InitiativeTabsProps) {
  const { initiatives, isLoading } = useInitiatives();

  // Show loading skeleton
  if (isLoading) {
    return (
      <div className={`flex gap-2 overflow-x-auto scrollbar-hide ${className}`}>
        {/* Loading placeholder pills */}
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-8 w-24 bg-bg-secondary/50 rounded-full animate-pulse flex-shrink-0"
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={`flex gap-2 overflow-x-auto scrollbar-hide ${className}`}
      role="tablist"
      aria-label="Filter plans by initiative"
    >
      {/* All pill - always first */}
      <button
        type="button"
        role="tab"
        aria-selected={selectedId === null}
        onClick={() => onSelect(null)}
        className={`flex-shrink-0 inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-full transition-all duration-150 border ${
          selectedId === null
            ? 'bg-bg-elevated text-text-primary shadow-sm border-border-default'
            : 'text-text-muted hover:text-text-secondary hover:bg-bg-secondary/50 border-transparent'
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

      {/* New Initiative button - positioned at end */}
      <button
        type="button"
        onClick={() => {
          // TODO: Open New Initiative modal when ui-initiatives-view is implemented
          // For now, this button is visible but does nothing (intentional placeholder)
        }}
        className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-muted hover:text-accent-cyan hover:bg-bg-secondary/50 rounded-full transition-all duration-150"
        aria-label="Create new initiative"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        New
      </button>
    </div>
  );
}

interface InitiativePillProps {
  initiative: Initiative;
  isSelected: boolean;
  onSelect: () => void;
}

/**
 * Individual initiative pill component.
 * Shows color dot + name, with selected/unselected states.
 */
function InitiativePill({ initiative, isSelected, onSelect }: InitiativePillProps) {
  const iconBgColor = initiative.color || '#a855f7'; // accent-purple as default

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isSelected}
      onClick={onSelect}
      className={`flex-shrink-0 inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-full transition-all duration-150 border ${
        isSelected
          ? 'bg-bg-elevated text-text-primary shadow-sm border-border-default'
          : 'text-text-muted hover:text-text-secondary hover:bg-bg-secondary/50 border-transparent'
      }`}
    >
      {/* Color dot */}
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: iconBgColor }}
        aria-hidden="true"
      />

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

export type PlansViewMode = 'list' | 'grouped';

interface PlansViewModeToggleProps {
  value: PlansViewMode;
  onChange: (mode: PlansViewMode) => void;
}

/**
 * Toggle component for switching between flat list and grouped-by-scope views.
 * Follows existing ViewModeToggle pattern.
 */
export function PlansViewModeToggle({ value, onChange }: PlansViewModeToggleProps) {
  return (
    <div className="inline-flex gap-0.5 p-1 bg-bg-secondary/50 rounded-lg border border-border-subtle">
      <button
        type="button"
        onClick={() => onChange('list')}
        className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 rounded-md transition-all duration-150 ${
          value === 'list'
            ? 'bg-accent-cyan text-bg-deep shadow-sm'
            : 'text-text-muted hover:text-text-secondary'
        }`}
        title="List View"
      >
        {/* List icon - horizontal lines */}
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
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
        List
      </button>
      <button
        type="button"
        onClick={() => onChange('grouped')}
        className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 rounded-md transition-all duration-150 ${
          value === 'grouped'
            ? 'bg-accent-cyan text-bg-deep shadow-sm'
            : 'text-text-muted hover:text-text-secondary'
        }`}
        title="Group by Scope"
      >
        {/* Grouped icon - stacked rectangles suggesting grouped sections */}
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
          <rect x="3" y="3" width="18" height="6" rx="1" />
          <rect x="3" y="12" width="18" height="9" rx="1" />
          <line x1="3" y1="15" x2="21" y2="15" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
        Grouped
      </button>
    </div>
  );
}

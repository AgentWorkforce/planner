export type ViewMode = 'list' | 'swimlane';

interface ViewModeToggleProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
}

export function ViewModeToggle({ value, onChange }: ViewModeToggleProps) {
  return (
    <div className="inline-flex rounded-lg border border-border-subtle overflow-hidden">
      <button
        type="button"
        onClick={() => onChange('list')}
        className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors ${
          value === 'list'
            ? 'bg-accent-cyan text-bg-deep'
            : 'bg-bg-secondary text-text-secondary hover:text-text-primary hover:bg-bg-hover'
        }`}
        title="List View"
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
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
        List
      </button>
      <button
        type="button"
        onClick={() => onChange('swimlane')}
        className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 border-l border-border-subtle transition-colors ${
          value === 'swimlane'
            ? 'bg-accent-cyan text-bg-deep'
            : 'bg-bg-secondary text-text-secondary hover:text-text-primary hover:bg-bg-hover'
        }`}
        title="Swimlane View"
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
          <rect x="3" y="3" width="7" height="18" rx="1" />
          <rect x="14" y="3" width="7" height="18" rx="1" />
        </svg>
        Swimlane
      </button>
    </div>
  );
}

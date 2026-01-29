export type ViewMode = 'list' | 'swimlane';

interface ViewModeToggleProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
}

export function ViewModeToggle({ value, onChange }: ViewModeToggleProps) {
  return (
    <div
      className="view-mode-toggle"
      style={{
        display: 'inline-flex',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--color-border)',
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={() => onChange('list')}
        className={`view-mode-btn${value === 'list' ? ' active' : ''}`}
        style={{
          padding: 'var(--spacing-xs) var(--spacing-sm)',
          border: 'none',
          background: value === 'list' ? 'var(--color-primary)' : 'var(--color-background)',
          color: value === 'list' ? 'white' : 'var(--color-text)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-xs)',
          fontSize: '0.75rem',
          fontWeight: 500,
          transition: 'background-color 0.2s, color 0.2s',
        }}
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
        className={`view-mode-btn${value === 'swimlane' ? ' active' : ''}`}
        style={{
          padding: 'var(--spacing-xs) var(--spacing-sm)',
          border: 'none',
          borderLeft: '1px solid var(--color-border)',
          background: value === 'swimlane' ? 'var(--color-primary)' : 'var(--color-background)',
          color: value === 'swimlane' ? 'white' : 'var(--color-text)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-xs)',
          fontSize: '0.75rem',
          fontWeight: 500,
          transition: 'background-color 0.2s, color 0.2s',
        }}
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

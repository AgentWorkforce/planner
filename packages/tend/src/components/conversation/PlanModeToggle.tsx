import { BookOpen } from 'lucide-react';

interface PlanModeToggleProps {
  enabled: boolean;
  onToggle: () => void;
}

export function PlanModeToggle({ enabled, onToggle }: PlanModeToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={enabled ? 'Plan Mode (active)' : 'Plan Mode'}
      className={`p-1 rounded transition-colors ${
        enabled
          ? 'text-accent-primary bg-accent-primary/10'
          : 'text-text-muted hover:text-text-secondary hover:bg-bg-tertiary/50'
      }`}
    >
      <BookOpen size={14} />
    </button>
  );
}

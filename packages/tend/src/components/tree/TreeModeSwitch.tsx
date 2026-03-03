import { cn } from '@/lib/utils';

interface TreeModeSwitchProps {
  mode: 'plan' | 'changes';
  onModeChange: (mode: 'plan' | 'changes') => void;
  planAvailable: boolean;
  changeCount?: number;
}

export function TreeModeSwitch({
  mode,
  onModeChange,
  planAvailable,
  changeCount = 0,
}: TreeModeSwitchProps) {
  return (
    <div className="flex items-center gap-1 text-xs font-mono">
      {planAvailable && (
        <button
          onClick={() => onModeChange('plan')}
          className={cn(
            'px-1.5 py-0.5 rounded transition-colors',
            mode === 'plan'
              ? 'text-accent-primary bg-accent-primary/10'
              : 'text-text-muted hover:text-text-secondary'
          )}
        >
          Plan
        </button>
      )}
      <button
        onClick={() => onModeChange('changes')}
        className={cn(
          'px-1.5 py-0.5 rounded transition-colors flex items-center gap-1',
          mode === 'changes'
            ? 'text-accent-primary bg-accent-primary/10'
            : 'text-text-muted hover:text-text-secondary'
        )}
      >
        Changes
        {changeCount > 0 && (
          <span className="text-[10px] bg-accent-primary/20 text-accent-primary px-1 rounded-full tabular-nums">
            {changeCount}
          </span>
        )}
      </button>
    </div>
  );
}

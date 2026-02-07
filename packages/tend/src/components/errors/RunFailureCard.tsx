import { cn } from '@/lib/utils';
import { AlertCircleIcon } from '@/components/icons/AlertCircleIcon';
import { PlayIcon } from '@/components/icons/PlayIcon';

export interface RunFailureCardProps {
  runId: string;
  error: string;
  onRestart?: () => void;
  className?: string;
}

/**
 * RunFailureCard - Shows when a forge run fails
 *
 * More prominent than step failure. Uses brick color to indicate critical error.
 * Shows run ID and provides restart action.
 */
export function RunFailureCard({
  runId,
  error,
  onRestart,
  className,
}: RunFailureCardProps) {
  return (
    <div
      className={cn(
        'bg-error-light border-2 border-error rounded-lg p-5',
        'shadow-lg',
        className
      )}
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className="flex-shrink-0">
          <div className="w-10 h-10 rounded-full bg-error/20 flex items-center justify-center">
            <AlertCircleIcon size="lg" className="text-error" />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-text-primary mb-1">
            Run Failed
          </h3>

          <p className="text-xs font-mono text-text-muted mb-2">
            Run ID: {runId}
          </p>

          <p className="text-sm text-text-secondary leading-relaxed mb-4">
            {error}
          </p>

          {/* Action */}
          {onRestart && (
            <button
              onClick={onRestart}
              className={cn(
                'inline-flex items-center gap-2',
                'px-4 py-2 text-sm font-semibold',
                'bg-error hover:bg-error/90 text-white',
                'rounded-md transition-colors shadow-sm',
                'focus-visible:outline-none focus-visible:ring-2',
                'focus-visible:ring-error focus-visible:ring-offset-2'
              )}
            >
              <PlayIcon size="sm" />
              Restart Run
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

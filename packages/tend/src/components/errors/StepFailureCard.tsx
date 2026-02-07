import { cn } from '@/lib/utils';
import { AlertTriangleIcon } from '@/components/icons/AlertTriangleIcon';
import { RefreshIcon } from '@/components/icons/RefreshIcon';
import { XIcon } from '@/components/icons/XIcon';

export interface StepFailureCardProps {
  stepTitle: string;
  error: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

/**
 * StepFailureCard - Shows when a step execution fails
 *
 * Uses brick color (--color-brick) to indicate error state.
 * Provides retry and dismiss actions.
 */
export function StepFailureCard({
  stepTitle,
  error,
  onRetry,
  onDismiss,
  className,
}: StepFailureCardProps) {
  return (
    <div
      className={cn(
        'bg-error-light border-l-4 border-error rounded-md p-4',
        'shadow-sm',
        className
      )}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="flex-shrink-0 text-error mt-0.5">
          <AlertTriangleIcon size="md" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-text-primary mb-1">
            Step Failed: {stepTitle}
          </h3>
          <p className="text-sm text-text-secondary leading-relaxed">
            {error}
          </p>

          {/* Actions */}
          {(onRetry || onDismiss) && (
            <div className="flex items-center gap-2 mt-3">
              {onRetry && (
                <button
                  onClick={onRetry}
                  className={cn(
                    'inline-flex items-center gap-1.5',
                    'px-3 py-1.5 text-xs font-medium',
                    'bg-error hover:bg-error/90 text-white',
                    'rounded-md transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2',
                    'focus-visible:ring-error focus-visible:ring-offset-2'
                  )}
                >
                  <RefreshIcon size="sm" />
                  Retry
                </button>
              )}

              {onDismiss && (
                <button
                  onClick={onDismiss}
                  className={cn(
                    'inline-flex items-center gap-1.5',
                    'px-3 py-1.5 text-xs font-medium',
                    'bg-bg-tertiary hover:bg-bg-secondary',
                    'text-text-secondary',
                    'rounded-md transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2',
                    'focus-visible:ring-border-default focus-visible:ring-offset-2'
                  )}
                >
                  <XIcon size="sm" />
                  Dismiss
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

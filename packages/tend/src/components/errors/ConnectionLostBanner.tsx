import { cn } from '@/lib/utils';
import { WifiOffIcon } from '@/components/icons/WifiOffIcon';
import { RefreshIcon } from '@/components/icons/RefreshIcon';

export interface ConnectionLostBannerProps {
  isVisible: boolean;
  onRetry: () => void;
  className?: string;
}

/**
 * ConnectionLostBanner - Fixed banner at top when connection is lost
 *
 * Uses clay/brick coloring to indicate warning/error state.
 * Auto-dismisses when connection restores (controlled by isVisible).
 */
export function ConnectionLostBanner({
  isVisible,
  onRetry,
  className,
}: ConnectionLostBannerProps) {
  if (!isVisible) {
    return null;
  }

  return (
    <div
      className={cn(
        'fixed top-0 left-0 right-0 z-50',
        'bg-warning border-b-2 border-error',
        'shadow-lg',
        'animate-slide-in-from-top',
        className
      )}
      role="alert"
      aria-live="assertive"
    >
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Icon + Message */}
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 text-white">
              <WifiOffIcon size="md" />
            </div>
            <p className="text-sm font-medium text-white">
              Connection lost. Attempting to reconnect...
            </p>
          </div>

          {/* Retry Button */}
          <button
            onClick={onRetry}
            className={cn(
              'inline-flex items-center gap-1.5',
              'px-3 py-1.5 text-xs font-semibold',
              'bg-white/20 hover:bg-white/30',
              'text-white backdrop-blur-sm',
              'rounded-md transition-colors border border-white/30',
              'focus-visible:outline-none focus-visible:ring-2',
              'focus-visible:ring-white focus-visible:ring-offset-2',
              'focus-visible:ring-offset-warning'
            )}
          >
            <RefreshIcon size="sm" />
            Retry Now
          </button>
        </div>
      </div>
    </div>
  );
}

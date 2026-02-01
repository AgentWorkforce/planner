/**
 * ProgressBar component for PlanCard.
 *
 * Renders a 4px progress bar at the absolute bottom of a card.
 * - Solid color for completed portion
 * - Zebra stripe pattern for remaining portion
 * - Hidden when total === 0
 */

interface ProgressBarProps {
  completed: number;
  total: number;
  className?: string;
}

/**
 * Visual progress bar showing step completion status.
 *
 * The bar is positioned absolutely at the bottom of its parent container.
 * Parent container must have `position: relative` and `overflow-hidden`
 * for proper clipping at rounded corners.
 */
export function ProgressBar({ completed, total, className = '' }: ProgressBarProps) {
  // Hidden when no steps
  if (total === 0) {
    return null;
  }

  const percentage = Math.min(100, Math.round((completed / total) * 100));
  const isComplete = completed >= total;

  return (
    <div
      className={`absolute bottom-0 left-0 right-0 h-1 ${className}`}
      role="progressbar"
      aria-valuenow={completed}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-label={`${completed} of ${total} steps completed`}
    >
      {/* Background: zebra stripe pattern for remaining portion */}
      {!isComplete && (
        <div
          className="absolute inset-0 rounded-b-xl"
          style={{
            background: `repeating-linear-gradient(
              -45deg,
              var(--color-bg-tertiary),
              var(--color-bg-tertiary) 4px,
              var(--color-bg-elevated) 4px,
              var(--color-bg-elevated) 8px
            )`,
          }}
        />
      )}

      {/* Foreground: solid color for completed portion */}
      <div
        className={`absolute top-0 left-0 bottom-0 ${
          isComplete ? 'rounded-b-xl bg-success' : 'rounded-bl-xl bg-accent-cyan'
        }`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

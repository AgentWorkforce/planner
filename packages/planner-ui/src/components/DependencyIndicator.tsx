import { useState } from 'react';

export type DependencyDirection = 'incoming' | 'outgoing';

export interface ConnectedStep {
  stepId: string;
  title: string;
  scope?: string;
}

interface DependencyIndicatorProps {
  direction: DependencyDirection;
  count: number;
  hasCrossScope: boolean;
  connectedSteps: ConnectedStep[];
  onHover?: (isHovered: boolean) => void;
  onClick?: () => void;
  /** External hover state (e.g., when parent step card is hovered) */
  isParentHovered?: boolean;
}

/**
 * Circular badge showing dependency count on step card edges.
 * - Left side (incoming): blue #2563eb - shows what this step depends on
 * - Right side (outgoing): green #22c55e - shows what depends on this step
 * - Cross-scope: orange #f59e0b
 */
export function DependencyIndicator({
  direction,
  count,
  hasCrossScope,
  connectedSteps,
  onHover,
  onClick,
  isParentHovered = false,
}: DependencyIndicatorProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Show expanded state when indicator OR parent is hovered
  const isExpanded = isHovered || isParentHovered;

  // Hide when count is 0
  if (count === 0) return null;

  // Determine background color based on cross-scope and direction
  let bgColor: string;
  if (hasCrossScope) {
    bgColor = 'bg-[#f59e0b]'; // orange for cross-scope
  } else if (direction === 'incoming') {
    bgColor = 'bg-[#2563eb]'; // blue for incoming
  } else {
    bgColor = 'bg-[#22c55e]'; // green for outgoing
  }

  // Position: left edge for incoming, right edge for outgoing
  const positionClass = direction === 'incoming'
    ? 'left-0 -translate-x-1/2'
    : 'right-0 translate-x-1/2';

  const handleMouseEnter = () => {
    setIsHovered(true);
    onHover?.(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    onHover?.(false);
  };

  const handleClick = () => {
    onClick?.();
  };

  // Build tooltip content
  const tooltipLabel = direction === 'incoming' ? 'Depends on:' : 'Blocks:';

  // Smaller dot when not hovered, expands to show count on hover
  const sizeClass = isExpanded
    ? 'w-5 h-5 text-xs'
    : 'w-2.5 h-2.5 text-[0px]';

  return (
    <div
      className={`absolute top-1/2 -translate-y-1/2 ${positionClass} z-20`}
    >
      <button
        type="button"
        className={`
          ${sizeClass} rounded-full ${bgColor} text-white
          font-semibold
          border border-white/50
          flex items-center justify-center
          cursor-pointer
          transition-all duration-150
          focus:outline-none focus:ring-2 focus:ring-accent-cyan focus:ring-offset-1
        `}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        aria-label={`${count} ${direction === 'incoming' ? 'dependencies' : 'dependents'}${hasCrossScope ? ' (cross-scope)' : ''}`}
      >
        {isExpanded && count}
      </button>

      {/* Tooltip - only show when directly hovering the indicator */}
      {isHovered && connectedSteps.length > 0 && (
        <div
          className={`
            absolute z-50
            ${direction === 'incoming' ? 'right-full mr-2' : 'left-full ml-2'}
            top-1/2 -translate-y-1/2
            bg-bg-elevated border border-border-subtle rounded-lg
            px-3 py-2 shadow-lg
            min-w-[180px] max-w-[280px]
            pointer-events-none
          `}
        >
          <div className="text-xs font-medium text-text-muted mb-1.5">{tooltipLabel}</div>
          <ul className="space-y-1">
            {connectedSteps.slice(0, 5).map((step) => (
              <li key={step.stepId} className="text-sm text-text-primary truncate">
                {step.title}
                {step.scope && (
                  <span className="ml-1 text-xs text-text-muted">({step.scope})</span>
                )}
              </li>
            ))}
            {connectedSteps.length > 5 && (
              <li className="text-xs text-text-muted">
                +{connectedSteps.length - 5} more
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

import { useState, useRef, useCallback } from 'react';

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

type TooltipPosition = 'left' | 'right';

/**
 * Circular badge showing dependency count on step card edges.
 * - Left side (incoming): blue #2563eb - shows what this step depends on
 * - Right side (outgoing): green #22c55e - shows what depends on this step
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
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition>('left');
  const tooltipRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const positionLockRef = useRef(false);

  // Calculate optimal tooltip position when hovered
  // Must account for overflow:auto container clipping, not just viewport
  const calculatePosition = useCallback(() => {
    if (!buttonRef.current || positionLockRef.current) return;

    const buttonRect = buttonRef.current.getBoundingClientRect();
    const tooltipWidth = 280; // max-w-[280px]
    const margin = 16; // padding from edge

    // Find the scrollable container boundary (the overflow:auto parent)
    // This is where content gets clipped, not the viewport edge
    let containerRight = window.innerWidth;
    let containerLeft = 0;

    let parent = buttonRef.current.parentElement;
    while (parent) {
      const style = getComputedStyle(parent);
      if (style.overflow === 'auto' || style.overflowX === 'auto' ||
          style.overflow === 'hidden' || style.overflowX === 'hidden' ||
          style.overflow === 'scroll' || style.overflowX === 'scroll') {
        const parentRect = parent.getBoundingClientRect();
        containerRight = parentRect.right;
        containerLeft = parentRect.left;
        break;
      }
      parent = parent.parentElement;
    }

    // Default position based on direction
    const defaultPos: TooltipPosition = direction === 'incoming' ? 'left' : 'right';

    // Check if default position would be clipped by container
    if (defaultPos === 'right') {
      const rightEdge = buttonRect.right + tooltipWidth + margin;
      if (rightEdge > containerRight) {
        setTooltipPosition('left');
        positionLockRef.current = true;
        return;
      }
    } else {
      const leftEdge = buttonRect.left - tooltipWidth - margin;
      if (leftEdge < containerLeft) {
        setTooltipPosition('right');
        positionLockRef.current = true;
        return;
      }
    }

    setTooltipPosition(defaultPos);
    positionLockRef.current = true;
  }, [direction]);


  // Show expanded state when indicator OR parent is hovered
  const isExpanded = (isHovered || isParentHovered) && count > 0;

  // Determine if this is an empty placeholder (no connections)
  const isEmpty = count === 0;

  // Determine background color based on direction
  // Empty indicators match the card background with subtle border
  let bgColor: string;
  let borderColor: string;
  if (isEmpty) {
    bgColor = 'bg-bg-card';
    borderColor = 'border-border-subtle';
  } else if (direction === 'incoming') {
    bgColor = 'bg-[#2563eb]';
    borderColor = 'border-white/50';
  } else {
    bgColor = 'bg-[#22c55e]';
    borderColor = 'border-white/50';
  }

  // Position: left edge for incoming, right edge for outgoing
  const positionClass = direction === 'incoming'
    ? 'left-0 -translate-x-1/2'
    : 'right-0 translate-x-1/2';

  const handleMouseEnter = () => {
    // Reset lock and calculate position BEFORE setting hover state
    // This ensures tooltip renders in correct position on first paint
    positionLockRef.current = false;
    calculatePosition();
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
  // Empty indicators stay small and non-interactive visually
  const sizeClass = isExpanded
    ? 'w-5 h-5 text-xs'
    : 'w-2.5 h-2.5 text-[0px]';

  return (
    <div
      className={`absolute top-1/2 -translate-y-1/2 ${positionClass} z-20`}
    >
      <button
        ref={buttonRef}
        type="button"
        className={`
          ${sizeClass} rounded-full ${bgColor}
          font-semibold
          border ${borderColor}
          flex items-center justify-center
          ${isEmpty ? 'cursor-default' : 'cursor-pointer'}
          transition-all duration-150
          ${isEmpty ? '' : 'text-white'}
          ${isEmpty ? '' : 'focus:outline-none focus:ring-2 focus:ring-accent-cyan focus:ring-offset-1'}
        `}
        onMouseEnter={isEmpty ? undefined : handleMouseEnter}
        onMouseLeave={isEmpty ? undefined : handleMouseLeave}
        onClick={isEmpty ? undefined : handleClick}
        aria-label={isEmpty
          ? `No ${direction === 'incoming' ? 'dependencies' : 'dependents'}`
          : `${count} ${direction === 'incoming' ? 'dependencies' : 'dependents'}${hasCrossScope ? ' (cross-scope)' : ''}`
        }
        tabIndex={isEmpty ? -1 : 0}
      >
        {isExpanded && count}
      </button>

      {/* Tooltip - only show when directly hovering the indicator */}
      {isHovered && connectedSteps.length > 0 && (
        <div
          ref={tooltipRef}
          className={`
            absolute z-50
            ${tooltipPosition === 'left' ? 'right-full mr-2' : 'left-full ml-2'}
            top-1/2 -translate-y-1/2
            bg-[#fbfcfd] dark:bg-bg-elevated border border-border-subtle rounded-lg
            px-3 py-2 shadow-lg
            min-w-[180px] max-w-[280px]
            pointer-events-none
          `}
        >
          <div className="text-xs font-medium text-text-muted mb-1.5">{tooltipLabel}</div>
          <ul className="space-y-1">
            {connectedSteps.slice(0, 5).map((step) => (
              <li key={step.stepId} className="flex items-start gap-2 text-sm text-text-primary">
                <span
                  className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                    direction === 'incoming' ? 'bg-[#2563eb]' : 'bg-[#22c55e]'
                  }`}
                />
                <span className="truncate">
                  {step.title}
                  {step.scope && (
                    <span className="ml-1 text-xs text-text-muted">({step.scope})</span>
                  )}
                </span>
              </li>
            ))}
            {connectedSteps.length > 5 && (
              <li className="text-xs text-text-muted pl-3.5">
                +{connectedSteps.length - 5} more
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

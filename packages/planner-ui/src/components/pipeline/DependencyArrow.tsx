interface Point {
  x: number;
  y: number;
}

interface DependencyArrowProps {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  color?: string;
  className?: string;
  /** Show arrowhead at end point (default: true) */
  showArrowhead?: boolean;
  /** Stroke width in pixels (default: 2) */
  strokeWidth?: number;
  /** Opacity 0-1 (default: 1) */
  opacity?: number;
  /** Use dashed line for cross-scope dependencies */
  dashed?: boolean;
}

/**
 * Calculate control points for a smooth quadratic bezier curve.
 *
 * Creates an S-curve that flows naturally between two points.
 * Control point offset scales with vertical distance (min 30px, max 80px).
 *
 * @returns SVG path d attribute string
 */
export function calculateBezierPath(start: Point, end: Point): string {
  const verticalDist = Math.abs(end.y - start.y);

  // Control point offset based on vertical distance
  const controlOffset = Math.min(80, Math.max(30, verticalDist * 0.4));

  // Determine if we're flowing left-to-right or right-to-left
  const isForward = end.x >= start.x;

  // Cubic bezier with horizontal control points for smooth S-curve
  const cp1x = start.x + (isForward ? controlOffset : -controlOffset);
  const cp1y = start.y;
  const cp2x = end.x + (isForward ? -controlOffset : controlOffset);
  const cp2y = end.y;

  return `M ${start.x} ${start.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${end.x} ${end.y}`;
}

/**
 * SVG arrow component for showing dependencies between plans.
 *
 * Usage:
 * ```tsx
 * <svg viewBox="0 0 800 600">
 *   <DependencyArrow
 *     startX={100}
 *     startY={100}
 *     endX={700}
 *     endY={500}
 *     color="#2563eb"
 *     dashed={true}
 *   />
 * </svg>
 * ```
 *
 * Styling:
 * - Uses design tokens via CSS variables (e.g., color="var(--color-border-default)")
 * - Supports currentColor for inheriting parent text color
 * - Dashed lines indicate cross-scope dependencies
 */
export function DependencyArrow({
  startX,
  startY,
  endX,
  endY,
  color = 'currentColor',
  className = '',
  showArrowhead = true,
  strokeWidth = 2,
  opacity = 1,
  dashed = false,
}: DependencyArrowProps) {
  const path = calculateBezierPath(
    { x: startX, y: startY },
    { x: endX, y: endY }
  );

  // Generate unique marker ID for this arrow instance
  const markerId = `arrowhead-${Math.random().toString(36).substring(2, 9)}`;

  return (
    <g className={`dependency-arrow ${className}`}>
      {showArrowhead && (
        <defs>
          <marker
            id={markerId}
            markerWidth="8"
            markerHeight="8"
            refX="6"
            refY="4"
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            {/* Triangle arrowhead pointing right */}
            <path
              d="M 0 0 L 8 4 L 0 8 Z"
              fill={color}
            />
          </marker>
        </defs>
      )}

      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={dashed ? '6 4' : undefined}
        opacity={opacity}
        markerEnd={showArrowhead ? `url(#${markerId})` : undefined}
      />
    </g>
  );
}

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

/**
 * Content visibility threshold (in pixels)
 * Blocks smaller than this size should hide detailed content
 */
export const CONTENT_VISIBILITY_THRESHOLD = 60;

/**
 * Animation state for physics blocks
 */
export type PhysicsBlockAnimationState = 'entering' | 'exiting' | 'idle';

/**
 * Props for PhysicsBlockBase component
 */
export interface PhysicsBlockBaseProps {
  id: string;
  position: { x: number; y: number };
  angle?: number; // Rotation angle from physics engine (in radians)
  size: number;
  activityScore?: number; // 0-100, used for z-index layering
  isAbandoned?: boolean; // Faded styling for abandoned items
  animationState?: PhysicsBlockAnimationState;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  children: React.ReactNode; // Context-specific content
}

/**
 * PhysicsBlockBase
 *
 * Shared base component for physics-driven blocks used by both dashboard and canvas views.
 * Handles position synchronization, rotation, z-index layering, and animation states.
 *
 * Features:
 * - Position sync via requestAnimationFrame (smooth 60fps updates)
 * - Rotation support from physics engine
 * - Size transitions with easing
 * - Z-index layering based on activity score
 * - Animation state classes (entering, exiting, idle)
 * - Abandoned item styling (faded, hover effects)
 * - GPU-accelerated transforms
 *
 * Usage:
 * ```tsx
 * <PhysicsBlockBase
 *   id="block-1"
 *   position={{ x: 100, y: 100 }}
 *   angle={0.5}
 *   size={80}
 *   activityScore={75}
 *   animationState="entering"
 *   onClick={() => console.log('clicked')}
 * >
 *   <div>Custom content here</div>
 * </PhysicsBlockBase>
 * ```
 */
export function PhysicsBlockBase({
  id,
  position,
  angle = 0,
  size,
  activityScore,
  isAbandoned = false,
  animationState = 'idle',
  className,
  style,
  onClick,
  children,
}: PhysicsBlockBaseProps) {
  const blockRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Sync DOM position with physics body position
  useEffect(() => {
    const element = blockRef.current;
    if (!element) return;

    // Use requestAnimationFrame for smooth 60fps updates
    const updatePosition = () => {
      if (element) {
        // Center the element on the physics body position
        const left = position.x - size / 2;
        const top = position.y - size / 2;

        // Apply both translation and rotation in a single transform
        // Use GPU-accelerated transforms for smooth movement
        const rotation = angle !== 0 ? ` rotate(${angle}rad)` : '';
        element.style.transform = `translate(${left}px, ${top}px)${rotation}`;
      }
      animationFrameRef.current = requestAnimationFrame(updatePosition);
    };

    animationFrameRef.current = requestAnimationFrame(updatePosition);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [position.x, position.y, size, angle]);

  // Calculate z-index from activity score
  const zIndex = activityScore !== undefined ? Math.round(activityScore) : undefined;

  // Map animation state to CSS class
  const animationClass =
    animationState === 'entering'
      ? 'physics-block-pop-in'
      : animationState === 'exiting'
        ? 'physics-block-pop-out'
        : '';

  return (
    <div
      ref={blockRef}
      onClick={onClick}
      className={cn(
        'absolute select-none',
        'transition-all duration-200',
        // Animation state classes
        animationClass,
        // Abandoned styling
        isAbandoned && [
          'opacity-40',
          'hover:opacity-60',
        ],
        // Cursor
        onClick && 'cursor-pointer',
        // Custom classes
        className
      )}
      style={{
        width: size,
        height: size,
        // GPU-accelerated performance
        willChange: 'transform',
        // Smooth size transitions
        transition: 'width 0.3s ease, height 0.3s ease',
        // Z-index layering
        zIndex,
        // Custom styles merged
        ...style,
      }}
      data-block-id={id}
    >
      {children}
    </div>
  );
}

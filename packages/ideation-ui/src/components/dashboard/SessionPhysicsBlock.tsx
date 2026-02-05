import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Session interface matching the ideation backend
 */
export interface SessionPhysicsBlockData {
  id: string;
  source: {
    initial_intent: string;
  };
  blocks?: Array<{ id: string }>;
  updated_at: string;
}

/**
 * Props for SessionPhysicsBlock component
 */
export interface SessionPhysicsBlockProps {
  session: SessionPhysicsBlockData;
  position: { x: number; y: number };
  size: number; // Derived from activity/importance
  isAbandoned?: boolean; // Whether the session is abandoned (> 7 days inactive)
  onClick?: () => void;
}

/**
 * SessionPhysicsBlock
 *
 * Individual session component rendered as an absolutely positioned block
 * synced with a physics body. Shows session title, block count, and last activity.
 *
 * Features:
 * - Position synced via requestAnimationFrame
 * - Size scales with session activity/importance
 * - GPU-accelerated transforms for smooth movement
 * - Click handler for navigation to session canvas
 * - Truncated title with ellipsis
 * - Block count badge
 * - Last activity timestamp
 *
 * Size Calculation:
 * - Base size from usePhysicsEngine (based on activity)
 * - Min: 80px (small sessions)
 * - Max: 120px (active sessions with many blocks)
 *
 * Usage:
 * ```tsx
 * <SessionPhysicsBlock
 *   session={{
 *     id: 'session-1',
 *     source: { initial_intent: 'Build a feature' },
 *     blocks: [{ id: 'b1' }, { id: 'b2' }],
 *     updated_at: '2026-02-04T10:00:00Z',
 *   }}
 *   position={{ x: 100, y: 100 }}
 *   size={80}
 *   onClick={() => navigate(`/ideation/session/${session.id}`)}
 * />
 * ```
 */
export function SessionPhysicsBlock({
  session,
  position,
  size,
  isAbandoned = false,
  onClick,
}: SessionPhysicsBlockProps) {
  const blockRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);

  // Sync DOM position with physics body position
  useEffect(() => {
    const element = blockRef.current;
    if (!element) return;

    // Use requestAnimationFrame for smooth updates
    const updatePosition = () => {
      if (element) {
        // Center the element on the physics body position
        const left = position.x - size / 2;
        const top = position.y - size / 2;

        // Use transform for GPU-accelerated positioning
        element.style.transform = `translate(${left}px, ${top}px)`;
      }
      animationFrameRef.current = requestAnimationFrame(updatePosition);
    };

    animationFrameRef.current = requestAnimationFrame(updatePosition);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [position.x, position.y, size]);

  const title = session.source.initial_intent;

  // Calculate block count
  const blockCount = session.blocks?.length || 0;

  // Format last activity (relative time)
  const lastActivity = new Date(session.updated_at);
  const now = new Date();
  const diffMs = now.getTime() - lastActivity.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  let activityLabel = '';
  if (diffMins < 1) {
    activityLabel = 'Just now';
  } else if (diffMins < 60) {
    activityLabel = `${diffMins}m ago`;
  } else if (diffHours < 24) {
    activityLabel = `${diffHours}h ago`;
  } else {
    activityLabel = `${diffDays}d ago`;
  }

  return (
    <>
      <div
        ref={blockRef}
        onClick={onClick}
        onMouseEnter={() => isAbandoned && setShowTooltip(true)}
        onMouseLeave={() => isAbandoned && setShowTooltip(false)}
        className={cn(
          'absolute select-none',
          'flex flex-col items-center justify-center',
          'transition-all duration-200',
          'cursor-pointer',
          'rounded-lg',
          isAbandoned
            ? [
                // Abandoned session styles
                'opacity-40',
                'hover:opacity-70',
                'hover:scale-150',
              ]
            : [
                // Active session styles
                'p-3 gap-1',
                'hover:shadow-lg hover:scale-105',
              ]
        )}
        style={{
          width: size,
          height: size,
          willChange: 'transform',
          backgroundColor: 'var(--block-draft)',
          borderWidth: '1px',
          borderStyle: 'solid',
          borderColor: 'var(--block-draft-border)',
        }}
      >
        {/* Only show content for non-abandoned sessions */}
        {!isAbandoned && (
          <>
            {/* Session Title */}
            <div className="text-xs font-medium text-[var(--canvas-text-primary)] text-center w-full px-1 line-clamp-2">
              {title}
            </div>

            {/* Block Count Badge */}
            {blockCount > 0 && (
              <div className="flex items-center gap-1 px-2 py-0.5 bg-[var(--canvas-bg-subtle)] rounded-full">
                <span className="text-xs text-[var(--canvas-text-muted)]">{blockCount} blocks</span>
              </div>
            )}

            {/* Last Activity */}
            <div className="text-[10px] text-[var(--canvas-text-muted)] mt-auto">
              {activityLabel}
            </div>
          </>
        )}
      </div>

      {/* Tooltip for abandoned sessions */}
      {isAbandoned && showTooltip && (
        <div
          className="absolute z-50 px-3 py-2 rounded-lg shadow-lg pointer-events-none"
          style={{
            left: position.x + size / 2 + 10,
            top: position.y,
            transform: 'translateY(-50%)',
            backgroundColor: 'var(--block-draft)',
            borderWidth: '1px',
            borderStyle: 'solid',
            borderColor: 'var(--block-draft-border)',
          }}
        >
          <div className="text-xs font-medium text-[var(--canvas-text-primary)] whitespace-nowrap">
            {title}
          </div>
          <div className="text-[10px] text-[var(--canvas-text-muted)] mt-1">
            Abandoned {activityLabel}
          </div>
          <div className="text-[10px] text-[var(--canvas-accent)] mt-1">
            Click to reactivate
          </div>
        </div>
      )}
    </>
  );
}

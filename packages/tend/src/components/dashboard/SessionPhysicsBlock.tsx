import { PhysicsBlockBase, CONTENT_VISIBILITY_THRESHOLD } from '@/components/shared/PhysicsBlockBase';

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
  angle?: number; // Rotation angle from physics engine (in radians)
  size: number; // Derived from activity/importance
  isAbandoned?: boolean; // Whether the session is abandoned (> 7 days inactive)
  blockCount?: number; // Number of blocks (used for color variation)
  onClick?: () => void;
}

/**
 * Get CSS variable names for progress colors based on block count
 * - 0 blocks: Cool blue-gray (just started)
 * - 1-2 blocks: Amber/yellow (developing)
 * - 3-4 blocks: Teal (maturing)
 * - 5+ blocks: Green (ready for planner)
 *
 * Colors are defined in globals.css for both light and dark themes.
 */
function getProgressColor(blockCount: number): { bg: string; border: string } {
  if (blockCount === 0) {
    return { bg: 'var(--session-new-bg)', border: 'var(--session-new-border)' };
  } else if (blockCount <= 2) {
    return { bg: 'var(--session-developing-bg)', border: 'var(--session-developing-border)' };
  } else if (blockCount <= 4) {
    return { bg: 'var(--session-maturing-bg)', border: 'var(--session-maturing-border)' };
  } else {
    return { bg: 'var(--session-ready-bg)', border: 'var(--session-ready-border)' };
  }
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
  angle = 0,
  size,
  isAbandoned = false,
  blockCount: blockCountProp,
  onClick,
}: SessionPhysicsBlockProps) {
  const blockCount = blockCountProp ?? (session.blocks?.length || 0);
  const progressColors = getProgressColor(blockCount);
  const showContent = size > CONTENT_VISIBILITY_THRESHOLD && !isAbandoned;

  // Calculate activity score for z-index (based on block count and recency)
  const activityScore = Math.min(100, blockCount * 10 + 50);

  const title = session.source.initial_intent;

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
    <PhysicsBlockBase
      id={session.id}
      position={position}
      angle={angle}
      size={size}
      activityScore={activityScore}
      isAbandoned={isAbandoned}
      onClick={onClick}
      style={{
        backgroundColor: isAbandoned ? 'var(--block-draft)' : progressColors.bg,
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: isAbandoned ? 'var(--block-draft-border)' : progressColors.border,
      }}
      className={!isAbandoned ? 'flex flex-col items-center justify-center p-3 gap-1 rounded-lg hover:shadow-lg hover:scale-105' : 'rounded-lg'}
    >
      {showContent && (
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
    </PhysicsBlockBase>
  );
}

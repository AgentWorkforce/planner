import { useEffect, useRef, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePhysicsEngine } from '@/hooks/usePhysicsEngine';
import { useSessions } from '@/hooks/useSessions';
import { useInitiatives } from '@/hooks/useInitiatives';
import { SessionPhysicsBlock } from './SessionPhysicsBlock';
import { InitiativeWells } from './InitiativeWells';
import { NewProjectModal } from '@/components/sessions/NewSessionModal';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

/**
 * Maximum number of sessions to display in physics view
 */
const MAX_VISIBLE_SESSIONS = 20;

/**
 * Abandoned session threshold (7 days)
 */
const ABANDONED_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Abandoned session size (tiny dot)
 */
const ABANDONED_SIZE = 10;

/**
 * Check if a session is abandoned (no activity > 7 days)
 */
function isSessionAbandoned(updatedAt: string): boolean {
  const now = new Date().getTime();
  const updated = new Date(updatedAt).getTime();
  const timeSinceUpdate = now - updated;
  return timeSinceUpdate > ABANDONED_THRESHOLD_MS;
}

/**
 * Calculate session block size based on activity/importance.
 * More blocks and recent activity = larger size.
 * Abandoned sessions are tiny (10px).
 */
function getSessionSize(blockCount: number, updatedAt: string): number {
  // Abandoned sessions are tiny dots
  if (isSessionAbandoned(updatedAt)) {
    return ABANDONED_SIZE;
  }

  const baseSize = 80; // Minimum size
  const maxSize = 120; // Maximum size

  // Factor 1: Block count (up to 20 blocks)
  const blockFactor = Math.min(blockCount / 20, 1);

  // Factor 2: Recency (sessions updated in last hour are more prominent)
  const now = new Date().getTime();
  const updated = new Date(updatedAt).getTime();
  const hoursSinceUpdate = (now - updated) / (1000 * 60 * 60);
  const recencyFactor = Math.max(0, 1 - hoursSinceUpdate / 24); // Full size if < 24h

  // Combine factors
  const sizeFactor = (blockFactor * 0.6 + recencyFactor * 0.4);
  return Math.round(baseSize + (maxSize - baseSize) * sizeFactor);
}

/**
 * SessionsPhysicsColumn
 *
 * Left column of SessionDashboard showing in-progress sessions as physics blocks.
 *
 * Features:
 * - Reuses physics engine from FormingBlocksColumn
 * - Each session represented as a physics block
 * - Clicking session navigates to that session's canvas
 * - Block size based on session activity/importance
 * - Physics simulation with central attraction
 *
 * @example
 * ```tsx
 * <SessionsPhysicsColumn />
 * ```
 */
export function SessionsPhysicsColumn() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { sessions, loading, error } = useSessions();
  const { initiatives } = useInitiatives();
  const navigate = useNavigate();
  const [isNewSessionModalOpen, setIsNewSessionModalOpen] = useState(false);

  // Filter for active sessions only
  const activeSessions = sessions.filter((s) => s.status === 'active');

  const { addBody, removeBody, updateBodyRadius, bodies, isReady } = usePhysicsEngine(containerRef, {
    edgeAttractionFilter: (id) => {
      // Apply edge attraction to abandoned sessions
      const session = activeSessions.find((s) => s.id === id);
      return session ? isSessionAbandoned(session.updated_at) : false;
    },
  });

  // Sort and limit sessions for physics display
  // Priority: block count (desc), then recency (desc)
  const sortedSessions = useMemo(() => {
    return [...activeSessions]
      .sort((a, b) => {
        // Sort by block count descending
        const aBlocks = a.blocks?.length ?? 0;
        const bBlocks = b.blocks?.length ?? 0;
        if (bBlocks !== aBlocks) return bBlocks - aBlocks;

        // Then by recency descending
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      })
      .slice(0, MAX_VISIBLE_SESSIONS);
  }, [activeSessions]);

  // Sync physics bodies with sessions array
  useEffect(() => {
    if (!isReady) return;

    const currentIds = new Set(sortedSessions.map((s) => s.id));
    const physicsIds = new Set(bodies.keys());

    // Add new bodies for sessions that don't have physics bodies yet
    sortedSessions.forEach((session) => {
      if (!physicsIds.has(session.id)) {
        const blockCount = session.blocks?.length || 0;
        const size = getSessionSize(blockCount, session.updated_at);
        addBody({
          id: session.id,
          radius: size / 2,
          initiativeId: session.initiative_id, // Pass initiative for grouping
        });
      }
    });

    // Update body radius for sessions that changed size (e.g., became abandoned)
    sortedSessions.forEach((session) => {
      if (physicsIds.has(session.id)) {
        const blockCount = session.blocks?.length || 0;
        const newSize = getSessionSize(blockCount, session.updated_at);
        updateBodyRadius(session.id, newSize / 2);
      }
    });

    // Remove physics bodies for sessions that no longer exist
    physicsIds.forEach((id) => {
      if (!currentIds.has(id)) {
        removeBody(id);
      }
    });
  }, [sortedSessions, addBody, removeBody, updateBodyRadius, bodies, isReady]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4">
        <h2 className="text-xs font-medium uppercase tracking-wider text-[var(--canvas-text-muted)]">
          In-Progress ({activeSessions.length})
        </h2>
        <p className="text-xs text-[var(--canvas-text-muted)] mt-1">
          {loading
            ? 'Opening garden...'
            : activeSessions.length > MAX_VISIBLE_SESSIONS
            ? `${activeSessions.length} active (showing ${MAX_VISIBLE_SESSIONS})`
            : `${activeSessions.length} active`
          }
        </p>
      </div>

      {/* Physics Container */}
      <div
        ref={containerRef}
        className={cn(
          'relative flex-1 overflow-hidden'
        )}
      >
        {/* Error State */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-sm text-text-error">
              <p>Lost connection to garden</p>
              <p className="text-xs text-text-muted mt-1">{error.message}</p>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && activeSessions.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-sm text-text-muted">
              <p>No active sessions</p>
              <p className="text-xs mt-1">Start a new session to get started</p>
            </div>
          </div>
        )}

        {/* Initiative Gravity Wells (rendered behind session blocks) */}
        {isReady && (
          <InitiativeWells
            bodies={bodies}
            sessions={sortedSessions}
            initiatives={initiatives}
          />
        )}

        {/* Render Session Blocks */}
        {sortedSessions.map((session) => {
          const body = bodies.get(session.id);
          if (!body) return null;

          const blockCount = session.blocks?.length || 0;
          const size = getSessionSize(blockCount, session.updated_at);
          const isAbandoned = isSessionAbandoned(session.updated_at);

          return (
            <SessionPhysicsBlock
              key={session.id}
              session={{
                id: session.id,
                source: session.source,
                blocks: session.blocks,
                updated_at: session.updated_at,
              }}
              position={{ x: body.x, y: body.y }}
              angle={body.angle}
              size={size}
              isAbandoned={isAbandoned}
              blockCount={blockCount}
              onClick={() => navigate(`/ideation/session/${session.id}`)}
            />
          );
        })}
      </div>

      {/* New Session Button */}
      <div className="p-4">
        <Button
          variant="primary"
          className="w-full"
          onClick={() => setIsNewSessionModalOpen(true)}
        >
          → Start new ideation session
        </Button>
      </div>

      {/* New Session Modal */}
      <NewProjectModal
        open={isNewSessionModalOpen}
        onOpenChange={setIsNewSessionModalOpen}
      />
    </div>
  );
}

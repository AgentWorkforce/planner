import { useMemo } from 'react';
import type { PhysicsBody } from '@/hooks/usePhysicsEngine';
import type { Initiative } from '@/hooks/useInitiatives';
import type { Session } from '@/hooks/useIdeationApi';
import { cn } from '@/lib/utils';

/**
 * Props for InitiativeWells component
 */
export interface InitiativeWellsProps {
  /** All physics bodies (session positions) */
  bodies: Map<string, PhysicsBody>;
  /** All active sessions */
  sessions: Session[];
  /** Initiative metadata */
  initiatives: Initiative[];
}

/**
 * Initiative well data for rendering
 */
interface InitiativeWellData {
  initiativeId: string;
  name: string;
  color?: string;
  centroid: { x: number; y: number };
  sessionCount: number;
}

/**
 * Parse hex color to rgba with alpha
 */
function hexToRgba(hex: string | undefined, alpha: number): string {
  if (!hex) return `rgba(100, 100, 255, ${alpha})`; // Default blue

  // Remove # if present
  const cleanHex = hex.replace('#', '');

  // Parse RGB components
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * InitiativeWells
 *
 * Renders visual "gravity well" overlays for each initiative group.
 * Shows initiative name label and subtle color tinting around clustered sessions.
 *
 * Features:
 * - Calculate centroid (average position) of all sessions in each initiative
 * - Render circular gradient overlay at centroid with initiative color
 * - Display initiative name label above the cluster
 * - Only render wells for initiatives with 2+ sessions (single sessions don't need wells)
 *
 * Visual design:
 * - Subtle radial gradient (initiative color at 10% opacity)
 * - Label positioned above centroid with semi-transparent background
 * - Well radius scales with number of sessions (more sessions = larger well)
 *
 * @example
 * ```tsx
 * <InitiativeWells
 *   bodies={bodies}
 *   sessions={activeSessions}
 *   initiatives={initiatives}
 * />
 * ```
 */
export function InitiativeWells({ bodies, sessions, initiatives }: InitiativeWellsProps) {
  // Calculate wells data (centroids, counts)
  const wells = useMemo(() => {
    const initiativeMap = new Map<string, InitiativeWellData>();

    // Group sessions by initiative and calculate centroid
    sessions.forEach((session) => {
      if (!session.initiative_id) return;

      const body = bodies.get(session.id);
      if (!body) return;

      const existing = initiativeMap.get(session.initiative_id);
      if (existing) {
        // Update centroid (running average)
        const newCount = existing.sessionCount + 1;
        existing.centroid.x = (existing.centroid.x * existing.sessionCount + body.x) / newCount;
        existing.centroid.y = (existing.centroid.y * existing.sessionCount + body.y) / newCount;
        existing.sessionCount = newCount;
      } else {
        // Initialize new well
        const initiative = initiatives.find((i) => i.initiative_id === session.initiative_id);
        if (initiative) {
          initiativeMap.set(session.initiative_id, {
            initiativeId: session.initiative_id,
            name: initiative.name,
            color: initiative.color,
            centroid: { x: body.x, y: body.y },
            sessionCount: 1,
          });
        }
      }
    });

    // Filter out initiatives with only 1 session (no need for well visualization)
    return Array.from(initiativeMap.values()).filter((well) => well.sessionCount > 1);
  }, [bodies, sessions, initiatives]);

  if (wells.length === 0) {
    return null;
  }

  return (
    <div className="absolute inset-0 pointer-events-none">
      {wells.map((well) => {
        // Scale well radius based on session count (more sessions = larger well)
        const baseRadius = 120;
        const radiusPerSession = 20;
        const radius = baseRadius + well.sessionCount * radiusPerSession;

        // Label position (above centroid)
        const labelX = well.centroid.x;
        const labelY = well.centroid.y - radius - 20;

        return (
          <div key={well.initiativeId}>
            {/* Radial gradient overlay */}
            <div
              className="absolute rounded-full"
              style={{
                left: well.centroid.x - radius,
                top: well.centroid.y - radius,
                width: radius * 2,
                height: radius * 2,
                background: `radial-gradient(circle, ${hexToRgba(well.color, 0.1)} 0%, transparent 70%)`,
                pointerEvents: 'none',
              }}
            />

            {/* Initiative label */}
            <div
              className={cn(
                'absolute px-3 py-1 rounded-full',
                'bg-bg-secondary/80 backdrop-blur-sm',
                'border border-border-subtle',
                'text-xs font-medium text-text-primary',
                'whitespace-nowrap'
              )}
              style={{
                left: labelX,
                top: labelY,
                transform: 'translateX(-50%)',
                pointerEvents: 'none',
              }}
            >
              {well.name}
              <span className="ml-1 text-text-muted">({well.sessionCount})</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

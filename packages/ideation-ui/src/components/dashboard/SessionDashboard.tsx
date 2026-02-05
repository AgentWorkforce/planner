import { CanvasLayout } from '../canvas/CanvasLayout';
import { SessionsPhysicsColumn } from './SessionsPhysicsColumn';
import { NavigatorChat } from './NavigatorChat';
import { SentToPlannerColumn } from './SentToPlannerColumn';

/**
 * SessionDashboard
 *
 * Physics-based dashboard showing all sessions with Navigator meta-chat.
 *
 * Layout:
 * ┌───────────────┬─────────────────────────┬────────────────────┐
 * │ In-Progress   │   Navigator Meta-Chat   │  Sent to Planner   │
 * │  Sessions     │                         │                    │
 * │  (physics)    │   "What would you like  │  • Project A       │
 * │               │    to work on today?"   │    (Planning)      │
 * │  ○ Session 1  │                         │  • Project B       │
 * │  ○ Session 2  │   [Chat input]          │    (Plan Ready)    │
 * │               │                         │                    │
 * └───────────────┴─────────────────────────┴────────────────────┘
 *    30%                    45%                      25%
 *
 * Features:
 * - Three-column layout using CanvasLayout
 * - Left: Sessions as physics blocks (reuses physics engine)
 * - Center: Navigator agent chat for workflow guidance
 * - Right: Handed-off sessions with planning status
 *
 * @route /ideation
 */
export function SessionDashboard() {
  return (
    <div className="h-screen flex flex-col bg-[var(--canvas-bg)]">
      {/* Header */}
      <header className="h-14 flex items-center px-4">
        <h1 className="text-xl font-semibold text-text-primary">Ideation Dashboard</h1>
      </header>

      {/* Three-column layout */}
      <div className="flex-1 overflow-hidden">
        <CanvasLayout
          formingBlocksSlot={<SessionsPhysicsColumn />}
          chatSlot={<NavigatorChat />}
          curatedBlocksSlot={<SentToPlannerColumn sessions={[]} />}
        />
      </div>
    </div>
  );
}

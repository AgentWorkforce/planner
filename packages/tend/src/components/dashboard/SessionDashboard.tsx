import { TendLayout } from '../layout/TendLayout';
import { StatusBar } from '../status/StatusBar';
import { DashboardNav } from './DashboardNav';
import { SessionsPhysicsColumn } from './SessionsPhysicsColumn';
import { NavigatorChat } from './NavigatorChat';
import { SentToPlannerColumn } from './SentToPlannerColumn';

/**
 * SessionDashboard
 *
 * Physics-based dashboard showing all sessions with Navigator meta-chat.
 *
 * Layout (CSS Grid — L/N/R/C/S):
 * ┌───────────────┬─────────────────────────┬────────────────────┐
 * │ In-Progress   │   Ideation Dashboard    │  Sent to Planner   │
 * │  Sessions     ├─────────────────────────┤                    │
 * │  (physics)    │   Navigator Meta-Chat   │  • Project A       │
 * │               │                         │    (Planning)      │
 * │  ○ Session 1  │   "What would you like  │  • Project B       │
 * │  ○ Session 2  │    to work on today?"   │    (Plan Ready)    │
 * └───────────────┴─────────────────────────┴────────────────────┘
 * │                     Status Bar                               │
 * └──────────────────────────────────────────────────────────────┘
 *
 * @route /ideation
 */
export function SessionDashboard() {
  return (
    <div className="h-screen">
      <TendLayout
        nav={<DashboardNav />}
        leftPanel={<SessionsPhysicsColumn />}
        center={<NavigatorChat />}
        rightPanel={<SentToPlannerColumn sessions={[]} />}
        statusBar={<StatusBar />}
      />
    </div>
  );
}

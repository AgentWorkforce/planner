# @plannr/tend

Session-first AI workspace for monitoring and steering plan execution. Sessions are the primary navigation entity — plans materialize from conversation and builds are monitored in real time as agents execute steps.

## Architecture

Tend is the operator-facing interface that sits above the forge execution layer. It does not create plans directly; it surfaces the state of sessions, plans, and running builds in a unified workspace.

**Key concepts:**

- **Session**: The primary unit of navigation. Each session has an initial intent, a conversation transcript, blocks (ideas), and associated plans.
- **Active Plan**: The most recently created plan within a session. Determines what the tree panel renders and whether a build can be started.
- **Build**: A forge-next run executing the active plan. Tend monitors build progress in real time via SSE and reflects step status, quality scores, stall warnings, and cost in the tree panel.
- **Block**: An idea or requirement captured during the session's ideation phase. Blocks can be focused and curated independently of plan steps.
- **Changeset**: The working git diff for the session's workspace, shown in the tree panel when no plan steps are present or when the user switches to changes mode.

```
┌──────────────────────────────────────────────────────┐
│                     tend (this)                      │
│                                                      │
│  DashboardPage (/)                                   │
│  ├─ Left: recent sessions                            │
│  ├─ Center: portfolio summary + suggestions          │
│  └─ Right: initiative tree with health indicators   │
│                                                      │
│  SessionWorkspace (/s/:id)                           │
│  ├─ Left: forming blocks + curated blocks            │
│  ├─ Center: conversation pane + focus mode           │
│  └─ Right: TreePanel (plan view / changeset view)    │
│             ├─ Build status banner + run metrics     │
│             ├─ ProjectTree (scope → step zoom)       │
│             └─ ChangesetTree (git working changes)   │
└──────────────────────────────────────────────────────┘
         │ SSE /api/forge-next/runs/:id/events
         ▼
    forge-next (backend)
```

## Routes

| Path | Component | Description |
|------|-----------|-------------|
| `/` | `DashboardPage` | Portfolio overview — sessions, suggestions, initiative tree |
| `/s/:id` | `SessionWorkspace` | Primary workspace for a session |
| `/projects/:id` | `ProjectPage` | Legacy project view (kept for backward compat) |
| `/settings` | `SettingsPage` | Application settings |

## Key Features

- Session-first navigation: `/s/:id` routes directly to the session workspace with no intermediate project layer
- Conversation pane with agent presence, pending questions, and reply bar
- Block focus mode: click a block to enter distraction-free editing with the conversation pane in context
- Tree panel with plan/changeset view toggle driven by URL state (`?tree=changes`)
- Zoomable project tree: overview (all scopes) → scope → step, navigable by breadcrumb and URL params (`?zoom=`, `?focus=`)
- Real-time build monitoring via SSE from forge-next: step status, satisfaction scores, stall warnings, cost
- Run metrics banner: steps completed, average satisfaction score, total cost, stall count
- Gate and question queue: pending agent questions surfaced in the reply bar with priority indicators
- Start Build dialog: configures forge-next run with step overrides, triggered from the tree panel when a plan is published
- Dashboard portfolio intelligence: initiative health, prioritized suggestions, contextual greeting based on most recent session

## Key Components

**Pages**
- `SessionWorkspace` — main workspace layout; owns block state, build dialog, step-to-build-status merging, and agent orchestration wiring
- `DashboardPage` — three-column portfolio dashboard

**Layout**
- `TendLayout` — four-region layout: nav bar, left panel, center, right panel, status bar
- `CanvasHeader` — top nav bar within the session workspace; shows session title and session switcher
- `StatusBar` — bottom bar with agent presence, session duration, relay connection status, and message queue

**Tree Panel**
- `TreePanel` — wraps `ProjectTree` with mode toggle, build status banner, and run metrics; auto-selects plan vs. changeset mode based on whether steps are present
- `ProjectTree` — zoomable scope/step tree with breadcrumb navigation, topological step ordering, and step detail sheet integration
- `StepNode` — compact step row showing status icon, title, and one trailing indicator (stall warning, satisfaction score, or dependency count)
- `ChangesetTree` — git working diff view for the current workspace
- `TreeModeSwitch` — toggle between plan and changes mode
- `WorkSection` — scope group with progress bar; renders `StepNode` list in collapsed or expanded form
- `TreeBreadcrumb` — project / scope / step breadcrumb with click-to-navigate segments

**Sheets**
- `StepSheet` — step detail drawer with editable title, description, owner role, acceptance criteria, quality section (score, reasoning, matched/failed criteria), cost section (estimated cost, duration, model), failure section (error messages, failure reasons), and a send-message input for directing the agent
- `SheetContainer` — slide-in sheet wrapper

**Blocks**
- `FormingBlocksColumn` — in-progress idea blocks from the session
- `CuratedBlocksColumn` — approved blocks ready for planning
- `FocusMode` — full-center block detail view with conversation pane inset

**Conversation**
- `ConversationPane` — chat transcript with agent list, pending item reply bar, and optional block/step focus context

**Dashboard**
- `PortfolioSummary` — initiative count, active plans, health breakdown, opportunity count
- `SuggestionCard` — primary portfolio suggestion with action button
- `SuggestionsList` — secondary suggestions list
- `InitiativeTree` — collapsible tree of initiatives with sessions and plans, health indicators

**Dialogs**
- `ForgeConfigPanel` (from `@plannr/shared-ui`) — build configuration form with step overrides; rendered inside the build dialog

**UI**
- `CommandPalette` — Cmd+K palette for session navigation
- `Toaster` — global toast notifications
- `ThemeToggle` — dark/light mode switch

## Key Hooks

**Session State**
- `useSession` — reads `SessionContext`; provides session, active plan, build state, build control actions, and refresh keys
- `useSessionSse` (internal to `SessionContext`) — SSE connection to ideation session events; triggers refetches on plan and block changes
- `usePlanSse` (internal to `SessionContext`) — SSE connection to planner plan events; triggers re-fetch on plan version changes

**Build Monitoring**
- `useBuildMonitor` — SSE-driven state machine for a forge-next run. Consumes a `RunEvent` stream at `/api/forge-next/runs/:id/events` and maintains:
  - `runStatus`: overall run lifecycle (`pending | running | paused | completed | failed | cancelled`)
  - `steps`: `Map<string, StepState>` with per-step status, satisfaction score, score reasoning, matched/failed criteria, failures, estimated cost, duration, model, and stall warning flag
  - `gates`: pending and resolved gate states
  - `questions`: pending and resolved question states
  - `runMetrics`: aggregate metrics (steps completed/total, average satisfaction, total cost)
  - `stallWarnings`: names of steps with active stall signals
  - Reconnect logic with exponential backoff and a maximum of 5 attempts

**Agent Orchestration**
- `useAgentOrchestration` — relay connection and agent presence for the session; provides connected agents, pending questions, session duration, and connection status
- `useQuestionNotifications` — queue of agent questions with dismiss support; feeds the reply bar in the status line

**Data Fetching**
- `useSessions` — all sessions (used in App for command palette)
- `useBlocks` — blocks for a session with curate/uncurate/update actions
- `usePlanSteps` — steps for the active plan, re-fetched when `planRefreshKey` increments
- `useWorkingChanges` — git working tree diff summary (total changes, branch name, detached HEAD)
- `usePortfolioOverview` — portfolio-level summary from `/api/portfolio/overview`
- `useSuggestions` — prioritized action suggestions from `/api/portfolio/suggestions`
- `useInitiatives` — initiative list for dashboard tree
- `useInitiativeHealth` — health map keyed by initiative ID

**UI State**
- `useCommandPalette` — palette open/close state, query, grouped actions, keyboard navigation
- `useStatusLine` — bottom status bar message queue with push, alert, and wipe operations
- `useRelayChannel` — WebSocket channel subscription for relay messages
- `useTheme` — dark/light theme preference with `localStorage` persistence

## SessionContext

`SessionContext` is the central state container for the session workspace. It is provided by `SessionProvider`, which is instantiated by `SessionWorkspace` with the session ID from the URL param.

Responsibilities:
- Fetches session, plans, and blocks from the API on mount and on explicit `refetch()`
- Maintains SSE connections for session events and plan version changes
- Delegates build lifecycle to `useBuildMonitor` when a run ID is active
- Exposes build control actions: `startBuild`, `pauseBuild`, `resumeBuild`, `cancelBuild`, `approveGate`, `rejectGate`, `answerQuestion`, `dismissQuestion`
- Provides `planRefreshKey`, `blockRefreshKey`, and `transcriptRefreshKey` for child components to trigger isolated re-fetches without full context re-renders

## Build Status Flow

```
User clicks "Start Build"
        │
        ▼
POST /api/forge-next/runs   ──→  returns runId
        │
        ▼
SessionContext stores activeRunId
        │
        ▼
useBuildMonitor opens SSE stream at /api/forge-next/runs/:runId/events
        │
        ▼
Events update step status, scores, stall flags, gates, questions, run metrics
        │
        ▼
SessionWorkspace merges buildSteps into plan steps for display
        │
        ▼
TreePanel renders merged steps with live status + quality indicators
```

Step status mapping from forge-next events to tree display:

| forge-next status | Tree display |
|-------------------|-------------|
| `pending` | pending (empty circle) |
| `running` | running (filled circle, pulsing) |
| `completed` | done (checkmark) |
| `failed` | failed (cross) |
| `skipped` | blocked (warning) |
| `retrying` | running |

## Development

```bash
npm run dev        # Dev server on port 3004
npm run build      # TypeScript compile + Vite build
npm run preview    # Preview production build
npm run test       # Run tests with Vitest (watch mode)
npm run test:run   # Run tests once (CI)
npm run typecheck  # Type checking only
```

Requires the backend server running on port 3001. All `/api` requests are proxied. WebSocket upgrades at `/ws/relay` are proxied to `ws://localhost:3001`.

SSE endpoints have buffering disabled in the Vite proxy (`x-accel-buffering: no`) to ensure real-time event delivery.

## Key Files

- `src/main.tsx` — entry point, mounts `BrowserRouter` + `App`
- `src/App.tsx` — route definitions, global `RelayProvider`, `CommandPalette`, `Toaster`
- `src/pages/SessionWorkspace.tsx` — session workspace page; owns layout and all cross-cutting wiring
- `src/pages/DashboardPage.tsx` — portfolio dashboard
- `src/contexts/SessionContext.tsx` — central session state provider
- `src/hooks/useBuildMonitor.ts` — SSE-driven build state machine
- `src/components/tree/TreePanel.tsx` — right panel with mode toggle, build banner, metrics
- `src/components/tree/ProjectTree.tsx` — zoomable scope/step tree
- `src/components/tree/StepNode.tsx` — compact step row with quality indicators
- `src/components/sheets/StepSheet.tsx` — step detail drawer
- `src/contexts/RelayContext.tsx` — shared relay WebSocket connection

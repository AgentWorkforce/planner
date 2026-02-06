# @plannr/forge-ui

Real-time execution monitoring dashboard for the Forge orchestration layer.

## Setup

```bash
# Install dependencies (from monorepo root)
npm install

# Start dev server (port 3003)
cd packages/forge-ui
npm run dev
```

The UI proxies API requests to `http://localhost:3001` (backend must be running).

## Routes

| Path | Component | Purpose |
|------|-----------|---------|
| `/forge` | `RunsListPage` | List all execution runs with filters |
| `/forge/runs/:runId` | `RunDashboardPage` | Live run dashboard with agents, tasks, timeline |
| `/forge/runs/:runId/timeline` | `TimelinePage` | Full timeline view with events export |
| `/forge/preflight/:planId` | `PreflightPage` | Pre-execution validation checks |

## Key Features

### Real-time Updates
- SSE event streams for run state changes
- WebSocket support for agent messaging
- Live agent status tracking
- Question/gate notifications with sound alerts

### Monitoring Components
- **Run Dashboard**: Progress bar, active agents, task list, artifact panel
- **Gates**: Human approval gates with blocking indicators
- **Questions**: Agent question queue with response UI
- **Timeline**: Event log with filtering and export
- **Artifacts**: File/PR outputs grouped by type

### Custom Hooks
- `useRunEvents` - SSE subscription for run updates
- `useRuns` / `useRun` - Run data fetching with status filtering
- `usePendingGates` - Gate notifications
- `useQuestions` - Question queue management
- `useActiveAgents` - Live agent tracking
- `useTimeline` - Event log with filtering
- `useArtifacts` - Artifact grouping and display

## Design System

Uses `@plannr/shared-ui` for components and theming. Follows Mission Control aesthetic (dark theme, neon accents).

## Scripts

```bash
npm run dev         # Start dev server (port 3003)
npm run build       # Production build
npm run preview     # Preview production build
npm run typecheck   # TypeScript validation
```

## Dependencies

- React 18 + React Router v7 for routing
- `@plannr/shared-ui` for shared components
- `@tanstack/react-virtual` for virtualized lists
- Radix UI primitives (Dialog, Tooltip, Separator)
- Tailwind CSS v4 for styling

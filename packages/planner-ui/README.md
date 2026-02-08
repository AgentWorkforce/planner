# Planner UI

React frontend for collaborative plan authoring and lifecycle management.

## Setup

```bash
npm install
npm run dev  # Starts on http://localhost:3000
```

Requires backend API running on port 3001.

## Key Features

- Plan authoring with AI-assisted refinement
- Multi-scope plan organization (repos, teams, domains)
- Real-time collaborative editing via WebSocket
- Step dependency visualization with drag-and-drop
- Approval workflow (draft → review → approved → published)
- Initiative grouping and portfolio views
- Command palette for keyboard-first navigation (Cmd+K)
- Change request handling from orchestrator
- Document import and context extraction
- Execution status overlay (read-only)

## Routes

| Path | Component | Description |
|------|-----------|-------------|
| `/plans` | PlansListPage | All plans with filtering/search |
| `/plans/my` | PlansListPage | User's plans |
| `/plans/new` | NewPlanPage | Create new plan |
| `/plans/:planId` | PlanEditorPage | Edit plan |
| `/plans/:planId/understanding` | PlanEditorPage | AI understanding view |
| `/plans/:planId/context` | PlanEditorPage | Context documents |
| `/plans/:planId/decisions` | PlanEditorPage | Decision log |
| `/initiatives` | InitiativesListPage | All initiatives |
| `/initiatives/:id` | InitiativeDetailPage | Initiative detail |
| `/pipeline` | PipelinePage | Execution pipeline |
| `/channels/:channelId` | ChannelPage | Plan channel messages |

## Key Components

**Plans**
- `PlanHeader` - Plan metadata and actions
- `WorkflowActions` - Submit/approve/publish buttons
- `TabNavigation` - Understanding/steps/context/decisions tabs
- `CollapsibleSection` - Expandable content sections
- `EditableText` - Inline text editing

**Steps**
- `DependencyIndicator` - Step dependencies with arrows
- `StepStatusIndicator` - Execution status badges
- `StepGateIndicator` - Approval gates
- `ExecutionProgress` - Progress bars

**Initiatives**
- `InitiativeCard` - Initiative summary with plan counts
- `InitiativeModal` - Create/edit initiative dialog
- `ColorPicker` - Initiative color selector
- `IconPicker` - Initiative icon selector

**Pipeline**
- `BoardView` - Kanban board visualization
- `SequenceView` - Sequential wave view
- `PipelinePlanCard` - Plan card in pipeline
- `DependencyArrow` - Plan dependency visualization

**Channels**
- `ChannelView` - Message list with real-time updates
- `MessageInput` - Send messages to plan channel
- `AgentAvatar` - Agent identity display

**UI Components**
- `CommandPalette` - Fuzzy search navigation
- `AttentionBadge` - Needs attention indicator
- `LoadingSpinner` - Loading states
- `ViewModeToggle` - Grid/list view toggle

## Key Hooks

**Plan Data**
- `usePlanEvents` - SSE subscription for plan updates
- `useAttentionPlans` - Plans needing attention
- `useRecentPlans` - Recently viewed plans
- `usePlansFilter` - Filter/search plans
- `useFuzzySearch` - Fuzzy text search

**Workflow**
- `useChangeRequests` - Change requests from orchestrator
- `useExecutionStatus` - Execution progress overlay
- `useQuestionNotifications` - AI questions requiring answers
- `useQuestionQueue` - Queue of pending questions

**AI/Agents**
- `useAIImprovements` - AI-suggested improvements
- `useAIConnectionStatus` - AI service health
- `useAgentOrchestration` - Agent spawning and coordination
- `usePresence` - User/agent presence in plan

**Relay/Messaging**
- `useRelayConnection` - WebSocket relay client
- `useActiveChannels` - Subscribed channels
- `useChannelMessages` - Messages in channel
- `useDmChannel` - Direct message channels

**UI State**
- `useCommandPalette` - Command palette state
- `usePlansViewMode` - Grid/list view preference
- `useSidebarState` - Sidebar collapse state
- `useScopeGroupExpansion` - Scope section expand/collapse
- `useTheme` - Dark/light theme

**Utilities**
- `useCurrentUser` - Current user identity
- `useTopologicalSort` - Dependency DAG sorting
- `useDependencyPositions` - Arrow position calculation
- `useUserTrajectory` - User's reasoning trajectory

## Contexts

- `RelayContext` - Shared WebSocket connection for all components
- `ToastContext` - Global toast notifications
- `PlanEditorContext` - Plan editor state (future)

## Design System

Uses Tailwind CSS v4 with custom color scales (`bg.deep`, `text.primary`) and shadcn/ui components. Matches relay-dashboard aesthetic. Dark mode default with OS preference support.

## Scripts

```bash
npm run dev        # Dev server (port 3000)
npm run build      # Production build
npm run preview    # Preview production build
npm run test       # Run tests with Vitest
npm run test:run   # Run tests once (CI)
npm run typecheck  # TypeScript type checking
```

## Architecture

- **@dnd-kit** for drag-and-drop step reordering
- **Fuse.js** for fuzzy search
- **Zod** schemas for API validation
- **SSE** for real-time plan updates
- **WebSocket** for agent messaging
- **Vite** for fast dev server and HMR

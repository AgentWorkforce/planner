# Planner-UI Building Blocks Map - START HERE

Complete guide to planner-ui's architecture for reuse in "tend" (three-column unified app).

---

## Documents in This Map

1. **planner-ui-building-blocks.md** (this collection)
   - Comprehensive inventory of all components, hooks, and patterns
   - Organized by feature area (layout, status bar, chat, messaging, editing, etc.)
   - Three-column column assignments (LEFT/CENTER/RIGHT/STATUS BAR/LAYOUT/SHARED)
   - Dependencies for each component
   - File paths and descriptions

2. **planner-ui-architecture.md**
   - Component tree and nesting hierarchy
   - Data flow diagrams for key features
   - State persistence patterns (localStorage, URL, context, memory)
   - Real-time update flows (SSE, WebSocket)
   - Key data shapes (Step, Question, Agent, RelayMessage)

3. **planner-ui-hooks-reference.md**
   - All custom hooks with signatures
   - Usage examples
   - Dependencies and return types
   - Common patterns (conditional polling, SSE, localStorage, subscriptions)

---

## Quick Navigation by Use Case

### "I need a component for..."

**Chat & Questions**
- NewChat bubble → ChatBubble
- Question queue (large) → TriagePanel
- Question notification → QuestionNotificationContent
- Send/receive messages → MessageStream + MessageInput
- Full chat page → ChannelView

**Plan Editing**
- Inline edit step → StepEditor
- View plan summary → PlanCard
- Edit step title → EditableText
- Show dependencies → DependencyIndicator
- Visualize steps → SwimlaneView
- List view of steps → StepEditor[]
- Full editor page → PlanEditorPage + PlanTabContent

**Navigation**
- Left sidebar → AppSidebar
- Initiative item → InitiativeCollapsible
- Command palette (search) → CommandPalette
- Status bar (bottom) → StatusBar
- Right messaging sidebar → MessagingSidebar

**Attention/Alerts**
- List of plans needing action → NeedsAttentionSection
- Individual attention item → AttentionItem
- Status badge → AttentionBadge

**Initialization & Setup**
- Plan list → PlansListPage
- Initiative list → InitiativesListPage
- Plan browser → PlansListPage + PlanTable
- Pipeline view → PipelinePage

---

## Key Architectural Decisions

### 1. Single Shared WebSocket (RelayContext)
- **One connection** for entire app, not per-component
- Prevents user registration churn
- All components access via `useRelay()` hook
- Graceful fallback to mock mode if relay unavailable

### 2. Plan Editor as Central Context
- **PlanEditorContext** manages all editing state
- Real-time sync via SSE (Server-Sent Events)
- Debounced refetch (250ms) batches updates
- Optimistic updates for snappy UX
- All nested components (steps, specs, criteria) share context

### 3. Persistent State Strategy
- **localStorage**: Sidebar collapse, view mode, theme, recent plans
- **URL params**: Plan filters, active plan ID, view mode
- **React Context**: Transient state (current step, active panel, hover state)
- **Memory (useState)**: Temporary UI state

### 4. Question Routing Pipeline
- **useQuestionQueue**: SSE polling (plan-specific)
- **useQuestionNotifications**: Auto-advance bubble (5s default)
- **TriagePanel**: Queue when > 5 questions
- **ChatBubble**: Modal for answering
- **StatusBar badge**: Always-visible pending count

### 5. Real-Time Sync (SSE + Polling)
- Plan changes: SSE events + debounced refetch
- Questions: Polling every 30 seconds
- Agents: Polling every 5 seconds
- Presence (who's in channel): Relay events
- Messages: Relay WebSocket

### 6. Multi-Scope as Default
- Steps grouped by scope (swimlane layout)
- Dependency visualization across scopes
- Scope picker in step editor
- Cross-scope dependencies highlighted

---

## Core Patterns You'll Reuse

### Inline Editing Pattern
```typescript
// EditableText, EditableTextarea
// User: click → edit → Enter to save → API call → optimistic update
<EditableText
  value={step.title}
  onChange={(newValue) => context.handleStepUpdate(step.step_id, { title: newValue })}
  disabled={isLocked}
/>
```

### Real-Time Sync Pattern
```typescript
// PlanEditorContext
const { isEventStreamConnected } = usePlanEvents(planId);

// On SSE event: debounce 250ms, then refetch
useEffect(() => {
  if (isEventStreamConnected) {
    // Refetch plan data
    const plan = await getPlan(planId);
    setVersion(plan.version);
  }
}, [isEventStreamConnected]);
```

### Persistent State Pattern
```typescript
// usePlansViewMode, useSidebarState, useTheme
const [viewMode, setViewMode] = useState(() => {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored || 'list';
});

useEffect(() => {
  localStorage.setItem(STORAGE_KEY, viewMode);
}, [viewMode]);
```

### Shared Connection Pattern
```typescript
// RelayProvider wraps entire app
// All components use:
const { connection, isConnected } = useRelay();

// No per-component connections!
```

### Attention Grouping Pattern
```typescript
// NeedsAttentionSection
const grouped = groupAndSortPlans(plans);
// Groups by urgency:
// 1. execution_failed (red)
// 2. change_request, gate_pending, awaiting_approval (orange)
// 3. stale_draft, unread_comments (gray)
```

### Step Visualization Pattern
```typescript
// SwimlaneView
const sorted = useTopologicalSort(steps);
// Renders swimlanes by scope, steps left-to-right by dependency depth
// DependencyLinesOverlay draws SVG connections
// Responsive to scroll + DOM changes
```

---

## Three-Column Model Mapping

### LEFT (The Now) - Forming, Creative Space
Components for capturing and responding to immediate needs:
- **NeedsAttentionSection** - Plans requiring action
- **AttentionItem** - Individual plan card
- **TriagePanel** - Question queue
- **ChatBubble** - Answer question
- **QuestionNotificationContent** - Notification bubble
- Could add: WorkingOnSection, SessionPhysicsBlock (from ideation-ui)

**State**: Persisted (localStorage)
**Updates**: SSE for new questions, polling for agent status
**Interactions**: Click to open plan, answer questions, dismiss FYI

### CENTER (Conversation) - Chat & Messaging
Components for real-time communication with agents:
- **MessagingSidebar** - Channel/DM interface
- **ChannelView** - Full-page channel view
- **MessageStream** - Message history
- **MessageInput** - Send messages
- **RelayContext** - WebSocket connection (infrastructure)
- **useRelay(), useChannels(), useChannelMessages(), usePresence()** - Hooks

**State**: Ephemeral (WebSocket)
**Updates**: Relay WebSocket events (real-time)
**Interactions**: Type and send messages, see presence, join/leave channels

### RIGHT (The Tree) - Plan Structure & Steps
Components for viewing and editing plans:
- **PlanEditorPage** - Main editor container
- **PlanTabContent** - Plan steps view
- **StepEditor** - Individual step card
- **SwimlaneView** - Swimlane layout
- **DependencyIndicator** - Dependency visualization
- **DependencyLinesOverlay** - SVG connecting lines
- **StepSpecificationTabs** - Domain-specific specs
- **AcceptanceCriteriaSection**, **DependenciesSection**, **ApprovalGateSection** - Step details
- **PlansListPage**, **PlanCard**, **PlanTable** - Plan browser
- **InitiativesListPage**, **InitiativeCard** - Initiative browser
- **PipelinePage** - Execution board view

**State**: Persistent (localStorage for view mode, context for editing)
**Updates**: SSE for plan changes, API calls for mutations, context for local state
**Interactions**: Click/hover steps, edit inline, expand sections, toggle views

### STATUS BAR - Agent Status & Indicators
Components for ambient awareness of orchestration:
- **StatusBar** - Fixed bottom bar
- **AgentAvatar** - Agent state + activity
- **AgentActivityDot**, **AgentActivityPopover** - Agent details
- **useAgentOrchestration** - Agent data (polling)
- **useQuestionNotifications** - Notification state

**State**: Transient (question count updates)
**Updates**: Polling for agent status, SSE for new questions
**Interactions**: Click agent avatar (DM or show pending question), click pending badge (open triage)

### LAYOUT - Navigation & Structure
Components for app shell and routing:
- **Layout** - Main application shell
- **AppSidebar** - Left navigation
- **InitiativeCollapsible** - Initiative item in sidebar
- **CommandPalette** - Cmd+K search
- **SidebarProvider** - Sidebar state management
- **useCommandPalette**, **useRecentPlans**, **useSidebarState**, **useTheme** - Layout state

**State**: Persistent (localStorage for collapsed/expanded/theme)
**Updates**: User interactions (click nav items, toggle sidebar)
**Interactions**: Navigate pages, search, toggle theme, expand initiatives

### SHARED - Used Everywhere
Components and utilities used across all columns:
- **Form controls** (Badge, Button, Input, Checkbox, Radio, Select, Toggle)
- **Layout primitives** (Tooltip, Separator, Skeleton, Sidebar components)
- **Editing utilities** (EditableText, EditableTextarea)
- **Icons** (40+ custom SVG icons for roles, actions, statuses)
- **useCurrentUser** - User identity
- **useFuzzySearch** - Search algorithm
- **Utility functions** - Time formatting, scope grouping, attention types

---

## Critical Integration Points

### 1. RelayProvider (WebSocket)
**Location**: App.tsx (wraps entire app)
**Provides**: useRelay() hook for all messaging
**Critical**: Must be initialized before any messaging component
**Fallback**: Mock mode if relay unavailable

### 2. PlanEditorContext (Plan State)
**Location**: PlanEditorPage (wraps editor)
**Provides**: usePlanEditor() hook for all step editing
**Critical**: Manages all editing state, mutations, real-time sync
**Fallback**: API calls directly if context unavailable (not recommended)

### 3. Router Outlet (Page Content)
**Location**: Layout (SidebarInset)
**Provides**: Dynamic page rendering based on URL
**Critical**: All pages mount/unmount based on route
**State preservation**: URL params + React Router state for breadcrumbs

### 4. useQuestionQueue + useQuestionNotifications
**Location**: Layout
**Provides**: Question detection + notification flow
**Critical**: Watches for new questions, routes through triage panel → chat bubble
**Fallback**: No UI if hook doesn't connect (silent failure)

### 5. usePlanEvents (SSE)
**Location**: PlanEditorContext
**Provides**: Real-time plan updates
**Critical**: Keeps plan in sync across tabs/users
**Fallback**: Manual refetch on demand, no SSE

---

## Performance Optimizations Already in Place

1. **Memoization**: useMemo for swimlane sort, dependency resolution, grouped plans
2. **Debouncing**: 250ms debounce on plan refetch to batch updates
3. **Event subscription cleanup**: All hooks unsubscribe on unmount
4. **Lazy rendering**: Scrollable lists don't render off-screen items
5. **CSS containment**: Swimlane lanes use CSS contain: layout
6. **Image optimization**: SVG icons only, no large images
7. **Code splitting**: Page components loaded on route match

**Avoid**: Creating multiple WebSocket connections, polling at < 1s intervals, rendering entire step lists at once

---

## Known Limitations

1. **Sub-plans**: Max 3 levels nesting recommended
2. **Comments**: Basic thread UI, no reactions/editing
3. **Specifications**: Manual domain selection; could auto-detect
4. **DM channels**: Interface exists but creation not fully implemented
5. **Pipeline**: Board/sequence read-only; no drag-drop reordering
6. **Approval gates**: Simple approve/reject; no conditional branching
7. **Search**: Fuzzy search on plan names only; could extend to steps/tags
8. **Mobile**: Sidebar drawer works, but editor not fully mobile-optimized

---

## Recommended Reuse Strategy for "Tend"

### Phase 1: Core Components (Reuse As-Is)
- CommandPalette + useFuzzySearch
- Badge, Button, Input (form controls)
- Icon set (40+ SVG icons)
- EditableText, EditableTextarea
- CollapsibleSection

### Phase 2: Integration (Adapt Structure)
- RelayContext/useRelay (WebSocket infrastructure is same)
- useChannels, useChannelMessages, usePresence (hook pattern reusable)
- MessagingSidebar (cosmetic layout changes)
- StatusBar (same agent tracking, different layout)

### Phase 3: New Implementation (Inspired By)
- LEFT column (questions/forming): Reuse question types, invent UI
- CENTER column (conversation): Reuse relay hooks, build new chat UI
- RIGHT column (plan structure): Reuse step editor pieces, rebuild swimlane
- Three-column grid layout (learn from Layout.tsx but redesign)

### Phase 4: Shared Services (Extract)
- Question routing pipeline (useQuestionQueue pattern)
- Real-time sync strategy (SSE + debounce pattern)
- State persistence (localStorage key management)
- Relay integration (connection lifecycle)

---

## File Reading Order

**For high-level understanding:**
1. This document (overview)
2. planner-ui-architecture.md (component tree + data flow)
3. planner-ui-building-blocks.md (component catalog)

**For implementation details:**
1. planner-ui-hooks-reference.md (hook signatures + patterns)
2. Individual component files in src/components/ (actual code)
3. Individual hook files in src/hooks/ (actual implementation)

**For specific features:**
- **Chat**: ChatBubble.tsx, TriagePanel.tsx, useQuestionQueue.ts, useQuestionNotifications.ts
- **Messaging**: MessagingSidebar.tsx, useRelay.ts, useChannels.ts, useChannelMessages.ts
- **Editing**: StepEditor.tsx, PlanEditorContext.tsx, StepSpecificationTabs.tsx
- **Visualization**: SwimlaneView.tsx, DependencyLinesOverlay.tsx, useTopologicalSort.ts
- **Navigation**: AppSidebar.tsx, CommandPalette.tsx, Layout.tsx

---

## Questions to Answer Before Reusing

1. **Do we reuse the API contracts?**
   - Same plan/step/question schemas? Same endpoints?
   - If yes: hooks reuse, components adapt
   - If no: rewrite hooks, components reuse patterns

2. **Do we keep the three-tier architecture (Intake → Planner → Orchestrator)?**
   - If yes: same SSE/relay patterns apply
   - If no: adapt real-time update strategy

3. **Do we use the same Relay for agent messaging?**
   - If yes: reuse RelayContext as-is
   - If no: build new messaging service, reuse UI patterns

4. **Do we need question routing?**
   - If yes: useQuestionQueue pattern applies
   - If no: skip triage panel, keep attention section

5. **Do we need multi-scope plans?**
   - If yes: swimlane view, scope grouping stay
   - If no: simplify to flat step list

---

## Summary Table: Component Reuse Matrix

| Component | Reuse As-Is | Adapt Structure | Learn Pattern | Skip |
|-----------|-------------|-----------------|---------------|------|
| CommandPalette | ✅ | | | |
| Badge, Button, Input | ✅ | | | |
| Icon set | ✅ | | | |
| EditableText | ✅ | | | |
| ChatBubble | | ✅ | | |
| TriagePanel | | ✅ | | |
| MessagingSidebar | | ✅ | | |
| StatusBar | | ✅ | | |
| StepEditor | | ✅ | | |
| SwimlaneView | | | ✅ | (if no swimlanes) |
| PlanCard | | ✅ | | |
| PlansListPage | | ✅ | | |
| AppSidebar | | ✅ | | |
| Layout | | | ✅ | (redesign for 3-col) |
| RelayContext | ✅ | | | |
| useQuestionQueue | | ✅ | | (if no questions) |
| useRelay | ✅ | | | |
| useChannels | ✅ | | | |
| usePlanEvents | ✅ | | | |
| PlanEditorContext | | | ✅ | (design new state mgmt) |

---

## Next Steps

1. Read **planner-ui-architecture.md** for data flow understanding
2. Review specific components/hooks for your use case
3. Set up test environment (vitest + @testing-library/react)
4. Extract components incrementally (avoid monolithic refactor)
5. Test against your new API contracts before full integration
6. Keep Relay + RelayContext as-is (proven stable)
7. Adapt UI layer to three-column model
8. Preserve question routing pipeline (works well)


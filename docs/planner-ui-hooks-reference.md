# Planner-UI Hooks Reference

Quick reference for all custom hooks and their usage patterns.

---

## Core Hooks (Context-Based)

### useRelay()
**File**: RelayContext.tsx (hook exported from context)
**Dependencies**: RelayProvider (must wrap component)
**Purpose**: Access shared WebSocket connection for relay messaging

```typescript
const { connection, isConnected, userId, displayName, isMock } = useRelay();

// connection methods:
connection.joinChannel(channelId);
connection.leaveChannel(channelId);
connection.sendChannelMessage(channelId, content, data?);
connection.sendDirectMessage(to, content, data?);

// event subscriptions:
const unsubscribe = connection.onChannelMessage((msg) => {
  console.log('New message:', msg.content);
});
```

**Returns**:
```typescript
{
  connection: UseRelayConnectionResult;
  isConnected: boolean;
  userId: string | null;
  displayName: string;
  isMock: boolean; // true if relay daemon unavailable
}
```

### usePlanEditor()
**File**: PlanEditorContext.tsx
**Dependencies**: PlanEditorProvider (must wrap component)
**Purpose**: Access plan editing state and mutations

```typescript
const {
  plan,
  version,
  loading,
  error,
  selectedStep,
  setSelectedStep,
  expandedStepId,
  setExpandedStepId,
  viewMode,
  setViewMode,
  activePanel,
  setActivePanel,
  commentStepId,
  comments,
  handleStepUpdate,
  handleStepDelete,
  handleGoalUpdate,
  handleWorkflowSubmit,
  handleWorkflowApprove,
  handleWorkflowPublish,
  isEventStreamConnected,
  currentUser,
} = usePlanEditor();

// Update a step
await handleStepUpdate(stepId, { title: 'New title' });

// Delete a step
await handleStepDelete(stepId);

// Submit plan for review
await handleWorkflowSubmit();

// Approve (lock editing)
await handleWorkflowApprove(approverRole);

// Publish (release to orchestrator)
await handleWorkflowPublish();
```

**Returns**: Full plan editing context value (see PlanEditorContextValue interface)

### useToast()
**File**: ToastContext.tsx
**Dependencies**: ToastProvider (must wrap component)
**Purpose**: Show toast notifications

```typescript
const toast = useToast();

toast.success('Plan saved!');
toast.error('Failed to save plan');
toast.info('Processing...');
toast.warning('This action cannot be undone');

// With options:
toast.success('Copied!', { duration: 2000 });
```

---

## Real-Time & Messaging Hooks

### useRelayConnection()
**File**: hooks/useRelayConnection.ts
**No dependencies** (creates its own WebSocket)
**Purpose**: Manage WebSocket lifecycle to relay proxy

```typescript
const connection = useRelayConnection(
  displayName: string,
  autoConnect: boolean = true,
  requestedUserId?: string
);

// State
connection.state; // 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error'
connection.isConnected; // boolean shortcut
connection.isMock; // true if relay unavailable
connection.userId; // assigned by server
connection.error; // error message if any

// Methods
connection.joinChannel(channelId);
connection.leaveChannel(channelId);
connection.sendChannelMessage(channelId, content, data?);
connection.sendDirectMessage(to, content, data?);
connection.reconnect();

// Subscriptions
const unsub = connection.onChannelMessage((msg) => {});
const unsub = connection.onMessage((msg) => {}); // direct messages
const unsub = connection.onJoined((channelId, members) => {});
const unsub = connection.onLeft((channelId) => {});
const unsub = connection.onPresenceUpdate((channelId, members) => {});
```

**Note**: Used internally by RelayContext. Most components should use useRelay() instead.

### useChannels()
**File**: hooks/useChannels.ts
**Dependencies**: connection from useRelayConnection or useRelay()
**Purpose**: Manage channel list and membership

```typescript
const { channels, joinedChannels, join, leave, loading, error } = useChannels(
  connection,
  planId?: string // auto-joins #plan-{planId}
);

// channels: Channel[] = [{ id, name, displayName, type }]
// joinedChannels: Set<string> = set of channel IDs we've joined
// join(channelId), leave(channelId)

// Usage:
const isJoined = channels.joinedChannels.has(channelId);
if (!isJoined) channels.join(channelId);
```

### useChannelMessages()
**File**: hooks/useChannelMessages.ts
**Dependencies**: connection, channelId (can be null)
**Purpose**: Subscribe to messages in a channel

```typescript
const { messages, loading, error } = useChannelMessages(
  connection,
  channelId: string | null
);

// messages: RelayMessage[] (sorted by timestamp, newest last)
// Auto-fetches history when channelId changes
// Auto-subscribes to new messages via onChannelMessage
```

### usePresence()
**File**: hooks/usePresence.ts
**Dependencies**: connection, channelId (can be null)
**Purpose**: Track who's in a channel

```typescript
const { members, loading } = usePresence(
  connection,
  channelId: string | null
);

// members: PresenceEntry[] = [{ userId, displayName, lastSeen }]
// Updates on joined/left/presence events
```

### useActiveChannels()
**File**: hooks/useActiveChannels.ts
**Dependencies**: RelayProvider (accesses relay internally)
**Purpose**: List channels currently joined

```typescript
const { activeChannels, isLoading } = useActiveChannels();

// activeChannels: Channel[] (only channels we've joined)
// Used in AppSidebar to show active channels
```

### useDmChannel()
**File**: hooks/useDmChannel.ts
**Dependencies**: RelayProvider
**Purpose**: Create or join a DM channel with an agent

```typescript
const { openDm } = useDmChannel();

const channelId = await openDm(agentId, agentName);
// Returns: #dm-{userId}-{agentId}
```

---

## Question & Orchestration Hooks

### useQuestionQueue()
**File**: hooks/useQuestionQueue.ts
**Dependencies**: None (uses API + SSE)
**Purpose**: Poll for questions pending answer for a plan

```typescript
const {
  questions,
  currentQuestion,
  loading,
  error,
  answer,
  dismiss,
} = useQuestionQueue(
  planId: string | undefined,
  options?: {
    pollInterval?: number; // default 30s
  }
);

// questions: Question[] = all pending questions
// currentQuestion: Question | null = first one (highest priority)

// answer(questionId, answerText) → POST /api/plans/{planId}/questions/{id}/answer
await answer(questionId, 'User provided answer');

// dismiss(questionId) → POST /api/plans/{planId}/questions/{id}/dismiss
await dismiss(questionId);
```

### useQuestionNotifications()
**File**: hooks/useQuestionNotifications.ts
**Dependencies**: None
**Purpose**: Manage notification bubble queue (auto-advance with delay)

```typescript
const {
  currentNotification,
  dismiss,
  addToQueue,
} = useQuestionNotifications({
  autoAdvanceDelay: 5000, // ms before auto-advance to next
  onNotificationClick?: (notification) => void,
});

// currentNotification: QuestionNotification | null
// = { question: Question, agentId: string }

// dismiss() → Hide current notification
dismiss();

// addToQueue(question) → Add question to notification queue
addToQueue(question);
```

**Pattern**: Layout uses useQuestionQueue + useQuestionNotifications together:
1. useQuestionQueue watches for new questions (SSE polling)
2. useEffect compares with previous question IDs
3. New questions added to notification queue via addToQueue
4. Notification auto-advances after delay
5. User can dismiss or click to open ChatBubble

### useAgentOrchestration()
**File**: hooks/useAgentOrchestration.ts
**Dependencies**: None (uses API polling)
**Purpose**: Track active agents and orchestration state

```typescript
const {
  agents,
  pendingQuestions,
  resolvedDecisions,
  sessionDuration,
  loading,
  error,
  refetch,
} = useAgentOrchestration(
  planId?: string,
  options?: {
    pollInterval?: number; // default 5s (or 30s if no plan)
  }
);

// agents: Agent[] = active agents with state/role/activity
// Agent = {
//   id: string;
//   role: string;
//   displayName?: string;
//   state: 'idle' | 'working' | 'needs_input' | 'error';
//   currentActivity?: string;
//   currentStep?: string;
//   currentThought?: string;
// }

// pendingQuestions: number
// resolvedDecisions: number
// sessionDuration: number (seconds)
```

**Usage**: StatusBar displays agent avatars + counts

---

## State Management Hooks

### usePlansViewMode()
**File**: hooks/usePlansViewMode.ts
**Purpose**: Toggle between list and grouped-by-scope views

```typescript
const { viewMode, setViewMode } = usePlansViewMode();

// viewMode: 'list' | 'grouped'
// Persisted to localStorage

setViewMode('grouped');
```

### useAttentionPlans()
**File**: hooks/useAttentionPlans.ts
**Purpose**: Fetch plans requiring attention

```typescript
const { plans, loading, error } = useAttentionPlans();

// plans: PlanSummary[] (filtered by attention type)
// Types: execution_failed, change_request, gate_pending, awaiting_approval, stale_draft, unread_comments
```

### useRecentPlans()
**File**: hooks/useRecentPlans.ts
**Purpose**: Track recently viewed plan IDs

```typescript
const { recentPlanIds, addRecent } = useRecentPlans();

// recentPlanIds: string[] (max 10, ordered by recency)
// Persisted to localStorage

addRecent(planId); // Add to recent list
```

### useSidebarState()
**File**: hooks/useSidebarState.ts
**Purpose**: Track which initiatives are expanded in sidebar

```typescript
const {
  isInitiativeExpanded,
  toggleInitiativeExpanded,
} = useSidebarState();

// isInitiativeExpanded(initiativeId) → boolean
// toggleInitiativeExpanded(initiativeId) → void
// Persisted to localStorage
```

### useTheme()
**File**: hooks/useTheme.ts
**Purpose**: Manage dark/light theme

```typescript
const { effectiveTheme, toggleTheme, theme, setTheme } = useTheme();

// effectiveTheme: 'dark' | 'light' (resolved from system preference)
// theme: 'dark' | 'light' | 'system'
// Persisted to localStorage

toggleTheme(); // Toggle between dark and light
setTheme('dark'); // Set explicitly
```

### useScopeGroupExpansion()
**File**: hooks/useScopeGroupExpansion.ts
**Purpose**: Track which scope groups are expanded in swimlane view

```typescript
const {
  isExpanded,
  toggleScope,
  setExpanded,
} = useScopeGroupExpansion();

// isExpanded(scope) → boolean
// toggleScope(scope) → void
// setExpanded(scopes: string[]) → void (all at once)
// Persisted to localStorage
```

### usePlansFilter()
**File**: hooks/usePlansFilter.ts
**Purpose**: Manage plan list filters

```typescript
const {
  filters,
  setFilters,
  clearFilters,
} = usePlansFilter();

// filters: PlansFilter = {
//   owner?: string;
//   initiative?: string;
//   status?: PlanStatus;
//   search?: string;
// }
// Persisted to URL query params

setFilters({ owner: 'me', status: 'draft' });
clearFilters();
```

### useCommandPalette()
**File**: hooks/useCommandPalette.ts
**Purpose**: Global command palette state

```typescript
const { isOpen, open, close, toggle } = useCommandPalette();

// isOpen: boolean
// Methods: open(), close(), toggle()
// Keyboard shortcut: Cmd+K
```

---

## Data Fetching Hooks

### useFuzzySearch()
**File**: hooks/useFuzzySearch.ts
**Purpose**: Fuzzy string matching for search

```typescript
const { results, search } = useFuzzySearch(plans);

// results: FuzzySearchResult[] = [
//   { item: Plan, score: number, indices: number[] }
// ]

results = search('auth'); // Search by plan goal
```

### useCurrentUser()
**File**: hooks/useCurrentUser.ts
**Purpose**: Get current authenticated user (stub for dev)

```typescript
const currentUser = useCurrentUser();

// currentUser: CurrentUser | null = {
//   user_id: string;
//   name: string;
//   email?: string;
// }
// null = anonymous user

// Used by RelayProvider to determine display name + user ID
```

### useInitiatives()
**File**: hooks/useInitiatives.ts
**Purpose**: Fetch all initiatives

```typescript
const { initiatives, loading, error, refresh, invalidate } = useInitiatives();

// initiatives: Initiative[] with nested plans
// refresh() → Refetch
// invalidate() → Clear cache + refetch on next use

// Used by AppSidebar to show initiative list
```

### useInitiative()
**File**: hooks/useInitiative.ts
**Purpose**: Fetch a specific initiative

```typescript
const { initiative, loading, error, refetch } = useInitiative(initiativeId);

// initiative: Initiative | null
// Used by InitiativeDetailPage
```

### usePipelinePlans()
**File**: hooks/usePipelinePlans.ts
**Purpose**: Fetch plans for pipeline view (grouped by execution status)

```typescript
const { plans, waves, loading, error } = usePipelinePlans(
  initiativeId?: string
);

// plans: PlanSummary[] with execution_status
// waves: ExecutionWave[] (grouping by status)
// Used by PipelinePage
```

### usePlanEvents()
**File**: hooks/usePlanEvents.ts
**Purpose**: Subscribe to plan change events (SSE)

```typescript
const {
  isConnected,
  error,
  events,
  refetch,
} = usePlanEvents(planId: string | undefined);

// events: PlanChangeEvent[] = [
//   { type: 'updated', plan_id, version, timestamp }
// ]
// SSE: GET /api/plans/{planId}/events
// Reconnection: exponential backoff

// Used by PlanEditorContext for real-time sync
```

### useChangeRequests()
**File**: hooks/useChangeRequests.ts
**Purpose**: Fetch change requests for a plan

```typescript
const { changeRequests, loading, approve } = useChangeRequests(planId);

// changeRequests: ChangeRequest[]
// approve(changeRequestId) → POST to approve
```

### useExecutionStatus()
**File**: hooks/useExecutionStatus.ts
**Purpose**: Fetch execution status for a plan's run

```typescript
const { status, stepStatuses, loading } = useExecutionStatus(planId);

// status: 'pending' | 'in_progress' | 'completed' | 'failed'
// stepStatuses: Map<stepId, status>
```

### useAIImprovements()
**File**: hooks/useAIImprovements.ts
**Purpose**: Fetch AI-suggested improvements for a plan

```typescript
const { improvements, loading, accept, dismiss } = useAIImprovements(planId);

// improvements: Improvement[] = [
//   { id, type: 'add_step' | 'refine_scope' | 'clarify_acceptance', suggestion }
// ]
// accept(id) → Apply improvement
// dismiss(id) → Ignore suggestion
```

### useAIConnectionStatus()
**File**: hooks/useAIConnectionStatus.ts
**Purpose**: Check if AI/Anthropic API is available

```typescript
const { status, error } = useAIConnectionStatus();

// status: 'connected' | 'disconnected' | 'checking'
// error: string | null
// Used by AIConnectionBadge in header
```

---

## Layout & Navigation Hooks

### useTopologicalSort()
**File**: hooks/useTopologicalSort.ts
**Purpose**: Order steps by dependency graph (left-to-right in swimlane)

```typescript
const { sorted, depth, incomingCount } = useTopologicalSort(steps);

// sorted: Step[] (left-to-right by dependency depth)
// depth: Map<stepId, depthLevel>
// incomingCount: Map<stepId, incomingEdgeCount>
// Uses Kahn's algorithm for acyclic topological sort
```

### useDependencyPositions()
**File**: hooks/useDependencyPositions.ts
**Purpose**: Calculate DOM positions of steps (for dependency line drawing)

```typescript
const positions = useDependencyPositions(
  stepsContainerRef,
  steps,
  highlightedStepId
);

// positions: Map<stepId, { top, left, right, bottom }>
// Used by DependencyLinesOverlay to draw SVG connecting lines
```

---

## Utility Hooks

### useUserTrajectory()
**File**: hooks/useUserTrajectory.ts
**Purpose**: Track user decisions for trajectories (planning history)

```typescript
const { trajectory, recordDecision } = useUserTrajectory();

// trajectory: TrajectoryEvent[]
// recordDecision(event) → Log user choice for analysis
```

### use-mobile (from shadcn)
**File**: hooks/use-mobile.tsx
**Purpose**: Detect if viewing on mobile device

```typescript
const isMobile = useIsMobile(); // boolean

// Breakpoint: 768px (md)
```

---

## Hook Dependency Graph

```
RelayProvider (app root)
│
├─ useRelay()
│  ├─ useChannels()
│  ├─ useChannelMessages()
│  ├─ usePresence()
│  ├─ useActiveChannels()
│  └─ useDmChannel()
│
└─ useRelayConnection() (internal)
   ├─ WebSocket lifecycle
   └─ Event subscriptions
       ├─ onMessage
       ├─ onChannelMessage
       ├─ onJoined
       ├─ onLeft
       └─ onPresenceUpdate

ToastProvider (app root)
│
└─ useToast()
   └─ Show notifications

SidebarProvider (Layout root)
│
├─ useSidebar() (shadcn internal)
├─ useInitiatives()
├─ useActiveChannels()
├─ useSidebarState()
├─ useTheme()
└─ AppSidebar

PlanEditorProvider (PlanEditorPage root)
│
├─ usePlanEditor()
│  ├─ usePlanEvents() (SSE)
│  ├─ useCurrentUser()
│  └─ getPlan() (API)
│
└─ PlanEditorContent
   ├─ StepEditor[] (uses context)
   ├─ SwimlaneView
   │  ├─ useTopologicalSort()
   │  └─ useDependencyPositions()
   └─ MessagingSidebar
      ├─ useRelay()
      ├─ useChannels()
      ├─ useChannelMessages()
      └─ usePresence()

Layout
│
├─ useCommandPalette()
├─ useRecentPlans()
├─ useAgentOrchestration()
├─ useQuestionQueue()
├─ useQuestionNotifications()
├─ useDmChannel()
└─ useRelayConnection() (via RelayProvider)

PlansListPage
│
├─ usePlansFilter()
├─ usePlansViewMode()
├─ useFuzzySearch()
└─ useAttentionPlans()

InitiativesListPage
│
└─ useInitiatives()

PipelinePage
│
├─ usePipelinePlans()
├─ useAttentionPlans()
└─ (board/sequence views)

PlanCard
│
├─ useCurrentUser()
└─ formatRelativeTime()

StatusBar
│
├─ useAgentOrchestration() [data source]
└─ useQuestionNotifications() [data source]
```

---

## Common Hook Patterns

### Pattern 1: Conditional Polling
```typescript
const { questions, answer, dismiss } = useQuestionQueue(
  planId || undefined,
  { pollInterval: 30000 }
);
// Only polls if planId is defined
// Stops polling if planId becomes undefined
```

### Pattern 2: SSE + Debounced Refetch
```typescript
const { isConnected } = usePlanEvents(planId);

useEffect(() => {
  if (isConnected) {
    const timeout = setTimeout(() => refetchPlan(), 250);
    return () => clearTimeout(timeout);
  }
}, [isConnected]);
// Batches rapid updates with 250ms debounce
```

### Pattern 3: localStorage Persistence
```typescript
const { viewMode, setViewMode } = usePlansViewMode();
// Internally:
// - Read from localStorage on mount
// - Save to localStorage on change
// - Survives page reload
```

### Pattern 4: Subscription Cleanup
```typescript
useEffect(() => {
  const unsub = connection.onChannelMessage((msg) => {
    console.log(msg);
  });
  return () => unsub(); // Clean up on unmount
}, [connection]);
```

### Pattern 5: URL State
```typescript
const { filters, setFilters } = usePlansFilter();
// Internally:
// - Read from URL query params
// - Update URL on filter change
// - Shareable links
// - Browser back/forward button support
```

---

## Hook Testing Patterns

All hooks can be tested with standard React Testing Library + Vitest:

```typescript
// useQuestionQueue test
test('useQuestionQueue polls for questions', async () => {
  const { result } = renderHook(() => useQuestionQueue('plan-123'));

  await waitFor(() => {
    expect(result.current.questions).toHaveLength(1);
  });
});

// useCommandPalette test
test('useCommandPalette toggles state', () => {
  const { result } = renderHook(() => useCommandPalette());

  expect(result.current.isOpen).toBe(false);

  act(() => result.current.open());
  expect(result.current.isOpen).toBe(true);
});

// useRelay test (with mocked WebSocket)
test('useRelay connects and sends messages', () => {
  const { result } = renderHook(() => useRelay(), {
    wrapper: RelayProvider,
  });

  act(() => {
    result.current.connection.sendChannelMessage('general', 'Hello!');
  });

  expect(result.current.isConnected).toBe(true); // or mocked state
});
```


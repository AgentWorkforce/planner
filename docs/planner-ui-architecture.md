# Planner-UI Component Tree & Data Flow

Visual architecture of how planner-ui components nest and share state.

---

## Application Root

```
App.tsx
├── BrowserRouter
│   └── ToastProvider (toast notifications)
│       └── RelayProvider (single shared WebSocket connection)
│           └── Routes
│               └── Layout (main shell)
│                   ├── SidebarProvider (shadcn sidebar state)
│                   │   └── AppSidebar (left navigation)
│                   │       ├── Header (logo + toggle)
│                   │       ├── SidebarContent
│                   │       │   ├── SidebarGroup (quick actions: new plan, search)
│                   │       │   ├── SidebarGroup (navigation: initiatives, plans, pipeline)
│                   │       │   ├── SidebarGroup (active channels)
│                   │       │   │   └── ChannelIcon links
│                   │       │   └── SidebarGroup (initiatives)
│                   │       │       └── InitiativeCollapsible (repeats for each)
│                   │       │           └── Nested plan links
│                   │       └── SidebarFooter (theme toggle, settings)
│                   │
│                   ├── SidebarInset
│                   │   ├── header (mobile menu trigger)
│                   │   └── main (flex container for Outlet)
│                   │       └── <Outlet /> (page content)
│                   │
│                   ├── CommandPalette
│                   │   └── FuzzySearch(plans)
│                   │
│                   ├── TriagePanel (conditional: isOpen && !selectedQuestion)
│                   │   └── QueueItem[] (list of questions)
│                   │
│                   ├── ChatBubble (conditional: selectedQuestion)
│                   │   └── Modal overlay
│                   │       └── ChatBubble content
│                   │
│                   ├── StatusBar
│                   │   ├── Context section (plan name + version + status)
│                   │   ├── Agents section
│                   │   │   └── AgentAvatar[] (each with optional notification)
│                   │   │       └── AgentActivityPopover (on hover)
│                   │   ├── Stats section (pending + resolved counts)
│                   │   └── Meta section (timer + collapse toggle)
│                   │
│                   └── MessagingSidebar (conditional: !collapsed && !onPlanPage)
│                       ├── ChannelHeader (active channel name)
│                       ├── ChannelMessageList (scrollable messages)
│                       ├── MessageInput (send message)
│                       └── Optional: Channel selector dropdown
```

---

## Page: PlansListPage

```
PlansListPage
├── PlansToolbar
│   ├── SearchInput
│   ├── FilterButtons (owner, initiative, status)
│   └── PlansViewModeToggle (list | grouped)
│
└── Content View
    ├── IF view mode == 'list':
    │   └── PlanTable
    │       └── PlanCard[] (rows)
    │           ├── Goal text
    │           ├── InitiativeBadge
    │           ├── Status badge
    │           ├── ProgressBar
    │           ├── AgentActivityDot
    │           └── QuestionsBadge
    │
    └── IF view mode == 'grouped':
        └── SectionedPlanTable
            └── CollapsibleSection[] (by scope)
                └── PlanCard[] (rows per scope)
```

---

## Page: PlanEditorPage

```
PlanEditorPage
└── PlanEditorProvider (context for plan state)
    └── PlanEditorContent
        ├── Main Content Area (flex-1)
        │   ├── PlanEditorHeader
        │   │   └── TabNavigation (Plan | Understanding | Context | Decisions)
        │   │
        │   └── Conditional Tab Content:
        │       ├── IF tab == 'plan':
        │       │   └── PlanTabContent
        │       │       ├── Header (Steps count + ViewModeToggle)
        │       │       ├── IF viewMode == 'list':
        │       │       │   └── StepEditor[] (one per step)
        │       │       │       ├── Title (EditableText)
        │       │       │       ├── Description (EditableTextarea)
        │       │       │       ├── Scope badge
        │       │       │       ├── Owner Role selector
        │       │       │       ├── StepSpecificationTabs
        │       │       │       │   ├── Tab[] (one per domain)
        │       │       │       │   │   └── DomainSpecEditor
        │       │       │       │   │       └── KeyValueEditor
        │       │       │       │   └── AddDomainPopover
        │       │       │       ├── AcceptanceCriteriaSection
        │       │       │       ├── DependenciesSection
        │       │       │       ├── ApprovalGateSection
        │       │       │       └── Action buttons
        │       │       │           ├── Expand/collapse
        │       │       │           ├── Comments
        │       │       │           ├── Delete
        │       │       │
        │       │       └── IF viewMode == 'swimlane':
        │       │           ├── SwimlaneView
        │       │           │   ├── ScopeSummaryStats[] (one per scope)
        │       │           │   │   └── Scope header + progress bar
        │       │           │   └── Swimlane Lane[] (one per scope, left-to-right)
        │       │           │       └── SwimlaneStepCard[] (ordered by deps)
        │       │           │           ├── Compact step display
        │       │           │           ├── DependencyIndicator
        │       │           │           │   ├── Incoming list
        │       │           │           │   └── Outgoing list
        │       │           │           └── Click to expand to editor
        │       │           └── DependencyLinesOverlay (SVG)
        │       │               └── Lines connecting dependencies
        │       │
        │       ├── IF tab == 'understanding':
        │       │   └── UnderstandingTab
        │       │       └── EditableTextarea (planning approach)
        │       │
        │       ├── IF tab == 'context':
        │       │   └── ContextTab
        │       │       ├── RoleContextCard[] (one per role)
        │       │       │   └── KeyValueEditor (role attributes)
        │       │       ├── AddRolePopover
        │       │       └── AddDomainPopover
        │       │
        │       └── IF tab == 'decisions':
        │           └── DecisionsTabContent
        │               └── DecisionList
        │                   ├── DecisionRow[] (one per decision)
        │                   └── DecisionDetailSheet (on click)
        │
        │   └── CommentThread (conditional: activePanel == 'comments')
        │       ├── Comments[] (nested threads)
        │       └── CommentInput
        │
        └── MessagingSidebar (right side)
            ├── ChannelHeader
            ├── ChannelMessageList
            ├── MessageInput
            └── Optional: Channel selector
```

---

## Page: InitiativesListPage

```
InitiativesListPage
└── Grid of InitiativeCard[]
    ├── Icon + Color
    ├── Initiative name
    ├── Plan count badge
    └── Click → InitiativeDetailPage
```

---

## Page: InitiativeDetailPage

```
InitiativeDetailPage
├── Initiative header (icon, name, color)
├── Plan count stats
├── AddPlanSheet
│   └── Form to create new plan in this initiative
│
└── PlansGrid
    └── PlanCard[] (filtered by initiative)
        └── Click → PlanEditorPage
```

---

## Page: PipelinePage

```
PipelinePage
├── PipelineToolbar
│   ├── InitiativeTabs (select which initiative to view)
│   └── ViewToggle (board | sequence)
│
└── Content View:
    ├── IF view == 'board':
    │   └── BoardView
    │       ├── Column[] (one per execution status: pending, in_progress, done, failed)
    │       │   └── PipelinePlanCard[] (draggable, future)
    │       └── DependencyArrow[] (between columns, showing dependencies)
    │
    └── IF view == 'sequence':
        └── SequenceView
            └── Horizontal timeline of waves
                └── WaveColumn[]
                    └── PipelinePlanCard[]
```

---

## Page: ChannelPage

```
ChannelPage
├── ChannelHeader
│   ├── Channel name
│   ├── Member list
│   └── Settings
│
├── ChannelMessageList
│   └── ChatMessage[] (with agent avatar + timestamp)
│
└── MessageInput
    └── Send message form
```

---

## Data Flow: Plan Editing

```
PlanEditorPage
│
├─ PlanEditorProvider
│  │
│  ├─ Load plan data (getPlan)
│  │  └─ Set: plan, version, loading, error
│  │
│  ├─ Subscribe to SSE (usePlanEvents)
│  │  └─ On plan change: refetch + update version
│  │
│  └─ Expose methods:
│     ├─ handleStepUpdate(stepId, updates)
│     │  └─ Call API → updatePlan
│     │     └─ Optimistic: update local version
│     │        └─ On SSE notification: reconcile with server
│     │
│     ├─ handleStepDelete(stepId)
│     │  └─ Call API → removeStep
│     │
│     ├─ handleWorkflowSubmit()
│     │  └─ Call API → submitVersion
│     │     └─ Change status: draft → submitted
│     │
│     ├─ handleWorkflowApprove(approver)
│     │  └─ Call API → approveVersion
│     │     └─ Change status: submitted → approved (locks editing)
│     │
│     └─ handleWorkflowPublish()
│        └─ Call API → publishVersion
│           └─ Status: approved → published (ready for orchestrator)
│
└─ PlanEditorContent (consumes context)
   │
   ├─ Render PlanTabContent
   │  │
   │  ├─ List View: StepEditor[]
   │  │  │
   │  │  └─ StepEditor (single step)
   │  │     │
   │  │     ├─ Title (EditableText)
   │  │     │  └─ onBlur → context.handleStepUpdate
   │  │     │
   │  │     ├─ DependencyIndicator
   │  │     │  └─ onClick → Show/hide dependency list
   │  │     │     └─ Click dep → context.handleScrollToStep
   │  │     │
   │  │     ├─ StepSpecificationTabs
   │  │     │  └─ onChange → API call (updateStepSpecification)
   │  │     │
   │  │     └─ Delete button
   │  │        └─ onClick → context.handleStepDelete
   │  │
   │  └─ Swimlane View: SwimlaneView
   │     │
   │     ├─ useTopologicalSort(steps) → order steps left-to-right by dependencies
   │     │
   │     └─ SwimlaneStepCard[]
   │        │
   │        ├─ DependencyIndicator (shows all incoming/outgoing)
   │        │
   │        └─ onClick → Select + expand to full editor
   │
   └─ MessagingSidebar (plan-aware)
      │
      ├─ useChannels (passes planId)
      │  └─ Auto-joins #plan-{planId}
      │
      └─ Receives messages for that plan's channel
```

---

## Data Flow: Chat & Questions

```
Layout
│
├─ useQuestionQueue(planId) [SSE poll]
│  │
│  ├─ Subscribe to: GET /api/plans/{planId}/questions (SSE)
│  ├─ Returns: questions[], currentQuestion
│  │
│  └─ Methods:
│     ├─ answer(questionId, text) → POST /api/plans/{planId}/questions/{id}/answer
│     └─ dismiss(questionId) → POST /api/plans/{planId}/questions/{id}/dismiss
│
├─ useQuestionNotifications [local queue]
│  │
│  ├─ Input: questions[] from useQuestionQueue
│  ├─ Watches for new questions via useEffect
│  │
│  └─ Methods:
│     ├─ addToQueue(question) → Show notification bubble
│     │  └─ Auto-dismiss after 5 seconds (configurable)
│     │
│     └─ dismiss() → Hide bubble
│
├─ useAgentOrchestration(planId) [polling]
│  │
│  ├─ Poll: GET /api/plans/{planId}/agents (every 5 seconds)
│  ├─ Returns: agents[], pendingQuestions, resolvedDecisions, sessionDuration
│  │
│  └─ Used by: StatusBar (display agent avatars + counts)
│
└─ UI Rendering:
   │
   ├─ TriagePanel (IF questions.length > 5 && isOpen)
   │  │
   │  ├─ QueueItem[] (for each question)
   │  │  └─ Click → setSelectedQuestionId
   │  │
   │  ├─ "Answer top" button
   │  │  └─ onClick → handleAnswerTop()
   │  │
   │  └─ "Dismiss FYI" button
   │     └─ onClick → dismiss() for all blocking_level == 'fyi'
   │
   ├─ ChatBubble (IF selectedQuestionId)
   │  │
   │  ├─ Shows: question text, agent context, answer input
   │  │
   │  ├─ "Answer" button
   │  │  └─ onClick → handleAnswer(text)
   │  │     └─ Call: answer(selectedQuestionId, text)
   │  │        └─ On success: move to next question or close
   │  │
   │  ├─ "Show next" button
   │  │  └─ onClick → handleShowNext()
   │  │
   │  ├─ "Later" button
   │  │  └─ onClick → handleLater() [close bubble, keep panel open]
   │  │
   │  └─ "Close" button
   │     └─ onClick → handleCloseChatBubble()
   │
   ├─ StatusBar
   │  │
   │  ├─ Pending badge
   │  │  └─ Click → handlePendingClick() [open triage panel]
   │  │
   │  └─ AgentAvatar[] (for each agent in orchestration)
   │     ├─ Shows state (idle, working, needs_input, error)
   │     ├─ Hover → AgentActivityPopover
   │     │  └─ Shows: current activity, step, thought
   │     │
   │     ├─ Click → handleAgentClick()
   │     │  ├─ IF agent needs_input: find their pending question, show ChatBubble
   │     │  └─ ELSE: open DM channel with agent
   │     │
   │     └─ Notification bubble (IF currentNotification.agentId == this agent.id)
   │        └─ Shows QuestionNotificationContent
   │           └─ Auto-dismiss after autoAdvanceDelay
   │
   └─ Quiet indicator: StatusBar shows "No agents active" if none
```

---

## Data Flow: Relay & Messaging

```
RelayProvider (App.tsx root)
│
├─ useRelayConnection(displayName, autoConnect, userId)
│  │
│  ├─ WebSocket connection: ws://localhost:3001/ws/relay
│  │
│  ├─ Lifecycle:
│  │  ├─ onopen → setState('connected'), start heartbeat
│  │  ├─ onmessage → Route to handlers (message, channel_message, joined, left)
│  │  ├─ onerror → setState('error')
│  │  └─ onclose → cleanup, attempt reconnect (exponential backoff)
│  │
│  ├─ Reconnection:
│  │  ├─ Max 5 attempts with 2s delay
│  │  └─ Exponential backoff: 2s, 4s, 6s, 8s, 10s
│  │
│  └─ Returns: connection object with methods & subscription helpers
│     │
│     ├─ Methods:
│     │  ├─ joinChannel(channelId)
│     │  ├─ leaveChannel(channelId)
│     │  ├─ sendChannelMessage(channelId, content, data)
│     │  └─ sendDirectMessage(to, content, data)
│     │
│     └─ Subscriptions:
│        ├─ onMessage(handler)
│        ├─ onChannelMessage(handler)
│        ├─ onJoined(handler)
│        ├─ onLeft(handler)
│        └─ onPresenceUpdate(handler)
│
└─ Expose context: RelayContext
   │
   └─ useRelay() hook (consumed by all components)
      │
      ├─ Returns:
      │  ├─ connection (WebSocket API)
      │  ├─ isConnected (boolean)
      │  ├─ userId (string)
      │  ├─ displayName (string)
      │  └─ isMock (boolean, true if relay unavailable)
      │
      └─ Usage:
         │
         ├─ MessagingSidebar
         │  │
         │  ├─ useChannels(connection, planId)
         │  │  │
         │  │  ├─ Fetch: GET /api/relay/channels (or mock list)
         │  │  ├─ Auto-join plan channel: #plan-{planId}
         │  │  └─ Returns: channels[], joinedChannels (Set), join/leave methods
         │  │
         │  ├─ useChannelMessages(connection, activeChannelId)
         │  │  │
         │  │  ├─ Subscribe: connection.onChannelMessage(handler)
         │  │  ├─ Fetch history: GET /api/relay/channels/{id}/messages
         │  │  └─ Returns: messages[]
         │  │
         │  ├─ usePresence(connection, activeChannelId)
         │  │  │
         │  │  ├─ Subscribe: connection.onPresenceUpdate(handler)
         │  │  └─ Returns: members[] (who's in this channel)
         │  │
         │  └─ MessageInput
         │     │
         │     └─ onSubmit → connection.sendChannelMessage(activeChannelId, text)
         │        └─ Wire protocol: { type: 'send', channel, body: text, data? }
         │
         └─ (Future) DM agent
            │
            └─ Agent click → openDm(agentId, name)
               └─ Create or join DM channel
                  └─ Switch to DM in MessagingSidebar
```

---

## Data Flow: State Persistence

```
Browser State (localStorage)
│
├─ SIDEBAR_COLLAPSED (AppSidebar)
├─ MESSAGING_SIDEBAR_COLLAPSED (Layout, PlanEditorContent)
├─ SIDEBAR_EXPANSION_STATE (useSidebarState)
│  └─ JSON map of initiative_id → isExpanded
├─ PLANS_VIEW_MODE (usePlansViewMode)
│  └─ 'list' | 'grouped'
├─ SCOPE_GROUP_EXPANSION (useScopeGroupExpansion)
│  └─ JSON set of expanded scope IDs
├─ LAST_CHANNEL (MessagingSidebar)
│  └─ channelId (string)
├─ THEME (useTheme)
│  └─ 'dark' | 'light' | 'system'
├─ RECENT_PLANS (useRecentPlans)
│  └─ JSON array of plan IDs (max 10)
└─ USER_ID (useCurrentUser)
   └─ Generated UUID (session-scoped, unique per browser)

Router State (URL)
│
├─ Pathname: /plans, /plans/:planId, /initiatives, /pipeline, /channels/:channelId
├─ Query params:
│  ├─ /plans?owner=me&initiative=foo&status=draft
│  └─ /plans?search=authentication
└─ State object (passed via navigate):
   └─ parents: [] (for breadcrumb navigation in sub-plans)

Memory State (React Context)
│
├─ PlanEditorContext
│  ├─ plan (Plan)
│  ├─ version (PlanVersion)
│  ├─ selectedStep (Step)
│  ├─ expandedStepId (string | null)
│  ├─ viewMode ('list' | 'swimlane')
│  ├─ hoveredStepId (string | null)
│  ├─ activePanel ('comments' | null)
│  ├─ commentStepId (string | null)
│  └─ comments (Comment[])
│
├─ RelayContext
│  ├─ connection (WebSocket API)
│  ├─ isConnected (boolean)
│  ├─ userId (string)
│  └─ isMock (boolean)
│
└─ ToastContext
   └─ toasts (Toast[])
```

---

## Real-Time Update Flow

```
User edits step title in StepEditor
│
├─ EditableText detects blur event
│  └─ onBlur → context.handleStepUpdate(stepId, { title: newValue })
│     │
│     └─ API call: PATCH /api/plans/{planId}/steps/{stepId}
│        │
│        ├─ Optimistic update: immediately update local version
│        │  └─ version.steps = [...steps].map(s => s.id === stepId ? {...s, title} : s)
│        │
│        └─ On success: reconcile with server response
│           └─ Check if server version is newer than local
│              └─ If newer: refetch entire plan
│              └─ If same: keep local (optimistic update was correct)
│
├─ Meanwhile, on server: SSE broadcasts plan change to all connected clients
│  │
│  └─ Other connected users receive SSE event:
│     └─ { type: 'plan_updated', plan_id, version }
│
└─ PlanEditorContent receives SSE event
   │
   ├─ usePlanEvents triggers refetch (debounced 250ms)
   │  └─ getPlan(planId) → fetch latest version
   │
   └─ Update local state with fetched version
      └─ Re-render with new step data
```

---

## Dependency Resolution Flow (Swimlane View)

```
PlanTabContent sets viewMode = 'swimlane'
│
└─ SwimlaneView receives steps[]
   │
   ├─ useTopologicalSort(steps)
   │  │
   │  ├─ Input: steps[] with dependencies
   │  ├─ Build dependency graph:
   │  │  └─ For each step: incoming (steps it depends on) + outgoing (steps depending on it)
   │  │
   │  ├─ Topological sort (Kahn's algorithm):
   │  │  ├─ Find steps with no dependencies (sources)
   │  │  ├─ Process in order, marking as processed
   │  │  └─ Next steps become sources
   │  │
   │  └─ Returns: sortedSteps (left-to-right order by dependency depth)
   │
   ├─ Group steps by scope
   │  └─ Create swimlane lane for each scope
   │     └─ ScopeSummaryStats header (scope name, count, progress)
   │        └─ SwimlaneStepCard[] (in topological order left-to-right)
   │
   ├─ For each step card:
   │  │
   │  ├─ Compute dependencies (useMemo)
   │  │  ├─ Incoming: steps this step depends on
   │  │  │  └─ Show with cross-scope highlighting
   │  │  │
   │  │  └─ Outgoing: steps depending on this step
   │  │     └─ Show with cross-scope highlighting
   │  │
   │  ├─ DependencyIndicator (visual signal)
   │  │  ├─ Incoming dot (left side of card)
   │  │  │  └─ Click → expand list of incoming steps
   │  │  │     └─ Click incoming step → context.handleScrollToStep(id)
   │  │  │
   │  │  └─ Outgoing dot (right side of card)
   │  │     └─ Click → expand list of outgoing steps
   │  │        └─ Click outgoing step → context.handleScrollToStep(id)
   │  │
   │  └─ onClick → Select step, expand to full StepEditor
   │
   └─ DependencyLinesOverlay (SVG)
      │
      ├─ Calculate positions of all steps (getBoundingClientRect)
      ├─ For each dependency edge:
      │  └─ Draw SVG line from source step to target step
      │     └─ Use quadratic curve for smooth connections
      │
      ├─ On hover step:
      │  └─ Highlight all incoming/outgoing lines
      │     └─ Dim non-related lines
      │
      └─ Update on:
         ├─ Window scroll (track position changes)
         ├─ ResizeObserver (step card size changes)
         └─ MutationObserver (DOM structure changes)
```

---

## Command Palette Flow

```
User presses Cmd+K
│
└─ Global keyboard listener (in Layout)
   │
   ├─ useCommandPalette().open()
   │  └─ setIsOpen(true)
   │
   └─ CommandPalette renders
      │
      ├─ Input field (auto-focused)
      ├─ FuzzySearch(searchTerm, plans)
      │  │
      │  ├─ Input: plans[], searchTerm
      │  ├─ Algorithm: Fuzzy string matching on plan goals
      │  └─ Returns: filtered results (sorted by match score)
      │
      ├─ Results grouped:
      │  ├─ Recent plans (from useRecentPlans)
      │  ├─ Matching plans (from fuzzy search)
      │  └─ Action shortcuts (create new plan, etc.)
      │
      ├─ Keyboard navigation:
      │  ├─ ArrowUp/Down: navigate results
      │  ├─ Enter: select result
      │  │  └─ IF plan: navigate to /plans/{planId}
      │  │  └─ IF action: trigger action
      │  │
      │  └─ Escape: close
      │
      └─ onClose: useCommandPalette().close()
```

---

## Attention Item Selection Flow

```
NeedsAttentionSection displays grouped plans
│
├─ getHighestPriorityAttention(plan)
│  │
│  ├─ Check plan for attention types in order:
│  │  1. execution_failed (highest priority)
│  │  2. change_request
│  │  3. gate_pending
│  │  4. awaiting_approval
│  │  5. stale_draft
│  │  6. unread_comments (lowest priority)
│  │
│  └─ Return highest found (or 'unread_comments' default)
│
├─ Group plans by type
│  └─ groupAndSortPlans(plans)
│     ├─ For each plan: map to primary attention type
│     ├─ Group by type
│     └─ Sort groups by urgency order
│
└─ Render CollapsibleSection[] (one per type)
   │
   └─ AttentionItem[] (for each plan in group)
      │
      ├─ Show: AttentionBadge (colored by type)
      ├─ Show: Plan name + goal summary
      ├─ Show: Last updated time
      │
      └─ onClick → navigate to /plans/{plan_id}
         └─ PlanEditorPage renders
            └─ User can resolve attention items
```

---

## Message Input & Send Flow (Messaging Sidebar)

```
User types in MessageInput
│
└─ MessageInput component
   │
   ├─ State: messageText (local)
   ├─ TextArea field (auto-focus when sidebar expands)
   │
   └─ onKeyDown (Enter to send)
      │
      ├─ Validate: messageText not empty
      ├─ Get: connection from useRelay()
      ├─ Get: activeChannelId from parent state
      │
      └─ connection.sendChannelMessage(activeChannelId, messageText, {
         │  planId?: currentPlanId,
         │  stepId?: currentStepId,
         │  metadata?: {...}
         │})
            │
            └─ Wire protocol: { type: 'send', channel, body, data }
               │
               └─ WebSocket sends to relay daemon
                  │
                  ├─ Relay broadcasts to all members of channel
                  │  └─ { type: 'channel_message', from, body, channel }
                  │
                  └─ Original sender receives own message via onChannelMessage
                     │
                     └─ useChannelMessages hook receives message
                        │
                        └─ Update messages[] state
                           │
                           └─ ChannelMessageList re-renders with new message
                              │
                              └─ Message appears with sender avatar + timestamp
```

---

## Agent Click Flow (Status Bar)

```
User clicks AgentAvatar in StatusBar
│
└─ handleAgentClick(agent)
   │
   ├─ IF agent.state === 'needs_input':
   │  │
   │  ├─ Find pending question: questions.find(q => q.agent_id === agent.id)
   │  ├─ If found:
   │  │  └─ setSelectedQuestionId(question.question_id)
   │  │     └─ ChatBubble shows with the question
   │  │
   │  └─ else: fall through to DM (below)
   │
   └─ ELSE (agent is idle/working):
      │
      ├─ openDm(agent.id, agent.displayName)
      │  │
      │  └─ useDmChannel hook:
      │     ├─ Create or find DM channel: #dm-{user_id}-{agent_id}
      │     └─ Return channelId
      │
      ├─ setRequestedChannelId(channelId)
      ├─ setMessagingSidebarCollapsed(false)
      │  └─ Expand messaging sidebar
      │
      └─ MessagingSidebar receives requestedChannelId
         │
         └─ useEffect watches requestedChannelId
            │
            ├─ Join channel: connection.joinChannel(channelId)
            ├─ Set active channel: setActiveChannelId(channelId)
            │
            └─ MessagingSidebar switches to DM channel
               │
               └─ MessageInput ready for conversation with agent
```

---

## Key Data Shapes

### Step
```typescript
{
  step_id: string;
  title: string;
  description?: string;
  scope?: string;
  owner_role?: string;
  dependencies: string[]; // step_id[] of steps this depends on
  acceptance_criteria?: AcceptanceCriterion[];
  gate?: {
    type: 'human_approval';
    approver_role?: string;
  };
  sub_plan_id?: string;
  specification?: DomainSpec[]; // domain-specific details
  execution_status?: 'pending' | 'in_progress' | 'completed' | 'failed';
}
```

### Question
```typescript
{
  question_id: string;
  agent_id: string;
  plan_id: string;
  blocking_level: 'blocking' | 'advisory' | 'fyi';
  question_text: string;
  context?: {
    step_id?: string;
    step_title?: string;
    [key: string]: unknown;
  };
  created_at: string;
}
```

### Agent (in orchestration)
```typescript
{
  id: string;
  role: string;
  displayName?: string;
  state: 'idle' | 'working' | 'needs_input' | 'error';
  currentActivity?: string;
  currentStep?: string;
  currentThought?: string;
}
```

### RelayMessage
```typescript
{
  id: string;
  from: string; // user_id or agent_id
  fromName: string; // display name
  entityType: 'user' | 'agent';
  channelId?: string; // for channel messages
  content: string; // message body
  timestamp: string; // ISO datetime
  data?: Record<string, unknown>; // metadata (planId, stepId, etc.)
}
```


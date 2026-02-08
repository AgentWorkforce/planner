# Planner-UI Quick Start - Component Mapping

Visual quick reference for planner-ui building blocks.

---

## Three-Column Model

```
┌─────────────────────────────────────────────────────────────────────────┐
│  LAYOUT: AppSidebar + CommandPalette + StatusBar + MessagingSidebar     │
├─────────────┬──────────────────────────────┬───────────────────────────┤
│   LEFT      │       CENTER                 │        RIGHT              │
│  The Now    │     Conversation             │       The Tree            │
│             │                              │                           │
│ Attention   │ Messages                     │ Plans & Steps             │
│ Questions   │ Agent DMs                    │ Step Editor               │
│ Chat        │ Relay WebSocket              │ Swimlane View             │
│             │                              │ Dependency Viz            │
└─────────────┴──────────────────────────────┴───────────────────────────┘
├─ STATUS BAR: Agent Avatars + Question Count + Resolved Count + Timer     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Quick Component Map

### LEFT COLUMN (The Now)

**Attention & Action Items**
```
NeedsAttentionSection
├── CollapsibleSection[] (grouped by urgency)
│   └── AttentionItem[] (planId → click to navigate)
│       ├── AttentionBadge (execution_failed | change_request | gate_pending | ...)
│       ├── Plan title + goal summary
│       └── Last updated time
```

**Question Handling**
```
TriagePanel (IF > 5 questions pending)
├── QueueItem[] (scrollable queue)
│   ├── Question text
│   ├── Priority indicator
│   └── Click → ChatBubble
├── "Answer top" button → handleAnswerTop()
└── "Dismiss FYI" button → handleDismissFyi()

ChatBubble (modal overlay)
├── Question text + context
├── Input field (answer)
├── "Answer" button → API call
├── "Show next" button → next question
├── "Later" button → close bubble, keep panel
└── "Close" button → close everything
```

**Notification**
```
QuestionNotificationContent (bubble above agent avatar in status bar)
├── Question text (summary)
├── Agent name
└── Auto-dismiss after 5 seconds (or click to open ChatBubble)
```

---

### CENTER COLUMN (Conversation)

**Channel Messaging**
```
MessagingSidebar (right side, collapsible)
├── ChannelHeader
│   ├── Channel name
│   └── Close button (collapse)
├── ChannelMessageList (scrollable)
│   └── ChatMessage[]
│       ├── Agent avatar + name
│       ├── Message body
│       └── Timestamp
└── MessageInput (text + send)
    ├── TextArea (auto-focus when expanded)
    └── Enter key to send
```

**Full Channel Page**
```
ChannelPage (/channels/:channelId)
├── ChannelHeader
├── ChannelMessageList
├── MessageInput
```

**Infrastructure**
```
RelayContext (app root)
├── WebSocket connection (single shared)
├── connection.sendChannelMessage()
├── connection.sendDirectMessage()
└── connection.onChannelMessage(handler)

Relay Hooks (always use these!)
├── useRelay() → { connection, isConnected, userId, displayName, isMock }
├── useChannels() → { channels[], joinedChannels, join(), leave() }
├── useChannelMessages() → { messages[], loading, error }
├── usePresence() → { members[], loading }
├── useActiveChannels() → { activeChannels[] }
└── useDmChannel() → { openDm(agentId, name) }
```

---

### RIGHT COLUMN (The Tree)

**Main Editor**
```
PlanEditorPage
└── PlanEditorProvider (context wrapper)
    └── PlanEditorContent
        ├── PlanEditorHeader (tabs: Plan | Understanding | Context | Decisions)
        │
        ├── Plan Tab Content:
        │   └── PlanTabContent
        │       ├── Header (Steps count + ViewModeToggle)
        │       │
        │       ├── IF viewMode == 'list':
        │       │   └── StepEditor[] (one per step)
        │       │
        │       └── IF viewMode == 'swimlane':
        │           ├── SwimlaneView
        │           │   ├── ScopeSummaryStats[] (by scope)
        │           │   ├── SwimlaneStepCard[] (left-to-right by deps)
        │           │   └── DependencyLinesOverlay (SVG)
        │
        ├── Other Tabs:
        │   ├── Understanding Tab (EditableTextarea)
        │   ├── Context Tab (RoleContextCard[])
        │   └── Decisions Tab (DecisionList)
        │
        └── MessagingSidebar (right side, plan-aware)
```

**Step Editor**
```
StepEditor (single step card)
├── Title (EditableText)
├── Description (EditableTextarea)
├── Scope (read-only badge)
├── Owner Role (selector dropdown)
├── Expand/collapse button
│
├── (Expanded section)
│   ├── StepSpecificationTabs
│   │   ├── Tab[] (one per domain: API, Database, Security, etc.)
│   │   │   └── DomainSpecEditor
│   │   │       └── KeyValueEditor (domain-specific fields)
│   │   └── AddDomainPopover
│   │
│   ├── AcceptanceCriteriaSection (add/remove criteria)
│   ├── DependenciesSection (show/add dependencies)
│   ├── ApprovalGateSection (toggle gate, set approver)
│   │
│   └── Action buttons
│       ├── Comments (open comment thread)
│       └── Delete (remove step)
```

**Visualization**
```
SwimlaneView (step visualization by scope)
├── ScopeSummaryStats[] (header for each scope)
│   ├── Scope name
│   ├── Step count
│   └── Progress bar
│
├── Swimlane Lane[] (one per scope, left-to-right)
│   └── SwimlaneStepCard[] (ordered by topological sort)
│       ├── Compact step display
│       ├── DependencyIndicator
│       │   ├── Incoming dot (left)
│       │   │   └── Click → expand incoming list
│       │   │       └── Click incoming step → scroll to it
│       │   └── Outgoing dot (right)
│       │       └── Click → expand outgoing list
│       │           └── Click outgoing step → scroll to it
│       └── onClick → expand to full StepEditor
│
└── DependencyLinesOverlay (SVG)
    ├── Lines connecting dependent steps
    ├── Curve paths for visual clarity
    └── Highlight on hover (incoming/outgoing)
```

**Plan Browser**
```
PlansListPage
├── PlansToolbar
│   ├── SearchInput
│   ├── FilterButtons (owner, initiative, status)
│   └── PlansViewModeToggle (list | grouped)
│
└── Content View
    ├── IF view == 'list':
    │   └── PlanTable
    │       └── PlanCard[] (rows)
    │
    └── IF view == 'grouped':
        └── SectionedPlanTable
            └── CollapsibleSection[] (by scope)
                └── PlanCard[] (rows per scope)

PlanCard
├── Accent bar (left, colored by status)
├── Goal text (ellipsis for overflow)
├── InitiativeBadge (if associated)
├── Status badge (draft/approved/published)
├── ProgressBar (execution progress)
├── AgentActivityDot (if running)
├── Hover → QuestionsBadge + timestamp
└── Click → navigate to PlanEditorPage
```

**Initiative Browser**
```
InitiativesListPage
└── InitiativeCard[] (grid)
    ├── Icon + Color
    ├── Initiative name
    ├── Plan count badge
    └── Click → InitiativeDetailPage

InitiativeDetailPage
├── Initiative header
├── Plan count stats
├── AddPlanSheet (create new plan in initiative)
└── PlansGrid (PlanCard[] filtered by initiative)
```

**Pipeline View**
```
PipelinePage
├── PipelineToolbar
│   ├── InitiativeTabs (select initiative)
│   └── ViewToggle (board | sequence)
│
└── Content View
    ├── IF view == 'board':
    │   └── BoardView
    │       ├── Column[] (pending, in_progress, done, failed)
    │       │   └── PipelinePlanCard[] (draggable, future)
    │       └── DependencyArrow[] (connecting arrows)
    │
    └── IF view == 'sequence':
        └── SequenceView
            └── Wave[] (horizontal timeline)
                └── PipelinePlanCard[]
```

---

### STATUS BAR (Fixed Bottom)

```
StatusBar (always visible, z-50)
├── Context section
│   ├── Plan icon (📋)
│   ├── Plan name (truncated to 200px)
│   ├── Version badge (v123)
│   └── Status badge (draft | approved | published)
│
├── Agents section (flex-1, center)
│   └── AgentAvatar[] (for each active agent)
│       ├── Role icon
│       ├── Activity indicator (idle/working/needs_input/error)
│       ├── Hover → AgentActivityPopover
│       │   └── Current activity + step + thought
│       ├── Click → handleAgentClick()
│       │   ├── IF needs_input: show pending question in ChatBubble
│       │   └── ELSE: open DM channel with agent
│       └── Notification bubble (IF this agent has pending question)
│           └── QuestionNotificationContent (auto-dismiss after 5s)
│
├── Stats section
│   ├── ❓ Pending questions count
│   │   └── Click → open TriagePanel
│   └── ✓ Resolved decisions count
│
├── Meta section
│   ├── ⏱️ Session timer (mm:ss)
│   └── Collapse button (^ down arrow)
│
├── Collapsed view (when collapsed)
│   ├── Agent avatars (small)
│   ├── Pending badge (small)
│   ├── Expand button
│   └── All in 6px height
```

---

### LAYOUT (Navigation & Shell)

```
Layout (main application shell)
├── SidebarProvider (shadcn sidebar state)
│   │
│   ├── AppSidebar (left, collapsible)
│   │   ├── Header (logo + collapse toggle)
│   │   ├── SidebarContent
│   │   │   ├── SidebarGroup (quick actions)
│   │   │   │   ├── New Plan (link to /plans/new)
│   │   │   │   └── Search (open CommandPalette)
│   │   │   ├── SidebarGroup (navigation)
│   │   │   │   ├── Initiatives (link to /initiatives)
│   │   │   │   ├── All Plans (link to /plans)
│   │   │   │   └── Pipeline (link to /pipeline)
│   │   │   ├── SidebarGroup (active channels)
│   │   │   │   └── ChannelIcon link[] (to /channels/:id)
│   │   │   └── SidebarGroup (initiatives)
│   │   │       └── InitiativeCollapsible[] (expandable)
│   │   │           └── Nested plan links
│   │   └── SidebarFooter
│   │       ├── Theme toggle (☀️/🌙)
│   │       └── Settings (link to /settings)
│   │
│   └── SidebarInset
│       ├── Mobile header (hamburger + title)
│       └── Main (Outlet for pages)
│
├── CommandPalette (global, Cmd+K)
│   ├── Input field (auto-focused)
│   ├── Results (fuzzy search)
│   │   ├── Recent plans
│   │   ├── Matching plans
│   │   └── Action shortcuts
│   └── Arrow keys to navigate, Enter to select, Escape to close
│
├── TriagePanel (right bottom, conditional)
├── ChatBubble (modal overlay, conditional)
├── StatusBar (fixed bottom, always)
├── MessagingSidebar (right side, conditional: !collapsed && !onPlanPage)
```

---

## Hook Usage by Feature

**Real-Time Chat**
```
useRelay()                    # Access WebSocket
useChannels()                 # Manage channel list
useChannelMessages()          # Subscribe to messages
usePresence()                 # Track who's in channel
```

**Questions & Agent Status**
```
useQuestionQueue()            # Poll for questions (SSE)
useQuestionNotifications()    # Manage notification bubble
useAgentOrchestration()       # Poll for agent status
```

**Plan Editing**
```
usePlanEditor()               # Access plan editing context
usePlanEvents()               # SSE for plan changes
useTopologicalSort()          # Order steps by dependencies
useDependencyPositions()      # Calculate step positions (for SVG)
```

**Navigation & State**
```
useCommandPalette()           # Open/close search palette
useRecentPlans()              # Tracked recently viewed plans
useSidebarState()             # Initiative expansion state
usePlansViewMode()            # List vs grouped view mode
useTheme()                    # Dark/light theme
```

**Data Fetching**
```
useCurrentUser()              # Get authenticated user
useInitiatives()              # Fetch all initiatives
useAttentionPlans()           # Fetch plans needing attention
useFuzzySearch()              # Search algorithm
```

---

## Column Assignments Summary

| Component | Column | Purpose |
|-----------|--------|---------|
| **Attention** | LEFT | Plans needing action |
| **TriagePanel** | LEFT | Question queue manager |
| **ChatBubble** | LEFT | Answer UI modal |
| **MessagingSidebar** | CENTER | Channel messages |
| **ChannelView** | CENTER | Full-page channel |
| **PlanEditorPage** | RIGHT | Main plan editor |
| **StepEditor** | RIGHT | Step card editor |
| **SwimlaneView** | RIGHT | Dependency visualization |
| **PlansListPage** | RIGHT | Plan browser |
| **StatusBar** | STATUS BAR | Agent + question status |
| **AppSidebar** | LAYOUT | Navigation |
| **CommandPalette** | LAYOUT | Search |
| **CommandPalette** | SHARED | Reusable everywhere |

---

## Data Flow Summary

```
User types → MessageInput
    ↓
connection.sendChannelMessage(channelId, text)
    ↓
WebSocket → relay daemon
    ↓
Relay broadcasts → all members
    ↓
Browser receives → onChannelMessage handler
    ↓
useChannelMessages updates state
    ↓
ChannelMessageList re-renders
    ↓
Message appears with avatar + timestamp
```

```
User clicks agent avatar in StatusBar
    ↓
handleAgentClick(agent)
    ↓
IF needs_input: find & show pending question in ChatBubble
ELSE: openDm(agent.id) → join DM channel
    ↓
MessagingSidebar switches to DM channel
    ↓
MessageInput ready for conversation
```

```
Agent sends question → Server
    ↓
useQuestionQueue (SSE polling)
    ↓
New question in questions[]
    ↓
useQuestionNotifications detects (via useEffect)
    ↓
addToQueue(question) → show notification bubble
    ↓
Bubble auto-dismisses after 5s OR user clicks
    ↓
onClick → setSelectedQuestionId() → ChatBubble shows
```

---

## Key Files to Know

| Feature | Main File | Dependencies |
|---------|-----------|--------------|
| Chat | ChatBubble.tsx | useQuestionQueue, useRelay |
| Questions | TriagePanel.tsx, useQuestionQueue.ts | API, SSE polling |
| Messaging | MessagingSidebar.tsx | useRelay, useChannels, useChannelMessages |
| Editing | PlanEditorPage.tsx, PlanEditorContext.tsx | usePlanEvents, API calls |
| Steps | StepEditor.tsx | EditableText, StepSpecificationTabs |
| Visualization | SwimlaneView.tsx | useTopologicalSort, DependencyLinesOverlay |
| Navigation | AppSidebar.tsx, CommandPalette.tsx | useInitiatives, useFuzzySearch |
| Status | StatusBar.tsx | useAgentOrchestration, useQuestionNotifications |

---

## Critical Patterns

### 1️⃣ Single WebSocket
```typescript
// App.tsx
<RelayProvider>
  <Routes>...</Routes>
</RelayProvider>

// Any component
const { connection, isConnected } = useRelay();
// Don't create new WebSockets!
```

### 2️⃣ SSE + Debounce
```typescript
// PlanEditorContext
const { isConnected } = usePlanEvents(planId);

// On event: refetch after 250ms delay
useEffect(() => {
  if (isConnected) {
    const timeout = setTimeout(() => refetchPlan(), 250);
    return () => clearTimeout(timeout);
  }
}, [isConnected]);
```

### 3️⃣ Inline Editing
```typescript
// StepEditor
<EditableText
  value={step.title}
  onChange={(newValue) =>
    context.handleStepUpdate(step.step_id, { title: newValue })
  }
/>
// Click to edit, Enter to save, Escape to cancel
```

### 4️⃣ localStorage Persistence
```typescript
// usePlansViewMode
const [viewMode, setViewMode] = useState(() =>
  localStorage.getItem(KEY) || 'list'
);

useEffect(() => {
  localStorage.setItem(KEY, viewMode);
}, [viewMode]);
```

---

**Total Components**: 150+
**Total Hooks**: 38+
**Documentation**: 4 comprehensive guides
**Ready to Reuse**: ✅


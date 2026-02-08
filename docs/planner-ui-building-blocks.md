# Planner-UI Building Blocks Map

Complete inventory of planner-ui's reusable components, hooks, and patterns for reference when planning "tend" (three-column unified app).

---

## Layout & Navigation

### Layout Architecture

**File**: `/packages/planner-ui/src/components/Layout.tsx`
- Main application shell with three fixed zones: left sidebar + center outlet + optional right messaging sidebar
- **Manages**: command palette, triage panel, chat bubble, status bar, messaging sidebar collapse state
- **Integrations**:
  - AppSidebar (left nav)
  - RelayProvider (WebSocket)
  - ToastProvider (notifications)
  - Router outlet for pages
- **Key State**: messagingSidebarCollapsed (persisted), selectedQuestionId, triagePanelOpen, requestedChannelId
- **Column**: LAYOUT

**File**: `/packages/planner-ui/src/components/sidebar/AppSidebar.tsx`
- Collapsible sidebar with Radix/shadcn primitives
- Sections: quick actions, navigation, active channels, initiatives, footer (theme + settings)
- **Responsiveness**: icon-only on desktop collapse, drawer on mobile
- **Keyboard nav**: Cmd+B toggle, Arrow keys navigate items, Escape closes mobile drawer
- **Features**: active route highlighting, tooltips in collapsed state
- **Column**: LAYOUT

**File**: `/packages/planner-ui/src/components/sidebar/InitiativeCollapsible.tsx`
- Expandable initiative item in sidebar with nested plan links
- Shows initiative icon + name, expands to show child plans
- **State**: `useSidebarState()` tracks which initiatives are expanded (persisted to localStorage)
- **Column**: LAYOUT

---

## Status Bar & Agent Presence

### StatusBar (Fixed Bottom)

**File**: `/packages/planner-ui/src/components/StatusBar.tsx`
- Permanent fixed bottom bar with four sections:
  1. **Context**: Plan name + version + status badge
  2. **Agents**: Avatar grid showing active agent states
  3. **Stats**: Pending questions count + resolved decisions count
  4. **Meta**: Session timer + collapse toggle
- **Collapse state**: Collapses to compact row (agent avatars + pending badge + expand button)
- **Notifications**: Overlays above matching agent avatar when question is pending
- **Interactions**: Click pending badge → open triage panel; click agent → open DM or show pending question
- **Column**: STATUS BAR

### AgentAvatar

**File**: `/packages/planner-ui/src/components/AgentAvatar.tsx`
- Small avatar component for displaying agent state
- Shows role icon + activity indicator (idle/working/needs_input/error)
- **Props**: role, state, size (sm/md), displayName, currentActivity, currentStep, currentThought
- **Notifications**: Shows bubble above avatar with custom content
- **Column**: STATUS BAR

### AgentActivityDot

**File**: `/packages/planner-ui/src/components/AgentActivityDot.tsx`
- Tiny status indicator dot (used in plan cards)
- Shows agent state: idle (gray), working (pulse), needs_input (red alert)
- **Column**: SHARED (used in multiple places)

### AgentActivityPopover

**File**: `/packages/planner-ui/src/components/AgentActivityPopover.tsx`
- Popover showing detailed agent activity (current task, thought, progress)
- Triggered by hovering AgentAvatar
- **Column**: STATUS BAR

---

## Chat & Questions (Now)

### TriagePanel (Fixed Right, Bottom)

**File**: `/packages/planner-ui/src/components/TriagePanel.tsx`
- Scrollable list of questions when > 5 pending
- Shows QueueItem for each question with priority indicator
- **Actions**:
  - Select question → opens ChatBubble
  - Answer top question
  - Dismiss all FYI
- **Positioning**: Fixed right bottom, z-50 (above status bar)
- **Column**: LEFT (forming/creative space) - question intake

### ChatBubble

**File**: `/packages/planner-ui/src/components/ChatBubble.tsx`
- Modal dialog for answering a single question
- Displays question text, agent context, answer input field
- **Navigation**: Show next question, Skip for later, Close
- **Processing state**: Shows loading spinner during answer submission
- **Positioning**: Centered modal overlay (z-50)
- **Column**: LEFT (conversation center for forming)

### QuestionNotificationContent

**File**: `/packages/planner-ui/src/components/QuestionNotificationContent.tsx`
- Renders notification bubble content for a question
- Shows question text + agent name
- **Column**: LEFT / STATUS BAR

### MessageInput & MessageStream

**File**: `/packages/planner-ui/src/components/channels/MessageInput.tsx`
- Text input for sending channel/DM messages
- **File**: `/packages/planner-ui/src/components/MessageStream.tsx`
- Scrollable message list with agent avatars + timestamps
- **Column**: CENTER (conversation)

### ChatPanel (Legacy?)

**File**: `/packages/planner-ui/src/components/ChatPanel.tsx`
- Full-height chat interface (may be replaced by MessagingSidebar)
- Shows conversation + participants
- **Column**: CENTER (conversation)

---

## Right Sidebar: Messaging

### MessagingSidebar

**File**: `/packages/planner-ui/src/components/MessagingSidebar.tsx`
- Right-side panel for channel messaging + agent DMs
- **Sections**:
  - ChannelHeader (active channel name + close button)
  - ChannelMessageList (scrollable message history)
  - MessageInput (send message)
  - Optional channel selector dropdown (envelope icon)
- **Collapse**: Can collapse/expand (persisted to localStorage)
- **Plan Context**: When viewing a plan, shows that plan's channel; otherwise shows all channels
- **Auto-join**: Joins channels on open
- **Column**: RIGHT (can be hidden when planning)

### ChannelView

**File**: `/packages/planner-ui/src/components/channels/ChannelView.tsx`
- Full-page view for a specific channel (route: `/channels/:channelId`)
- Shows channel header + message list + input
- **Column**: CENTER (when navigated to from sidebar)

### ChannelHeader & ChannelMessageList

**File**: `/packages/planner-ui/src/components/channels/ChannelHeader.tsx`
- Shows channel name + member count + settings
- **File**: `/packages/planner-ui/src/components/channels/ChannelMessageList.tsx`
- Renders messages with agent avatars + timestamps

---

## Plan Editor (Right Column)

### PlanEditorPage & PlanEditorContent

**File**: `/packages/planner-ui/src/pages/PlanEditorPage.tsx`
- Wrapper page that provides PlanEditorProvider context
- **File**: `PlanEditorContent` inside same file
- Main editor layout: content area (left) + MessagingSidebar (right)
- **Tabs**: Plan | Understanding | Context | Decisions
- **Column**: RIGHT (plan structure)

### PlanEditorHeader

**File**: `/packages/planner-ui/src/components/plan-editor/PlanEditorHeader.tsx`
- Tab navigation (Plan | Understanding | Context | Decisions)
- Shows plan title + status
- **Column**: RIGHT

### PlanTabContent

**File**: `/packages/planner-ui/src/components/plan-editor/PlanTabContent.tsx`
- Shows steps list or swimlane view
- **Toolbar**: ViewModeToggle (list vs swimlane)
- **Breadcrumb**: Shows parent plan if nested
- **Column**: RIGHT

### PlanEditorContext

**File**: `/packages/planner-ui/src/contexts/PlanEditorContext.tsx`
- Global state for plan editing: plan, version, steps, selected step, expanded step, view mode, hovered step
- **Methods**:
  - handleStepUpdate, handleStepDelete, handleGoalUpdate
  - handleWorkflowSubmit, handleWorkflowApprove, handleWorkflowPublish
  - openCommentsPanel, handleAddComment
- **Real-time sync**: Uses usePlanEvents for SSE updates
- **Column**: RIGHT (data context)

---

## Step Editing

### StepEditor

**File**: `/packages/planner-ui/src/components/StepEditor.tsx`
- Card showing single step with inline editing
- **Sections**:
  - Title (EditableText)
  - Description (EditableTextarea)
  - Scope (read-only badge)
  - Owner role (dropdown selector, custom role support)
  - Spec tabs (StepSpecificationTabs)
  - Acceptance criteria (AcceptanceCriteriaSection)
  - Dependencies (DependenciesSection)
  - Approval gate (ApprovalGateSection)
  - Action buttons (expand/collapse, comments, delete)
- **Collapse**: Can expand/collapse editing sections
- **Keyboard**: Enter to save, Escape to cancel
- **Column**: RIGHT

### EditableText & EditableTextarea

**File**: `/packages/planner-ui/src/components/EditableText.tsx`
- Inline text editor: click to edit, click outside to save
- Handles double-click or Enter to activate, Escape to cancel
- **File**: `/packages/planner-ui/src/components/EditableTextarea.tsx`
- Same pattern for multiline text
- **Column**: RIGHT

### DependencyIndicator

**File**: `/packages/planner-ui/src/components/DependencyIndicator.tsx`
- Visual indicator showing incoming/outgoing dependencies
- Click to expand and see connected step details
- Hover to highlight dependency direction (incoming vs outgoing)
- **Features**: Cross-scope dependency highlighting
- **Column**: RIGHT

### AcceptanceCriteriaSection

**File**: `/packages/planner-ui/src/components/step-editor/AcceptanceCriteriaSection.tsx`
- Editable list of acceptance criteria
- Each criterion has description + type (test/review/metric)
- Can add/remove criteria
- **Column**: RIGHT

### DependenciesSection

**File**: `/packages/planner-ui/src/components/step-editor/DependenciesSection.tsx`
- Shows list of step IDs this step depends on
- Can search and add new dependencies
- Shows dependency status (e.g., "blocking" if dependency not done)
- **Column**: RIGHT

### ApprovalGateSection

**File**: `/packages/planner-ui/src/components/step-editor/ApprovalGateSection.tsx`
- Configure human approval gate before step execution
- Toggle gate on/off, set approver role
- **Column**: RIGHT

### StepSpecificationTabs

**File**: `/packages/planner-ui/src/components/spec/StepSpecificationTabs.tsx`
- Tabbed interface for domain-specific specs
- Tabs: API, Database, Security, etc. (based on domains)
- Each tab has DomainSpecEditor for that domain
- **Column**: RIGHT

### DomainSpecEditor

**File**: `/packages/planner-ui/src/components/spec/DomainSpecEditor.tsx`
- Editor for a single domain's specification
- Shows key-value pairs for domain-specific attributes
- Add/remove spec fields
- **Column**: RIGHT

---

## Step Visualization

### SwimlaneView

**File**: `/packages/planner-ui/src/components/SwimlaneView.tsx`
- Swimlane grid visualization of steps grouped by scope
- Each scope = horizontal lane
- Steps positioned left-to-right by dependency order
- **Rendering**:
  - ScopeSummaryStats header for each scope
  - SwimlaneStepCard for each step
  - DependencyLinesOverlay (SVG lines connecting dependencies)
- **Interactions**: Click step to select, hover to highlight
- **Column**: RIGHT

### DependencyLinesOverlay

**File**: `/packages/planner-ui/src/components/swimlane/DependencyLinesOverlay.tsx` or `/src/components/DependencyLinesOverlay.tsx`
- SVG overlay drawing lines between dependent steps
- Handles scroll position + DOM repositioning
- Highlights incoming/outgoing when hovered
- Uses ResizeObserver + MutationObserver for dynamic updates
- **Column**: RIGHT

### ViewModeToggle

**File**: `/packages/planner-ui/src/components/ViewModeToggle.tsx`
- Button group to switch list ↔ swimlane view
- Stores preference in context
- **Column**: RIGHT

### ScopeSummaryStats

**File**: `/packages/planner-ui/src/components/ScopeSummaryStats.tsx`
- Header for each swimlane scope
- Shows: scope name, step count, progress bar
- **Column**: RIGHT

### SectionedPlanTable

**File**: `/packages/planner-ui/src/components/SectionedPlanTable.tsx`
- Table view with rows grouped by scope
- Each section collapsible
- **Column**: RIGHT

---

## Plan/Initiative Listings

### PlansListPage

**File**: `/packages/planner-ui/src/pages/PlansListPage.tsx`
- Displays all plans with filters (owner, initiative, status)
- **Toolbar**: PlansToolbar (search, filters, view mode toggle)
- **View modes**: List (PlanTable) | Grouped (SectionedPlanTable)
- **Column**: RIGHT (plan structure listing)

### PlansToolbar

**File**: `/packages/planner-ui/src/components/plans/PlansToolbar.tsx`
- Search input + filter buttons (owner, initiative, status)
- View mode toggle
- **Column**: RIGHT

### PlanCard

**File**: `/packages/planner-ui/src/components/PlanCard.tsx`
- Compact plan summary card
- Shows: goal, status badge, initiative badge, progress bar, agent activity dot
- Hover reveals: creation date, last updated, agent activity popover
- **Click**: Navigate to plan editor
- **Styling**: Status-based accent color + glow effect
- **Column**: RIGHT

### PlanTable

**File**: `/packages/planner-ui/src/components/PlanTable.tsx`
- Table view of plans (rows)
- Columns: goal, initiative, status, progress, agents, updated at
- **Column**: RIGHT

### InitiativesListPage

**File**: `/packages/planner-ui/src/pages/InitiativesListPage.tsx`
- Grid of initiative cards
- Each card shows initiative name + icon + color + plan count
- Click to open InitiativeDetailPage
- **Column**: RIGHT

### InitiativeDetailPage

**File**: `/packages/planner-ui/src/pages/InitiativeDetailPage.tsx`
- Shows initiative details + associated plans
- Can add new plan to initiative
- **Column**: RIGHT

### InitiativeCard

**File**: `/packages/planner-ui/src/components/initiatives/InitiativeCard.tsx`
- Displayable initiative with icon + color
- Shows plan count badge
- Click to navigate to detail page
- **Column**: LAYOUT / RIGHT

### InitiativeModal

**File**: `/packages/planner-ui/src/components/initiatives/InitiativeModal.tsx`
- Dialog for creating/editing initiative
- Fields: name, icon picker, color picker
- **Uses**: ColorPicker, IconPicker subcomponents
- **Column**: SHARED

---

## Attention & Alerts

### NeedsAttentionSection

**File**: `/packages/planner-ui/src/components/NeedsAttentionSection.tsx`
- Shows grouped plans requiring attention
- Groups by attention type: execution_failed, change_request, gate_pending, awaiting_approval, stale_draft, unread_comments
- Highest-urgency items grouped first
- **Column**: LEFT (items needing action)

### AttentionItem

**File**: `/packages/planner-ui/src/components/AttentionItem.tsx`
- Single plan card in attention section
- Shows attention badge + plan details
- Click to navigate to plan
- **Column**: LEFT

### AttentionBadge

**File**: `/packages/planner-ui/src/components/AttentionBadge.tsx`
- Visual badge showing attention type (error, warning, info)
- Shows icon + label
- **Column**: SHARED

### CollapsibleSection

**File**: `/packages/planner-ui/src/components/CollapsibleSection.tsx`
- Reusable collapsible group (with expand/collapse arrow)
- Used for grouping plans, steps, etc.
- **Column**: SHARED

---

## Real-Time Communication

### RelayContext

**File**: `/packages/planner-ui/src/contexts/RelayContext.tsx`
- Single shared WebSocket connection for all components
- Provides userId, displayName, connection state
- **Usage**: All components use `const { connection, isConnected } = useRelay()`
- **Column**: CENTER (messaging infrastructure)

### useRelayConnection Hook

**File**: `/packages/planner-ui/src/hooks/useRelayConnection.ts`
- Manages WebSocket lifecycle (connect, reconnect, join/leave channels)
- **Methods**:
  - joinChannel(channelId), leaveChannel(channelId)
  - sendChannelMessage(channelId, content, data)
  - sendDirectMessage(to, content, data)
  - onMessage, onChannelMessage, onJoined, onLeft, onPresenceUpdate (subscription)
- **Reconnection**: Exponential backoff up to 5 attempts
- **Heartbeat**: Pings every 30s to keep connection alive
- **Mock mode**: Falls back to mock mode if relay unavailable
- **Column**: CENTER

### useChannels Hook

**File**: `/packages/planner-ui/src/hooks/useChannels.ts`
- Manages channel list + join/leave state
- Tracks: channels, joinedChannels (Set)
- **Auto-join**: Joins plan channel if planId provided
- **Column**: CENTER

### useChannelMessages Hook

**File**: `/packages/planner-ui/src/hooks/useChannelMessages.ts`
- Subscribes to messages for a specific channel
- Maintains message history
- Fetches existing messages on join
- **Column**: CENTER

### usePresence Hook

**File**: `/packages/planner-ui/src/hooks/usePresence.ts`
- Tracks who's in a channel (presence entries)
- Updates on joined/left events
- **Column**: CENTER

### useActiveChannels Hook

**File**: `/packages/planner-ui/src/hooks/useActiveChannels.ts`
- Lists channels currently joined
- Used in sidebar to show active channels
- **Column**: LAYOUT

### useDmChannel Hook

**File**: `/packages/planner-ui/src/hooks/useDmChannel.ts`
- Creates or joins a DM channel with agent
- Returns channel ID
- Used by status bar to open DM on agent click
- **Column**: CENTER

---

## Agent Orchestration & Questions

### useAgentOrchestration Hook

**File**: `/packages/planner-ui/src/hooks/useAgentOrchestration.ts`
- Polls for agent state + pending questions
- **Returns**:
  - agents (array of Agent with state/role/activity)
  - pendingQuestions (count)
  - resolvedDecisions (count)
  - sessionDuration (seconds)
- **Polling interval**: 5 seconds (or 30s when no active plan)
- **Used by**: StatusBar, Layout
- **Column**: STATUS BAR (data source)

### useQuestionQueue Hook

**File**: `/packages/planner-ui/src/hooks/useQuestionQueue.ts`
- SSE subscription to question events for a plan
- **Methods**:
  - answer(questionId, answerText)
  - dismiss(questionId)
- **Returns**: questions[], currentQuestion, polling control
- **Polling interval**: Configurable (default 30s)
- **Column**: LEFT (data source)

### useQuestionNotifications Hook

**File**: `/packages/planner-ui/src/hooks/useQuestionNotifications.ts`
- Manages question notification queue (bubble auto-advance)
- **Config**: autoAdvanceDelay (default 5s)
- **Returns**: currentNotification, dismiss(), addToQueue()
- **Column**: STATUS BAR (notification state)

---

## Command Palette & Search

### CommandPalette

**File**: `/packages/planner-ui/src/components/CommandPalette.tsx`
- Global keyboard-activated command menu (Cmd+K)
- Integrates: FuzzySearch for plan search + command shortcuts
- **Features**: Recent plans, plan navigation, action shortcuts
- **Keyboard**: Cmd+K to open, Escape to close, Arrow keys to navigate
- **Column**: LAYOUT / SHARED

### useCommandPalette Hook

**File**: `/packages/planner-ui/src/hooks/useCommandPalette.ts`
- Manages palette open/close state
- Exports: open, close, toggle, isOpen
- **Column**: LAYOUT

### useFuzzySearch Hook

**File**: `/packages/planner-ui/src/hooks/useFuzzySearch.ts`
- Fuzzy string matching for plan search
- **Column**: SHARED

---

## State Management Hooks

### usePlansViewMode Hook

**File**: `/packages/planner-ui/src/hooks/usePlansViewMode.ts`
- Manages plan list view mode (list | grouped)
- Persisted to localStorage
- **Column**: RIGHT

### useAttentionPlans Hook

**File**: `/packages/planner-ui/src/hooks/useAttentionPlans.ts`
- Fetches plans requiring attention
- Filters by: execution_failed, change_request, gate_pending, etc.
- **Column**: LEFT (data source)

### useRecentPlans Hook

**File**: `/packages/planner-ui/src/hooks/useRecentPlans.ts`
- Tracks recently viewed plan IDs
- Persisted to localStorage (max 10)
- **Column**: LAYOUT / SHARED

### useSidebarState Hook

**File**: `/packages/planner-ui/src/hooks/useSidebarState.ts`
- Tracks sidebar collapse state + which initiatives are expanded
- Persisted to localStorage
- **Column**: LAYOUT

### useTheme Hook

**File**: `/packages/planner-ui/src/hooks/useTheme.ts`
- Manages dark/light theme
- Respects system preference
- **Column**: LAYOUT

### useCurrentUser Hook

**File**: `/packages/planner-ui/src/hooks/useCurrentUser.ts`
- Returns current authenticated user (or null for anonymous)
- Stub implementation for dev (can be extended for real auth)
- **Column**: SHARED

### useScopeGroupExpansion Hook

**File**: `/packages/planner-ui/src/hooks/useScopeGroupExpansion.ts`
- Tracks which scope groups are expanded in swimlane view
- Persisted to localStorage
- **Column**: RIGHT

### usePlansFilter Hook

**File**: `/packages/planner-ui/src/hooks/usePlansFilter.ts`
- Manages filter state for plans list (owner, initiative, status)
- Persisted to URL params
- **Column**: RIGHT

### usePipelinePlans Hook

**File**: `/packages/planner-ui/src/hooks/usePipelinePlans.ts`
- Fetches plans for pipeline view (grouped by execution status)
- **Column**: RIGHT

### useInitiatives & useInitiative Hooks

**File**: `/packages/planner-ui/src/hooks/useInitiatives.ts` and `useInitiative.ts`
- Fetch all initiatives or a specific one
- Cache + refetch support
- **Column**: LAYOUT / RIGHT

---

## API & Data Fetching

All API calls are in `/packages/planner-ui/src/api/`:

- **plans.ts**: listPlans, getPlan, createPlan, updatePlan, submitVersion, approveVersion, publishVersion
- **initiatives.ts**: listInitiatives, createInitiative, updateInitiative, deleteInitiative
- **comments.ts**: getComments, createComment, resolveComment, unresolveComment
- **chat.ts**: postChatMessage (for AI improvements)
- **questions.ts**: answerQuestion, dismissQuestion
- **changeRequests.ts**: getChangeRequests, approveChangeRequest
- **execution.ts**: getExecutionStatus
- **gates.ts**: approveGate
- **improvements.ts**: getAIImprovements
- **trajectories.ts**: getTrajectoryEvents

All use centralized `client.ts` with shared fetch logic + error handling.

---

## UI Components (Shared)

### Badge

**File**: `/packages/planner-ui/src/components/ui/Badge.tsx`
- Small label component (variant, size)
- **Variants**: default, primary, success, warning, error, info
- **Column**: SHARED

### Button

**File**: `/packages/planner-ui/src/components/ui/Button.tsx`
- Standard button with variants (primary, secondary, outline, ghost)
- **Column**: SHARED

### Input

**File**: `/packages/planner-ui/src/components/ui/input.tsx`
- Text input field (from shadcn)
- **Column**: SHARED

### Checkbox, Radio, Select, Toggle

**File**: `/packages/planner-ui/src/components/ui/` (toggle.tsx, select.tsx, etc.)
- Standard form controls (shadcn-based)
- **Column**: SHARED

### Sheet

**File**: `/packages/planner-ui/src/components/ui/sheet.tsx`
- Slide-out panel (used for mobile sidebar)
- **Column**: LAYOUT

### Sidebar Primitives

**File**: `/packages/planner-ui/src/components/ui/sidebar.tsx`
- Radix-based sidebar components: Sidebar, SidebarHeader, SidebarContent, SidebarFooter, SidebarMenu, SidebarMenuItem, SidebarMenuButton
- **Column**: LAYOUT

### Separator

**File**: `/packages/planner-ui/src/components/ui/separator.tsx`
- Horizontal/vertical divider line
- **Column**: SHARED

### Skeleton

**File**: `/packages/planner-ui/src/components/ui/skeleton.tsx`
- Loading placeholder skeleton
- **Column**: SHARED

### Tooltip

**File**: `/packages/planner-ui/src/components/ui/tooltip.tsx`
- Hover tooltip (from shadcn)
- **Column**: SHARED

### TabPill

**File**: `/packages/planner-ui/src/components/ui/TabPill.tsx`
- Small pill-shaped tab button
- **Column**: SHARED

---

## Custom Icons

All in `/packages/planner-ui/src/components/icons/`:

- ArchitectIcon, DesignerIcon, TesterIcon, SecurityIcon, DatabaseIcon, SettingsIcon (role icons)
- PlansIcon, PipelineIcon, InitiativesIcon, ChannelIcon (nav icons)
- ChevronIcon, ChevronLeftIcon, ChevronRightIcon (navigation)
- SearchIcon, PlusIcon, CloseIcon, EditIcon, TrashIcon (actions)
- CheckIcon, AlertIcon, LockIcon (status)
- MessageIcon, EnvelopeIcon, ChatQuestionIcon (communication)
- SunIcon, MoonIcon (theme)
- DocumentIcon, DatabaseIcon, WaveIcon, BrainIcon (visual elements)
- ColumnsIcon, RowsIcon, TableIcon (view modes)
- And many more...

All accept size prop (sm/md/lg) + custom className.

---

## Utility & Helper Functions

**File**: `/packages/planner-ui/src/utils/`:
- **attention.ts**: getHighestPriorityAttention(plan) — determine attention type
- **scopeGrouping.ts**: groupStepsByScope(steps) — organize by scope
- **time.ts**: formatRelativeTime(), formatAttentionTime() — human-readable timestamps

**File**: `/packages/planner-ui/src/lib/`:
- **utils.ts**: cn() (classname combiner from clsx)
- **identity.ts**: getUserId() (session-persistent anonymous ID)

---

## Configuration

**File**: `/packages/planner-ui/src/config/`:
- **storage-keys.ts**: Enum of localStorage keys (SIDEBAR_COLLAPSED, MESSAGING_SIDEBAR_COLLAPSED, LAST_CHANNEL, etc.)
- **agentRoles.ts**: Predefined role definitions

---

## Pages/Routes

- `/` → PlansListPage
- `/plans/new` → NewPlanPage (create plan)
- `/plans/:planId` → PlanEditorPage (edit plan)
- `/plans/:planId/understanding` → PlanEditorPage (tab=understanding)
- `/plans/:planId/context` → PlanEditorPage (tab=context)
- `/plans/:planId/decisions` → PlanEditorPage (tab=decisions)
- `/initiatives` → InitiativesListPage
- `/initiatives/:id` → InitiativeDetailPage
- `/pipeline` → PipelinePage (board/sequence views)
- `/channels/:channelId` → ChannelPage (dedicated channel view)

---

## State Management Patterns

### localStorage Keys
- SIDEBAR_COLLAPSED (Layout)
- MESSAGING_SIDEBAR_COLLAPSED (Layout)
- SIDEBAR_EXPANSION_STATE (AppSidebar - which initiatives expanded)
- PLANS_VIEW_MODE (PlansListPage - list vs grouped)
- SCOPE_GROUP_EXPANSION (PlanEditor - which scopes expanded in swimlane)
- LAST_CHANNEL (MessagingSidebar - last selected channel)
- THEME (useTheme - dark/light)
- RECENT_PLANS (useRecentPlans - recently viewed)
- USER_ID (useCurrentUser - anonymous user ID, session-scoped)

### Context Providers (React Context)
- **RelayProvider** (App.tsx) - single shared WebSocket connection
- **ToastProvider** (App.tsx) - global toast notifications
- **PlanEditorProvider** (PlanEditorPage.tsx) - plan editing state
- **SidebarProvider** (Layout.tsx) - sidebar collapsed state (from shadcn)

### URL State
- Plan filters: `/plans?owner=me&initiative=foo&status=draft`
- Current plan/step highlighted in URL pathname
- Parent chain for breadcrumb: passed via React Router state object

---

## Three-Column Mapping for "Tend"

### LEFT Column (The Now) - Forming, Creative Space
- NeedsAttentionSection (plans needing action)
- AttentionItem (individual plan card)
- TriagePanel (question queue)
- ChatBubble (answer question)
- QuestionNotificationContent (notification bubble)
- Maybe: WorkingOnSection (future - what user is currently focused on)
- Maybe: SessionPhysicsBlock (from ideation-ui - reusable physics component)

### CENTER Column (Conversation) - Chat & Relay
- MessagingSidebar (channel messages, DMs with agents)
- MessageStream + MessageInput (bidirectional chat)
- ChannelView (dedicated channel page)
- ChatPanel (full-height chat, legacy?)
- RelayContext + useRelayConnection (WebSocket infrastructure)
- useChannels, useChannelMessages, usePresence (relay hooks)

### RIGHT Column (The Tree) - Plan Structure & Steps
- PlanEditorPage + PlanTabContent (main editor)
- StepEditor (step card with inline editing)
- SwimlaneView (swimlane layout of steps)
- DependencyIndicator + DependencyLinesOverlay (dependency visualization)
- AcceptanceCriteriaSection, DependenciesSection, ApprovalGateSection (step details)
- StepSpecificationTabs + DomainSpecEditor (domain-specific specs)
- PlansListPage + PlanCard + PlanTable (plan browser)
- InitiativesListPage + InitiativeCard (initiative browser)
- ViewModeToggle (list vs swimlane in editor)
- PlansViewModeToggle (list vs grouped in browser)
- PipelinePage (execution board view)

### STATUS BAR - Agent Status & Indicators
- StatusBar (fixed bottom bar)
- AgentAvatar (agent state + activity)
- AgentActivityDot, AgentActivityPopover (agent status details)
- useAgentOrchestration (agent data source)
- useQuestionNotifications (notification bubble state)

### LAYOUT - Navigation & Structure
- Layout (main shell)
- AppSidebar (left nav)
- InitiativeCollapsible (initiative item in sidebar)
- SidebarProvider (shadcn sidebar state)
- CommandPalette (Cmd+K search)
- useCommandPalette (palette state)
- useRecentPlans (recent plan links)
- useSidebarState (sidebar expand/collapse)
- useTheme (dark/light toggle)

### SHARED - Used Everywhere
- Badge, Button, Input, Checkbox, Radio, Select, Toggle (form controls)
- Tooltip, Separator, Skeleton (layout)
- EditableText, EditableTextarea (inline editing)
- CollapsibleSection (grouping)
- Icon components (visual elements)
- useCurrentUser (user identity)
- useFuzzySearch (search)
- Utility functions (time formatting, grouping, etc.)
- useToast (toast notifications)

---

## Key Architectural Patterns

### 1. Inline Editing Pattern
Components like EditableText and StepEditor use direct state mutation + API calls:
- Click to activate edit mode
- Enter to save (calls API)
- Escape to cancel
- Optimistic updates where safe

### 2. Real-Time Sync Pattern
PlanEditorContext uses SSE (usePlanEvents) + polling for state sync:
- SSE for when plan changes (another user edits, agent updates status)
- Debounced refetch (250ms) to batch updates
- Version tracking (only update if newer version)

### 3. Persistent State Pattern
Key UI state is stored in localStorage:
- Sidebar collapse, selected initiatives
- View mode preferences
- Last selected channel
- User theme preference
- Recent plan history

### 4. Shared Connection Pattern
Single RelayProvider at app root:
- One WebSocket connection shared across all components
- Prevents user registration churn
- All components use useRelay() context

### 5. Attention Grouping Pattern
Plans are grouped by urgency type for quick scanning:
- Execution failed (highest urgency)
- Change requests, gates pending, awaiting approval
- Stale drafts, unread comments (lowest urgency)
- Collapsible groups for scanning depth

### 6. Swimlane Organization Pattern
Steps visualized in horizontal swimlanes by scope:
- Each scope = one lane
- Steps ordered left-to-right by dependency topology
- Dependency lines drawn as SVG overlay
- Responsive to scroll + DOM changes

### 7. Question Routing Pattern
Questions flow through multiple UIs:
- useQuestionQueue (SSE polling for new questions)
- useQuestionNotifications (auto-advance bubble with delay)
- TriagePanel (queue for > 5 questions)
- ChatBubble (modal dialog for answering)
- Status bar badge (always visible pending count)

---

## CSS/Styling System

**Colors** (CSS variables from @plannr/shared-ui):
- Text: --color-text-primary, --color-text-secondary, --color-text-muted
- Backgrounds: --color-bg-deep, --color-bg-secondary, --color-bg-tertiary
- Borders: --color-border-subtle, --color-border-default, --color-border-light
- Status: --color-success, --color-warning, --color-error
- Accents: --color-accent-cyan, --color-accent-orange

**Layout**:
- Fixed sidebar + flexible content area (CSS grid or flex)
- Fixed status bar at bottom (z-50)
- Responsive: mobile drawer for sidebar, full layout on desktop
- Messaging sidebar optional right column (toggle with localStorage)

**Typography**:
- Font display (Outfit): headings, logo
- Font sans (Inter): body text
- Font mono (IBM Plex Mono): code, specifications

---

## Performance Considerations

1. **Lazy component loading**: Steps + channels use windowing for large lists
2. **Memoization**: useMemo for expensive computations (swimlane order, dependency resolution)
3. **Debouncing**: Real-time sync uses 250ms debounce to batch updates
4. **Event subscription cleanup**: All hooks properly unsubscribe on unmount
5. **Image optimization**: Agent avatars use simple SVG icons (no large images)
6. **CSS containment**: Swimlane lanes use contain: layout for rendering optimization

---

## Known Limitations / Future Improvements

1. **Sub-plans**: Breadcrumb navigation exists but limited nesting depth (recommend 3 levels max)
2. **Comments**: Thread UI is basic; could expand with reactions, edits, pinning
3. **Specification tabs**: Domain picker is manual; could auto-detect from plan metadata
4. **DM channels**: Interface exists but DM creation not fully implemented
5. **Pipeline view**: Current board view is read-only; drag-drop reordering not implemented
6. **Approval workflow**: Simple approve/reject; could expand with conditional branching
7. **Search**: Fuzzy search only on plan names; could extend to step descriptions, tags
8. **Mobile**: Sidebar is drawer-based but main editor view not fully mobile-optimized

---

## File Summary by Category

**Main Shell**: Layout.tsx, App.tsx

**Navigation**: AppSidebar.tsx, InitiativeCollapsible.tsx

**Status Bar**: StatusBar.tsx, AgentAvatar.tsx, AgentActivityDot.tsx, AgentActivityPopover.tsx

**Chat/Questions**: ChatBubble.tsx, TriagePanel.tsx, QueueItem.tsx, QuestionNotificationContent.tsx, ChatPanel.tsx

**Messaging**: MessagingSidebar.tsx, ChannelView.tsx, ChannelHeader.tsx, ChannelMessageList.tsx, MessageInput.tsx, MessageStream.tsx

**Plan Editor**: PlanEditorPage.tsx, PlanEditorHeader.tsx, PlanTabContent.tsx, PlanEditorContext.tsx

**Step Editing**: StepEditor.tsx, EditableText.tsx, EditableTextarea.tsx, DependencyIndicator.tsx, AcceptanceCriteriaSection.tsx, DependenciesSection.tsx, ApprovalGateSection.tsx, StepSpecificationTabs.tsx, DomainSpecEditor.tsx

**Step Visualization**: SwimlaneView.tsx, DependencyLinesOverlay.tsx, ViewModeToggle.tsx, ScopeSummaryStats.tsx, SectionedPlanTable.tsx

**Plan Browsing**: PlansListPage.tsx, PlansToolbar.tsx, PlanCard.tsx, PlanTable.tsx

**Initiative Management**: InitiativesListPage.tsx, InitiativeDetailPage.tsx, InitiativeCard.tsx, InitiativeModal.tsx, ColorPicker.tsx, IconPicker.tsx

**Attention System**: NeedsAttentionSection.tsx, AttentionItem.tsx, AttentionBadge.tsx, CollapsibleSection.tsx

**Relay/WebSocket**: RelayContext.tsx, useRelayConnection.ts, useChannels.ts, useChannelMessages.ts, usePresence.ts, useActiveChannels.ts, useDmChannel.ts

**Agent Orchestration**: useAgentOrchestration.ts, useQuestionQueue.ts, useQuestionNotifications.ts

**Command Palette**: CommandPalette.tsx, useCommandPalette.ts, useFuzzySearch.ts

**State Management Hooks**: usePlansViewMode.ts, useAttentionPlans.ts, useRecentPlans.ts, useSidebarState.ts, useTheme.ts, useCurrentUser.ts, useScopeGroupExpansion.ts, usePlansFilter.ts, usePipelinePlans.ts, useInitiatives.ts, useInitiative.ts

**Utility**: Utils (time, scopeGrouping, attention), Icons, Config (storageKeys, agentRoles)

---

## Next Steps for "Tend"

1. **Identify reusable blocks**: Which components can be taken as-is vs. refactored?
2. **Assess adaptation needs**: Any specialized needs for the new three-column model?
3. **Plan hook migration**: Some hooks (e.g., useRelayConnection, useQuestionQueue) are directly reusable; others need context adjustments.
4. **Typography + layout adjustments**: Will "tend" use same design system or custom theming?
5. **Data model compatibility**: Ensure API contracts remain compatible (same plan/step schema).


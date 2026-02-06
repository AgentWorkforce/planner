# tend: Implementation Plan

## Starting Point

Fork `packages/ideation-ui/` → `packages/tend/`.

Ideation-ui is the closest structural match to tend's three-column layout. It already has:
- Left column with physics-driven forming blocks
- Center column with chat + focus mode
- Right column (curated blocks → becomes the tree)
- Status bar
- CSS Grid layout with focus mode toggle
- SSE real-time updates for blocks
- Specialist-driven block creation

The planner-ui contributes the tree column internals (step editing, dependencies, swimlanes, status tracking) and the infrastructure layer (relay WebSocket, question pipeline, agent orchestration).

---

## What Changes from ideation-ui

### Layout: `IdeationGridLayout` → `TendLayout`

The three-column grid stays. What changes:

| ideation-ui | tend | Change |
|---|---|---|
| Left: `FormingBlocksColumn` | Left: `NowColumn` | Rename. Add reply bar below blocks. Add dashboard mode (project drafts). |
| Center: `SessionChatView` | Center: `ConversationPane` | Add system events, context markers, agent tabs above. |
| Right: `CuratedBlocksColumn` | Right: `ProjectTree` | **Replace entirely.** Curated blocks list becomes a zoomable tree with Work + Artifacts sections. |
| Header: `SessionNav` | Header: `TreeBreadcrumb` | Replace session nav with breadcrumb navigation showing zoom path. |
| Status: `IdeationStatusBar` | Status: `StatusBar` | Merge with planner-ui's StatusBar (agent avatars, progress rings, question bubbles). |

### Pages: Single app, not per-session

| ideation-ui | tend | Change |
|---|---|---|
| `CanvasPage` (one session) | `ProjectPage` (one project) | The main workspace. Three columns, project-scoped. |
| `DashboardPage` (session list) | `DashboardPage` (project list) | Same layout, different content. Left: project drafts/cultivate. Center: AI overview. Right: project list as tree. |
| Session routing (`/ideation/session/:id`) | Project routing (`/projects/:id`) | Unified routing. |
| No concept of "plans" or "steps" | Full plan lifecycle | Integrate planner storage + versioning. |

---

## The Right Column: From Curated Blocks → Project Tree

This is the biggest structural change. The curated blocks column is a flat vertical list. The tree is a hierarchical, zoomable, stateful structure.

### Components to bring from planner-ui

| planner-ui component | Becomes in tend | Adaptation needed |
|---|---|---|
| `StepEditor` | `StepNode` | Simplify to compact tree node view (title + status indicator). Full editing moves to sheets. |
| `SwimlaneView` + `useTopologicalSort` | Tree scope grouping | Adapt from horizontal swimlane to vertical tree structure. Keep dependency ordering. |
| `DependencyIndicator` | `DependencyIndicator` | Reuse as-is. |
| `DependencyLinesOverlay` | Optional — tree structure may make lines unnecessary | Evaluate. Tree nesting might make explicit lines redundant. |
| `AcceptanceCriteriaSection` | In step sheet | Move to sheet (detail view), not inline. |
| `PlanEditorContext` | `ProjectContext` | Adapt — manages step editing state, real-time sync via SSE. Extend with block state. |
| `EditableText` | `EditableText` | Reuse from shared-ui or planner-ui. |

### New components for the tree

| Component | Purpose |
|---|---|
| `ProjectTree` | Container. Manages zoom level state (OVERVIEW/SCOPE/STEP). |
| `TreeBreadcrumb` | Shows current zoom path. Clickable segments to zoom out. |
| `WorkSection` | Groups steps by scope. Collapsible per scope. |
| `ArtifactsSection` | PRs, commits, deploys. Links to external, sheets for internal. |
| `ScopeHeader` | Scope name + progress bar. Click to zoom into scope. |

### Zoom level rendering

```
OVERVIEW:  ScopeHeader (progress bar) per scope. Collapsed.
SCOPE:     One scope expanded → StepNode list. Others collapsed to one line.
STEP:      Full step detail visible in tree. Click again → sheet.
```

State: URL param `?zoom=overview|scope|step&focus=scope-id.step-id`

---

## The Center Column: From Chat → Conversation

### What stays from ideation-ui

- `ChatInput` → stays (rename to `ConversationInput`)
- `ChatMessageList` → stays (rename to `ConversationMessages`)
- `ChatBubble` → stays
- `TypingIndicator` → stays
- `FocusMode` → stays (for forming block inspection)
- Context banner when in focus mode → stays

### What's added

| Component | Source | Purpose |
|---|---|---|
| `SystemEvent` | New (pattern from planner-ui `MessageStream`) | Compact inline markers: "Step completed · 4m 12s · PR #43 created" |
| `ContextMarker` | New | Subtle divider when conversation focus shifts between tree nodes |
| `AgentTabBar` | New | Tab bar above conversation. Main tab + agent tabs. |
| `AgentTab` | New (adapts planner-ui `ChannelView`) | Per-agent conversation view. Shows agent trace, progress, questions. |

### Agent tabs

```
┌─ Main ─┬─ OAuth endpoints ─┬─ Session middleware ─┐
│                                                     │
│  (active tab's conversation content)                │
│                                                     │
```

Each agent tab is a Claude instance with its own tool config. The main conversation doesn't see agent detail — just compact system events. Click an event → opens agent tab.

Implementation: tabs are just a filter on which messages to show. All messages belong to the project. Each has a `channel_id` (main thread or agent-specific). The tab bar switches which channel is rendered.

---

## The Left Column: Stays Mostly the Same

### What stays from ideation-ui

- `FormingBlocksColumn` → `NowColumn`
- `PhysicsBlock` + `PhysicsBlockBase` → stays
- `usePhysicsEngine` → stays
- Block confidence → size mapping → stays
- Block click → focus mode → stays

### What's added

| Component | Source | Purpose |
|---|---|---|
| `ReplyBar` | New (adapts planner-ui `TriagePanel` pattern) | Pending items above chat input. Questions waiting for answers. |
| Dashboard mode | New | When at dashboard level: show project drafts instead of forming blocks. |

### Reply bar

The reply bar sits above the conversation input (technically part of the center column, but functionally bridges left + center). Planner-ui already has the full question pipeline:

```
useQuestionQueue (SSE polling) → useQuestionNotifications (auto-advance bubble, 10-15s) → TriagePanel (queue)
```

Adapt this pipeline. Instead of a triage panel, questions accumulate as compact lines in the reply bar.

---

## Theming: tend's Palette

The current shared-ui theme is "Mission Control" — dark backgrounds, neon cyan/orange/purple accents. tend's vision is "zen garden" — earth tones, warmth, calm. Theming is foundational, not polish. Every component built after the fork inherits tend's palette.

### The transformation

| Aspect | Mission Control (current) | tend |
|---|---|---|
| Background | Cold dark (#0a0a0f) | Warm sand (#f5f0e8 light) / warm charcoal (#1a1816 dark) |
| Accents | Neon (cyan #00d9ff, orange #ff6b35) | Earth (moss #4a7c59, clay #c4703e) |
| Shadows | Dark with glow effects | Subtle, warm-tinted |
| Status colors | Bright neon | Muted earth-tone variants |
| Default mode | Dark | Light (zen garden is naturally light) |
| Canvas | Separate cream theme (#f2f1ed) | Integrated — tend's bg IS the canvas |

### tend's color tokens

```css
:root, .theme-light {
  /* Backgrounds — warm, layered */
  --color-bg-deep: #f5f0e8;          /* Warm sand */
  --color-bg-primary: #ece7dd;       /* Parchment */
  --color-bg-secondary: #e3ddd3;     /* Warm stone */
  --color-bg-tertiary: #d9d2c7;      /* Deeper stone */
  --color-bg-card: #ffffff;           /* Clean white cards */
  --color-bg-elevated: #ffffff;

  /* Text — earth tones */
  --color-text-primary: #2d2a24;     /* Rich brown-black */
  --color-text-secondary: #6b6560;   /* Warm gray */
  --color-text-muted: #9b9590;       /* Faded stone */
  --color-text-dim: #c5bfb8;

  /* Accents — moss and clay */
  --color-accent-primary: #4a7c59;   /* Moss green */
  --color-accent-secondary: #c4703e; /* Clay/terracotta */
  --color-accent-tertiary: #7c6b5e;  /* Warm brown */

  /* Status */
  --color-success: #4a7c59;          /* Moss */
  --color-warning: #c4703e;          /* Clay */
  --color-error: #b54a3a;            /* Brick red */
  --color-info: #5a7a8a;             /* Slate blue */
}

.theme-dark {
  --color-bg-deep: #1a1816;          /* Warm charcoal */
  --color-bg-primary: #201e1a;       /* Dark earth */
  --color-bg-secondary: #282520;
  --color-bg-tertiary: #302c26;
  --color-bg-card: #302c26;
  --color-bg-elevated: #383430;

  --color-text-primary: #e8e2d8;     /* Warm off-white */
  --color-text-secondary: #a09888;
  --color-text-muted: #706860;
  --color-text-dim: #504840;

  --color-accent-primary: #5a9c6a;
  --color-accent-secondary: #d4804e;
  --color-accent-tertiary: #8c7b6e;
}
```

### What stays from shared-ui

- Font stack (Outfit, Inter, IBM Plex Mono) — neutral, works for tend
- Font size scale and typography classes
- Tailwind preset structure — override color variables, keep everything else
- Base styles (scrollbars, focus, reduced motion)
- Component library (shadcn/ui) — colors from variables, structure stays

### File structure

```
packages/tend/src/globals.css    ← tend's earth-tone tokens
packages/shared-ui/theme/        ← shared preset (unchanged)
packages/tend/tailwind.config.cjs ← extends shared preset
```

---

## The Status Bar: Merge Both

| Feature | Source |
|---|---|
| Agent avatars + progress rings | planner-ui `AgentAvatar` + `AgentActivityDot` |
| Question bubble (10-15s timeout) | planner-ui `useQuestionNotifications` + `ChatBubble` |
| Agent polling | planner-ui `useAgentOrchestration` |
| Connection status | planner-ui `StatusBar` connection indicator |
| Pending count badge | planner-ui `StatusBar` question count |

The ideation-ui status bar is simpler (session status + specialist count). Replace it entirely with planner-ui's richer status bar, adapted for tend's agent model.

---

## Infrastructure

### Routing

```
/                    → DashboardPage
/projects/:id        → ProjectPage (three-column workspace)
/settings            → SettingsPage
```

All complexity handled through tree navigation + URL params, not URL routing.

### State management

| Concern | Strategy | Source |
|---|---|---|
| Project + plan data | React Context (`ProjectContext`) | Adapt planner-ui `PlanEditorContext` |
| Forming blocks | SSE + local state | Keep ideation-ui pattern |
| Agent status | Polling (5s) | Keep planner-ui `useAgentOrchestration` |
| Questions | SSE polling (30s) | Keep planner-ui `useQuestionQueue` |
| Relay messaging | WebSocket via `RelayContext` | Keep planner-ui `RelayProvider` |
| UI preferences | localStorage | Both already do this |
| Navigation state | URL params | `?zoom=scope&focus=api-service` |
| Tree zoom level | URL param + context | New |

### API integration

tend talks to the same backend server (port 3001). The existing domain APIs work as-is — new backend work is limited to the project entity, graduation bridge, and the unified interviewer (see Backend Work Inventory):

```
# Ideation (forming blocks, conversation)
POST /api/ideation/sessions           → create session
POST /api/ideation/sessions/:id/chat  → send message
GET  /api/ideation/sessions/:id/blocks → get blocks
GET  /api/ideation/sessions/:id/events → SSE stream

# Planner (tree structure, steps)
POST /api/plans                        → create plan
GET  /api/plans/:id                    → get plan with steps
PUT  /api/plans/:id/versions/:v        → update steps
POST /api/plans/:id/versions/:v/approve → approve

# Forge (execution)
POST /api/forge/runs                   → start execution
GET  /api/forge/runs/:id/events        → SSE stream

# Relay (messaging)
WS   /ws/relay                         → WebSocket for agent messaging
```

### Backend: Project entity

The project is the only new backend table. It links all three domains and stores configuration:

```sql
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id TEXT,
  initiative_id TEXT,
  session_id TEXT,       -- → ideation session
  plan_id TEXT,          -- → planner plan
  run_id TEXT,           -- → forge run (null until execution starts)
  config JSONB,          -- → ProjectConfig (scopes, execution_policy)
  current_focus JSONB,   -- → { focus_type, focus_id, zoom_level }
  created_at TEXT,
  updated_at TEXT
);
```

API:

```
GET    /api/projects              → list projects
POST   /api/projects              → create project
GET    /api/projects/:id          → get project with linked entities
PUT    /api/projects/:id          → update project (name, config, links)
POST   /api/projects/:id/focus    → update current focus (for Interviewer context)
POST   /api/projects/:id/graduate → graduate forming blocks to plan steps
```

The `config` column stores `ProjectConfig` (defined in Git & Code Integration section). The `current_focus` column stores what the user is looking at for the Interviewer's context enrichment.

### The graduation bridge

New API endpoint or tool that converts forming blocks into plan steps atomically:

```
POST /api/projects/:id/graduate
Body: { block_ids: string[] }

→ For each block:
  1. Create Step in PlanVersion (title, scope, description from block)
  2. Mark block as graduated
  3. Emit block_graduated + step_added events
  4. Frontend animates left → right transition
```

This is the key new piece connecting ideation and planner storage.

---

## The Unified Interviewer

Today two separate AI agents handle different domains:

| Agent | Package | Purpose | Key Tools |
|---|---|---|---|
| **Interviewer** | `packages/ideation/` | Brainstorming facilitator. Spawns specialists, weaves insights, manages forming blocks. | `start_session`, `read_session`, `update_understanding`, `update_synthesis`, `spawn_specialist` |
| **PlannerLead** | `packages/server/src/relay/` | Plan authoring. Edits steps, manages dependencies, spawns execution agents. | `read_plan`, `add_step`, `edit_step`, `spawn_agent`, `ask_user_question`, `join_plan_channel` |

Both are persistent relay services using Anthropic SDK with tool calling. Both manage per-channel conversation history. They don't talk to each other.

### The Merged Agent

In tend, these merge into one persistent service: the **Tend Interviewer**. It:

- Listens on `#project-{projectId}` channels (replacing both `#ideation-{sessionId}` and `#plan-{planId}`)
- Has access to ALL tools from both agents, plus new bridge tools
- Maintains one conversation history per project
- Receives context from all three domains: blocks (ideation), steps (planner), run status (forge)

### The Merged Tool Set

Organized by domain:

**Ideation tools** (forming blocks):
- `spawn_specialist` — unchanged. Lazy, AI-driven. Session-scoped lifecycle.
- `read_blocks` — current forming blocks and specialist state (replaces `read_session`)
- `update_understanding` — store specialist observations (invisible to user)
- `update_synthesis` — update aggregate understanding

**Planner tools** (the tree):
- `add_step`, `edit_step` — create/modify steps in PlanVersion
- `read_plan` — current plan state (steps, scopes, dependencies)

**Bridge tools** (new for tend):
- `graduate_blocks` — convert forming blocks to plan steps atomically
- `start_execution` — create forge run from approved steps (wraps `POST /api/forge/runs`)

**Interaction tools**:
- `ask_user_question` — surface blocking questions through attention system
- `spawn_agent` / `release_agent` — manage execution agents via relay
- `report_agent_status` — update agent state in status bar

**Specialist tools** (unchanged — specialists still use):
- `create_block`, `update_block`, `list_blocks` — manage forming blocks
- `queue_insight` — feed observations to Interviewer

### Context Focus

When the user clicks a tree node, the frontend tells the Interviewer what the user is looking at. This changes the AI's context without requiring a new message.

```
User clicks "Session middleware" step
  → Frontend: POST /api/projects/:id/focus
    Body: { focus_type: "step", focus_id: "step-abc", zoom_level: "step" }
  → Backend stores focus on project state
  → Next AI invocation includes in system prompt:
    "User is viewing: Step 'Session middleware' (running, 75%)"
    + step details (AC, deps, agent status, recent events)
```

The focus enriches the next message — it doesn't trigger one. When the user types while focused on a step, the AI already knows what they're looking at.

For focus changes that warrant AI commentary (clicking a scope header), the frontend sends both focus update AND a system message: `context_shift: { from: "overview", to: "scope:api-service" }`. The Interviewer decides whether to speak based on whether it has something useful to say.

### The Trickle Layer

The Interviewer watches forge SSE events and selectively surfaces what matters. This is editorial judgment, not event relay.

```
Forge SSE → Tend Interviewer (subscriber)
  → For each event, decides:
    TRICKLE:    emit as system event in conversation
                (agent spawned, step completed, step blocked)
    TREE ONLY:  update tree state silently
                (progress %, intermediate commits)
    SUMMARIZE:  batch events into AI message
                ("OAuth endpoints done. All 4 AC passed.")
```

The decision logic lives in the Interviewer's prompt, not in code. Blocking events (agent needs input) trigger immediate Interviewer invocation — these can't wait for the user to type next.

**Technically:** The backend subscribes to forge SSE on behalf of the Interviewer. Events are injected into the Interviewer's pending context. The next invocation (user message or blocking event) processes pending events and decides what to trickle.

### System Prompt Structure

```
You are the AI in tend. You help explore ideas, plan work, and manage execution
in one continuous conversation.

Current project: {project_name}
Current focus: {focus_type}: {focus_details}

## State
Forming: {block_count} blocks ({top_block} at {confidence}%)
Plan: {step_count} steps, {scope_count} scopes. {done}/{total} complete.
Execution: {agent_count} agents. {pending_questions} questions waiting.

## Pending forge events:
{events_since_last_message}

## Specialist insights to weave in:
{specialist_queue}

## Rules:
- One voice. Never reveal specialists or internal agents.
- Trickle milestones, not routine progress.
- Propose graduation when blocks reach threshold. Approval is dialogue.
- Adapt to focus: exploratory when ideating, structured when planning,
  status-focused when executing.
```

### What Changes

| Existing | In tend | Change |
|---|---|---|
| `InterviewerService` | `TendInterviewerService` | Merge with PlannerLead tools, project-scoped channels |
| `PlannerLead` | Absorbed | Tools become part of unified agent |
| `#ideation-{id}` + `#plan-{id}` | `#project-{id}` | One channel per project |
| Separate histories | One per project | Single history combines all context |
| No forge awareness | Forge SSE subscription | Trickle decisions |
| `send_to_planner` | `graduate_blocks` | Direct bridge, no cross-service handoff |

---

## Conversation Tabs: Data Model

Tabs are a UI filter, not separate conversations. All messages belong to the project. Each message has a `channel_id` that determines which tab renders it.

### Message tagging

```typescript
interface ProjectMessage {
  id: string;
  project_id: string;
  channel_id: string;       // "main" | "agent-{agentId}"
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: {
    attention_level?: 1 | 2 | 3;   // rendering hint
    block_refs?: string[];          // forming blocks this message references
    step_refs?: string[];           // tree steps this message references
    event_type?: string;            // for system events
  };
  created_at: string;
}
```

### Tab lifecycle

```
Agent spawned for step "Session middleware"
  → Forge creates task, relay spawns agent Worker-{taskId}
  → Backend creates channel "agent-{taskId}"
  → Frontend: new tab appears in AgentTabBar
  → Tab shows agent's message stream (tool calls, reasoning, progress)

Agent completes
  → Tab gets a "completed" indicator
  → After a delay (or when user navigates away), tab auto-collapses
  → Main conversation gets a summary system event:
    "┊ Step completed · 4m 12s · PR #43 created"
  → Tab remains accessible (click the system event to reopen)

Agent blocked
  → Tab gets a red indicator
  → Question bubbles through attention system (status bar → reply bar)
  → Clicking reply bar item opens this tab, scrolled to question
```

### What the main tab sees vs agent tabs

| Content | Main tab | Agent tab |
|---|---|---|
| User messages | Yes | No (agents don't see user chat) |
| AI (Interviewer) messages | Yes | No |
| System events (compact) | Yes | No |
| Agent tool calls | No | Yes |
| Agent reasoning trace | No | Yes |
| Agent questions | Summary only | Full context |
| Agent progress | Via system events | Detailed |

### Tab state persistence

- Active tabs stored in `ProjectContext` (React state)
- On navigation away and back: tabs restored from active forge tasks
- Completed tabs: accessible via system events in main conversation
- URL doesn't encode tab state — tabs are ephemeral UI, not navigation

---

## Attention Level System

Every piece of information in tend has an attention level. This is a rendering system, not a component — it's a cross-cutting pattern that every component respects.

### The three levels

| Level | Treatment | Used for |
|---|---|---|
| **1 — Background** | Lower font weight, blends in. The user sees it if looking, ignores it otherwise. | System events, progress updates, completed steps, timestamps |
| **2 — Foreground** | Normal to slightly elevated weight. Noticeable in flow. | AI questions, state changes, context markers, active steps |
| **3 — Raised** | Card with drop shadow, badges/icons. Above the background layer. | Blocking questions, items requiring action, inspection cards that open sheets |

### Implementation

```typescript
interface AttentionItem {
  level: 1 | 2 | 3;
  content: string;
  choices?: { label: string; action: string }[];
  route?: string;        // navigation target if clickable
  step_ref?: string;     // tree step to highlight
}
```

Components receive attention level and render accordingly:
- `SystemEvent` renders at level 1 (compact, subtle)
- `ContextMarker` renders at level 1
- `QuestionCard` renders at level 2 (in conversation) or level 3 (blocking, in reply bar)
- Agent bubble in status bar renders at level 3

**Typography does the work.** Weight and size, not color. Color is reserved for semantic meaning (status indicators). This keeps the zen garden calm — no rainbow of attention-grabbing colors.

---

## Multiple-Choice Input

For direct questions with discrete options, choices appear in the conversation input area. This is a new component that doesn't exist in either ideation-ui or planner-ui today.

### MultipleChoiceInput

```
┌─────────────────────────────────────────┐
│  [A: JWT tokens]  [B: Session cookies]  │
│  [C: OAuth2 only]  [or type your own]   │
├─────────────────────────────────────────┤
│  Type here...                           │
└─────────────────────────────────────────┘
```

**Rules:**
- Max ~4 options (last is always freeform "other")
- Styled as text options, not chunky buttons — consistent with text-first aesthetic
- Appears when the AI's message includes `choices` in metadata
- Clicking an option sends it as a user message
- Options disappear after selection
- Dashboard-level questions use this; agent blocking questions use the status bar bubble system

### Data flow

```
AI message arrives with metadata.choices: ["JWT tokens", "Session cookies", "OAuth2 only"]
  → ConversationInput renders MultipleChoiceInput above the text input
  → User clicks "JWT tokens"
  → Sends as user message: "JWT tokens" (or however the AI phrased the option)
  → MultipleChoiceInput disappears
  → Conversation continues
```

---

## Build Order

### 1. Fork, scaffold, and theme

- Copy `packages/ideation-ui/` → `packages/tend/`
- Update package.json (`@plannr/tend`), port (3004), Vite config
- **Set up tend's globals.css with earth-tone tokens** — every component built after this inherits the right palette
- Rename core components (IdeationGridLayout → TendLayout, etc.)
- Add routing: `/` dashboard, `/projects/:id` workspace, `/settings`
- Verify it runs with tend's palette

### 2. Replace right column (the tree)

- Remove `CuratedBlocksColumn`
- Add `ProjectTree` with zoom level state management
- Bring in `StepEditor` (simplified as `StepNode`) from planner-ui
- Add `WorkSection` with scope grouping
- Add `TreeBreadcrumb` for navigation
- Wire `PlanEditorContext` (adapted) for step data
- Verify: tree renders steps, zoom works, breadcrumb navigates

### 3. Build sheets

- `StepSheet` — slides in from right. Contains: title, scope, owner role, description, dependencies, acceptance criteria, execution info, traceability
- `SheetContainer` — slide-in panel with drop shadow overlay
- Focused chat input at bottom of sheets
- Wire: click step at STEP zoom level → opens sheet
- Verify: sheets open/close, editing works, sheet chat flows to main conversation

### 4. Enhance center column

- Add `SystemEvent` component for compact inline markers
- Add `ContextMarker` for focus-shift dividers
- Add `AgentTabBar` + `AgentTab` above conversation
- Add `MultipleChoiceInput` — options in input area for direct questions
- Wire relay WebSocket (`RelayProvider` from planner-ui)
- Adapt `SessionChatView` → `ConversationPane` with tab awareness
- Verify: conversation shows system events, tabs switch, multiple-choice works

### 5. Enhance status bar and reply bar

- Replace ideation status bar with planner-ui's richer `StatusBar`
- Bring in `AgentAvatar`, question bubble pipeline
- Wire `useAgentOrchestration`, `useQuestionNotifications`
- Build `ReplyBar` above chat input (compact pending items)
- Verify: agent avatars show, questions bubble up, reply bar accumulates

### 6. Build graduation bridge and unified interviewer

- Create `graduate_blocks` API endpoint (backend)
- Create `TendInterviewerService` merging Interviewer + PlannerLead tools
- Wire forming block → step conversion with left → right animation
- Wire context focus mechanism (click tree → AI knows)
- Wire forge SSE → Interviewer trickle layer
- Verify: blocks graduate, tree updates, AI adapts to focus, forge events trickle

### 7. Build dashboard

- Dashboard page: project list in right column, AI overview in center
- Left column: project drafts at dashboard level
- Project creation flow via conversation
- Empty states (zen garden aesthetic — raked sand, peaceful, full of potential)
- First-time experience (AI greeting, `[+ new]` entry point)
- Verify: projects listed, can create new, can navigate into project

### 8. Polish and edge cases

- Keyboard navigation (Cmd+K command palette — searches tree nodes, steps, projects)
- Tree crystallizing animation (characters resolve from noise to text)
- Graduation animation refinement (block shrinks left, step appears right)
- Workspace transition animations (columns sliding in from edges)
- Attention level system consistency pass
- Error states and recovery UI
- Settings page (bubble timing, cost visibility, theme preference)
- Verify: all animations smooth, error states handled, settings functional

---

## Git & Code Integration

### How repos get connected

When the user starts a project, they point tend to code. Two options:

1. **Local folder**: "This project is about `/Users/me/code/backend`" — the user points to a directory on disk. tend discovers it's a git repo (or not).
2. **Remote repo**: "This project works on `github.com/acme/backend`" — tend clones it locally.

This can happen:
- At project creation: the AI asks "what code are we working on?" or the user volunteers it
- During conversation: "the API lives in our backend repo at ~/code/backend"
- Through a settings/config UI on the project

For multi-scope projects, each scope maps to a repo (or a subdirectory):

```
Auth System project
├─ api-service   → ~/code/backend/
├─ web-frontend  → ~/code/web-app/
└─ infrastructure → ~/code/infra/
```

This mapping is stored on the project entity and passed to forge as `workspace_path` when creating a run.

### Branch strategy

tend manages branches automatically. When execution starts on a step:

1. tend creates `tend/{step-slug}` branch from the scope's default branch
2. The branch name is deterministic from the step title: `tend/session-middleware`, `tend/oauth-endpoints`
3. The agent receives the branch name in its task prompt along with `workspace_path`
4. Agent works on the branch, commits, pushes
5. Agent creates PR via git/GitHub CLI and reports it as an artifact

**Why `tend/*` prefix**: Clear signal that this branch is managed by tend. Easy to filter in git log. Prevents collision with human branches. Easy cleanup.

**One branch per step.** Not per scope, not per project. Each step's work is isolated. Dependencies between steps may create merge situations — the agent handles this (it can see the upstream branch/PR).

### Forge integration (the execution engine)

Forge already has everything needed. The flow:

```
1. User says "start the API work"
   → Interviewer recognizes execution intent

2. Interviewer calls graduate_blocks (if blocks haven't graduated yet)
   → Forming blocks become Steps in PlanVersion

3. Tend creates a Forge Run via POST /api/forge/runs
   → Sends ForgePlan (steps + dependencies + AC)
   → Sends workspace_path per scope
   → Sends execution_policy (budgets, parallelism, retry)

4. Forge orchestrator:
   → Creates Task per step
   → Checks dependency DAG for ready tasks
   → Spawns agents via relay for ready tasks
   → Each agent gets: task prompt, workspace_path, branch name, MCP tools

5. Agent works:
   → cd to workspace_path
   → git checkout -b tend/session-middleware
   → Writes code, runs tests
   → git push, creates PR
   → Calls report_complete with artifacts: [{ type: "pr", reference: "https://..." }]

6. Forge captures completion:
   → Updates task status → completed
   → Stores artifacts (PR URL, commit SHA)
   → Emits trajectory event
   → Checks DAG for newly unblocked tasks → dispatches next

7. Tend receives SSE events:
   → Tree updates: step status changes, artifacts appear
   → Interviewer trickles key events to conversation
```

### What the user sees during execution

**In the tree:**
- Step status changes: ○ pending → ⟳ running → ✓ done
- Progress percentage updates (from agent `report_progress` calls)
- Agent name shown on running steps
- Artifacts appear under ARTIFACTS as they're reported

**In the conversation (trickles):**
- Compact system events inline: `┊ Agent spawned · Coder (Haiku) · 10:42am`
- Progress markers: `┊ Progress: 60% · Refactoring serializer`
- Completion: `┊ Step completed · 4m 12s · PR #43 created`
- The AI summarizes when it thinks it's valuable — not every event, just meaningful ones

**In agent tabs:**
- Click any system event → opens agent tab
- Full agent trace: tool calls, code reads, reasoning, git operations
- Agent questions appear here (also bubble up to status bar + reply bar)

**Artifacts in the tree:**
Forge captures artifacts via `report_complete`. Types:

| Type | Example | Tree rendering |
|---|---|---|
| `pr` | PR URL | `PR #43 — Session middleware (+120 -30)` — click opens GitHub |
| `commit` | Git SHA | Shown inside PR, not separately |
| `deployment` | URL | `Deployed to staging — https://staging.example.com` |
| `test_result` | JSON | `Tests: 42 passed, 0 failed` — click opens sheet |
| `file` | File path | Listed if significant |

The Interviewer decides what to surface in conversation. Not every artifact gets a trickle — a PR completion does, an intermediate commit probably doesn't. This is the "drops info when valuable" principle.

### Multi-repo coordination

Agents working on different scopes (repos) coordinate via relay channels. All agents in a project auto-join `#plan-{planId}`:

```
Agent A (api-service): "OAuth endpoints complete. API shape:
  POST /auth/token → { access_token, refresh_token }
  POST /auth/refresh → { access_token }"

Agent B (web-frontend): reads channel history → sees API shape
  → Implements login page using the correct endpoints
  → "Login page complete, tested against staging API"
```

No synchronous blocking. Channel history is persistent — late-joining agents can read what happened before they started. Forge's dependency DAG ensures agents don't start until their upstream dependencies are complete (or at least running, depending on policy).

### Forge configuration per project

The project entity stores execution preferences:

```typescript
interface ProjectConfig {
  scopes: {
    [scopeName: string]: {
      workspace_path: string;       // local path to repo
      remote_url?: string;          // github URL for cloning
      default_branch?: string;      // main, master, develop
    }
  };
  execution_policy?: {
    max_concurrent_tasks: number;   // default: 5
    per_task_time_seconds: number;  // default: 300
    max_retries: number;            // default: 3
    budget_usd?: number;            // optional cost cap
  };
}
```

### What's new vs what forge already provides

| Capability | Status |
|---|---|
| Run creation from approved plan | **Exists** — `POST /api/forge/runs` |
| Task DAG scheduling | **Exists** — orchestrator with dependency resolution |
| Agent spawning via relay | **Exists** — `forge-spawner.ts` |
| Agent MCP tools (report_complete, report_progress, etc.) | **Exists** — 7 tools |
| Artifact capture (PR, commit, deploy, test) | **Exists** — via `report_complete` |
| Trajectory capture (43 event types) | **Exists** — full audit trail |
| `workspace_path` propagation | **Exists** — passed in task prompt |
| SSE event streaming | **Exists** — `GET /api/forge/runs/:id/events` |
| Branch management (`tend/*` branches) | **New** — need to add pre-spawn branch creation |
| Scope → repo mapping | **New** — need to add to project config |
| Artifact → tree rendering | **New** — frontend work in tend |
| Conversation trickles from forge events | **New** — Interviewer watches forge SSE, selectively surfaces |

---

## Backend Work Inventory

Honest accounting of new backend work (beyond the existing APIs):

| Piece | Scope | Complexity |
|---|---|---|
| `projects` table + CRUD API | New table, 5 endpoints | Low — straightforward Express routes + SQLite |
| `graduate_blocks` endpoint | Cross-domain bridge: reads blocks, creates steps, emits dual events | Medium — needs atomic operation across ideation + planner storage |
| `TendInterviewerService` | Merge Interviewer + PlannerLead into one relay service | High — largest new backend piece. Unified tool set, project-scoped channels, forge event subscription |
| Context focus endpoint | Store + retrieve user focus for prompt enrichment | Low — single field update |
| Branch creation service | Pre-spawn: create `tend/{step-slug}` branches in workspace | Low — git CLI wrapper |
| Forge SSE proxy | Subscribe to forge events on behalf of Interviewer | Medium — event buffering, immediate invocation for blocking events |
| Project-scoped relay channels | `#project-{id}` replacing `#ideation-{id}` + `#plan-{id}` | Low — channel naming change |

**Not new backend work** (already exists):
- All ideation APIs (sessions, blocks, specialists, SSE)
- All planner APIs (plans, versions, steps, SSE)
- All forge APIs (runs, tasks, events, SSE)
- Relay WebSocket proxy
- Agent spawning via forge-spawner

### SSE Strategy

Three existing SSE streams feed tend:

| Stream | Source | Events | Frontend consumer |
|---|---|---|---|
| Ideation SSE | `GET /api/ideation/sessions/:id/events` | `block_created`, `block_updated`, `understanding_updated`, `confidence_changed` | Left column (forming blocks) |
| Planner SSE | `GET /api/plans/:id/events` | `plan_change` (step added/edited/removed), `question_event` | Right column (tree) |
| Forge SSE | `GET /api/forge/runs/:id/events` | `run_status_changed`, `task_status_changed`, `agent_progress`, `gate_reached`, `question_added` | Tree (step status) + Interviewer (trickle decisions) |

**Strategy:** Keep separate streams. The frontend subscribes to all three via existing hooks (`useSessionEvents`, `usePlanEvents`, `useRunEvents`). A new `useProjectEvents` hook composes them:

```typescript
function useProjectEvents(project: Project) {
  // Left column updates
  useSessionEvents(project.session_id, {
    onBlockCreated: (blocks) => updateFormingBlocks(blocks),
    onConfidence: (score) => updateConfidence(score),
  });

  // Tree updates
  usePlanEvents(project.plan_id, true, (event) => {
    refetchPlanData();
  });

  // Execution updates (when run exists)
  useRunEvents(project.run_id, {
    onEvent: (event) => {
      updateTreeStatus(event);       // tree always gets real-time
      forwardToInterviewer(event);   // Interviewer decides what to trickle
    },
  });
}
```

No new SSE endpoint needed. Composition at the frontend.

---

## Error and Failure States

### Step failures

```
Agent fails step (retries exhausted)
  → Tree: step shows ✗ with error summary
  → Conversation: system event "┊ Step failed · Session middleware · 3 retries exhausted"
  → Interviewer summarizes: "Session middleware failed. The agent couldn't resolve
    the Redis serializer issue. Options: retry with different approach, skip, or
    I can investigate."
  → Reply bar: pending decision item
  → Status bar: agent avatar shows red, then fades after user acknowledges
```

### Run failures

```
Forge run crashes or times out
  → Tree: all running steps show ⚠ (paused, not failed)
  → Conversation: "The execution run encountered an issue. All agents have been paused.
    You can resume, restart, or cancel."
  → Multiple-choice input: [Resume] [Restart from failed] [Cancel run]
```

### Connection loss

```
SSE disconnects (network issue)
  → Tree: shows stale indicator (subtle "last updated X ago" on running steps)
  → Status bar: connection indicator appears (normally hidden)
  → On reconnect: all three SSE streams reconnect with exponential backoff
    (existing pattern — useSessionEvents, usePlanEvents, useRunEvents all have this)
  → Forge SSE supports Last-Event-ID for missed event replay
  → Tree state reconciles from fresh API fetch after reconnect
```

### Agent stuck

Two types (from vision doc):
- **Normal stuck** — needs information/decision. Interviewer asks the agent what would help, surfaces questions to user. Handled through attention system.
- **System stuck** — agent looping, crashed, hit a wall. Forge detects via timeout or tool call patterns. System-level handling: auto-restart, escalate to user if retry fails.

---

## Empty States and First Experience

### First time opening tend

No projects exist. The dashboard shows:

```
┌──────────────────┬──────────────────────────┬──────────────────────┐
│                  │                          │                      │
│                  │  What would you like to  │                      │
│                  │  work on?               │  (empty)             │
│                  │                          │                      │
│  (collapsed)     │  I can help you explore  │  [+ new]             │
│                  │  an idea, plan a feature,│                      │
│                  │  or jump into building.  │                      │
│                  │                          │                      │
│                  │  ┌─────────────────────┐ │                      │
│                  │  │ Type here...        │ │                      │
│                  │  └─────────────────────┘ │                      │
├──────────────────┴──────────────────────────┴──────────────────────┤
│  (no active agents)                                                │
└───────────────────────────────────────────────────────────────────┘
```

The left column is collapsed. The right column shows only `[+ new]`. The center is a warm, inviting AI greeting. Zen garden: peaceful, ready, full of potential.

### Empty project (just created)

```
Left:  "Things will appear as we talk." (subtle text, collapsed)
Center: AI conversation in progress
Right:  Project name only. Work and Artifacts sections hidden (no content yet).
```

### Empty sections

Sections don't show when empty:
- WORK section: hidden until first step graduates
- ARTIFACTS section: hidden until first artifact reported
- Left column blocks: collapsed when nothing is forming
- Reply bar: hidden when no pending items
- Agent tabs: only Main tab when no agents running

---

## Settings Page

Route: `/settings`. Accessible from dashboard or any project.

### Settings content

| Setting | Default | Notes |
|---|---|---|
| **Theme** | Light (system preference) | Light/Dark/System. Respects `prefers-color-scheme`. |
| **Status bar bubble timing** | 15s (blocking: 30s, FYI: 8s) | How long agent question bubbles stay visible |
| **Graduation threshold** | 65% | Confidence threshold for auto-proposing block graduation. Tuner adjusts this over time. |
| **Cost visibility** | Hidden | Show/hide cost per step, per project. Not in status bar (not zen). |
| **Execution defaults** | 5 concurrent, 300s timeout, 3 retries | Default execution policy for new projects |
| **Relay connection** | Auto | Connection status, manual reconnect |

Project-specific settings (scope→repo mapping, execution policy) live on the project entity, not in global settings. Accessible via conversation ("change the timeout for this project") or eventually through a project settings sheet.

---

## Open Technical Questions

1. **Shared components**: Should we extract components used by both ideation-ui and tend into `shared-ui`? Or keep copies and diverge?
2. **Branch conflict resolution**: When two steps in the same scope create branches from the same base, how do we handle merge conflicts? Agent responsibility? Or forge coordination?
3. **Remote repo support**: For teams — do we need to support repos the user doesn't have locally? Clone on demand? Or require local checkout?
4. **Tauri integration timing**: When do we add the Tauri wrapper? After all 8 build stages? Or earlier to validate system tray / background agent behavior?
5. **Conversation history limits**: Projects can run for weeks. How do we manage conversation history length for the Interviewer's context window? Summarization? Sliding window? RAG over history?
6. **Offline mode**: Vision doc flags this as open. If SSE drops and agents keep working via relay, how does the UI catch up? Fresh API fetch + Last-Event-ID replay covers forge, but what about ideation and planner events?

### Resolved (previously open)

- ~~Backend project entity~~ → `projects` table defined in Infrastructure section. Build stage 6.
- ~~Dual SSE streams~~ → Keep separate, compose at frontend via `useProjectEvents`. See SSE Strategy.
- ~~Specialist spawning in tend~~ → Unchanged. Same backend, same relay pattern. Confirmed in Unified Interviewer section.

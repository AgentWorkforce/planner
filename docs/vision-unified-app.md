# Vision: Unified Plannr App

## The Problem With Three Apps

Today, Plannr is split across three separate frontends:

| App | Port | Purpose |
|-----|------|---------|
| ideation-ui | 3002 | Brainstorm and refine ideas |
| planner-ui | 3000 | Structure plans, approve, publish |
| forge-ui | 3003 | Monitor execution |

Plus tuner on port 4002 (backend-only, no UI).

This creates friction:

- **Context loss**: Switching between apps means losing your mental model. You brainstorm in one window, plan in another, watch execution in a third.
- **Explicit handoffs**: "Send to Planner" is a ceremony. "Publish to Forge" is another. These are implementation boundaries masquerading as user workflows.
- **Fragmented navigation**: Three sidebars, three command palettes, three sets of routes. The user has to remember where things live.
- **Disconnected state**: Agent activity in planner doesn't show in ideation. Execution progress in forge doesn't surface in the plan view.
- **Onboarding cost**: New users face three apps to learn instead of one coherent experience.

The underlying pipeline is natural and linear: **Idea → Plan → Execution → Learning**. But the current architecture forces the user to drive between three buildings when they should be walking through one.

---

## The Core Insight

**The user's mental model is a Project, not a pipeline.**

A project starts as a vague idea ("improve authentication"), gets refined through conversation, crystallizes into structured steps, gets executed by agents, and produces results. The user doesn't think "I'm in the ideation phase now" or "time to switch to the planner." They think "I'm working on the authentication project."

The unified app should honor this mental model.

---

## What Each Domain Contributes

### From Ideation (Keep: the conversation + specialist insights)

**Essential:**
- Chat-based brainstorming with AI interviewer
- Specialist observations that emerge from conversation (blocks/nuggets)
- Confidence tracking (how well does the AI understand the intent?)
- Document upload and analysis (feeding context into brainstorming)
- The Navigator concept (meta-level "what should you work on?")

**Reconsider:**
- Physics engine (visually striking, but adds complexity. The *concept* of blocks with confidence states is valuable; the Matter.js simulation is a specific visualization choice that could be simplified)
- Separate "sessions" as a first-class entity (becomes a project phase instead)
- Three-column canvas layout (could be adapted into a single workspace)

### From Planner (Keep: the structure + approval workflow)

**Essential:**
- Plan creation with steps, dependencies, scopes, acceptance criteria
- Versioning and immutability (approved versions are locked)
- Multi-scope visualization (swimlanes showing cross-repo/team work)
- Initiatives as organizational containers
- Agent messaging via relay channels (plan-specific conversations)
- Question queue and triage (agents asking humans for input)
- Status bar with agent presence
- Command palette (Cmd+K) for fast navigation

**Reconsider:**
- Separate "plans" vs "initiatives" hierarchy (could be flattened: projects contain plans)
- Heavy approval workflow (draft → submitted → approved → published is 4 states. For a single user or small team, draft → approved might suffice)
- MCP server as separate concern (fold into unified backend)
- Pipeline view (useful but duplicates what execution monitoring already shows)

### From Forge (Keep: the execution dashboard + agent lifecycle)

**Essential:**
- Run creation and monitoring (real-time task progress)
- Agent spawning and lifecycle management
- Gate approvals during execution (human checkpoints)
- Timeline/event log (chronological audit trail)
- Artifact tracking (commits, PRs, deployments)
- Preflight validation before execution starts
- DOT Framework (budget enforcement, retry strategies, confidence thresholds)

**Reconsider:**
- Separate "runs" page (execution is just another state of a project)
- Test mode vs real mode distinction in UI (could be a toggle, not a separate concept)
- Detailed execution metrics in UI (most users care about "is it done?" not "how many tokens did Haiku use?")

### From Tuner (Keep: the intelligence, invisible)

**Essential:**
- Model selection optimization (which model for which task)
- Cost/budget tracking and drift detection
- Config generation (execution policies that improve over time)
- Outcome collection and baseline building

**Reconsider:**
- Tuner as a separate service (could be an embedded module in the unified backend)
- CLI interface (surfaced as insights in the main UI instead)
- Separate port/database (merge into main)

---

## The Unified App Vision

### One App, One Workspace

```
┌─────────────────────────────────────────────────────────────────┐
│  [Sidebar]              [Main Workspace]           [Context]    │
│                                                                 │
│  PROJECTS               Adaptive content area      Agent chat   │
│  ├─ Auth System (🔵)    that shifts based on       Specialist   │
│  ├─ API Redesign (🟢)   project phase:             insights     │
│  └─ Mobile App (🟡)                                Execution    │
│                         • Ideation → Chat canvas    details     │
│  ACTIVE RUNS            • Planning → Step editor               │
│  ├─ Auth: 3/7 tasks     • Execution → Dashboard               │
│  └─ API: Running...     • Review → Results                     │
│                                                                 │
│  CHANNELS               Seamless transitions -                  │
│  ├─ #auth-system        no app switching                       │
│  └─ #api-redesign                                              │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  [Status Bar] Agent activity | Questions (2) | Cost: $1.43     │
└─────────────────────────────────────────────────────────────────┘
```

### Project Lifecycle (Not Pipeline Stages)

A project flows through phases organically. The UI adapts:

```
  ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
  │ IDEATING │────▶│ PLANNING │────▶│ FORGING  │────▶│ COMPLETE │
  │          │     │          │     │          │     │          │
  │ Chat +   │     │ Steps +  │     │ Agents + │     │ Results +│
  │ Insights │     │ Approval │     │ Progress │     │ Learnings│
  └──────────┘     └──────────┘     └──────────┘     └──────────┘
        ▲                                 │
        └─────────────────────────────────┘
              (Feedback: change request)
```

**Phase transitions are soft, not hard.** You can always go back. An approved plan can trigger a "re-ideate" if execution reveals gaps. A running forge task can surface a question that sends you back to the plan editor.

### Key UX Screens

#### 1. Home / Dashboard

The Navigator concept from ideation, but for everything:

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   Good morning. Here's what needs your attention:           │
│                                                             │
│   🔴 Auth System — Agent blocked, needs your input          │
│      "Should we use JWT or session cookies?"                │
│      [Answer] [View Plan]                                   │
│                                                             │
│   🟡 API Redesign — Plan ready for approval                 │
│      3 scopes, 12 steps. Last edited 2h ago.                │
│      [Review] [Approve]                                     │
│                                                             │
│   🟢 Mobile App — Forging in progress                       │
│      ████████░░ 6/10 tasks complete                         │
│      [Monitor]                                              │
│                                                             │
│   ─────────────────────────────────────                     │
│   💬 "What would you like to work on next?"                 │
│   [Start a new project...]                                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

This merges:
- Planner's "Needs Attention" sections
- Forge's run status cards
- Ideation's Navigator chat
- Question triage from all domains

#### 2. Project View — Ideation Phase

When you create a new project or open one that's in ideation:

```
┌─────────┬───────────────────────────────┬──────────────┐
│ Sidebar │       Conversation            │  Insights    │
│         │                               │              │
│ PROJECTS│  🤖 What problem are you      │  EMERGING    │
│ ...     │     trying to solve?          │              │
│         │                               │  ◐ Auth flow │
│ PHASE   │  👤 We need better auth.      │    63% conf  │
│ ○ Ideate│     Users keep getting        │              │
│ ○ Plan  │     locked out.               │  ◐ Session   │
│ ○ Forge │                               │    mgmt      │
│ ○ Done  │  🤖 Let me understand the     │    41% conf  │
│         │     current auth flow...      │              │
│ BLOCKS  │                               │  SPECIALISTS │
│  5 total│  🔒 Security Specialist:      │  🔒 Security │
│  2 ready│  "Consider OAuth2 + PKCE"     │  🏗 Architect│
│         │                               │  📊 Product  │
│         │  [Type your message...]       │              │
└─────────┴───────────────────────────────┴──────────────┘
```

This is ideation's current canvas, adapted:
- Left sidebar now shows *project* context (phase indicator, blocks summary)
- Center is the chat (same as ideation's SessionChatView)
- Right panel shows emerging insights/blocks and specialist activity
- **No app switching** — when you're ready, click "Structure as Plan" and the workspace morphs

#### 3. Project View — Planning Phase

```
┌─────────┬───────────────────────────────┬──────────────┐
│ Sidebar │       Plan Editor             │  Agent Chat  │
│         │                               │              │
│ PROJECTS│  AUTH SYSTEM v3 (draft)       │  #auth-system│
│ ...     │  ┌─────────────────────────┐  │              │
│         │  │ api-service             │  │ PlannerLead: │
│ PHASE   │  │ ├─ Add OAuth endpoints  │  │ "I've added  │
│ ● Ideate│  │ ├─ Add session middleware│  │  the PKCE    │
│ ◉ Plan  │  │ └─ Add token refresh    │  │  step based  │
│ ○ Forge │  ├─────────────────────────┤  │  on Security │
│ ○ Done  │  │ web-frontend            │  │  Specialist's│
│         │  │ ├─ Add login page       │  │  observation"│
│ STEPS   │  │ ├─ Add protected routes │  │              │
│ 7 total │  │ └─ Add token storage    │  │ You:         │
│ 3 scopes│  ├─────────────────────────┤  │ "Looks good, │
│         │  │ infrastructure          │  │  approve it" │
│ [Approve]│ │ └─ Add OAuth secrets    │  │              │
│         │  └─────────────────────────┘  │ [Message...] │
└─────────┴───────────────────────────────┴──────────────┘
```

This is planner's current editor, with key additions:
- Phase indicator shows ideation is complete (filled dot)
- **Blocks from ideation are visible** as context (specialist observations carried forward)
- Right panel is the plan channel (same relay messaging)
- Approve action is in the sidebar, prominent when plan is ready
- **Transition from ideation is seamless** — the insights become the plan's "understanding" section

#### 4. Project View — Forging Phase

```
┌─────────┬───────────────────────────────┬──────────────┐
│ Sidebar │       Execution Dashboard     │  Live Feed   │
│         │                               │              │
│ PROJECTS│  AUTH SYSTEM — Forging        │  TIMELINE    │
│ ...     │  ████████░░░░ 5/7 tasks       │              │
│         │  Budget: $1.43 / $10.00       │  12:03 Task  │
│ PHASE   │                               │  "Add OAuth" │
│ ● Ideate│  ┌────────────────────────┐   │  completed ✓ │
│ ● Plan  │  │ api-service       3/3 ✓│   │              │
│ ◉ Forge │  │ web-frontend      1/3 ░│   │  12:01 Agent │
│ ○ Done  │  │ infrastructure    1/1 ✓│   │  spawned for │
│         │  └────────────────────────┘   │  "Login page"│
│ AGENTS  │                               │              │
│ 🟢 Coder│  ⚠ GATE: Review OAuth config │  11:58 Gate  │
│ 🟡 Tester│  before deploying secrets    │  approved by │
│         │  [Approve] [Reject]           │  user        │
│         │                               │              │
│ COST    │  ARTIFACTS                    │  [Full log]  │
│ $1.43   │  • PR #42: OAuth endpoints    │              │
│ 7 tasks │  • PR #43: Login page         │              │
└─────────┴───────────────────────────────┴──────────────┘
```

This is forge's dashboard, integrated:
- Same sidebar, phase indicator shows forging is active
- Center shows task progress grouped by scope (same as forge's RunDashboardPage)
- Right panel is a live timeline (forge's TimelinePage, condensed)
- Gate approvals are inline, not a separate page
- Artifacts (PRs, commits) are visible in context
- Agent avatars in sidebar show who's working
- **You can click back to "Plan" phase to see the original plan** — it's the same project

#### 5. Project View — Complete

```
┌─────────┬───────────────────────────────┬──────────────┐
│ Sidebar │       Results Summary         │  Learnings   │
│         │                               │              │
│ PROJECTS│  AUTH SYSTEM — Complete ✓     │  TUNER       │
│ ...     │                               │  INSIGHTS    │
│         │  Completed in 23 minutes      │              │
│ PHASE   │  Total cost: $3.21            │  "Haiku was  │
│ ● Ideate│  7/7 tasks succeeded          │  sufficient  │
│ ● Plan  │                               │  for all API │
│ ● Forge │  ARTIFACTS                    │  tasks.      │
│ ● Done  │  ├─ PR #42: OAuth endpoints   │  Saved $1.80 │
│         │  ├─ PR #43: Login page         │  vs Sonnet." │
│ STATS   │  ├─ PR #44: Token refresh      │              │
│ 23 min  │  └─ PR #45: OAuth secrets      │  "Session    │
│ $3.21   │                               │  middleware   │
│ 7/7 ✓   │  ACCEPTANCE CRITERIA          │  took 2x     │
│         │  ✓ OAuth2 + PKCE flow works   │  expected.   │
│         │  ✓ Token refresh < 100ms      │  Baseline    │
│         │  ✓ All tests passing           │  updated."   │
│         │  ✓ No secrets in code          │              │
└─────────┴───────────────────────────────┴──────────────┘
```

Tuner insights are surfaced here:
- What worked well / what took longer than expected
- Cost optimization suggestions
- Baseline updates for similar future tasks
- This feeds into the Navigator's recommendations for next projects

---

## Architecture: What Changes

### Frontend: One App

```
Before:                          After:
┌─────────────┐                  ┌─────────────────────┐
│ planner-ui  │ port 3000        │                     │
├─────────────┤                  │   plannr-app        │ port 3000
│ ideation-ui │ port 3002        │   (single SPA)      │
├─────────────┤                  │                     │
│ forge-ui    │ port 3003        └─────────────────────┘
└─────────────┘
```

**What happens to the 3 frontend packages:**
- `planner-ui` becomes the base (it's the most mature, has sidebar + routing)
- `ideation-ui` components/hooks get absorbed (chat, blocks, physics, specialists)
- `forge-ui` components/hooks get absorbed (runs, tasks, timeline, preflight)
- `shared-ui` remains as the design system foundation

**Router structure:**
```
/                              → Dashboard (Navigator + attention items)
/projects                      → Project list (replaces /plans + /initiatives)
/projects/new                  → New project (starts in ideation mode)
/projects/:id                  → Project workspace (phase-adaptive)
/projects/:id/ideation         → Ideation phase view
/projects/:id/plan             → Plan editor view
/projects/:id/plan/versions    → Version history
/projects/:id/forge            → Execution dashboard
/projects/:id/forge/timeline   → Full timeline
/projects/:id/results          → Completion summary
/channels/:channelId           → Direct channel view
/settings                      → App settings, tuner config visibility
```

### Backend: Simplified Server

```
Before:                          After:
┌──────────────────┐             ┌──────────────────────┐
│ server (meta)    │ 3001        │                      │
│  ├─ planner      │             │  plannr-server       │ 3001
│  ├─ ideation     │             │  (single Express)    │
│  └─ forge-core   │             │                      │
├──────────────────┤             │  Embedded:           │
│ tuner            │ 4002        │  ├─ plans/           │
└──────────────────┘             │  ├─ ideation/        │
                                 │  ├─ forge/           │
                                 │  └─ tuner/           │
                                 └──────────────────────┘
```

**What changes:**
- Tuner folds into the main server (no separate port)
- Still plugin architecture internally (clean domain boundaries)
- Single database or co-located databases (implementation detail, not user-visible)
- Relay integration stays the same (it's transport, not UI)

### Data Model: Project-Centric

The key data model change: **Project** becomes the top-level entity that unifies sessions, plans, and runs.

```typescript
interface Project {
  id: string;
  name: string;
  phase: 'ideating' | 'planning' | 'forging' | 'complete';
  initiative_id?: string;  // optional grouping

  // Ideation state (was: Session)
  ideation?: {
    session_id: string;     // links to ideation session
    blocks: Block[];        // insights from brainstorming
    understanding: Understanding;
    specialists: Specialist[];
  };

  // Planning state (was: Plan + PlanVersion)
  plan?: {
    plan_id: string;
    current_version: number;
    status: 'draft' | 'approved' | 'published';
    steps: Step[];
  };

  // Execution state (was: Run)
  forge?: {
    run_id: string;
    status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
    tasks: Task[];
    artifacts: Artifact[];
  };

  // Tuner insights
  insights?: {
    cost_total: number;
    duration_total: number;
    model_recommendations: string[];
    baseline_comparisons: BaselineComparison[];
  };

  created_at: string;
  updated_at: string;
}
```

**This doesn't require rewriting the backend.** The Project is a thin coordination layer on top of existing domain entities. Each domain still owns its data. The Project just links them:

```
Project
  ├─ ideation.session_id  → ideation.db (sessions table)
  ├─ plan.plan_id         → planner.db (plans table)
  └─ forge.run_id         → forge.db (runs table)
```

---

## What Gets Simpler

### 1. No More "Handoff"

Today: Ideation → click "Send to Planner" → switch apps → find plan → continue.

Unified: You're in the project. Click "Structure as Plan." The workspace morphs. Your blocks become the plan's understanding section. Same sidebar, same project, same context.

### 2. No More "Publish"

Today: Planner → approve → publish → switch to Forge → import plan → preflight → start.

Unified: You're in the project. Approve the plan. Click "Start Forging." The workspace morphs to show execution. Preflight runs inline. Same project, same context.

### 3. Questions Surface Everywhere

Today: Agent asks question in forge. User has to be watching forge-ui. If they're in planner-ui, they miss it.

Unified: Questions surface in the status bar no matter where you are. Click to answer. The answer flows to the right agent. One attention layer for all domains.

### 4. Agent Activity is Global

Today: Agent avatars only show in the app they're relevant to.

Unified: Status bar shows all active agents across all projects. "Coder is working on Auth System, Tester is running on API Redesign." One view of the whole workforce.

### 5. Tuner Insights are Contextual

Today: Tuner is CLI-only. Users never see its recommendations.

Unified: When reviewing execution results, tuner insights appear in context. "This task type runs 2x faster with Haiku." When planning, tuner suggests complexity estimates. "Similar tasks have taken ~5 minutes historically."

---

## What Gets Harder (Honestly)

### 1. Bundle Size

Three apps means each loads only what it needs. One app loads everything. Mitigation: code splitting per phase, lazy-load forge components until a run exists.

### 2. State Complexity

Three isolated apps have simple state. One app managing ideation + planning + execution state simultaneously is more complex. Mitigation: keep domain boundaries in state management (separate contexts per phase), but share cross-cutting concerns (agent status, questions, channels).

### 3. Migration

This is a significant refactor of 3 frontend apps + server architecture. Mitigation: phased approach (see below).

### 4. Testing

More integration surface area. Each phase transition is a new test scenario. Mitigation: the existing domain-level tests still work; add integration tests for transitions.

---

## What To Drop

| Feature | Why |
|---------|-----|
| Physics engine (Matter.js) | High complexity, niche value. Replace with simpler animated block list. The *data* (blocks, confidence) matters; the physics simulation is expensive novelty. Reconsider for v2 if users miss it. |
| Testbench UI | Keep as CLI-only developer tool. Not user-facing. |
| Separate tuner port | Embed in main server. No user-visible change. |
| Pipeline view | Merge into project list with status indicators. The separate kanban/sequence views add complexity for marginal value when each project already shows its phase. |
| MCP as separate package | Fold MCP tools into unified server. Still HTTP transport, just co-located. |
| Multiple theme toggles | One theme, app-wide. |
| Ideation "mockup" route | Development artifact, drop. |

---

## What To Keep Exactly As-Is

| Feature | Why |
|---------|-----|
| Relay integration | Transport layer works. Agent messaging is solid. |
| DOT Framework | Execution policy (budgets, retries, confidence) is well-designed. |
| Approval workflow (simplified) | draft → approved is the essential core. Immutability post-approval is non-negotiable. |
| Command palette | Cmd+K navigation works well, extend to all phases. |
| Status bar | Agent presence + question count + cost tracking. Keep and enhance. |
| Domain separation in backend | Plugin architecture stays. Clean boundaries. Just co-locate. |
| Specialist agents | The concept of domain experts observing brainstorming is powerful. |
| Block/nugget crystallization | Progressive insight refinement from chat is the core ideation value. |
| Step editor with scopes | Multi-scope planning is a differentiator. |
| Real-time updates (SSE + WS) | Both patterns are solid. Keep. |

---

## Migration Strategy

### Phase 1: Unify the Shell (Smallest Useful Step)

- Create single `plannr-app` package
- Import planner-ui as the foundation (it has the most mature layout)
- Add ideation-ui and forge-ui pages as new routes within the same app
- Single sidebar with all navigation
- **No backend changes.** Same API, same server, same databases.
- Result: One app, three "sections" — not yet deeply integrated, but one URL.

### Phase 2: Project Entity + Phase Transitions

- Add `Project` coordination layer in backend
- Link sessions → plans → runs under Project
- Phase indicator in sidebar
- Smooth transitions: ideation → planning preserves context
- Status bar unification (all agents, all questions, all domains)

### Phase 3: Deep Integration

- Blocks from ideation flow into plan understanding
- Tuner insights surface in planning and results views
- Navigator dashboard as home screen
- Remove explicit handoff/publish ceremonies (become one-click transitions)
- Unified search/command palette across all domains

### Phase 4: Polish + Simplification

- Evaluate physics engine: keep, simplify, or replace
- Optimize bundle size with code splitting
- Unified notification system
- Settings/preferences consolidation
- Performance pass (single app perf vs three small apps)

---

## Open Questions

1. **Physics engine**: The ideation canvas with floating blocks is visually distinctive. Is it worth the complexity (Matter.js dependency, GPU acceleration, mouse constraint handling)? Or would an animated card list with the same data (blocks, confidence, specialists) be 80% of the value at 20% of the complexity?

2. **Project vs Initiative hierarchy**: Today, initiatives contain plans. Should projects replace plans entirely? Or should initiative → project → (ideation + plan + run) be the hierarchy?

3. **Multi-user**: The current system has relay for multi-agent coordination but limited multi-human support. Does the unified app need concurrent editing? Or is it primarily a single-operator cockpit with agent collaboration?

4. **Mobile/responsive**: Three separate apps were desktop-focused. A single app could be designed responsive from the start. Is mobile/tablet a requirement?

5. **Offline/local-first**: Current architecture requires the server running. Could the unified app work with a local SQLite + optional sync? This changes the architecture significantly.

6. **Agent visibility**: How much of the agent's internal reasoning should be visible? Currently, trajectory events capture everything but the UI shows minimal. Should the unified app expose more of the "thinking" process?

---

## Summary

The unified app is not about cramming three apps into one. It's about recognizing that **the user's journey is continuous** and the technology should match that.

```
Today:   [Ideation App] ──handoff──▶ [Planner App] ──publish──▶ [Forge App]
                                                                      │
                                                                  [Tuner CLI]

Unified: [Project Workspace] ──phase transition──▶ same workspace ──▶ same workspace
              ideating              planning              forging      │
                                                                   insights
                                                                   surfaced
                                                                   in-context
```

One project. One workspace. One attention layer. Phases, not apps.

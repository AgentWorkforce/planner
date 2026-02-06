# tend

A project is a conversation that builds a tree.

You talk to an AI. As you talk, structured output materializes — insights crystallize, tasks take shape, work gets done, artifacts appear. This structured output is **the tree**: a living document that grows from conversation into work over the life of the project.

There are no phases. No mode switches. The conversation is continuous. The tree grows organically. Some branches may be fully executed while others are still being understood. That's how real projects work.

```
"We need better auth"              → blocks forming on the left
"Users keep getting locked out"    → more blocks forming
"Yeah, let's break this down"      → 7 proto-steps appear
"The API steps look right"         → api-service steps graduate to tree
"Start the API work"               → agents spawn
"JWT, not session cookies"         → agent unblocked
"Looks good, merge it"             → PR #42 merged
```

---

## Layout

Three columns. Always.

```
┌──────────────────┬──────────────────────┬──────────────────────┐
│   THE NOW        │   CONVERSATION       │   THE TREE           │
│                  │                      │                      │
│   Ephemeral.     │   The ongoing        │   Persistent.        │
│   Things form    │   dialogue with      │   Grows over the     │
│   and fade.      │   the AI. Always     │   project lifetime.  │
│                  │   the primary        │   Source of truth.    │
│                  │   interaction.       │                      │
└──────────────────┴──────────────────────┴──────────────────────┘
                        STATUS BAR (agent dock)
```

This layout holds everywhere — inside a project, on the dashboard, at any zoom level. What changes is the content within each column.

### The Now (left)

The creative space. Things here are transient — they either graduate to the tree or fade away.

Contains **forming blocks**: proto-work-items materializing from conversation. Each shows a confidence percentage and type. Confidence-based sizing, physics-driven (floating, drifting). Capped at 3–5 visible, with a "+N more" indicator for overflow. When nothing is forming, the column collapses gracefully.

The messiness is the signal. Floating, slightly chaotic blocks say "this is still cooking." When a block graduates to the tree, it goes from messy to structured. That visual transition communicates the state change without any label.

### The Conversation (center)

Always present. One continuous thread per project. You can scroll back and see the full history of the project's evolution.

The conversation is contextual — its character shifts based on what you're focused on in the tree. Click a running step and the AI shows agent progress. Click a scope and the AI summarizes status. Click the project name and the AI gives an overview.

**Message types:**
- User and AI messages
- System events — compact inline markers ("Step completed · 4m 12s · PR #43 created")
- Context markers — subtle dividers when conversation focus shifts
- Agent questions — surfaced through conversation when they need answers

**Reply bar** sits above the chat input, showing pending items that need a response. Multiple-choice options appear in the input area for direct questions.

### The Tree (right)

The accumulated structure of the project. Two sections that fill in over time:

```
PROJECT NAME
├─ WORK        Steps organized by scope. Each step progresses:
│               approved → running → done
└─ ARTIFACTS   What's been produced. PRs, deploys, test results.
```

Steps and tasks are the same thing. A step's state changes — it doesn't become a different entity when execution starts. Sections only appear when they have content.

The tree is interactive. Clicking any node focuses the conversation on it. The tree is the primary navigation.

### The Tree Breathes

Three zoom levels — overview, scope, step — that expand and contract based on focus.

```
OVERVIEW        api-service ████████░░ 2/3 · web-frontend ░░░░░░ pending
SCOPE           ✓ OAuth endpoints · ⟳ Session middleware 75% · ○ Rate limiting
STEP            Full detail: progress, agent, acceptance criteria, dependencies
```

The user clicks in the tree. The tree zooms. The conversation adapts. The AI does not auto-scroll or auto-zoom — the user controls the tree, the conversation follows. Breadcrumbs orient the user when zoomed in.

### The Status Bar (bottom)

Fixed at the bottom. Agent avatars with progress rings. Colors indicate state: green (working), yellow (needs input), red (blocked).

When an agent has a question, a chat bubble pops up from its avatar for ~10–15 seconds. If the user clicks, the question opens in conversation. If not, the bubble shrinks to a badge and the item appears in the reply bar.

```
Tiered attention:
  Status bar bubble  → "right now, this second"        10–15s then badge
  Reply bar          → "deal with this soon"            persistent until addressed
  Tree               → "the accumulated state"          lifetime of project
```

---

## How It Feels

### Starting a project

Empty canvas with an intelligent partner. No forms, no wizards. `[+ new]` at dashboard level puts options in the chat input. You type, the AI adapts — vague inputs lead to exploration, specific inputs lead to immediate structure.

### Deep in ideation

The left column is alive with forming blocks. The AI asks clarifying questions, connects dots, proposes structure. Blocks catch your eye — click to inspect, approve if they look right, ignore if they don't. Ignored blocks fade if the conversation moves on.

The AI says "Want me to sketch out some steps?" — the organic moment where planning starts. Not a transition. Just the conversation evolving.

### The plan takes shape

The AI proposes steps in conversation. They appear as proto-steps in the left column. The user approves conversationally: "yeah, start the API work." Approved steps graduate from left to right — a subtle animation. The tree's Work section appears when the first steps are approved.

### Mixed states

Some parts done, some running, some still forming. Everything coexists in one view. Click any element to focus on it — the conversation adapts. This is the mixed state that a tree model handles naturally.

### An agent needs help

The agent hits a problem. Its avatar in the status bar turns red. A bubble pops up with the question and options. The user answers directly, or the question waits in the reply bar. The tree shows the step as blocked until resolved.

### Coming back

tend opens where you left it. Overnight events appear as compact system event lines — top 3 shown individually, rest collapsed. Pending questions persist in the reply bar. The AI greets contextually based on what happened while you were away.

### The dashboard

Same three-column layout. Left column may show cultivate signals (future). Center: the AI discusses priorities and suggests next actions. Right: projects as a text-based list with attention indicators on items that need interaction.

```
Auth System
└ 7/10 · 3 running
  └ ⟳ Session middleware · needs input

Mobile App
└ ideating · 3 blocks
```

---

## Forming → Tree Flow

### The ensemble

The user talks to one AI (the Interviewer — unified voice). Behind the scenes, invisible specialist agents analyze the conversation from different angles: Security, Architect, Designer, etc. Specialists are spawned lazily by the Interviewer based on conversation context.

Each specialist can independently create forming blocks, update confidence, and queue insights for the Interviewer to weave into conversation. The user never sees the specialists — they see a smarter conversation and better-formed blocks.

### Confidence and graduation

Confidence is aggregate — averaged across specialists who have weighed in on a block. Status derived from aggregate: forming → emerging → developing → ready. Default graduation threshold: 65%.

When a block crosses the threshold, the Interviewer proposes it conversationally: "The auth steps look solid — should we start?" The user confirms, and the Interviewer calls `graduate_blocks` — an atomic bridge operation that converts forming blocks into full steps in the tree, complete with dependencies and acceptance criteria.

The threshold adapts over time based on user behavior (a tuner use case).

### Understanding is invisible

Understanding (domain context the AI accumulates) is stored as invisible infrastructure — `understanding_json` on PlanVersion. It's used by the AI as context, never shown as visible blocks. The left column shows only proto-steps, not understanding.

### Trajectories provide traceability

Every step can trace back to the decisions and conversation that motivated it. The trajectory system captures: decisions with reasoning, alternatives considered, provenance from conversation. Step sheets show trajectory data so the user can always answer "why does this step exist?"

---

## Detail Views

### Sheets

The primary surface for rich detail and editing. Slide in from the right. Always user-initiated, never AI-triggered. May include a focused chat input at the bottom.

**Step sheets** contain: title, scope, owner, description, dependencies, acceptance criteria, approval gate, execution info, traceability.

**What triggers a sheet:** First click on a tree node zooms. Second click opens the sheet. Clicking anything that needs editing opens its sheet. Close and re-click for navigation between sheets.

**What doesn't need a sheet:** Quick status (tree zoom handles it), conversation context (conversation adapts), external artifacts (open in browser), forming blocks (inline expansion only).

### Interaction map

| Click target | Result |
|---|---|
| Step in tree | First: zoom. Second: open sheet |
| Scope heading | Zoom to scope, conversation summarizes |
| Reply bar item | Navigate to subtask tab with question context |
| Agent avatar | Zoom to step, show agent activity stream |
| Artifact | External → new tab. Internal → sheet |
| Project name / breadcrumb | Zoom out to overview |

---

## Conversation Tabs

**Phase 1:** One thread. Agent work as compact inline events.

**Phase 2:** Subthreads promoted to tabs above the conversation column. Main tab is always present. Agent tabs spawn when agents start working and auto-collapse when finished. Tree and left column don't change per tab — only the conversation swaps.

---

## Aesthetic

**tend** — lowercase, always. You tend your projects like you tend a garden.

Minimalistic, warm, inviting. Like tending a zen garden — deliberate placement, negative space, quiet confidence.

- Muted, warm color palette. Earth tones: sand, stone, moss, clay.
- Generous whitespace. The three columns breathe.
- Subtle animations. Blocks drift gently. Progress fills smoothly.
- Typography does the work. Hierarchy through weight and size, not color or decoration.
- The empty state is beautiful. A new project feels like a raked sand garden.
- Text-first. Reserve styled cards for things that demand attention. Everything else is text on the background layer.

### Attention levels

Every piece of information has an attention level:

| Level | Treatment | Used for |
|---|---|---|
| 1 — Background | Lower weight, blends in | System events, progress updates, completed steps |
| 2 — Foreground | Normal weight, noticeable | AI questions, state changes |
| 3 — Raised | Card with drop shadow, badges | Blocking questions, items requiring action |

Typography does the heavy lifting. Color is reserved for semantic meaning (status), not attention hierarchy.

### AI voice

Intelligent and wise — distills, never adding unnecessarily. Focused and sharp, constructive, efficient. Some warmth, not artificial. Like a sharp, thoughtful colleague fully invested in your project's success. The user experiences one AI everywhere — no persona distinctions.

### Garden vocabulary

| Concept | Word |
|---|---|
| The app | **tend** |
| Intake / signals | **cultivate** |
| Grouping of work | **plot** (replaces scope) |
| Unit of work | step |
| Forming work | block / seed |
| The project | project |

Use garden words where they add warmth without confusion.

---

## Platform

Desktop app (Tauri), not a browser tab. Local-first. SQLite on disk, relay daemon as local process.

System tray: agents keep running when you close the window. Tray icon shows status. Click to reopen.

Build phasing: web app first → Tauri wrapper → system tray integration.

---

## Cultivate (future)

The intake layer. Monitors external channels (Slack, GitHub, support, analytics) for signals that feed into what you build. Separate package, not part of tend. Tend consumes cultivate's output.

At dashboard level, the left column shows cultivate signals instead of forming blocks. Inside a project, the AI references signals when relevant. Steps can trace provenance back to the original signals.

Not Phase 1. But tend's architecture accounts for it: left column accepts a pluggable data source, AI context has a slot for external signals, steps have optional provenance fields.

---

## Team (future)

Phase 1 is single user + AI. The data model is team-ready from day one (`owner_id` on projects, `owner_role` on steps).

Team mode: multiple people see the same tree. Each gets their own conversation with the AI. The tree is the shared source of truth.

---

## Technical Architecture

### Routes

```
/                    → Dashboard
/projects/:id        → Project workspace (three-column view)
/projects/new        → New project
/settings            → Settings
```

All complexity handled through tree navigation, not URL routing.

### Backend

Phase 1: existing ideation, planner, and forge APIs unchanged. "Project" is a client-side concept linking `session_id + plan_id + run_id`.

Phase 2: thin `projects` table formalizing the linkage. Single new API endpoint.

### Real-time

SSE pattern: specialist tool call → storage mutation → SSE event → frontend update. Events: `block_created`, `block_updated`, `block_graduated`, `step_added`, `plan_changed`.

---

## Open Questions

1. **Offline / reconnection** — agents continue via relay, but UI needs a sync strategy.
2. **Cost controls** — not in ambient UI, but project-level budgets? Per-step limits?
3. **Plan export** — tree as standalone document for stakeholders?
4. **Version history** — rewind the tree to a previous state?

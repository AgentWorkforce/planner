# Planner UI: Vision & Design

## Overview

Planner UI is where humans create plans and agents execute them. The interface surfaces what needs human attention and stays out of the way otherwise.

For AI behavior, see [planner-agentic-behavior.md](./planner-agentic-behavior.md).
For detailed user scenarios, see [planner-ux-scenarios.md](./planner-ux-scenarios.md).
For handling large plans, see [planner-scale.md](./planner-scale.md).

---

## Design Principles

### 1. Inbox-Driven

The primary view is "what needs my attention", not "browse all plans."

### 2. Two Screens, Not Eight

- **Inbox**: What needs action
- **Plan**: Where you work

Everything else is a panel or modal, not a page.

### 3. Three States, Not Four

```
draft → approved → published
```

No "review" state. AI reviews continuously as you work.

### 4. Flat Organization

Plans have tags. No nested Projects/Folders hierarchy.

```
Plans (filtered by tags) → Versions → Steps
```

---

## Plan Lifecycle

```
┌─────────────────────────────────────────────────────────────────────┐
│                            DRAFT                                    │
│                                                                     │
│  ┌─────────────────────┐         ┌─────────────────────────────┐   │
│  │   working           │────────▶│   submitted                 │   │
│  │   (editing)         │ submit  │   (ready for review)        │   │
│  └─────────────────────┘         └─────────────────────────────┘   │
│                                             │                       │
│  AI works continuously in both states       │                       │
└─────────────────────────────────────────────┼───────────────────────┘
                                              │ approve
                                              ▼
                                      ┌───────────────┐
                                      │   APPROVED    │ (locked)
                                      └───────┬───────┘
                                              │ publish
                                              ▼
                                      ┌───────────────┐
                                      │   PUBLISHED   │ (executing)
                                      └───────────────┘
```

**Draft (working)**: User edits. AI improves silently.

**Draft (submitted)**: Ready for Portfolio/reviewer evaluation. Still editable if needed.

**Approved**: Locked. Can't edit. Creates accountability.

**Published**: Released to orchestrator for execution.

**Key distinction:**
- "Submit" = coordination signal to reviewers ("I'm ready")
- "Approve" = accountability checkpoint ("I sign off")

---

## Creating a Plan

Planner accepts any expression of intent—from vague ideas to detailed specs. The AI helps refine.

**Entry via [+ New]:**

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Create Plan                                                       [×]  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  What do you want to accomplish?                                        │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ I want to make the app faster                                    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  [Continue →]                                                           │
│                                                                         │
│  ─────────────────────── or ───────────────────────                     │
│                                                                         │
│  [Import from document]  [From template]                                │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**If input is vague, AI helps scope:**

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Create Plan                                                       [×]  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  "I want to make the app faster"                                        │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  AI: Let me help you scope this.                                        │
│                                                                         │
│  What kind of "faster"?                                                 │
│  ○ Page load time (user-facing)                                         │
│  ○ API response time (backend)                                          │
│  ○ Build/deploy time (developer)                                        │
│  ○ I'm not sure yet                                                     │
│                                                                         │
│  Do you have data on what's slow?                                       │
│  ○ Yes, I have metrics                                                  │
│  ○ I have hunches but no data                                           │
│  ○ No, investigation needed first                                       │
│                                                                         │
│  [Continue →]                                                           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**If input is specific, AI drafts multi-scope plan:**

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Create Plan                                                       [×]  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  "Add user authentication with OAuth"                                   │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  This will affect:                                                      │
│  ☑ api-service                                                          │
│  ☑ web-frontend                                                         │
│  ☐ mobile-app (detected - include?)                                     │
│  ☑ infrastructure                                                       │
│                                                                         │
│  [Generate Plan]                                                        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

| Entry | When to Use | What Happens |
|-------|-------------|--------------|
| **Vague goal** | "improve UX", "make it faster" | AI asks clarifying questions, helps scope |
| **Specific goal** | "add dark mode toggle" | AI identifies scopes, drafts plan |
| **Import** | Have PRD/spec | AI extracts steps from pasted text |
| **Template** | Common pattern | Select template, customize |

---

## Editing a Plan

### Inline Editing

Click any field to edit. No modals for simple changes.

```
┌─ 2. Design auth flow ───────────────────────────────────────────────────┐
│                                                                         │
│  Title: [Design auth flow                              ] ← click to edit│
│                                                                         │
│  Scope: api-service                                                     │
│                                                                         │
│  Description:                                                           │
│  [Create sequence diagrams for login, logout, and refresh flows.     ] │
│  [Include error handling and edge cases.                             ] │
│                                                                         │
│  Owner: [Architect ▼]                                                   │
│                                                                         │
│  After: Research approaches (AI-inferred)              [override]       │
│                                                                         │
│  Acceptance criteria:                                                   │
│  ☑ [Flow diagram covers all paths                                    ] │
│  ☑ [Security review completed                                        ] │
│  [+ Add criterion]                                                      │
│                                                                         │
│  ☐ Requires human approval gate                                        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Note:** Dependencies ("After") are AI-inferred from step descriptions. Humans express intent ("this needs to happen before that"), AI builds the DAG. Override is available but rarely needed.

### Adding Steps

[+ Add Step] — describe what you need, AI places it:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Add Step                                                          [×]  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  What needs to happen?                                                  │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Add rate limiting to the API                                     │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  Scope: [api-service ▼]                                                 │
│                                                                         │
│  [Add Step]                                                             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

AI automatically places the step in the right position and infers dependencies based on context.

### Deleting Steps

AI handles dependency adjustment:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Delete Step 2?                                                    [×]  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  "Design auth flow" will be removed.                                   │
│                                                                         │
│  AI will adjust dependencies for affected steps:                       │
│    • Backend implementation                                             │
│    • Frontend implementation                                            │
│                                                                         │
│  [Delete]  [Cancel]                                                     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Reviewing a Plan

For Portfolio managers and designated reviewers:

### Reviewer's Inbox

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Planner                                               [+ New]  [⌘K]   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Awaiting Your Review                                                   │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  │ 🟠  Auth Plan · submitted by @alice · 2h ago                       │ │
│  │ 🟠  API Refactor · submitted by @bob · 1d ago                      │ │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Review Actions

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ← Back         Auth Implementation            📋 Submitted for review  │
│                 Submitted by @alice · 2h ago                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  [Plan content...]                                                      │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│  [Approve]  [Request Changes]  [Comment]                [💬 AI Chat]   │
└─────────────────────────────────────────────────────────────────────────┘
```

### Request Changes Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Request Changes                                                   [×]  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  What needs to be fixed?                                               │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Step 3 needs clearer acceptance criteria. Also consider adding  │   │
│  │ a rollback plan for the database migration.                     │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  [Send to @alice]                                                       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Primary Views

### Inbox

What needs your attention. This is home.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Planner                                               [+ New]  [⌘K]   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Needs Your Action                                                      │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  │ 🟠  Auth Plan · ready to approve                                   │ │
│  │ 🔵  Dark Mode · change request from orchestrator                   │ │
│  │ 🟡  API Refactor · AI flagged scope concern                        │ │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  Recent                                                                 │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  │ Database Migration · draft · backend                               │ │
│  │ User Onboarding · published · frontend                             │ │
│  │ Caching Layer · approved · backend                                 │ │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**That's it.** No dashboard stats. No activity feed as a page. Just:
1. What needs action (top)
2. Recent plans (bottom)

Filter by tags if needed. Search with ⌘K.

### Plan

The workspace. One plan, full screen.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ← Back         Auth Implementation                   ✏️ Draft         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Implement user authentication with OAuth2 for Google and GitHub.      │
│  Must integrate with existing user model.                               │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  ┌─ 1. Research approaches ─────────────────────────────────────────┐  │
│  │  Owner: Architect · Acceptance: Decision doc produced            │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│           │                                                             │
│           ▼                                                             │
│  ┌─ 2. Design flow ─────────────────────────────────────────────────┐  │
│  │  Owner: Architect · Acceptance: Flow diagram approved            │  │
│  │  🚪 Gate                                                         │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│           │                                                             │
│     ┌─────┴─────┐                                                       │
│     ▼           ▼                                                       │
│  ┌─ 3. Backend ─┐  ┌─ 4. Frontend ─┐                                   │
│  │  ...         │  │  ...          │                                   │
│  └──────────────┘  └───────────────┘                                   │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│  [+ Add Step]                                [Approve]  [💬 AI Chat]   │
└─────────────────────────────────────────────────────────────────────────┘
```

**Actions change by state:**
- Draft (working): `[Submit]` `[AI Chat]`
- Draft (submitted): `[Approve]` `[Withdraw]` `[AI Chat]`
- Approved: `[Publish]` `[New Version]`
- Published: `[View Execution]`

---

## Panels (Not Pages)

### AI Chat

Slide-out for asking questions or getting help.

```
┌────────────────────────────────────────┬────────────────────────────────┐
│  [Plan content...]                     │  AI Chat                   [×] │
│                                        │                                │
│                                        │  You: Is step 2 too vague?    │
│                                        │                                │
│                                        │  AI: Yes. I'd suggest adding: │
│                                        │  - Sequence diagram required   │
│                                        │  - Security review sign-off    │
│                                        │                                │
│                                        │  [Apply]                       │
│                                        │                                │
│                                        │  ─────────────────────────────│
│                                        │  [Type message...]        [➤] │
└────────────────────────────────────────┴────────────────────────────────┘
```

### Activity

Slide-out showing what happened.

```
┌────────────────────────────────────────┬────────────────────────────────┐
│  [Plan content...]                     │  Activity                  [×] │
│                                        │                                │
│                                        │  • 5m: AI added criteria (3)  │
│                                        │  • 1h: You edited step 2      │
│                                        │  • 2h: Orchestrator requested │
│                                        │    change: add migration step │
│                                        │  • 1d: Plan created from goal │
│                                        │                                │
└────────────────────────────────────────┴────────────────────────────────┘
```

### Version Diff

Modal when comparing versions.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Comparing v2 → v3                                          [×]         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  + 1 step added · ~ 2 modified                                         │
│                                                                         │
│  ┌─ Step 3 ──────────────────────────────────────────── MODIFIED ───┐  │
│  │  + Integration tests pass (added)                                 │  │
│  │  + Security review completed (added)                              │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌─ Step 6 ──────────────────────────────────────────── ADDED ──────┐  │
│  │  Database migration                                               │  │
│  │  Owner: DBA · via change request                                  │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Execution Status

Overlay when plan is running.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Auth Implementation                              🟢 Running (3/7)      │
├─────────────────────────────────────────────────────────────────────────┤
│  ████████████░░░░░░░░░░░░░░░░░░ 43%                                    │
│                                                                         │
│  ✅ 1. Research · done 2h ago                                          │
│  ✅ 2. Design · done 1h ago (gate approved by @alice)                  │
│  🔄 3. Backend · running                                               │
│  ⏸️ 4. Frontend · waiting on 3                                         │
│  ⏸️ 5. Integration · waiting on 3, 4                                   │
│  ⏸️ 6. Migration · waiting on 2                                        │
│  ⏸️ 7. Testing · waiting on 3, 4, 5, 6                                 │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Interaction

### Keyboard

| Key | Action |
|-----|--------|
| `⌘ K` | Command palette |
| `⌘ N` | New plan |
| `⌘ /` | AI chat |
| `⌘ Enter` | Primary action (Approve/Publish) |
| `Esc` | Close panel / go back |

### Command Palette

Everything accessible via ⌘K:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  🔍 Type to search...                                                   │
├─────────────────────────────────────────────────────────────────────────┤
│  Auth Implementation                                          plan     │
│  API Refactor                                                 plan     │
│  Create new plan                                              ⌘ N     │
│  Approve current plan                                         ⌘ Enter │
│  Open AI chat                                                 ⌘ /     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Visual Design

### Aesthetic

- Clean, minimal
- Neutral colors, status colors only for states
- Dense but readable
- No visual noise

### Status Colors

| State | Color | Meaning |
|-------|-------|---------|
| Draft | Gray | Work in progress |
| Approved | Blue | Locked, ready |
| Published | Green | Live/executing |
| Needs Action | Orange | Requires attention |

---

## Technology

| Concern | Choice |
|---------|--------|
| Framework | React + Next.js |
| Styling | Tailwind |
| State | Zustand |
| Real-time | WebSockets |

---

## Large Plans

For plans with 30+ steps, compound steps enable hierarchical organization:

- **Zoom levels**: Overview → Expanded → Full Detail
- **Breadcrumb navigation**: Parent > Sub-plan > Current
- **Progress rollup**: Parent shows aggregated progress from children
- **Focus mode**: Work on one sub-plan without distraction

See [planner-scale.md](./planner-scale.md) for complete scale handling patterns.

---

## What We're NOT Building

- No nested folder hierarchy (tags instead)
- No separate "Projects" page
- No "Review" workflow state (AI reviews continuously)
- No "Request AI Review" button (AI works in background)
- No activity page (it's a panel)
- No dashboard with stats (inbox is enough)
- No modal-per-edit (inline editing instead)
- No blank canvas (AI drafts from goal)

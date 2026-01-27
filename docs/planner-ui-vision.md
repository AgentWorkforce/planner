# Planner UI: Vision

## Overview

The Planner UI is where humans create and approve plans. It surfaces what needs attention and stays out of the way otherwise.

---

## Design Principles

### 1. Inbox-Driven

The primary view answers "what needs my attention?" — not "browse all plans."

### 2. Two Screens Only

- **Inbox**: What needs action
- **Plan**: Where you work

Everything else is a slide-out panel, not a separate page.

### 3. AI Does the Wiring

- **Dependencies**: AI-inferred from step descriptions. Users don't manually connect steps.
- **Placement**: When adding a step, AI determines where it fits in the flow.
- **Improvements**: AI silently adds acceptance criteria, clarifies descriptions, fixes issues.

Users focus on *what* needs to happen. AI figures out *how* it connects.

### 4. Human Controls the Checkpoints

These are protected actions AI never performs:

| Action | Why |
|--------|-----|
| Submit | Signals "ready for review" |
| Approve | Locks the plan (accountability) |
| Publish | Releases to orchestrator (commitment) |
| Add gates | Workflow governance |

### 5. Inline Over Modals

Click to edit. No modal for simple changes. Expand for details.

---

## The Two Screens

### Inbox

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Planner                                               [+ New]  [⌘K]   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Needs Your Action                                                      │
│  ─────────────────────────────────────────────────────────────────────  │
│  │ 🟠  Auth Plan · ready to approve                                   │ │
│  │ 🔵  Dark Mode · change request from orchestrator                   │ │
│  │ 🟡  API Refactor · AI flagged scope concern                        │ │
│                                                                         │
│  Recent                                                                 │
│  ─────────────────────────────────────────────────────────────────────  │
│  │ Database Migration · draft · backend                               │ │
│  │ User Onboarding · published · frontend                             │ │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

Two sections: **Needs Action** (decisions pending) and **Recent** (your plans).

### Plan

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ← Back         Auth Implementation                   ✏️ Draft         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Implement user authentication with OAuth2.                             │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  api-service                                                            │
│  ┌─ 1. Add OAuth endpoints ────────────────────────────────────────┐   │
│  │  Owner: Backend · Acceptance: Tests pass                        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│           │                                                             │
│           ▼                                                             │
│  ┌─ 2. Add session middleware ─────────────────────────────────────┐   │
│  │  Owner: Backend · 🚪 Gate                                       │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  web-frontend                                                           │
│  ┌─ 3. Add login page ─────────────────────────────────────────────┐   │
│  │  Owner: Frontend · After: api-service (AI-inferred)             │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│  [+ Add Step]                                [Submit]  [💬 AI Chat]    │
└─────────────────────────────────────────────────────────────────────────┘
```

Steps grouped by **scope** (repo/team/domain). Dependencies shown as visual flow. Cross-scope dependencies are AI-inferred.

---

## Creating a Plan

User enters a goal. AI responds based on specificity:

**Vague input → AI helps scope:**

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
│  [Continue →]                                                           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Specific input → AI identifies scopes and drafts:**

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

No blank canvas. AI always drafts first.

---

## Editing a Plan

- **Edit step**: Click any field, edit inline
- **Add step**: Describe what needs to happen, AI places it and infers dependencies
- **Delete step**: AI adjusts dependencies for affected steps
- **Override**: Dependencies can be manually adjusted (rarely needed)

---

## Reviewing a Plan

Reviewers see submitted plans in their Inbox. Actions:

- **Approve**: Locks the plan
- **Request Changes**: Sends feedback to author
- **Comment**: Discussion without blocking

---

## Panels (Slide-Out)

| Panel | Purpose |
|-------|---------|
| AI Chat | Ask questions, get suggestions, apply improvements |
| Activity | See what changed (who, when, what) |
| Version Diff | Compare versions (structural, not text) |

---

## What We're NOT Building

- No nested folder hierarchy (tags instead)
- No "Review" workflow state (AI reviews continuously)
- No dashboard with stats (inbox is enough)
- No modal-per-edit (inline instead)
- No blank canvas (AI drafts from goal)
- No manual dependency wiring (AI infers)

---

## References

- [planner-agentic-behavior.md](./planner-agentic-behavior.md) — AI behavior details
- [planner-ux-scenarios.md](./planner-ux-scenarios.md) — Detailed user scenarios
- [planner-scale.md](./planner-scale.md) — Multi-scope and hierarchical plans
- [github-issue-planner-vision.md](./github-issue-planner-vision.md) — Core architecture

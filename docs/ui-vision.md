# Planner UI: Vision

## The Experience We're Building

Planner is where **intent becomes contract**.

Traditional planning tools ask you to build structure from scratch—create tasks, wire dependencies, track status. Planner inverts this. You express what you want to achieve, and an AI partner helps you develop that into a structured, versioned, approvable specification that agents can execute.

This isn't AI-assisted planning. It's **AI-native planning**—where the AI doesn't just help you fill in boxes, but actively partners in developing vague intent into executable structure.

---

## Where the UI Fits

*(See Architecture Overview for the full system diagram)*

```
Intake → Portfolio → PLANNER UI → Orchestrator → Agents
                     ^^^^^^^^^^^
                     (this document)
```

The Planner UI is the **critical human interface** in this stack. It's where:
- Vague intent gets refined into structured plans
- Humans review and approve what agents will execute
- Accountability is established through explicit approval
- The contract between humans and machines is formed

---

## What Makes This Different

### 1. Intent-First, Not Task-First

You don't start by creating tasks. You start by expressing what you want.

```
"I want to add user authentication"
         │
         ▼
AI identifies this affects:
  • api-service (OAuth endpoints, session management)
  • web-frontend (login UI, protected routes)
  • infrastructure (secrets, config)
         │
         ▼
AI drafts a multi-scope plan with steps, dependencies, acceptance criteria
         │
         ▼
Human refines, adjusts, adds gates where needed
```

The blank page problem doesn't exist. AI always drafts first.

### 2. Multi-Scope is Visual

Real work crosses boundaries. A feature touches multiple repos, teams, domains. The UI makes this natural:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Add User Authentication                                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  api-service                                                            │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ 1. Add OAuth endpoints        → 2. Add session middleware       │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                       │                                 │
│                                       │ (depends on)                    │
│                                       ▼                                 │
│  web-frontend                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ 3. Add login page             → 4. Add protected routes         │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  infrastructure                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ 5. Add OAuth secrets to config                                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

Steps group by scope. Cross-scope dependencies are AI-inferred and visually connected. You see the whole system, not isolated tasks.

### 3. AI Does the Wiring, Humans Make the Decisions

The division of labor is clear:

| AI Does (Invisible) | Human Decides (Explicit) |
|---------------------|--------------------------|
| Infer dependencies from step descriptions | Submit when ready for review |
| Place new steps in the right position | Approve to lock the plan |
| Add acceptance criteria | Publish to release for execution |
| Fix structural issues | Add human approval gates |
| Clarify vague descriptions | Resolve ambiguous choices |

AI handles the tedious structure. Humans handle accountability and judgment.

### 4. Approval is Ceremony

Approving a plan isn't clicking a button. It's signing off on a contract.

The UI should reflect this gravity:
- Show exactly what you're approving
- Make the commitment explicit ("This plan will be executed by agents")
- Record who approved, when, and why
- Make it clear this version is now immutable

---

## The Core Experiences

### Experience 1: Developing Intent

A user comes with an idea—sometimes vague, sometimes specific, sometimes with a full spec document.

**Vague intent:**
```
User: "I want to make the app faster"

AI: "Let me help you scope this. What kind of 'faster'?"
    ○ Page load time (user-facing)
    ○ API response time (backend)
    ○ Build/deploy time (developer)
    ○ I'm not sure—investigation needed first
```

**Specific intent:**
```
User: "Add OAuth login with Google and GitHub"

AI: "This will affect api-service, web-frontend, and infrastructure.
     Here's a draft plan with 8 steps across these scopes.
     Review and adjust as needed."
```

**Document import:**
```
User: [Pastes PRD or spec document]

AI: "I've extracted 12 steps from this document, organized into 3 scopes.
     Review the structure before creating the plan."
```

The experience adapts to where the user is starting from.

### Experience 2: Refining with AI

While working on a plan, AI is a continuous partner:

- **Silent improvements**: Adds missing acceptance criteria, fixes dependencies, clarifies descriptions. User sees a subtle "3 improvements" badge they can expand if curious.

- **Flagged concerns**: "Steps 4 and 6 seem to overlap" or "This scope seems larger than the stated goal." Shown inline, user decides.

- **On-demand chat**: User can ask "Is step 3 clear enough?" or "What acceptance criteria should this have?" AI responds in context.

The key principle: **AI works continuously, but only surfaces what needs human decision.**

### Experience 3: Review and Approval

When a plan is ready, the author submits it for review. Reviewers see:

- The plan with full context (goal, scopes, steps, dependencies)
- Who submitted and when
- Version history if this is a revision
- Step-level commenting (like code review)

Approval is explicit:
```
┌─────────────────────────────────────────────────────────────────────────┐
│  Approve Plan                                                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  You are approving:                                                     │
│    "Add User Authentication" (v2)                                       │
│    8 steps across 3 scopes                                              │
│    2 human approval gates                                               │
│                                                                         │
│  This action:                                                           │
│    • Locks this version (no further edits)                              │
│    • Records your approval for accountability                           │
│    • Enables publishing to orchestrator                                 │
│                                                                         │
│  [Cancel]                                            [Approve Plan]     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Experience 4: Visibility into Execution

Once published, the plan connects to execution. If the orchestrator provides status:

- Steps show progress (done, running, waiting, blocked)
- Gates awaiting approval are surfaced prominently
- Change requests from orchestrator appear for review
- Full execution history is preserved

This is read-only in Planner—execution is the orchestrator's domain—but visibility keeps humans in the loop.

---

## Design Principles

### 1. Surface What Needs Attention

The primary question the UI answers: **"What needs my attention right now?"**

Not "show me everything" but "show me what matters":
- Plans awaiting my approval
- Change requests from orchestrator
- AI-flagged concerns that need decision
- Gates awaiting sign-off

Everything else is reachable but not prominent.

### 2. Progressive Disclosure

Simple by default. Details on demand.

- Plan list: Title, status, scope tags
- Plan view: Goal, scopes, steps
- Step detail: Expand for description, criteria, history
- Full audit: Activity panel for complete timeline

### 3. Inline Everything

Editing happens in place. Click to edit. Blur to save.

No modal for simple changes. Expand in place for complex ones. The plan is always visible while you work on it.

### 4. Keyboard-First

Power users live in the keyboard:
- `⌘K` for command palette (find plans, run actions)
- `⌘/` for AI chat
- Arrow navigation through steps
- Shortcuts for common actions

### 5. Clear State Always

At any moment, you know:
- What state is this plan in? (draft / submitted / approved / published)
- Who owns the next action?
- What's blocking progress?

---

## Integration Touch Points

### From Intake/Portfolio

Plans can be created directly or routed from upstream:

```typescript
// A plan created via Intake shows its source
{
  goal: "Fix login timeout issue",
  source: {
    channel: "slack",
    reference: "#eng-support thread 2024-01-15"
  }
}
```

The UI shows this context: "From Slack #eng-support"

### To Orchestrator

Published plans produce a `plan_ref` the orchestrator fetches:

```
GET /plans/{plan_id}/versions/{version}
```

The UI shows orchestrator readiness: "Ready for execution" badge on published plans.

### Change Requests

Orchestrator can request plan changes mid-execution:

```typescript
{
  reason: "Missing database migration step",
  suggested_changes: { add_steps: [...] }
}
```

This surfaces in the UI as an action item: "Orchestrator requested changes to [Plan Name]"

---

## What We're NOT Building

| Avoid | Why | Instead |
|-------|-----|---------|
| Gantt charts / timelines | Planner is about structure, not scheduling | Let orchestrator handle timing |
| Resource allocation | That's Portfolio's domain | Show roles, not people |
| Nested folder hierarchy | Adds complexity without value | Tags and search |
| Dashboard with metrics | Not a reporting tool | Focus on action items |
| Real-time collaboration | Complexity vs. value tradeoff | Async review with versioning |
| Manual dependency wiring | AI handles this better | AI-inferred with override |

---

## Summary

The Planner UI is where **intent becomes contract**.

It's built on these foundations:
- **Intent-first**: You express goals, AI helps structure them
- **Multi-scope by default**: Real work crosses boundaries
- **AI does wiring, humans decide**: Clear division of labor
- **Approval is ceremony**: Accountability is explicit
- **Connected to execution**: Plans aren't documents, they're specifications

The experience should feel like collaborating with an intelligent planning partner who:
- Understands your vague intent and helps you clarify it
- Knows your system and suggests what's affected
- Handles the tedious structure so you focus on intent
- Creates clear accountability through approval workflows
- Connects your decisions to actual execution

---

## References

- [github-issue-planner-vision.md](./github-issue-planner-vision.md) — Core architecture and data model
- [planner-agentic-behavior.md](./planner-agentic-behavior.md) — AI behavior specification
- [planner-scale.md](./planner-scale.md) — Multi-scope and hierarchical plans
- [planner-ux-scenarios.md](./planner-ux-scenarios.md) — Detailed user scenarios

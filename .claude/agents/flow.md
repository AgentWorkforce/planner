---
name: flow
description: When user mentions features, requirements, planning, or asks "what should I build next", proactively show feature status and suggest next actions. Entry point for all flow-* skills.
tools: Read, Write, Glob, Grep, Bash, TaskCreate, TaskUpdate, TaskList, TaskGet
skills:
  - flow-schema
  - flow-discover
  - flow-brainstorm
  - flow-planner
  - flow-feature
  - flow-ui-ux-validation
  - flow-test-designer
  - flow-change-request
  - flow-visualize
  - flow-tasks
---

You have all flow skills preloaded. Use them to manage the feature lifecycle.

**Schema**: See `flow-schema.md` for data structures.

## Critical Rule: Always Persist

**NEVER just summarize in chat.** All feature information MUST be written to `docs/flow/` files:
- `docs/flow/catalog.json` - project index with components and features
- `docs/flow/features/<slug>.json` - feature details

If files don't exist, create them. If they exist, update them.

## Output Rule

After completing ANY workflow that creates or modifies features:
1. **Write** results to docs/flow/ files (catalog.json, feature files)
2. **Visualize** using flow-visualize to show current state
3. **Suggest** next action based on incomplete sections

## Purpose

Central entry point for all flow skills:
- Show project/feature status
- Suggest next actions based on current state
- Route to appropriate sub-skill
- Detect requirement changes

## Usage

| Command | Action |
|---------|--------|
| `/flow` | Show status + suggest next action |
| `/flow status` | Status only (compact view) |
| `/flow visualize` | ASCII diagram of feature state |
| `/flow visualize dag` | Dependency graph view |
| `/flow discover` | Analyze codebase → create features |
| `/flow brainstorm` | New feature from rough idea |
| `/flow planner` | Create implementation plan |
| `/flow tasks` | Create executable tasks from plan |
| `/flow feature` | Document user flow |
| `/flow validate` | Validate UI/UX |
| `/flow test` | Design test coverage |
| `/flow change` | Handle requirement changes |
| `/flow <intent>` | Detect appropriate skill from input |

## Intent Detection

When user provides `/flow <text>`, detect appropriate skill:

| User intent patterns | Route to |
|---------------------|----------|
| "status", "show", "visualize", "diagram" | flow-visualize |
| "dag", "dependencies", "blocking", "what's blocking" | flow-visualize (DAG view) |
| "analyze", "map", "discover", "what exists", "traverse" | flow-discover |
| "plan", "implement", "how to build" | flow-planner |
| "tasks", "tasks", "ready to build", "let's build" | flow-tasks |
| "flow", "steps", "behavior", "what happens when" | flow-feature |
| "validate", "check UI", "test the UI", "looks like" | flow-ui-ux-validation |
| "test", "coverage", "test cases" | flow-test-designer |
| "change", "update", "modify", "actually we need" | flow-change-request |
| "new feature", "add feature", "idea" | flow-brainstorm |

If unclear, ask: "Which would you like to do?" + list options.

## Choosing Discover vs Brainstorm

| Situation | Use |
|-----------|-----|
| Existing codebase, no flow docs | flow-discover |
| New project, starting from idea | flow-brainstorm |
| Adding features to documented project | flow-brainstorm |
| "What features exist?" | flow-discover |
| "I want to build X" | flow-brainstorm |

## Section Ownership

| Section | Skill | Purpose |
|---------|-------|---------|
| `summary` | flow-brainstorm/flow-discover | What the feature is |
| `understanding` | Any agent (as needed) | Agent observations during ideation |
| `context` | Any agent (as needed) | Formalized decisions by role |
| `design_spec` | flow-ui-ux-designer | How it looks (views, components) |
| `user_flow` | flow-feature | How it behaves (for testing) |
| `plan_implementation` | flow-planner | How to build it (steps + specification) |
| `plan_tests` | flow-test-designer | Test design/coverage |
| `validation_uiux` | flow-ui-ux-validation | UI/UX validation results |
| `audit` | flow-audit | Implementation verification |

**Note**: `understanding` and `context` can be added by any skill when observations or decisions are made. They're not exclusive to one skill.

## Understanding and Context

These sections capture knowledge during the workflow:

**Understanding** = Agent observations during ideation (keyed by role)
- What patterns apply? What questions need answers? What concerns exist?
- Common roles: architect, designer, tester, security, modeler

**Context** = Formalized decisions by role (freeform key-value)
- Tech stack choices, design decisions, testing strategies
- Feature-level context can extend project-level `catalog.design_system`

**Specification** = Step-level technical details in `plan_implementation.steps`
- Architecture patterns, design choices, security requirements
- Freeform: any domain (architecture, design, model, testing, security)

## Status Check

Read `docs/flow/catalog.json` and `docs/flow/features/*.json`.
Use flow-visualize to render status.

## Suggest Next Action

Use feature DAG (dependencies + priority) to determine work order:
1. Find **unblocked** features (no dependencies, or all dependencies complete)
2. Sort by **priority** (critical > high > medium > low)
3. Suggest highest priority unblocked feature with incomplete sections

| State | Suggestion |
|-------|------------|
| No catalog | "Run /flow discover (existing project) or /flow brainstorm (new project)" |
| Features missing summary | "Complete /flow brainstorm or /flow discover" |
| Features with plan but no tasks | "Create tasks with /flow tasks" |
| Unblocked features missing sections | "Next: [feature] (priority: X) - needs [section]" |
| All unblocked complete, blocked remain | "Blocked features: X, Y depend on Z" |
| All sections complete | "All features complete. Review or publish." |

## Skill Order

```
discover ──┐
           ├──→ planner ──→ tasks ──→ [implement]
brainstorm ┘        │
     │              │
     └───→ feature ─┴─→ ui-ux-validation
               │
               └──→ test-designer
```

- **discover** or **brainstorm** first (creates catalog + summaries + initial understanding/context)
- **planner** creates implementation steps with specifications
- **tasks** creates executable tasks with PRE/IMPL/POST/VERIFY/DOC
- **feature** can run in parallel with planner
- **ui-ux-designer** populates design_spec and context.designer
- **ui-ux-validation** and **test-designer** require user_flow
- All can be re-run via **change-request** if requirements change

## Detect Change Requests

If input suggests changes to existing features:
→ "This sounds like a requirement change. Run /flow change?"

Indicators: "actually we need...", "change X to Y", "add/remove requirement"

## Plan Immutability

- Plans are immutable once approved
- If implementation diverges → use `/flow change-request`
- Never silently modify approved plans
- Progress is tracked in tasks, not in plan files

## Rules

- **Always write to docs/flow/** - never just chat summaries
- **Always visualize after changes** - show what happened
- **Capture understanding** - note observations during ideation
- **Record context** - persist decisions for future reference
- Status: ≤5 lines for quick checks
- Suggestions: single sentence each
- Don't switch skills without user confirmation
- If unsure which skill, ask

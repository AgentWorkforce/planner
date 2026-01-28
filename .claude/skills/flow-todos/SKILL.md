---
name: flow-todos
description: Use after flow-planner to create executable todos. Transforms implementation plan into Claude Code tasks with PRE/IMPL/POST/VERIFY/DOC checkpoints.
user-invocable: false
---
# Todos: Plan → Executable Tasks

**Owns**: Creates Claude Code todos from `plan_implementation`

## Purpose

Transform implementation plan into executable todos with verification checkpoints:
- PRE: Analyze before implementing
- IMPL: Do the work
- POST: Review changes
- VERIFY: Check acceptance criteria, run tests
- DOC: Compare to plan, flag divergence

## CRITICAL: This Skill Only Creates Todos

**DO NOT implement anything.** This skill:
- ✅ Reads the feature's plan_implementation.steps
- ✅ Creates todos using TaskCreate tool
- ✅ Sets up todo dependencies using TaskUpdate
- ✅ Shows the created todos using TaskList
- ❌ Does NOT run npm/yarn/pnpm commands
- ❌ Does NOT create files or directories
- ❌ Does NOT write code
- ❌ Does NOT execute any implementation steps

After creating todos, STOP and let the user start implementation.

## Multiple Features: Hierarchical Approach

When asked to handle multiple features (e.g., "all features", "do everything"):

**Step 1: Create feature-level todos first**
```
[TODO] Implement domain-plan (8 steps, critical, no deps)
[TODO] Implement domain-step (7 steps, critical, blocked by domain-plan)
[TODO] Implement domain-versioning (7 steps, high, blocked by domain-step)
...
```

**Step 2: Work one feature at a time**
When starting a feature-level todo:
1. Mark feature todo as in_progress
2. Create detailed PRE/IMPL/POST/VERIFY/DOC todos for that feature only
3. Complete all checkpoints
4. Mark feature todo as completed
5. Move to next feature

This prevents context overload and ensures proper sequencing.

## Prerequisites

Requires: feature with `plan_implementation.steps` section.

If missing → "Run /flow planner first."

## When to Use

- After flow-planner has created implementation plan
- User says "create todos", "make tasks", "ready to implement"
- User says "let's build this"

## Todo Types

### PRE (before each phase)

Analyze existing code before making changes.

```
Title: "Analyze [scope] before implementing [feature]"
ActiveForm: "Analyzing [scope] architecture"

Tasks:
- Read existing code in affected area
- Understand current architecture and patterns
- Note state management and data flow
- Identify integration points and risks
- Quality bar: simple, elegant, robust, readable
- No over/under-engineering, no hacks, no magic
```

### IMPL (one per plan step)

The actual implementation work.

```
Title: "[step title]"
ActiveForm: "[step title in progress form]"

Description includes:
- Step description from plan
- Acceptance criteria for this step
- Scope and dependencies
- Reference: feature_id, step_id
```

### POST (after each phase)

PR-style review of all changes in the phase.

```
Title: "Review [feature] implementation"
ActiveForm: "Reviewing [feature] changes"

Tasks:
- Review all changes made in this phase
- Check for: bugs, logic errors, code smells
- Check for: over/under-engineering, hacks, magic
- Fix any issues found before proceeding
```

### VERIFY (after POST)

Verify acceptance criteria and run tests.

```
Title: "Verify [feature] acceptance criteria"
ActiveForm: "Verifying [feature] criteria"

Tasks:
- Check each acceptance criterion is met
- Run builds (if applicable)
- Run type checks (if applicable)
- Run tests (if applicable)
- All must pass before continuing
```

### DOC (after VERIFY)

Compare implementation to plan, flag divergence.

```
Title: "Document [feature] completion"
ActiveForm: "Documenting [feature] completion"

Tasks:
- Compare implementation to plan
- If diverged from plan → suggest /flow change-request
- If acceptance criteria changed → flag for change-request
- If all matches → phase complete
```

## Workflow

### 1. Read Feature Plan

Load feature file and extract `plan_implementation.steps`.

### 2. Group Steps by Phase

Group steps by scope or logical phase. Each group gets:
- 1 PRE todo
- N IMPL todos (one per step)
- 1 POST todo
- 1 VERIFY todo
- 1 DOC todo

### 3. Create Todos

Use the **TaskCreate tool** (not a CLI command). TaskCreate is a built-in Claude Code tool that you call directly, like Read or Write.

Example TaskCreate call:
```
TaskCreate:
  subject: "[IMPL] Create Plan interface"
  description: |
    ## Flow Reference
    - Feature: domain-plan
    - Step: dp002
    - File: docs/flow/features/domain-plan.json

    ## Task
    Create TypeScript interface for Plan entity.

    ## Acceptance Criteria
    - [ ] Plan has plan_id, created_at, updated_at
    - [ ] Zod schema validates Plan
  activeForm: "Creating Plan interface"
```

**Important**: TaskCreate is a tool you invoke, not a bash command. Do NOT run `claude task create` or similar CLI commands.

### 4. Set Dependencies

- IMPL todos may depend on each other (per plan step dependencies)
- POST blocked by all IMPL in phase
- VERIFY blocked by POST
- DOC blocked by VERIFY
- Next phase's PRE blocked by previous phase's DOC

## Todo Descriptions

Each todo description should include:

```markdown
## Flow Reference
- Feature: [feature_id]
- Step: [step_id] (for IMPL only)
- File: docs/flow/features/[file].json

## Acceptance Criteria
- [ ] ac1: [description]
- [ ] ac2: [description]

## Quality Standards
- Simple, elegant, robust, readable
- No over/under-engineering
- No hacks or magic numbers
```

## Rules

- **Plan is immutable** - divergence triggers change-request, not silent update
- **Progress tracked in todos** - not in plan files
- **Each checkpoint is explicit** - cannot skip POST/VERIFY/DOC
- **POST must complete** before VERIFY starts
- **VERIFY must pass** before DOC starts
- **DOC must complete** before next phase starts

## Example Output

For a feature with 3 implementation steps across 2 scopes:

```
Phase: backend
├── [PRE]    Analyze backend before implementing auth
├── [IMPL]   Add auth endpoints
├── [IMPL]   Add session middleware
├── [POST]   Review backend auth implementation
├── [VERIFY] Verify backend auth criteria
└── [DOC]    Document backend auth completion

Phase: frontend
├── [PRE]    Analyze frontend before implementing auth
├── [IMPL]   Add login page
├── [POST]   Review frontend auth implementation
├── [VERIFY] Verify frontend auth criteria
└── [DOC]    Document frontend auth completion
```

## Fits the Whole

| Skill | Section |
|-------|---------|
| flow-discover | `summary` (from code) |
| flow-brainstorm | `summary` (from ideas) |
| flow-planner | `plan_implementation` |
| **flow-todos** | Creates executable tasks from plan |
| flow-feature | `user_flow` |
| flow-ui-ux-validation | `validation_uiux` |
| flow-test-designer | `plan_tests` |
| flow-visualize | Reads all, renders diagram |
| flow-change-request | Updates any, cascades |

## Suggested Next Steps

After todos created:
- Start with first PRE todo
- Work through each phase sequentially
- If divergence detected in DOC → `/flow change-request`

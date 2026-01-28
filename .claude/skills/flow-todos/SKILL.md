---
name: flow-todos
description: Use when user says "create todos", "make tasks", "ready to implement", or "let's build this" after a plan exists. Creates Claude Code tasks with PRE/IMPL/POST/VERIFY/DOC checkpoints.
user-invocable: false
---
# Todos: Plan → Executable Tasks

## The Process

Creating todos is a loop. You process features one by one, in dependency order.

```
1. Read catalog, get all features with plan_implementation.steps
2. Sort features: dependencies first, then by priority
3. For each feature:
   a. Create PRE todo (blocked by previous feature's DOC if dependent)
   b. Create IMPL todos (one per step, respecting step dependencies)
   c. Create POST todo (blocked by all IMPLs)
   d. Create VERIFY todo (blocked by POST)
   e. Create DOC todo (blocked by VERIFY)
   f. Record this feature's DOC todo ID (needed for dependent features)
4. Continue until all features processed
```

## Handling Large Sets

You can create multiple todos per turn. Batch them by feature - create all todos for one feature, then move to the next.

If you have many features:
- Process them in order
- Track which features you've completed
- If you need to stop mid-way, note where you are so you can resume

## Todo Structure Per Feature

For each feature, create these todos in order:

| Todo | Subject | Blocked By |
|------|---------|------------|
| PRE | [PRE] Analyze before [feature] | Previous feature's DOC (if dependent) |
| IMPL×N | [IMPL] [step title] | PRE, plus step dependencies from plan |
| POST | [POST] Review [feature] changes | All IMPLs |
| VERIFY | [VERIFY] Check [feature] criteria | POST |
| DOC | [DOC] Document [feature] completion | VERIFY |

## Cross-Feature Dependencies

If feature B depends on feature A:
- B's PRE todo is blocked by A's DOC todo

This ensures you complete one feature before starting a dependent one.

## Todo Format

- **subject**: "[TYPE] Brief description"
- **activeForm**: Present continuous form for the spinner
- **description**: Feature ID, step ID (for IMPL), acceptance criteria, link to feature file

## Checkpoint Purposes

| Type | Purpose |
|------|---------|
| PRE | Read existing code, understand architecture before changing |
| IMPL | Do the actual implementation work |
| POST | Self-review: bugs, logic errors, code quality |
| VERIFY | Acceptance criteria met? Tests pass? |
| DOC | Compare to plan. Diverged? → `/flow change-request` |

## Prerequisite

Each feature must have `plan_implementation.steps`. Skip features without plans, or note they need `/flow planner` first.

## After All Todos Created

Stop. The user works through the todos. You don't implement.

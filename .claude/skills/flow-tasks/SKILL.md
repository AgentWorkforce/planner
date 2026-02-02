---
name: flow-tasks
description: Use when user says "create tasks", "make tasks", "ready to implement", or "let's build this" after a plan exists. Creates Claude Code tasks with PRE/IMPL/POST/VERIFY/DOC checkpoints.
user-invocable: false
---
# Tasks: Plan → Executable Tasks

Create tasks using TaskCreate, TaskUpdate, TaskList - these are tools you invoke directly, not CLI commands.

## The Process

Creating tasks is a loop. You process features one by one, in dependency order.

```
1. Read catalog, get all features with plan_implementation.steps
2. Sort features: dependencies first, then by priority
3. For each feature:
   a. Create PRE task (blocked by previous feature's CHECKPOINT if dependent)
   b. Create IMPL tasks (one per step, respecting step dependencies)
   c. Create POST task (blocked by all IMPLs)
   d. Create VERIFY task (blocked by POST)
   e. Create DOC task (blocked by VERIFY)
   f. Create CHECKPOINT task (blocked by DOC)
   g. Record this feature's CHECKPOINT task ID (needed for dependent features)
4. Continue until all features processed
```

## Handling Large Sets

You can create multiple tasks per turn. Batch them by feature - create all tasks for one feature, then move to the next.

If you have many features:
- Process them in order
- Track which features you've completed
- If you need to stop mid-way, note where you are so you can resume

## Task Structure Per Feature

For each feature, create these tasks in order:

| Task | Subject | Blocked By |
|------|---------|------------|
| PRE | [PRE] Analyze before [feature] | Previous feature's CHECKPOINT (if dependent) |
| IMPL×N | [IMPL] [step title] | PRE, plus step dependencies from plan |
| POST | [POST] Review [feature] changes | All IMPLs |
| VERIFY | [VERIFY] Check [feature] criteria | POST |
| DOC | [DOC] Document [feature] completion | VERIFY |
| CHECKPOINT | [CHECKPOINT] Context check | DOC |

## Cross-Feature Dependencies

If feature B depends on feature A:
- B's PRE task is blocked by A's CHECKPOINT task

This ensures you complete one feature (and check context) before starting a dependent one.

## Task Format

- **subject**: "[TYPE] Brief description"
- **activeForm**: Present continuous form for the spinner
- **description**: Must include actionable instructions (see templates below)

## Task Description Templates

Each task description must tell the executing agent exactly what to do. Copy these templates:

**PRE**:
```
Feature: [feature_id]
File: docs/flow/features/[feature_id].json

DO:
1. Run /cost and report the ACTUAL percentage. If > 50%, run /compact first
2. Read the feature file to understand goal and acceptance criteria
3. Read all files that will be modified (check plan_implementation.steps)
4. Note current architecture patterns to maintain consistency
5. Identify risks or blockers before implementing

You MUST state the actual context percentage. DO NOT proceed until you've reported it.
```

**IMPL** (one per step):
```
Feature: [feature_id]
Step: [step_id] - [step_title]
File: docs/flow/features/[feature_id].json

DO: Implement this step per its acceptance_criteria and specification (if present) in the feature file.
```

**POST**:
```
Feature: [feature_id]
File: docs/flow/features/[feature_id].json

DO: Review this code as if it were a PR from another developer.

1. Re-read ALL code written or modified for this feature
2. Look for:
   - Bugs, logic errors, off-by-one mistakes
   - Missing edge cases or error handling
   - Inconsistent patterns vs existing codebase
   - Security issues (injection, auth, data exposure)
   - Performance concerns (N+1 queries, unnecessary loops)
   - Code that could be clearer or simpler
3. Make fixes and improvements—don't just note them

Be critical. If you wouldn't approve this PR, fix it before marking complete.
```

**VERIFY**:
```
Feature: [feature_id]
File: docs/flow/features/[feature_id].json

DO:
1. Read the feature's acceptance_criteria from the file
2. For EACH criterion: confirm it is met (not assumed)
3. Run relevant tests (typecheck, unit tests, integration tests)
4. If any criterion is NOT met, fix it before marking complete

List each criterion and its status in your response.
```

**DOC**:
```
Feature: [feature_id]
File: docs/flow/features/[feature_id].json

DO:
1. Compare what you built to the plan_implementation.steps
2. If implementation diverged from plan, run `/flow change-request`
3. Update feature status if complete

Mark complete only if implementation matches plan (or change request filed).
```

**CHECKPOINT**:
```
Feature: [feature_id] complete.

DO:
1. Run /cost and report the ACTUAL percentage shown
2. If > 50%, run /compact before marking complete
3. If this completes an epic, suggest running `/flow audit` on the epic
4. Mark complete only after reporting the actual number

You MUST state the actual context percentage. "Context is fine" without a number = task NOT complete.
```

## Prerequisite

Each feature must have `plan_implementation.steps`. Skip features without plans, or note they need `/flow planner` first.

## After All Tasks Created

Stop. The user works through the tasks. You don't implement.

## Fits the Whole

| Skill | Section |
|-------|---------|
| flow-discover | `summary`, `understanding`, `context` (from code) |
| flow-brainstorm | `summary`, `understanding`, `context` (from ideas) |
| flow-ui-ux-designer | `design_spec`, `context.designer`, `understanding.designer` |
| flow-planner | `plan_implementation` (with step `specification`) |
| **flow-tasks** | Creates executable tasks from plan |
| flow-feature | `user_flow` |
| flow-ui-ux-validation | `validation_uiux` |
| flow-test-designer | `plan_tests` |
| flow-visualize | Reads all, renders diagram |
| flow-change-request | Updates any, cascades |

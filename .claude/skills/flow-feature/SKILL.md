---
name: flow-feature
description: Use when documenting feature behavior as testable user flows. Fills user_flow section with atomic steps ([action], [assert], [system]).
user-invocable: false
---
# Feature Flow: Feature → User Flow

**Owns**: Feature `user_flow` section

## Purpose

Document "what the product does" as atomic steps:
- Capture user actions, system behavior, expected outcomes
- Make flows testable (observable assertions)
- Serve as source of truth for E2E/integration tests

## Input

- Feature file with `summary` section

## Output

Feature's `user_flow` section filled.

## Prerequisites

Requires: feature file with `summary` section.

If no feature file → "Run /flow discover or /flow brainstorm first."

## Modes

**Declare**: User describes feature behavior; convert to flow.

**Elaborate**: Feature already has summary; expand into detailed steps.

For documenting behavior of existing code without a feature file, use `/flow discover` first.

## Rules

- 1–2 questions per message. Prefer option-based questions.
- Each step must be atomic: one action or one assertion
- Assertions must be observable (UI state, URL, API response, persisted record)
- No vague language ("works", "handles correctly")
- Happy path first; add variants only when they change behavior materially
- After completion: single-sentence summary unless user requests more.

## Workflow

### 1. Understand the Feature

Read `summary.goal` and `summary.acceptance_criteria`.
Identify the happy path and key variants.

### 2. Draft Steps

Write atomic steps using tags:

```json
{
  "user_flow": {
    "steps": [
      { "step_id": "s001", "title": "[action] User enters credentials" },
      { "step_id": "s002", "title": "[system] API validates credentials" },
      { "step_id": "s003", "title": "[assert] Dashboard is visible" },
      { "step_id": "s004", "title": "[assert] Welcome message shows username" }
    ]
  }
}
```

### 3. Step Tags

| Tag | Meaning |
|-----|---------|
| `[action]` | User action (click, type, navigate) |
| `[assert]` | Observable assertion (visible, contains, URL) |
| `[system]` | System side-effect (verified via later assert) |

### 4. Quality Bar

- Each step is atomic: one action or one assertion
- Assertions must be observable (UI state, URL, API response, persisted record)
- No vague language ("works", "handles correctly")
- Happy path first; add variants only when they change behavior materially

### 5. Handle Complexity

If a feature has >10 flow steps or multiple distinct paths:
- Split into sub-features
- Use epic structure with `sub_features` array

## Fits the Whole

| Skill | Section |
|-------|---------|
| flow-discover | `summary` (from code) |
| flow-brainstorm | `summary` (from ideas) |
| flow-planner | `plan_implementation` |
| flow-todos | Creates executable tasks from plan |
| **flow-feature** | `user_flow` |
| flow-ui-ux-validation | `validation_uiux` |
| flow-test-designer | `plan_tests` |
| flow-visualize | Reads all, renders diagram |
| flow-change-request | Updates any, cascades |

## Suggested Next Steps

- To validate in real UI: `/flow validate`
- To design test coverage: `/flow test`

## Done When

- `user_flow` section is filled
- Each step is atomic and tagged
- Assertions are observable
- Happy path is complete; key variants documented

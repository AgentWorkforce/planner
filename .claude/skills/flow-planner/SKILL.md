---
name: flow-planner
description: When feature has summary but needs implementation steps - "how do I build this?", "plan the implementation", or feature.plan_implementation.steps is empty. Creates multi-scope implementation plans with dependencies, roles, and approval gates.
user-invocable: false
---
# Planner: Feature → Implementation Plan

**Owns**: Feature `plan_implementation` section

## Purpose

Transform a feature into a structured implementation plan:
- Identify affected scopes (from catalog components)
- Draft steps with dependencies, roles, acceptance criteria
- Add human approval gates where needed

## Input

- Feature file with `summary` section (from flow-brainstorm or flow-discover)
- Or direct intent from user

## Output

Feature's `plan_implementation` section filled.

## Prerequisites

Requires: feature file with `summary` section, or direct intent.

If feature exists but no summary → "Run /flow brainstorm or /flow discover first."

## Rules

- 1–2 questions per message. Prefer option-based questions.
- Multi-scope is the default—real work crosses boundaries.
- Use component IDs from `catalog.components` as scope values.
- AI infers dependencies from step content.
- Steps specify `owner_role` (e.g., "backend:Coder"), not specific agents.
- Human approval gates are explicit where accountability matters.
- After completion: single-sentence summary unless user requests more.

## Workflow

### 1. Read Catalog Components

Check `docs/flow/catalog.json` for defined components:

```json
"components": [
  { "id": "backend", "name": "API Server", "tech": ["Node.js"] },
  { "id": "frontend", "name": "Web App", "tech": ["React"] }
]
```

Use these component IDs as scope values.

### 2. Understand Intent

Read the feature's `summary.goal` and `summary.acceptance_criteria`.
If unclear, clarify with user.

### 3. Identify Affected Scopes

Determine which components are affected:
```
"Add user authentication" affects:
  • backend (auth endpoints, session management)
  • frontend (login UI, protected routes)
  • database (user records, sessions)
```

### 4. Draft Steps

For each scope, draft implementation steps:

```json
{
  "plan_implementation": {
    "scopes": ["backend", "frontend", "database"],
    "steps": [
      {
        "step_id": "i001",
        "title": "Add auth endpoints",
        "scope": "backend",
        "description": "Implement /auth/login and /auth/logout",
        "dependencies": [],
        "owner_role": "backend:Coder",
        "acceptance_criteria": [
          { "id": "ac1", "description": "Returns token on successful auth" }
        ]
      }
    ]
  }
}
```

### 5. Add Gates

Add `human_approval` gates for:
- Security-sensitive steps (auth, permissions, data access)
- External-facing changes (API contracts, UI changes)
- High-risk operations (migrations, deletions)

```json
"gate": { "type": "human_approval", "approver_role": "tech-lead" }
```

### 6. Approval

When implementation plan is complete:
- Verify dependencies form valid DAG
- Update feature `status` as appropriate

## Fits the Whole

| Skill | Section |
|-------|---------|
| flow-discover | `summary` (from code) |
| flow-brainstorm | `summary` (from ideas) |
| **flow-planner** | `plan_implementation` |
| flow-todos | Creates executable tasks from plan |
| flow-feature | `user_flow` |
| flow-ui-ux-validation | `validation_uiux` |
| flow-test-designer | `plan_tests` |
| flow-visualize | Reads all, renders diagram |
| flow-change-request | Updates any, cascades |

## Suggested Next Steps

- Implementation plan ready: proceed to build
- To document user-facing behavior: `/flow feature`

## Done When

- `plan_implementation` section is filled
- Scopes match catalog component IDs
- Each step has: title, scope, description, acceptance criteria
- Dependencies are inferred and shown
- Gates are placed where accountability matters

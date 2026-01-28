---
name: flow-brainstorm
description: Use when starting a new feature or refining a rough idea into structured requirements. Creates catalog.json and feature files with summary and acceptance criteria.
user-invocable: false
---
# Brainstorm: Idea → Feature Catalog

**Owns**: `catalog.json`, feature `summary` section

## Purpose

Transform a vague idea into a processable, approved feature set by:
- Clarifying goal, scope, constraints, success criteria
- Exploring 2–3 approaches with trade-offs
- Producing catalog + feature files

## Output

- `docs/flow/catalog.json`
- `docs/flow/features/<slug>.json` (one per feature/epic)

## Rules

- 1–2 questions per message. Prefer option-based questions.
- Propose 2–3 approaches with trade-offs before committing.
- MVP by default; expand scope only when required by success criteria.
- Persist decisions into files—no chat-only conclusions.
- Acceptance criteria must be **assertions** (checkable outcomes), not tasks.
- After completion: single-sentence summary unless user requests more.

## Workflow

### 1. Check for Existing Catalog

If `docs/flow/catalog.json` exists:
- Show existing components and features
- Ask: "Add to existing catalog or start fresh?"

### 2. Identify Components (multi-component projects)

For projects spanning multiple parts:
- Identify all components (backend, frontend, mobile, database, etc.)
- Add to `catalog.components` array
- Each component: `id`, `name`, `tech[]`, `path`

```json
"components": [
  { "id": "backend", "name": "API Server", "tech": ["Node.js"], "path": "server/" },
  { "id": "frontend", "name": "Web App", "tech": ["React"], "path": "client/" }
]
```

### 3. Clarify Feature Intent

Collect until writable:
- **Goal**: 1–2 sentences
- **In/Out**: what's in v1, what's explicitly out
- **Constraints**: platform, integrations, privacy, performance
- **Success criteria**: 3–7 assertions

### 4. Explore Approaches

For each approach: what it optimizes for, major trade-offs, risks.
User chooses or accepts recommendation.

### 5. Create Features

Create feature files with `summary` section filled:

```json
{
  "feature_id": "auth-login",
  "title": "User Login",
  "type": "feature",
  "status": "draft",
  "priority": "high",
  "dependencies": [],
  "summary": {
    "goal": "Allow users to authenticate",
    "acceptance_criteria": [
      { "id": "ac1", "description": "User can log in with valid credentials" },
      { "id": "ac2", "description": "Invalid credentials show clear error" }
    ]
  },
  "plan_implementation": {
    "scopes": ["backend", "frontend"],
    "steps": []
  }
}
```

### 6. Set Dependencies and Priority

For each feature:
- `dependencies`: which features must complete first (creates DAG)
- `priority`: critical/high/medium/low based on value and risk

### 7. Organize as Epics

Group related features under epics:
- Create epic file with `type: "epic"` and `sub_features` array
- **Inline** if anticipated complexity is low (simple flow, few scopes)
- **Separate file** if complex (multi-path flows, multiple scopes, high-risk)

### 8. Approve

When feature list is stable:
- Set `catalog.status = "approved"`
- Set each feature's `status = "approved"`

## Fits the Whole

| Skill | Section |
|-------|---------|
| flow-discover | `summary` (from code) |
| **flow-brainstorm** | `summary` (from ideas) |
| flow-planner | `plan_implementation` |
| flow-todos | Creates executable tasks from plan |
| flow-feature | `user_flow` |
| flow-ui-ux-validation | `validation_uiux` |
| flow-test-designer | `plan_tests` |
| flow-visualize | Reads all, renders diagram |
| flow-change-request | Updates any, cascades |

## Suggested Next Steps

- To plan implementation: `/flow planner`
- To document behavior for testing: `/flow feature`

## Done When

- Catalog exists with components (if multi-component)
- Each feature has: goal, acceptance criteria, priority
- Epics group related features logically
- Unknowns are explicitly marked

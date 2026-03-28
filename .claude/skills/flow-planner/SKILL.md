---
name: flow-planner
description: When feature has summary but needs implementation steps - "how do I build this?", "plan the implementation", or feature.plan_implementation.steps is empty. Creates multi-scope implementation plans with dependencies, roles, and approval gates.
user-invocable: false
---
# Planner: Feature → Implementation Plan

**Owns**: Feature `plan_implementation` section (including step-level `specification`)

## Purpose

Transform a feature into a structured implementation plan:
- Identify affected scopes (from catalog components)
- Draft steps with dependencies, roles, acceptance criteria
- Add step-level specifications for technical details
- Add human approval gates where needed

## Input

- Feature file with `summary` section (from flow-brainstorm or flow-discover)
- Feature file with `design_spec` section (if UI feature, from flow-ui-ux-designer)
- Feature `understanding` and `context` (if available)
- Or direct intent from user

## Output

Feature's `plan_implementation` section filled, including step specifications.

## Prerequisites

Requires: feature file with `summary` section, or direct intent.

If feature exists but no summary → "Run /flow brainstorm or /flow discover first."

## Rules

- Use `mcp__conductor__AskUserQuestion` for choices; 1–2 questions max.
- Multi-scope is the default—real work crosses boundaries.
- Use component IDs from `catalog.components` as scope values.
- AI infers dependencies from step content.
- Steps specify `owner_role` (e.g., "backend:Coder"), not specific agents.
- Human approval gates are explicit where accountability matters.
- **Acceptance criteria must be specific** — not "returns data" but "returns { id, name, status }".
- **Cross-scope boundaries need contracts** — if backend serves frontend, define the shape.
- **Include integration steps** — every new component/endpoint/service needs a step for where it gets rendered/called/used.
- **Wire UI handlers to APIs** — if a step creates a UI handler (onClick, onSubmit) and another creates an API endpoint, add an explicit step to connect them.
- **Add specification for technical steps** — architecture decisions, design choices, security requirements.
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
Also check `understanding` and `context` for existing observations and decisions.
If unclear, clarify with user.

### 3. Identify Affected Scopes

Determine which components are affected:
```
"Add user authentication" affects:
  • backend (auth endpoints, session management)
  • frontend (login UI, protected routes)
  • database (user records, sessions)
```

### 4. Draft Steps with Specification

For each scope, draft implementation steps. Add `specification` for technical details:

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
          { "id": "ac1", "description": "Returns JWT token on successful auth" }
        ],
        "specification": {
          "architecture": {
            "pattern": "middleware chain",
            "tech": "express-jwt"
          },
          "security": {
            "auth_method": "JWT",
            "token_expiry": "7 days",
            "refresh_strategy": "sliding window"
          }
        }
      },
      {
        "step_id": "i002",
        "title": "Create login form component",
        "scope": "frontend",
        "description": "Build login UI with form validation",
        "dependencies": ["i001"],
        "owner_role": "frontend:Coder",
        "acceptance_criteria": [
          { "id": "ac1", "description": "Form validates email format" },
          { "id": "ac2", "description": "Shows loading state during auth" }
        ],
        "specification": {
          "design": {
            "component": "Card with Form",
            "library": "shadcn/ui",
            "layout": "centered, max-w-md"
          }
        }
      }
    ]
  }
}
```

### 5. When to Add Specification

Add `specification` to steps that involve:

| Domain | When to add | Example fields |
|--------|-------------|----------------|
| `architecture` | New patterns, integrations, tech choices | pattern, tech, integration_points |
| `design` | UI components, layouts, styling | component, library, layout, variants |
| `model` | Database/schema changes | entities, relationships, migrations |
| `testing` | Test-specific requirements | strategy, coverage, fixtures |
| `security` | Auth, permissions, data handling | auth_method, permissions, encryption |

**Specification is freeform** — any domain, any fields. Use what's relevant.

### 6. Define Cross-Scope Contracts

When steps cross boundaries (API ↔ UI, service ↔ service), define explicit contracts:

1. **Check `design_spec`** — what does the consumer (UI) need?
2. **Specify data shapes** in acceptance criteria:

```json
// Bad: vague
{ "id": "ac1", "description": "Returns list of plans" }

// Good: explicit shape
{ "id": "ac1", "description": "Returns [{ id, goal, status, latest_version, created_at }]" }
```

3. **Mark integration points** — add `"integration": true` to steps that cross scopes

This prevents the classic "backend returns X, frontend expects Y" mismatch.

### 7. Add Gates

Add `human_approval` gates for:
- Security-sensitive steps (auth, permissions, data access)
- External-facing changes (API contracts, UI changes)
- High-risk operations (migrations, deletions)

```json
"gate": { "type": "human_approval", "approver_role": "tech-lead" }
```

### 8. Approval

When implementation plan is complete:
- Verify dependencies form valid DAG
- Update feature `status` as appropriate

## Specification Examples

### Architecture specification:
```json
"specification": {
  "architecture": {
    "pattern": "repository",
    "tech": "better-sqlite3",
    "caching": "in-memory LRU"
  }
}
```

### Design specification:
```json
"specification": {
  "design": {
    "component": "DataTable",
    "library": "shadcn/ui",
    "features": ["sorting", "filtering", "pagination"],
    "custom_cells": ["status badge", "action menu"]
  }
}
```

### Security specification:
```json
"specification": {
  "security": {
    "auth_required": true,
    "permissions": ["admin", "editor"],
    "rate_limit": "100/minute",
    "audit_log": true
  }
}
```

## Fits the Whole

| Skill | Section |
|-------|---------|
| flow-discover | `summary`, `understanding`, `context` (from code) |
| flow-brainstorm | `summary`, `understanding`, `context` (from ideas) |
| **flow-planner** | `plan_implementation` (with step specifications) |
| flow-tasks | Creates executable tasks from plan |
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
- **Technical steps have specification** with relevant domain details
- **Cross-scope steps have explicit data shapes** in acceptance criteria
- Dependencies are inferred and shown
- Gates are placed where accountability matters

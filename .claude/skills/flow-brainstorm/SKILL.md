---
name: flow-brainstorm
description: When user has a new idea, rough vision, or requirement that doesn't exist yet - "I want to build X", "new feature", "let's add Y". Structures the idea into catalog.json and feature files with goals and acceptance criteria.
user-invocable: false
---
# Brainstorm: Idea → Feature Catalog

**Owns**: `catalog.json`, feature `summary` section, initial `understanding` and `context`

## Purpose

Transform a vague idea into a processable, approved feature set by:
- Clarifying goal, scope, constraints, success criteria
- Exploring 2–3 approaches with trade-offs
- Capturing initial observations and decisions
- Producing catalog + feature files

## Output

- `docs/flow/catalog.json`
- `docs/flow/features/<slug>.json` (one per feature/epic)

## Rules

- Use `mcp__conductor__AskUserQuestion` for choices; 1–2 questions max.
- Propose 2–3 approaches with trade-offs before committing.
- MVP by default; expand scope only when required by success criteria.
- Persist decisions into files—no chat-only conclusions.
- Acceptance criteria must be **assertions** (checkable outcomes), not tasks.
- Capture observations and decisions in `understanding` and `context` sections.
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

**Capture observations**: As you explore approaches, note insights in `understanding`:
- What patterns might apply?
- What questions need answers?
- What concerns emerged?

### 5. Record Decisions

When decisions are made during brainstorming, capture them in `context`:

```json
"context": {
  "architect": {
    "approach": "REST API with SQLite",
    "rationale": "Simple, portable, no external dependencies"
  },
  "designer": {
    "library": "shadcn/ui",
    "theme": "dark mode by default"
  }
}
```

### 6. Create Features

Create feature files with `summary`, `understanding`, and `context` sections:

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
  "understanding": {
    "architect": {
      "observations": ["JWT tokens for session management", "Rate limiting needed"],
      "questions": ["OAuth integration later?"],
      "confidence": "forming"
    }
  },
  "context": {
    "architect": {
      "auth_method": "JWT",
      "session_duration": "7 days"
    },
    "security": {
      "rate_limiting": "5 attempts per minute"
    }
  },
  "plan_implementation": {
    "scopes": ["backend", "frontend"],
    "steps": []
  }
}
```

### 7. Set Dependencies and Priority

For each feature:
- `dependencies`: which features must complete first (creates DAG)
- `priority`: critical/high/medium/low based on value and risk

### 8. Organize as Epics

Group related features under epics:
- Create epic file with `type: "epic"` and `sub_features` array
- **Inline** if anticipated complexity is low (simple flow, few scopes)
- **Separate file** if complex (multi-path flows, multiple scopes, high-risk)

### 9. Approve

When feature list is stable:
- Set `catalog.status = "approved"`
- Set each feature's `status = "approved"`

## Understanding During Brainstorm

As you brainstorm, capture observations by role:

| Role | What to capture |
|------|-----------------|
| architect | Tech decisions, patterns, integration points |
| designer | UI/UX preferences, component choices |
| tester | Testability concerns, edge cases identified |
| security | Auth needs, data sensitivity, compliance |

Example:
```json
"understanding": {
  "architect": {
    "observations": ["REST API pattern fits well", "May need WebSocket for real-time"],
    "keywords": ["REST", "CRUD", "real-time"],
    "questions": ["Should we support offline mode?"],
    "concerns": ["Scaling if user count grows 10x"],
    "confidence": "forming"
  }
}
```

## Context During Brainstorm

When decisions are made (even tentative), record them:

```json
"context": {
  "architect": {
    "api_style": "REST with JSON",
    "storage": "SQLite for MVP, PostgreSQL later"
  },
  "designer": {
    "library": "shadcn/ui",
    "dark_mode": "default"
  }
}
```

## Fits the Whole

| Skill | Section |
|-------|---------|
| flow-discover | `summary` (from code) |
| **flow-brainstorm** | `summary`, `understanding`, `context` (from ideas) |
| flow-planner | `plan_implementation` |
| flow-tasks | Creates executable tasks from plan |
| flow-feature | `user_flow` |
| flow-ui-ux-validation | `validation_uiux` |
| flow-test-designer | `plan_tests` |
| flow-visualize | Reads all, renders diagram |
| flow-change-request | Updates any, cascades |

## Suggested Next Steps

- For UI features: `/flow design` (define UI/UX before implementation)
- To plan implementation: `/flow planner`
- To document behavior for testing: `/flow feature`

## Done When

- Catalog exists with components (if multi-component)
- Each feature has: goal, acceptance criteria, priority
- Key observations captured in `understanding` (at least architect role)
- Key decisions captured in `context` (any that were made)
- Epics group related features logically
- Unknowns are explicitly marked

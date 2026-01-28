
# Flow Schema

Defines the data structure used by all flow-* skills.

## File Structure

```
docs/flow/
├── catalog.json              # Project index
└── features/
    └── <slug>.json           # Feature file (epic or leaf)
```

## Catalog

```json
{
  "project_id": "my-project",
  "status": "draft|approved|published",

  "components": [
    {
      "id": "component-id",
      "name": "Human-readable name",
      "tech": ["Technology", "Framework"],
      "path": "src/path/",
      "description": "What this component does"
    }
  ],

  "features": [
    { "id": "auth", "title": "Authentication", "type": "epic", "status": "approved" },
    { "id": "settings", "title": "User Settings", "type": "feature", "status": "draft" }
  ]
}
```

### Component Fields

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Slug used in `plan_implementation.scopes` |
| `name` | Yes | Human-readable name |
| `tech` | No | Array of technologies/frameworks |
| `path` | No | Root path in repo (for discovery) |
| `description` | No | What this component does |

## Feature

```json
{
  "feature_id": "auth",
  "title": "Authentication",
  "type": "epic|feature",
  "status": "draft|approved|published|deprecated",
  "priority": "critical|high|medium|low",
  "dependencies": ["other-feature-id"],

  "summary": {
    "goal": "What this feature achieves",
    "context": "Optional background",
    "acceptance_criteria": [
      { "id": "ac1", "description": "Checkable outcome" }
    ]
  },

  "user_flow": {
    "steps": [
      {
        "step_id": "s001",
        "title": "[action|assert|system] Description",
        "description": "Detailed instruction or expected outcome"
      }
    ]
  },

  "plan_implementation": {
    "scopes": ["backend", "frontend"],
    "steps": [
      {
        "step_id": "i001",
        "title": "Step title",
        "scope": "backend",
        "description": "What to do",
        "dependencies": ["i000"],
        "owner_role": "backend:Coder",
        "acceptance_criteria": [{ "id": "ac1", "description": "..." }],
        "gate": { "type": "human_approval", "approver_role": "tech-lead" }
      }
    ]
  },

  "plan_tests": {
    "coverage": "e2e|integration|unit",
    "priority": "critical|high|medium|low",
    "cases": [
      { "type": "happy|edge|error", "description": "Test case" }
    ],
    "data_requirements": ["Test accounts", "Seed data"]
  },

  "validation_uiux": {
    "env": "local|staging|prod",
    "viewport": "desktop|mobile|both",
    "steps": [
      {
        "step_id": "s001",
        "present": "pass|fail|unknown",
        "designed": "pass|fail|unknown",
        "holistic": "pass|fail|unknown",
        "issues": [{ "severity": "blocker|major|minor", "issue": "...", "fix": "..." }]
      }
    ],
    "summary": {
      "present": "pass|fail|unknown",
      "designed": "pass|fail|unknown",
      "holistic": "pass|fail|unknown",
      "blockers": 0,
      "majors": 0,
      "minors": 0
    }
  },

  "references": [
    { "type": "prd", "title": "Auth PRD v2", "url": "https://..." },
    { "type": "design", "title": "Login Figma", "url": "https://..." },
    { "type": "spec", "title": "OAuth Integration", "path": "docs/oauth-spec.md" }
  ],

  "sub_features": [
    { "feature_id": "auth-login", "title": "Login", "type": "feature" },
    { "feature_id": "auth-reset", "ref": "auth-reset.json" }
  ]
}
```

## Section Ownership

| Section | Skill | Purpose |
|---------|-------|---------|
| `summary` | flow-brainstorm/flow-discover | What the feature is |
| `user_flow` | flow-feature | How it behaves (for testing) |
| `plan_implementation` | flow-planner | How to build it |
| `plan_tests` | flow-test-designer | Test design/coverage |
| `validation_uiux` | flow-ui-ux-validation | UI/UX validation results |
| `references` | Any | Links to external docs |
| `sub_features` | Any | Nested features (inline or ref) |

## Status Semantics

| Status | Meaning |
|--------|---------|
| `draft` | Incomplete or unclear |
| `approved` | Stable enough to implement/test |
| `published` | Validated baseline |
| `deprecated` | Intentionally removed |

## Type Semantics

| Type | Meaning |
|------|---------|
| `epic` | Container for sub-features |
| `feature` | Leaf feature with actual content |

## Feature DAG

Features form a dependency graph (DAG) via the `dependencies` array:
- Features with no dependencies (or all dependencies complete) are **unblocked**
- Use `priority` to rank unblocked features
- `/flow` uses this to suggest which feature to work on next

Work order: highest priority unblocked feature first.

## Nesting Rule

- **Inline** sub-feature if anticipated complexity is low (simple flow, few implementation steps)
- **Separate file** if complex (multi-path flows, multiple scopes, high-risk)
- Use `"ref": "filename.json"` for separate files

## Step Tags (user_flow)

| Tag | Meaning |
|-----|---------|
| `[action]` | User action |
| `[assert]` | Observable assertion |
| `[system]` | System side-effect (verified via later assert) |

## References

External documents linked at feature level:

| Type | Use for |
|------|---------|
| `prd` | Product requirements document |
| `design` | Figma, Sketch, design files |
| `spec` | Technical specification |
| `api` | API documentation |
| `doc` | General documentation |

Each reference has:
- `type`: category (above)
- `title`: human-readable name
- `url` or `path`: external URL or local file path

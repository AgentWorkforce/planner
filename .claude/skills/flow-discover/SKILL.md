---
name: flow-discover
description: When user asks "what features exist?", "map the codebase", or wants to document an existing project that has no docs/flow/ files yet. Traverses code to create catalog.json and feature files from what's already built.
user-invocable: false
---
# Discover: Codebase → Feature Catalog

**Owns**: Creates `catalog.json` (with components) and feature `summary` sections from existing code.

## Purpose

Analyze an existing codebase and map discovered features to the schema:
- Detect project components (backend, frontend, database, etc.)
- Traverse code to find what features exist
- Infer feature boundaries and relationships
- Create catalog.json and feature files
- Mark confidence levels appropriately

## When to Use

- Existing codebase with no flow documentation
- User asks to "analyze", "map", "discover" features
- User says "what features exist?"

## Output

- `docs/flow/catalog.json` (with components array)
- `docs/flow/features/<slug>.json` (one per feature/epic)
- All with `status: "draft"` (discovered, not yet validated)

## Rules

- Explore thoroughly before writing files
- Ask confirmation before bulk-writing: "Found N features in M categories. Create files?"
- Mark discovered features with `status: "draft"`
- Add `"source": "discovered"` to feature metadata
- Use existing docs/comments to inform goal/criteria where available
- Mark uncertainty: if goal is unclear, write "INFERRED: ..." in goal field
- After writing: run flow-visualize to show results

## Workflow

### 0. Detect Project Components

**First step for any project**: Identify all components before feature discovery.

Scan for component patterns (see Discovery Heuristics). For each detected component:
1. Identify tech stack from files/dependencies
2. Determine root path
3. Add to `catalog.json` components array

Example output:
```
Detected 3 components:

1. backend (Node.js, Express)
   Path: server/
   Found: package.json with express, 12 route files

2. frontend (React, TypeScript)
   Path: client/
   Found: package.json with react, src/components/

3. database (PostgreSQL, Prisma)
   Path: prisma/
   Found: schema.prisma with 5 models

Continue with feature discovery? [Y/n]
```

### 1. Explore Codebase (per component)

For each component, look for feature boundaries in:
- **Routes/Pages**: URL patterns, page components
- **API endpoints**: Controllers, handlers, route definitions
- **Services/Modules**: Business logic boundaries
- **Database models**: Entity relationships
- **Config/Feature flags**: Feature toggles, A/B tests
- **Documentation**: README, docs/, inline comments

### 2. Identify Feature Categories

Group related functionality into epics:
- Authentication (login, register, password reset)
- Payments (checkout, subscriptions, invoices)
- Core functionality (what the app actually does)

### 3. Draft Feature List

Before writing files, summarize findings:
```
Found 8 features in 3 categories:

Authentication (3 features)
- auth-login: Email/password login
- auth-register: User registration
- auth-password-reset: Email-based reset

Payments (2 features)
- payments-checkout: Checkout flow
- payments-subscription: Plan management

[etc.]

Create catalog and feature files? [Y/n]
```

### 4. Write Files

On confirmation, create:

**catalog.json**:
```json
{
  "project_id": "project-name",
  "status": "draft",
  "components": [
    { "id": "backend", "name": "API Server", "tech": ["Node.js", "Express"], "path": "server/" },
    { "id": "frontend", "name": "Web Client", "tech": ["React"], "path": "client/" }
  ],
  "features": [
    { "id": "auth", "title": "Authentication", "type": "epic", "status": "draft" },
    { "id": "auth-login", "title": "Login", "type": "feature", "status": "draft" }
  ]
}
```

**Feature files** with discovered info:
```json
{
  "feature_id": "auth-login",
  "title": "Login",
  "type": "feature",
  "status": "draft",
  "priority": "high",
  "dependencies": [],
  "metadata": { "source": "discovered" },
  "summary": {
    "goal": "Allow users to authenticate",
    "context": "INFERRED: Uses /api/auth/login endpoint",
    "acceptance_criteria": [
      { "id": "ac1", "description": "INFERRED: User can log in with email/password" }
    ]
  },
  "plan_implementation": {
    "scopes": ["backend", "frontend", "database"],
    "steps": []
  }
}
```

**Cross-component features**: When a feature spans multiple components, list all affected components in `scopes`. Common patterns:
- Auth (frontend + backend + database)
- Payments (frontend + backend + webhooks)
- Real-time features (frontend + backend + messaging)

### 5. Visualize Results

After writing, run flow-visualize to show what was created.

## Discovery Heuristics

### Component Detection

Identify project components by scanning for:

| Pattern | Component Type | Tech Stack |
|---------|----------------|------------|
| `package.json` + `next.config.*` | Web Frontend | Next.js, React |
| `package.json` + `express`/`fastify`/`koa` | API Backend | Node.js |
| `package.json` + `react-native` | Mobile App | React Native |
| `requirements.txt` / `pyproject.toml` | Python Service | Python, Django/Flask |
| `Cargo.toml` | Rust Service | Rust |
| `go.mod` | Go Service | Go |
| `pom.xml` / `build.gradle` | Java Service | Java, Spring |
| `*.csproj` | .NET Service | C#, .NET |
| `*.xcodeproj` / `Package.swift` | Apple App | Swift |
| `prisma/schema.prisma` | Database | Prisma |
| `docker-compose.yml` | Infrastructure | Docker |
| `*.tf` / `terraform/` | Infrastructure | Terraform |

### Feature Detection by Component

**Web Frontend** (`app/`, `pages/`, `src/`):
| Look in | For |
|---------|-----|
| `app/routes/`, `pages/` | Route-based features |
| `components/` | UI components |
| `hooks/`, `context/`, `store/` | State management |

**API Backend** (`api/`, `server/`, `src/`):
| Look in | For |
|---------|-----|
| `routes/`, `controllers/` | API endpoints |
| `services/`, `lib/` | Business logic |
| `middleware/` | Cross-cutting concerns |

**Database** (`prisma/`, `migrations/`, `models/`):
| Look in | For |
|---------|-----|
| `schema.prisma`, `models/` | Data entities |
| `migrations/` | Schema evolution |
| `seeds/` | Initial data |

**General** (all projects):
| Look in | For |
|---------|-----|
| `README.md`, `docs/` | Documented features |
| `package.json` scripts | Build/deploy features |
| `.env.example` | Configuration features |

## Confidence Levels

| Confidence | When | Marker |
|------------|------|--------|
| High | Found in docs + code matches | (none) |
| Medium | Clear code pattern, no docs | "INFERRED: " |
| Low | Ambiguous or incomplete | "UNCLEAR: " |

## Fits the Whole

| Skill | Section |
|-------|---------|
| **flow-discover** | `summary` (from code) + `components` |
| flow-brainstorm | `summary` (from ideas) |
| flow-planner | `plan_implementation` |
| flow-tasks | Creates executable tasks from plan |
| flow-feature | `user_flow` |
| flow-ui-ux-validation | `validation_uiux` |
| flow-test-designer | `plan_tests` |
| flow-visualize | Reads all, renders diagram |
| flow-change-request | Updates any, cascades |

## Suggested Next Steps

After discovery:
- Review and validate discovered features
- Run `/flow brainstorm` to add missing features
- Run `/flow feature` to document user flows

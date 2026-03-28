# Architecture Patterns

## Storage Strategy

### JSONB for LLM Context

Store complex, nested data like PlanVersions in JSONB columns rather than fully normalized tables:

- LLMs work better with self-contained JSON documents they can traverse
- Reduces tool calls needed to assemble context
- Hybrid model: relational tables for queried/filtered data, JSONB for nested details

```sql
-- Queryable fields as columns, full document in JSONB
CREATE TABLE plan_versions (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  status TEXT NOT NULL,
  document JSONB NOT NULL  -- Full PlanVersion for LLM consumption
);
```

### Multi-Database Strategy

Each domain owns its database, no cross-database queries:

| Database | Owner | Contents |
|----------|-------|----------|
| `planner.db` | Planner | Plans, versions, steps, organizations, initiatives, trajectory_events |
| `ideation.db` | Ideation | Sessions, messages, nuggets, specialists |
| `forge.db` | Forge | Runs, tasks, results |

Base class: `@plannr/storage-base` provides `BaseSqliteStorage` with migration support.

## Plugin Architecture

### Structure

Server is a meta-server that mounts domain packages as Express plugins:

```
server (meta) ──mounts──→ planner (router + storage)
              ──mounts──→ ideation (router + storage)
              ──mounts──→ forge-core (router + storage)
```

Each domain:
- Exports a router factory function
- Manages its own storage instance
- Server calls factory with dependencies, mounts at API prefix (e.g., `/api/plans`)

NOT microservices, but clear plugin boundaries within a monolith.

### Server Initialization Sequence

1. Create services (storage + domain logic)
2. Initialize storage with migrations
3. Mount Express app with middleware stack
4. Attempt relay connection (non-blocking - server starts even if relay unavailable)
5. Detect relay mode (connected/disconnected) → determines forge real vs test mode
6. Initialize cross-domain bridges (ideation bridge, forge spawner)
7. Start HTTP server + WebSocket proxy
8. Graceful shutdown handlers

## Subdomain Boundaries

### System Domains

| Domain | Responsibility | API Prefix |
|--------|----------------|------------|
| Planner | Plan authoring, versioning, approval | `/api/plans` |
| Ideation | Brainstorming, requirement refinement, specialist agents | `/api/ideation` |
| Forge | Plan execution, agent task spawning (the orchestrator) | `/api/forge` |
| Tuner | Adaptive learning, model selection, drift detection | `/api/tuner` |
| Testbench | End-to-end pipeline testing | `/api/testbench` |

### Separation of Concerns

System boundaries maintained through API contracts and events:
- Planner → Forge: plan_ref handoff
- Forge → Planner: ChangeRequest feedback loop
- Ideation → Planner: refined requirements
- Tuner → all: model/config recommendations

Each domain has single responsibility. Planner doesn't execute; Forge doesn't plan.

## Error Handling

### Centralized Error System

`@plannr/errors` package provides consistent error handling:

| Error Class | HTTP Status | Use Case |
|-------------|-------------|----------|
| `NotFoundError` | 404 | Resource not found |
| `BadRequestError` | 400 | Invalid request |
| `ValidationError` | 422 | Zod validation failure |
| `ConflictError` | 409 | State conflict |

Helper functions: `notFound()`, `badRequest()`, `unprocessableEntity()`, `conflict()`

`errorHandler` middleware converts all errors to consistent JSON responses with Zod validation details.

## LLM Integration

### Anthropic SDK Pattern

- Singleton client from `@anthropic-ai/sdk`
- Graceful fallback: returns null if `ANTHROPIC_API_KEY` not set (enables mock mode)
- Tool calling support for agent interactions
- Centralized model config (not scattered)

### MCP Integration

Model Context Protocol for tool discovery:
- HTTP transport in `packages/planner/src/mcp/`
- Enables external tools to interact with planner
- Structured tool schemas for LLM consumption

## Development Strategy

### Phased Feature Rollout

Complex features should be phased:

1. **MVP**: Core functionality, minimal UI
2. **Enhancement**: Polish, edge cases, advanced features
3. **Scale**: Performance optimization, full integration

Don't build everything at once. Defer advanced functionality.

### Event-Driven Updates

For real-time synchronization:
- SSE for plan change notifications
- WebSocket for agent-to-agent messaging
- Events for inter-subdomain communication

Prefer push over polling for responsive UX.

## Orthogonal Layers

Cross-cutting concerns that complement main workflow:

| Concern | Integration | Notes |
|---------|-------------|-------|
| Trajectories | Built into planner | `trajectory_events` table tracks user decisions |
| Relay | Transport layer | Agent-to-agent messaging, WebSocket proxy in server |
| Tuner | Adaptive learning | Orthogonal to workflow, provides recommendations |
| Insights | Analytics layer | Not core workflow |
| Platform | Infrastructure | Not business logic |

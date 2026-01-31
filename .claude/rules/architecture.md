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

## Subdomain Boundaries

### Logical vs Physical Mapping

Maintain clear separation between:
- **Logical concepts** (Planner): `scope`, `owner_role`, `acceptance_criteria`
- **Physical implementation** (Orchestrator): `repo`, `path`, `agent_id`

This mapping is handled via configuration, not shared schemas.

### Separation of Concerns

System boundaries are maintained through API contracts and events:
- Intake → Planner: request routing
- Planner → Orchestrator: plan_ref handoff
- Orchestrator → Planner: ChangeRequest feedback loop

Each subdomain has single responsibility. Planner doesn't execute; Orchestrator doesn't plan.

## Development Strategy

### Modular Monolith First

Avoid premature microservice decomposition:
- Start with monolith + strict contract boundaries
- Full service isolation creates operational overhead too early
- Progressive decomposition when scale demands it

### Phased Feature Rollout

Complex features (Organizations, Initiatives, comprehensive layouts) should be phased:

1. **MVP**: Core functionality, minimal UI
2. **Enhancement**: Polish, edge cases, advanced features
3. **Scale**: Performance optimization, full integration

Don't build everything at once. Defer advanced functionality.

### Event-Driven Updates

For real-time synchronization:
- Use SSE for plan change notifications
- WebSocket for agent-to-agent messaging
- Events for inter-subdomain communication

Prefer push over polling for responsive UX.

## Orthogonal Layers

Treat cross-cutting concerns as orthogonal services:

| Concern | Integration |
|---------|-------------|
| Trajectories | Observability via events/references |
| Insights | Analytics layer, not core workflow |
| Platform | Infrastructure, not business logic |

These complement the main workflow without coupling to every subdomain.

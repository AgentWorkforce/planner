# Planner Core

## What This Is

This repository implements the **Planner** layer of a three-tier agentic architecture:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           HUMAN / INTAKE                                │
│        (goals, context, constraints, messy requirements)                │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         PLANNER (this repo)                             │
│                                                                         │
│  • Receives goal + context + constraints                                │
│  • Produces versioned, reviewable PlanVersions                          │
│  • Manages approval workflow (draft → approved → published)             │
│  • Outputs immutable plan_ref for Orchestrator consumption              │
│                                                                         │
│  Does NOT: spawn agents, send tasks, retry, schedule, run anything      │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ plan_ref (approved JSON)
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           ORCHESTRATOR                                  │
│                                                                         │
│  • Fetches approved PlanVersion by plan_ref                             │
│  • Compiles into executable Run (state machine + agent slots)           │
│  • Dispatches steps to agents via role mapping                          │
│  • Verifies acceptance criteria, handles retries/failures               │
│  • Sends ChangeRequests back to Planner when structural changes needed  │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      AGENT RELAY (transport layer)                      │
│                                                                         │
│  • Real-time agent-to-agent messaging (~5ms latency)                    │
│  • Agent spawning via pseudo-terminals (claude --dangerously-skip...)   │
│  • Playback/continuation of agent reasoning                             │
│  • Channels, broadcast, consensus primitives                            │
│                                                                         │
│  Source: https://github.com/agentworkforce/relay                        │
└─────────────────────────────────────────────────────────────────────────┘
```

## The Bigger Picture

This Planner integrates with the **agentworkforce** ecosystem:

| Component | Status | Purpose |
|-----------|--------|---------|
| `relay` | Mature | Messaging layer between agents |
| `relay-dashboard` | Mature | UI for monitoring agent swarms |
| `trajectories` | Active | Document layer capturing agent reasoning |
| `planner` | **Empty (this is it)** | Plan authoring & versioning |
| Orchestrator | TBD | Plan execution engine |

The relay is the transport, but it's "just messaging" — it doesn't impose orchestration patterns. The Planner provides the **structured intent** (what should happen), and the Orchestrator provides the **execution engine** (making it happen using relay as transport).

## Core Concepts

### PlanVersion (what Planner produces)

```typescript
interface PlanVersion {
  plan_id: string;
  version: number;  // monotonic within plan
  status: 'draft' | 'approved' | 'published';

  summary: { goal: string; context?: string; };

  steps: Step[];  // DAG of work items

  metadata?: Record<string, unknown>;

  // Timestamps
  created_at: string;
  updated_at: string;
}

interface Step {
  step_id: string;  // stable within version
  title: string;
  dependencies: string[];  // step_ids this depends on (DAG structure)

  // Step type: primitive (actual work) or compound (expands to sub-plan)
  type: 'primitive' | 'compound';

  // Primitive step fields
  description?: string;
  owner_role?: string;  // e.g., "backend:Coder" - NOT a specific agent
  priority?: 1 | 2 | 3;
  acceptance_criteria?: AcceptanceCriterion[];
  gate?: {
    type: 'human_approval' | 'approval_required';
    approver_role?: string;
  };
  estimates?: { effort?: string; };
  notes?: string;

  // Compound step fields (for large plans)
  sub_plan_id?: string;  // Reference to another PlanVersion
}

interface AcceptanceCriterion {
  id: string;
  description: string;
  type?: string;  // 'test', 'review', 'metric', etc.
}
```

### Plan Lifecycle

```
┌─────────────────────────────────────────────────────────────────────┐
│                            DRAFT                                    │
│  ┌─────────────────────┐         ┌─────────────────────────────┐   │
│  │   working           │────────▶│   submitted                 │   │
│  │   (editing)         │ submit  │   (ready for review)        │   │
│  └─────────────────────┘         └─────────────────────────────┘   │
│                                             │                       │
│  AI works continuously in both states       │                       │
└─────────────────────────────────────────────┼───────────────────────┘
                                              │ approve
                                              ▼
                                      ┌───────────────┐
                                      │   APPROVED    │ (locked)
                                      └───────┬───────┘
                                              │ publish
                                              ▼
                                      ┌───────────────┐
                                      │   PUBLISHED   │ (executing)
                                      └───────────────┘
```

**Three states + submitted flag**:
- `draft` = editable (working or submitted for Portfolio review)
- `approved` = locked, immutable
- `published` = released to orchestrator

**Submit vs Approve**:
- **Submit**: Coordination signal to Portfolio/reviewers ("ready for review")
- **Approve**: Accountability checkpoint ("I sign off") - locks the plan

**Key invariant:** Approved/published versions are immutable. Any change creates a new version.

### Versioning & Diffs

- Every meaningful change produces a new version
- Diffs are structural (step added/removed/modified), not just text
- Field-level change tracking for steps
- Dependencies edge changes tracked
- Support for RFC 6902-style patches

## What Planner Does

1. **Create and edit plans**: Steps + dependencies (DAG), notes, acceptance criteria, gates
2. **Version everything**: Every meaningful change produces a new version with diffs
3. **Approval workflow**: Approve to lock; approved versions are immutable
4. **Publish**: Export plan artifacts (JSON canonical + Markdown render) and return stable `plan_ref`
5. **Optional run overlay**: Show execution status per step if Orchestrator provides it (read-only)

## What Planner Does NOT Do

- No spawning agents
- No sending tasks to agents
- No retries/timeouts/concurrency management
- No scheduling or resource allocation
- No "run engine"
- No portfolio governance logic (that's a separate concern)
- No mutation of approved versions

## Integration Points

### Orchestrator → Planner (fetch plans)

```
GET /plans/{plan_id}                          # latest plan
GET /plans/{plan_id}/versions/{version}       # specific version
POST /plans/{plan_id}/versions/{version}/publish  # publish for execution
```

### Orchestrator → Planner (feedback loop)

```
POST /runs/{run_id}/change-requests           # structural change needed
```

When Orchestrator discovers the plan is inadequate (missing steps, wrong dependencies), it creates a ChangeRequest. This triggers a new PlanVersion draft, NOT mutation of the approved version.

### Relay Integration (optional)

Planner can use relay for:
- Planning team collaboration (multiple planning agents)
- Handoff "meetings" with implementation agents
- Planner agent sitting in on execution to oversee

But Planner itself doesn't require relay — it can be a standalone HTTP service.

## Design Principles

### 1. Do One Thing Well

Planner plans. It doesn't execute. This separation enables:
- Plans to be reviewed before execution
- Multiple orchestration strategies with the same plan format
- Clear audit trail of intent vs. execution

### 2. Immutability After Approval

Once approved, a PlanVersion cannot change. This ensures:
- Orchestrator always executes what was approved
- Audit trail integrity
- No "moving target" during execution

### 3. Structured Over Freeform

Plans have schema. Steps have IDs. Dependencies are explicit. This enables:
- Automated validation
- Meaningful diffs
- Machine-readable handoff to Orchestrator

### 4. Human-in-the-Loop by Default

Gates and approval workflows are first-class. The system assumes:
- Not everything should auto-advance
- Humans need visibility into agent decisions
- Some steps require explicit sign-off

## Technology Decisions

Based on ecosystem analysis (matching relay stack):

| Concern | Choice | Rationale |
|---------|--------|-----------|
| Language | TypeScript | Matches relay (83.4% TS) |
| Runtime | Node.js 20+ | Matches relay |
| Database | SQLite (better-sqlite3) | Matches relay storage, start simple |
| API | Express + REST | Matches relay server |
| Schema | Zod | Type-safe validation |
| Testing | Vitest | Matches relay |
| Build | Turbo + esbuild | Matches relay monorepo |

## The Bootstrap Flow

**Who spawns the first agent?** Non-agent infrastructure.

```
1. Human creates goal (via UI, CLI, API)
         │
2. [Intake captures - future service]
         │
3. Planner produces PlanVersion
         │
4. Human reviews and approves
         │
5. Planner publishes → plan_ref
         │
6. Orchestrator fetches plan_ref
         │
7. Orchestrator spawns agent(s) via Relay
         │
8. Agents execute, communicate via Relay
```

## Handling Scale

Steps can be **primitive** (actual work) or **compound** (expands into a sub-plan). This enables hierarchical plans for large projects.

```
Level 0: Application Plan
         ├── Level 1: Feature Plans (compound steps)
         │            ├── Level 2: Component Plans
         │            │            └── Level 3: Task-level (primitive steps)
```

See [docs/planner-scale.md](./docs/planner-scale.md) for details on:
- Compound steps data model
- Hierarchical plan navigation (zoom levels, breadcrumbs)
- Approval flow at scale (bottom-up, top-down, phased)
- Progress rollup from sub-plans to parent

**Recommended limits**:
- 15-20 steps per plan level (cognitive manageability)
- 3 levels max hierarchy depth (practical navigation)

## HTN/PDDL Strategy

**Key insight**: Formalism should be hidden from users by default.

### Phase 1: Pragmatic (MVP)
- Steps + explicit dependencies (user writes DAG)
- Acceptance criteria (natural language)
- No formalism visible

### Phase 2: Decomposition (built-in)
- Compound steps that expand to sub-plans
- Hierarchical navigation for large projects
- See "Handling Scale" above

### Phase 3: Verification (optional)
- Preconditions/effects for validation
- Gap detection ("no step produces X that Y needs")
- For critical workflows only

## Orchestrator-Agnostic Design

**Requirement**: Planner works with "any" orchestrator.

The **plan format is the contract**. Different orchestrators can:
- Interpret steps differently
- Use different parallelization strategies
- Have different retry policies
- Map roles to agents differently

But they all consume the same PlanVersion format.

## Open Questions

1. **Planning agents**: Should Planner itself use agents (via Relay) to create plans? Or just call LLMs directly?

2. **Run overlay**: Is showing execution status a v1 requirement, or can we defer?

3. **Versioning granularity**: Every save = version? Or only meaningful changes?

4. **Approval rigidity**: Strict state machine (draft→review→approved→published) or flexible transitions?

## File Structure (planned)

```
src/
├── domain/           # Core entities (Plan, Step, Version)
│   ├── plan.ts
│   ├── step.ts
│   └── version.ts
├── storage/          # Persistence adapters
│   ├── interface.ts
│   └── sqlite.ts     # Start simple
├── api/              # HTTP endpoints
│   ├── routes.ts
│   └── handlers/
├── diff/             # Versioning and diff logic
│   ├── compute.ts
│   └── apply.ts
├── validation/       # Schema validation
│   └── schemas.ts
└── index.ts

# Optional future packages:
packages/
├── planner-core/     # This - domain + storage + API
├── planner-ui/       # React components (if needed)
└── planner-relay/    # Relay integration adapter
```

## References

- [Agent Relay](https://github.com/agentworkforce/relay) - Transport layer
- [Relay Dashboard](https://github.com/agentworkforce/relay-dashboard) - Reference UI
- [Trajectories](https://github.com/agentworkforce/trajectories) - Document layer for agent reasoning
- HTN (Hierarchical Task Networks) - Formal planning theory
- PDDL (Planning Domain Definition Language) - Classical AI planning notation

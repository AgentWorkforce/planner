# Architecture Synthesis: Planner in the Bigger Picture

## The "Grokked" Understanding

After analyzing the blueprint conversation, the relay ecosystem, and the orchestration landscape, here's my synthesis of what we're building and how it fits together.

## The Three-Layer Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              HUMAN                                      │
│                   (goals, context, messy requirements)                  │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────────────┐
│                         INTAKE (future)                                 │
│                                                                         │
│  • Captures messy inbound into structured initiatives                   │
│  • Normalizes requests                                                  │
│  • RLM-style context workbench                                          │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────────────┐
│                    TRIAGE & PORTFOLIO (future)                          │
│                                                                         │
│  • Prioritizes initiatives                                              │
│  • Sequences work                                                       │
│  • Allocates resources                                                  │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────────────┐
│                         PLANNER (this repo)                             │
│                                                                         │
│  • Receives goal + context + constraints                                │
│  • Produces versioned PlanVersions (DAG of steps)                       │
│  • Manages approval workflow (draft → approved → published)             │
│  • Outputs immutable plan_ref                                           │
│                                                                         │
│  KEY: Plan-only. No execution.                                          │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ plan_ref
┌───────────────────────────────▼─────────────────────────────────────────┐
│                        ORCHESTRATOR (future)                            │
│                                                                         │
│  • Fetches approved PlanVersion                                         │
│  • Compiles into executable Run                                         │
│  • Dispatches steps to agents (via Relay)                               │
│  • Verifies acceptance criteria                                         │
│  • Handles retries, failures, parallelism                               │
│  • Sends ChangeRequests back to Planner                                 │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────────────┐
│                     AGENT RELAY (exists, mature)                        │
│                                                                         │
│  • Real-time agent-to-agent messaging                                   │
│  • Agent spawning (PTY-based)                                           │
│  • Playback/continuation                                                │
│  • Channels, broadcast, consensus                                       │
│                                                                         │
│  KEY: Transport only. No orchestration logic.                           │
└─────────────────────────────────────────────────────────────────────────┘
```

## Why This Separation Matters

### Relay is Transport, Not Logic

Relay provides:
- Messaging primitives (send, receive, broadcast)
- Agent spawning infrastructure
- Sub-5ms latency

Relay does NOT provide:
- Workflow logic
- State machines
- Approval workflows
- Orchestration patterns

**Relay doesn't care what messages mean** — it just delivers them. This is a feature, not a bug.

### Planner is Intent, Not Execution

Planner provides:
- Structured plans (steps, dependencies, acceptance criteria)
- Versioning with diffs
- Approval workflow (human-in-the-loop)
- Immutable approved artifacts

Planner does NOT provide:
- Agent spawning
- Task dispatch
- Retry logic
- Execution monitoring

**Planner doesn't run anything** — it produces artifacts that describe what should happen.

### Orchestrator is Execution, Not Planning

Orchestrator (future) will provide:
- Plan interpretation
- Agent dispatch (using Relay)
- Step execution
- Failure handling
- Verification

Orchestrator does NOT provide:
- Plan creation
- Human approval of plans
- Versioning

**Orchestrator executes what was approved** — it doesn't decide what to do.

## The Bootstrap Flow

**Q: Who spawns the first agent?**

Answer: The infrastructure, not agents.

```
1. Human creates goal (via UI, CLI, API)
         │
         ▼
2. Intake captures and structures (future service)
         │
         ▼
3. Planner produces PlanVersion
         │
         ▼
4. Human reviews and approves
         │
         ▼
5. Planner publishes → plan_ref
         │
         ▼
6. Orchestrator fetches plan_ref, compiles Run
         │
         ▼
7. Orchestrator spawns first agent(s) via Relay
         │
         ▼
8. Agents execute, communicate via Relay
         │
         ▼
9. Orchestrator verifies, handles failures
         │
         ▼
10. If plan insufficient: Orchestrator → ChangeRequest → Planner
```

The key insight: **Non-agent code (Orchestrator) spawns agents**. Agents don't self-organize from nothing.

## HTN/PDDL: Where It Fits

### Not User-Facing

Formalism (HTN decomposition, PDDL preconditions) should be:
- Hidden by default
- Used internally for validation
- Optional "under the hood" inspection for advanced users

### Where It Adds Value

1. **Decomposition consistency**: Methods library ensures complex tasks decompose predictably
2. **Validation**: Preconditions/effects can catch impossible plans
3. **Gap detection**: "No step produces predicate X that step Y needs"
4. **Automated planning**: Given a goal, generate a plan (future)

### Implementation Strategy

```
Phase 1: Pragmatic
  - Steps + explicit dependencies (user writes DAG)
  - Acceptance criteria (natural language)
  - No formalism visible

Phase 2: Decomposition (optional)
  - Compound tasks that expand
  - Methods library
  - Still user-friendly

Phase 3: Verification (optional)
  - Preconditions/effects
  - Automated validation
  - For critical workflows
```

## Orchestrator-Agnostic Design

**Requirement**: Planner should work with "any" orchestrator.

### The Contract is the Plan Format

Different orchestrators can:
- Interpret steps differently
- Use different parallelization strategies
- Have different retry policies
- Map roles to agents differently

But they all consume the same PlanVersion format.

### Minimal Orchestrator Requirements

Any orchestrator needs these Planner APIs:

```
GET  /plans/{plan_id}                    # Latest version
GET  /plans/{plan_id}/versions/{v}       # Specific version
POST /plans/{plan_id}/change-requests    # Request plan changes
```

### Optional Integration Points

Nice-to-have:
```
POST /plans/{plan_id}/runs/{run_id}/status  # Push execution status
WS   /plans/{plan_id}/events                # Stream plan changes
```

## Technology Decisions

### Follow the Ecosystem

For consistency with relay:

| Concern | Choice |
|---------|--------|
| Language | TypeScript |
| Runtime | Node.js 20+ |
| Database | SQLite (better-sqlite3) |
| API | Express |
| Testing | Vitest |
| Build | Turbo + esbuild |
| Schema | Zod |

### Start Simple

- Local SQLite for single-user
- JSON files for backup/export
- HTTP REST (no GraphQL complexity)
- No UI initially (API-first)

### Extensibility Later

- PostgreSQL adapter for team use
- Relay integration for planning agents
- UI package (like relay-dashboard)

## Open Design Decisions

### 1. Planning Agents

**Question**: Should Planner itself use agents (via Relay) to create plans?

**Options**:
- A) Planner is a service, calls LLM directly
- B) Planner spawns planning agents that collaborate
- C) Both (API-only for simple, agents for complex)

**Lean toward**: Start with A (simpler), enable B later.

### 2. Run Overlay

**Question**: Should Planner show execution status?

**Options**:
- A) Planner is plan-only, separate dashboard for runs
- B) Planner has read-only run overlay
- C) Planner and Orchestrator share UI

**Lean toward**: A initially, B as a feature.

### 3. Versioning Granularity

**Question**: What constitutes a "new version"?

**Options**:
- A) Every save = new version
- B) Explicit "checkpoint" action
- C) Meaningful changes only (diff-based)

**Lean toward**: C (meaningful changes create versions).

### 4. Approval Workflow

**Question**: How rigid is the approval flow?

**Answer**: Three states + submitted flag.

```
draft (working) → draft (submitted) → approved → published
```

- **Submit**: Coordination signal to Portfolio/reviewers ("ready for review")
- **No "review" state**: AI reviews continuously, submit is for human coordination
- **Approval locks the plan**: Creates accountability, prevents accidental changes
- **Publish releases to orchestrator**: Explicit commitment to execute

**Why "submitted" is a flag, not a state**: The plan is still editable after submit (can incorporate reviewer feedback). Only "approve" locks it.

## Key Insights from Deep Research

### 1. Framework Convergence

All major orchestration frameworks (LangGraph, CrewAI, AutoGen, OpenAI Agents, Temporal) need the same core elements from a plan:
- **Step definitions** with descriptions
- **Dependencies** (DAG structure)
- **Acceptance criteria** for verification
- **Role/capability requirements**

This validates our plan format design.

### 2. Protocol Maturation

Two interoperability protocols are emerging:
- **A2A (Agent2Agent)**: Agent-to-agent communication (Google → Linux Foundation)
- **MCP (Model Context Protocol)**: Agent-to-tool/data integration (Anthropic → Linux Foundation)

**Implication**: Planner could be A2A-compatible, exposing skills like `create_plan`, `get_plan`, `update_status`.

### 3. No Standard Orchestrator Protocol

Each framework has its own plan/workflow format:
- LangGraph: StateGraph with nodes/edges
- CrewAI: Crews with agents/tasks
- Temporal: Workflows with activities
- Airflow: DAGs with operators

**Implication**: Our universal format + REST API is the right approach. Let each orchestrator translate.

### 4. Human-in-the-Loop is Universal

Every framework has human approval patterns:
- LangGraph: Breakpoints/interrupts
- CrewAI: `human_input=True`
- Temporal: Signals
- OpenAI Agents: `@human_approval`

**Implication**: Gates are first-class in our plan format.

### 5. Durable Execution Matters

Temporal's model (event-sourced, auto-recovery) is the gold standard for reliability. Even if we don't use Temporal, our Orchestrator should support:
- Checkpoint/resume
- Automatic retry
- Full execution history

## Recommended Integration Strategy

### Phase 1: Universal Plan Format
```typescript
interface PlanVersion {
  plan_id: string;
  version: number;
  status: 'draft' | 'approved' | 'published';
  summary: { goal: string; context?: string; };
  steps: Step[];
  created_at: string;
  updated_at: string;
}

interface Step {
  step_id: string;
  title: string;
  dependencies: string[];
  type: 'primitive' | 'compound';

  // Primitive step fields
  description?: string;
  owner_role?: string;
  acceptance_criteria?: AcceptanceCriterion[];
  gate?: { type: 'human_approval'; approver_role?: string; };

  // Compound step fields (for large plans)
  sub_plan_id?: string;  // Reference to another PlanVersion
}
```

See [planner-scale.md](./planner-scale.md) for handling large plans with compound steps.

### Phase 2: REST API Contract
```
GET  /plans/{id}                    # Latest version
GET  /plans/{id}/versions/{v}       # Specific version
POST /plans                         # Create plan
PUT  /plans/{id}                    # Update (creates new version)
POST /plans/{id}/status             # Accept execution updates
POST /plans/{id}/change-requests    # Accept modification requests
```

### Phase 3: A2A Compatibility (Optional)
Expose Planner as an A2A server agent:
```json
{
  "name": "Plan Service",
  "skills": [
    {"name": "create_plan", "description": "Create plan from goal"},
    {"name": "get_plan", "description": "Retrieve approved plan"},
    {"name": "request_change", "description": "Submit change request"}
  ]
}
```

## Next Steps

1. **Define core domain model**: PlanVersion, Step, AcceptanceCriterion
2. **Design API surface**: REST endpoints for CRUD + workflow
3. **Implement storage adapter**: SQLite first
4. **Build CLI**: For testing without UI
5. **Add diff/versioning**: Structural diffs
6. **Test with one orchestrator**: LangGraph or Temporal as reference

## The Fundamental Insight

**Planner is the "source of truth" for intent.**

It's not execution, not messaging, not coordination. It's the place where:
- Humans and agents agree on what should happen
- Changes are tracked and versioned
- Approval gates ensure oversight
- The Orchestrator knows what to do

Everything else (Relay, Orchestrator, Agents) exists to make the plan happen. But the plan — the structured, versioned, approved plan — is the contract.

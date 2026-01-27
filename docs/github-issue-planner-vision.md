# Planner Core: Vision & Architecture

## Overview

Planner is the **source of truth for intent** in an agentic AI system. It transforms goals into structured, versioned, approvable plans that can be executed by any orchestration framework.

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│                  │     │                  │     │                  │
│  Intake/Portfolio│────▶│     PLANNER      │────▶│   Orchestrator   │
│    (upstream)    │     │    (this repo)   │     │   (downstream)   │
│                  │     │                  │     │                  │
└──────────────────┘     └──────────────────┘     └──────────────────┘
       goals                   plans                  execution
```

**Planner does one thing well**: it takes a goal and produces a versioned, reviewable, approvable specification for execution. It doesn't execute plans, spawn agents, or manage coordination—it produces the contract that other systems consume.

---

## The Problem

When building agentic AI systems, there's a gap between "what we want to achieve" and "how agents execute it":

- **No structured planning layer** — Goals go directly to execution with no review or approval
- **No versioning** — Plans change mid-execution, creating "moving target" problems
- **No human oversight** — Agents act autonomously without approval gates
- **Framework lock-in** — Plans are tied to specific orchestration tools (LangGraph, CrewAI, Temporal)

Planner solves this by providing a **universal plan format** with built-in versioning and approval workflows.

---

## Where Planner Fits

### The Three-Layer Architecture

```mermaid
flowchart TB
    subgraph Upstream ["Upstream (Future Work)"]
        I[Intake/Discovery]
        P[Triage/Portfolio]
    end

    subgraph Core ["Planner (This Repo)"]
        PL[Plan Creation]
        V[Versioning]
        A[Approval Workflow]
    end

    subgraph Downstream ["Downstream (Future Work)"]
        O[Orchestrator]
        R[Agent Relay]
    end

    I -->|structured goal| P
    P -->|prioritized initiative| PL
    PL --> V
    V --> A
    A -->|approved plan| O
    O -->|tasks| R
    R -->|results| O
    O -->|change requests| PL
```

### Layer Responsibilities

| Layer | Responsibility | Examples/Candidates |
|-------|---------------|---------------------|
| **Intake/Discovery** | Transform messy input (Slack, email, meetings) into structured goals | Custom, Linear webhooks |
| **Triage/Portfolio** | Prioritize and sequence initiatives | Custom, WSJF-based |
| **Planner** | Create versioned, approvable plans from goals | **This repo** |
| **Orchestrator** | Execute approved plans, dispatch to agents | LangGraph, CrewAI, Temporal |
| **Agent Relay** | Agent-to-agent messaging and coordination | Existing relay infrastructure |

### Integration Points

**Upstream → Planner:**
```
POST /plans
{
  goal: "Implement dark mode for the application",
  context: { constraints: [...], preferences: [...] }
}
```

**Planner → Downstream:**
```
GET /plans/{id}  →  Returns approved PlanVersion (JSON)
```

**Downstream → Planner (feedback loop):**
```
POST /plans/{id}/change-requests
{
  reason: "Missing database migration step",
  suggested_changes: { add_steps: [...] }
}
```

---

## Core Concepts

### PlanVersion

The central artifact Planner produces:

```typescript
interface PlanVersion {
  plan_id: string;
  version: number;
  status: 'draft' | 'approved' | 'published';

  summary: {
    goal: string;
    context?: string;
  };

  steps: Step[];

  created_at: string;
  updated_at: string;
}
```

### Step

Individual units of work in a plan:

```typescript
interface Step {
  step_id: string;
  title: string;
  dependencies: string[];  // DAG structure

  // Step type: primitive (actual work) or compound (expands to sub-plan)
  type: 'primitive' | 'compound';

  // Primitive step fields
  description?: string;
  owner_role?: string;
  acceptance_criteria?: AcceptanceCriterion[];
  gate?: {
    type: 'human_approval';
    approver_role?: string;
  };

  // Compound step fields (for large plans)
  sub_plan_id?: string;  // Reference to another PlanVersion
}
```

See [planner-scale.md](./planner-scale.md) for handling large plans with hierarchical structure.

### Plan Lifecycle

```mermaid
stateDiagram-v2
    [*] --> draft: create

    state draft {
        working --> submitted: submit
        submitted --> working: withdraw
    }

    draft --> approved: approve
    approved --> published: publish
    published --> [*]: (orchestrator fetches)

    note right of draft: AI reviews continuously
    note right of submitted: Ready for Portfolio review
    note right of approved: Immutable, locked
    note right of published: Consumable by orchestrator
```

**Three states + submitted flag**:
- `draft` = editable (working or submitted for review)
- `approved` = locked, immutable
- `published` = released to orchestrator

**Submit vs Approve**:
- **Submit**: Coordination signal ("I'm ready for review") - plan stays editable
- **Approve**: Accountability checkpoint ("I sign off") - plan becomes immutable

**Key invariant**: Approved and published versions are **immutable**. Any change creates a new version.

---

## What Planner Does

### Core Capabilities

1. **Plan Creation** — Transform goal + context into a DAG of steps
2. **Versioning** — Track every meaningful change with structural diffs
3. **Approval Workflow** — Manage draft → approved → published lifecycle
4. **Validation** — Ensure plans are structurally sound (acyclic DAG, valid references)
5. **Export** — Produce canonical JSON for orchestrators, Markdown for humans

### What Planner Does NOT Do

- ❌ Execute plans or spawn agents
- ❌ Manage retries, timeouts, or concurrency
- ❌ Coordinate agent communication
- ❌ Prioritize between plans (that's Portfolio)
- ❌ Interpret messy input (that's Intake)

---

## API Surface

### REST Endpoints

```
# Plan CRUD
POST   /plans                         # Create new plan
GET    /plans/{id}                    # Get latest version
GET    /plans/{id}/versions           # List all versions
GET    /plans/{id}/versions/{v}       # Get specific version
PUT    /plans/{id}                    # Update (creates new version)

# Workflow
POST   /plans/{id}/submit             # Signal ready for review (to Portfolio/reviewers)
POST   /plans/{id}/approve            # Approve and lock plan
POST   /plans/{id}/publish            # Publish for execution

# Orchestrator Integration
POST   /plans/{id}/change-requests    # Request plan modification
POST   /plans/{id}/runs/{run}/status  # Push execution status (optional)
```

### Orchestrator-Agnostic Format

The plan format is designed to work with any orchestration framework:

| Plan Element | LangGraph | CrewAI | Temporal | Airflow |
|--------------|-----------|--------|----------|---------|
| `step_id` | Node ID | Task ID | Activity ID | Task ID |
| `dependencies` | Graph edges | `context` | Code flow | `>>` operator |
| `owner_role` | — | Agent role | Worker queue | — |
| `acceptance_criteria` | Output check | Expected output | Result check | Sensor |
| `gate` | Breakpoint | `human_input` | Signal/wait | External sensor |

Each orchestrator translates the universal format into its native execution model.

---

## Technology Candidates

| Concern | Candidates | Notes |
|---------|------------|-------|
| Language | TypeScript | Consistency with existing tooling |
| Runtime | Node.js 20+ | LTS, good async support |
| Storage | SQLite → PostgreSQL | Start simple, scale later |
| API | REST + JSON | Universal, orchestrator-friendly |
| Validation | Zod | Runtime type checking |
| Testing | Vitest | Fast, TypeScript-native |

---

## Design Principles

1. **Do One Thing Well** — Planner plans. It doesn't execute.

2. **Immutability After Approval** — Approved plans are contracts. Changes create new versions.

3. **Roles Over Agents** — Plans specify `owner_role: "backend:Coder"`, not specific agent IDs.

4. **Human-in-the-Loop by Default** — Gates and approval workflows are first-class.

5. **Orchestrator-Agnostic** — Any execution framework can consume the plan format.

---

## Open Questions

- [ ] **Decomposition methods**: Should Planner support a "methods library" for common task decompositions (HTN-style)?
- [ ] **AI-assisted planning**: Should Planner integrate LLM-based plan generation, or receive plans from external AI?
- [ ] **Run overlay**: Should Planner display execution status from orchestrators, or stay purely plan-focused?
- [ ] **Template support**: Should Planner support reusable plan templates?

---

## Relationship to Existing Infrastructure

Planner is designed to integrate with:

- **Agent Relay** — For optional planning agent collaboration and handoff meetings
- **Future Orchestrator** — As the consumer of approved plans
- **Future Intake/Portfolio** — As the producer of structured initiatives

The plan format serves as the **contract** between these layers. Planner owns the contract; other systems produce or consume it.

---

## Summary

**Planner is the source of truth for intent.**

It's where humans and agents agree on what should happen, tracked with full version history and approval gates. Everything else—relay, orchestrator, agents—exists to make the plan happen. But the plan itself is the contract.

# Architecture Overview: The Agentic Stack

## The Shape of the System

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              HUMAN                                      │
│                   (goals, context, messy requirements)                  │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         INTAKE (future)                                 │
│                                                                         │
│  Monitors channels (Slack, email, GitHub). Detects requests vs noise.  │
│  Routes to Portfolio/Planner.                                           │
│                                                                         │
│  Does NOT: prioritize, brainstorm, refine scope, structure plans        │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        PORTFOLIO (future, optional)                     │
│                                                                         │
│  Assesses value. Prioritizes initiatives. Sequences work.               │
│  Answers: "Is this worth doing? In what order? Given our constraints?"  │
│  Needed for: competing initiatives, ROI decisions, resource limits.     │
│  Small teams / solo users skip this—go directly to Planner.             │
│                                                                         │
│  Does NOT: create plans, structure steps, manage approval workflows     │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         PLANNER                                         │
│                                                                         │
│  Accepts any expression of intent. Spawns planning agents via Relay.    │
│  Produces versioned, approvable PlanVersions.                           │
│  Outputs immutable plan_ref for downstream consumption.                 │
│                                                                         │
│  Does NOT: execute plans, dispatch tasks, retry, schedule               │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ plan_ref
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        ORCHESTRATOR (future)                            │
│                                                                         │
│  Fetches approved plan. Compiles into executable Run.                   │
│  Dispatches steps to agents. Verifies acceptance criteria.              │
│  Sends ChangeRequests back to Planner when plan is insufficient.        │
│                                                                         │
│  Does NOT: create plans, approve plans, version plans                   │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      AGENT RELAY (exists, mature)                       │
│                                                                         │
│  Real-time agent-to-agent messaging (~5ms latency).                     │
│  Agent spawning via pseudo-terminals.                                   │
│  Channels, broadcast, consensus primitives.                             │
│                                                                         │
│  Does NOT: impose orchestration patterns, understand message semantics  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## How Planning Agents Work

Planner spawns planning agents via **Agent Relay**. The agents use **MCP (Model Context Protocol)** to read and write plan state.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         PLANNER SERVICE                                 │
│                                                                         │
│  ┌───────────────┐         ┌────────────────────────────────────────┐  │
│  │   REST API    │         │           MCP SERVER                    │  │
│  │   (humans)    │         │           (agents)                      │  │
│  │               │         │                                         │  │
│  │  POST /plans  │         │  Tools:                                 │  │
│  │  PUT /plans   │         │  • read_plan(plan_id)                   │  │
│  │  GET /plans   │         │  • add_step(plan_id, step)              │  │
│  │  /approve     │         │  • update_step(plan_id, step_id, ...)   │  │
│  │  /publish     │         │  • set_dependencies(plan_id, edges)     │  │
│  │               │         │  • add_criteria(plan_id, step_id, ...)  │  │
│  └───────┬───────┘         └──────────────────┬─────────────────────┘  │
│          │                                    │                        │
│          │         ┌──────────────────────────┘                        │
│          │         │                                                   │
│          ▼         ▼                                                   │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                     PLAN DOMAIN MODEL                            │  │
│  │                     (SQLite database)                            │  │
│  │                                                                  │  │
│  │  plans, steps, scopes, versions, approval_state                  │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 │ spawns via relay-pty
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         AGENT RELAY                                     │
│                                                                         │
│  relay-daemon (Unix Domain Socket, message routing)                     │
│  relay-pty (Rust binary, spawns Claude in pseudo-terminals)             │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    PLANNING AGENT                                 │  │
│  │                    (Claude in PTY)                                │  │
│  │                                                                   │  │
│  │  System prompt: "You are a planning agent..."                     │  │
│  │  Context: goal, attachments, constraints                          │  │
│  │  MCP connection: to Planner's tool server                         │  │
│  │                                                                   │  │
│  │  Capabilities:                                                    │  │
│  │  • Analyze vague intent, ask clarifying questions                 │  │
│  │  • Identify affected scopes (repos, teams, domains)               │  │
│  │  • Draft steps with descriptions                                  │  │
│  │  • Infer dependencies from step content                           │  │
│  │  • Generate acceptance criteria                                   │  │
│  │  • Continuously improve while draft is open                       │  │
│  │                                                                   │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Why this architecture?**

1. **Shared state**: Both human (via REST API) and agent (via MCP tools) read/write the same SQLite database. No synchronization problems.

2. **Relay for spawning**: Planning agents are Claude instances in PTYs, spawned via `relay-pty`. Same infrastructure as implementation agents.

3. **MCP for tools**: Relay has native MCP support. Planning agent connects to Planner's MCP server to get tools like `add_step`, `update_step`, etc.

4. **Observability**: Planning sessions appear in the Relay dashboard. Full trajectory of agent reasoning is captured.

**The flow:**

```
1. User: POST /plans { goal: "Add authentication" }
         │
2. Planner: Creates plan record (draft state) in SQLite
         │
3. Planner: Spawns planning agent via relay-pty
         │         - System prompt with planning instructions
         │         - MCP connection to Planner's tool server
         │         - Context: goal, any attachments
         │
4. Planning Agent: Uses MCP tools to build the plan
         │         - read_plan() to see current state
         │         - add_step() for each step
         │         - set_dependencies() for DAG edges
         │         - add_criteria() for acceptance criteria
         │
5. Human: Views progress via Planner UI (reads from SQLite)
         │         - Can edit inline (writes to SQLite)
         │         - Agent sees changes on next read_plan()
         │
6. Human: Approves → plan locks (agent can no longer modify)
         │
7. Human: Publishes → plan_ref available for Orchestrator
```

**Human and agent collaborate on the same plan**:
- Agent proposes structure via MCP tools
- Human reviews, adjusts, decides via UI
- Both see each other's changes (shared SQLite state)
- Agent works continuously until human approves

---

## Planning Agent Scenarios

| Scenario | How It Works |
|----------|--------------|
| **Simple goal** | Single planning agent uses MCP tools to draft the full plan |
| **Multi-scope plan** | Agent identifies multiple scopes, creates steps grouped by scope |
| **Vague intent** | Agent asks clarifying questions via the plan's conversation thread |
| **Document import** | Agent receives PRD/spec as context, extracts steps from it |
| **Change request** | Orchestrator sends ChangeRequest; Planner spawns agent to revise |
| **Handoff meeting** | Planning agent joins implementation agents via Relay messaging to transfer context |

---

## Why This Separation?

### Relay is Infrastructure, Not Logic

Relay spawns agents and delivers messages between them. It doesn't impose workflow patterns or understand what agents are doing—that's a feature. Relay stays simple (spawn, send, receive) while orchestration logic lives in Planner and Orchestrator.

### Planner is Intent, Not Execution

Planner helps humans develop goals into structured plans. It doesn't run anything. This separation means:
- Plans can be reviewed before execution
- Multiple orchestrators can consume the same plan format
- Clear audit trail of intent vs. execution

### Orchestrator is Execution, Not Planning

Orchestrator executes what was approved. It doesn't decide what to do. When the plan is insufficient, it sends a ChangeRequest back to Planner rather than modifying the plan itself.

---

## The Bootstrap Flow

**Who spawns the first agent?** Non-agent infrastructure.

```
1. Human creates goal (via UI, CLI, API)
         │
2. [Intake captures - future]
         │
3. [Portfolio prioritizes - future]
         │
4. Planner spawns planning agent(s) via Relay
         │
5. Planning agent drafts PlanVersion
         │
6. Human reviews, edits, approves
         │
7. Planner publishes → plan_ref
         │
8. Orchestrator fetches plan_ref
         │
9. Orchestrator spawns implementation agent(s) via Relay
         │
10. Implementation agents execute, communicate via Relay
         │
11. If plan insufficient → ChangeRequest → Planner → step 4
```

All agents run on Relay. Planning agents create the plan. Implementation agents execute it.

---

## Integration Contracts

### Upstream → Planner

```
POST /plans
{ goal: "Add user authentication", context: "..." }
```

Planner accepts any expression of intent—vague or detailed.

### Planner → Downstream

```
GET /plans/{id}  →  Approved PlanVersion (JSON)
```

Immutable contract. Orchestrator executes exactly what was approved.

### Downstream → Planner (feedback loop)

```
POST /plans/{id}/change-requests
{ reason: "Missing database migration step", suggested_changes: {...} }
```

Creates a new draft version. Does NOT mutate the approved version.

---

## The Fundamental Insight

**Planner is the source of truth for intent.**

Everything else—Relay, Orchestrator, Agents—exists to make the plan happen. But the plan itself is the contract: structured, versioned, approved.

---

## Current Status

| Layer | Status |
|-------|--------|
| Agent Relay | Mature, operational |
| Planner | Design phase (see: Planner Core, Planner UI issues) |
| Orchestrator | Future work |
| Portfolio | Future work |
| Intake | Future work |

---

## Related Issues

- **Planner Core: Design Proposal** — Technical design of the Planner layer
- **Planner UI: Vision Proposal** — User experience for plan creation and approval

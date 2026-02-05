# Forge: The Execution Engine

## What is Forge?

Forge is the **orchestrator** component in our three-tier agentic architecture. It takes approved plans from Planner and coordinates AI agents (Workers and Auditors) to actually execute the work and produce artifacts.

**Key insight: Forgemaster is software infrastructure, NOT an LLM.** It's a deterministic TypeScript service that manages state machines, task queues, and agent coordination. The LLM intelligence lives in the agents it spawns.

## The Three-Tier Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              IDEATION                                       │
│  Human brainstorms with AI → refined understanding → ready for planning     │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PLANNER                                        │
│  Accepts intent → AI helps scope → produces versioned PlanVersions         │
│  Approval workflow → publishes immutable plan_ref                          │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │ ForgePlan (approved JSON)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FORGE (this component)                              │
│                                                                             │
│  Forgemaster (TypeScript service, NOT an LLM):                             │
│  • Receives ForgePlan → creates Run with task DAG                          │
│  • Schedules tasks via BullMQ (Redis-backed queue)                         │
│  • Creates isolated git worktree per task                                   │
│  • Spawns Workers via Relay SDK                                            │
│  • Dispatches Auditors to verify acceptance criteria                       │
│  • Handles human gates (pause + notify + resume)                           │
│  • Captures trajectories for durability and retrospectives                 │
│                                                                             │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AGENT RELAY                                       │
│  Real-time agent-to-agent messaging, spawning, coordination                │
└─────────────────────────────────────────────────────────────────────────────┘
```

## How a Run Executes

```
                          ForgePlan arrives
                                │
                                ▼
                    ┌───────────────────────┐
                    │   Create Run          │
                    │   (status: pending)   │
                    └───────────┬───────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │   Compile Task DAG    │
                    │   from plan steps     │
                    └───────────┬───────────┘
                                │
                                ▼
         ┌──────────────────────┴──────────────────────┐
         │                                             │
         ▼                                             ▼
┌─────────────────┐                         ┌─────────────────┐
│  Task A         │                         │  Task B         │
│  (no deps)      │                         │  (no deps)      │
└────────┬────────┘                         └────────┬────────┘
         │                                           │
         │  ┌─────────────────────────────────────┐  │
         │  │  For each ready task:               │  │
         │  │                                     │  │
         │  │  1. Create git worktree             │  │
         │  │  2. Write .forge/context.json       │  │
         │  │  3. Spawn Worker via Relay          │  │
         │  │  4. Worker uses MCP tools to report │  │
         │  │  5. Spawn Auditor to verify         │  │
         │  │  6. Update task status              │  │
         │  │  7. Cleanup worktree                │  │
         │  └─────────────────────────────────────┘  │
         │                                           │
         ▼                                           ▼
┌─────────────────────────────────────────────────────────────┐
│                  Task C (depends on A & B)                  │
│                  (waits until both complete)                │
└─────────────────────────────────────────────────────────────┘
```

## Agent Communication via MCP Tools

Agents don't have direct access to Forgemaster internals. They communicate through a defined set of MCP (Model Context Protocol) tools:

```
┌─────────────────────────┐         MCP Tools          ┌─────────────────────────┐
│                         │                            │                         │
│       Worker Agent      │ ──────────────────────────▶│      Forgemaster        │
│       (Claude CLI)      │                            │      (TypeScript)       │
│                         │   report_progress          │                         │
│                         │   report_complete          │  Updates task status    │
│                         │   report_blocked           │  Stores artifacts       │
│                         │   request_human_input      │  Triggers next steps    │
│                         │   record_decision          │  Captures trajectories  │
│                         │                            │                         │
└─────────────────────────┘                            └─────────────────────────┘

Worker reports: "I've created commit abc123 with the API endpoint"
    │
    ▼ report_complete({ artifacts: [{ type: 'commit', ref: 'abc123' }] })
    │
    ▼
Forgemaster: transitions task → auditing, spawns Auditor agent
    │
    ▼
Auditor verifies acceptance criteria against commit abc123
    │
    ▼ report_audit_result({ findings: [{ criterion_id: 'ac1', status: 'pass' }] })
    │
    ▼
Forgemaster: transitions task → completed, marks dependencies as ready
```

## Workspace Isolation with Git Worktrees

Each task gets its own isolated workspace so agents can work in parallel without conflicts:

```
                         Main Repository
                         /path/to/repo
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
          ▼                    ▼                    ▼
   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
   │  Worktree    │    │  Worktree    │    │  Worktree    │
   │  run-1-task-a│    │  run-1-task-b│    │  run-1-task-c│
   │              │    │              │    │              │
   │  Branch:     │    │  Branch:     │    │  Branch:     │
   │  forge/r1-a  │    │  forge/r1-b  │    │  forge/r1-c  │
   │              │    │              │    │              │
   │  Worker A    │    │  Worker B    │    │  (waiting)   │
   │  running...  │    │  running...  │    │              │
   └──────────────┘    └──────────────┘    └──────────────┘
```

Each worktree contains `.forge/context.json` with:
- Task description and acceptance criteria
- Expected artifacts
- MCP tool configuration

## Human Gates

Some steps require human approval before proceeding:

```
        Task execution in progress...
                    │
                    ▼
        ┌───────────────────────┐
        │   HUMAN GATE          │
        │   type: security_review│
        │                       │
        │   Run pauses here     │◀─────  has_pending_gate = true
        │   status: awaiting_   │        (no new tasks scheduled)
        │           approval    │
        └───────────────────────┘
                    │
                    │  Notification sent via API/SSE
                    │  Human reviews in Forge UI
                    │
                    ▼
        ┌───────────────────────┐
        │  Human approves/      │
        │  rejects via UI       │
        └───────────────────────┘
                    │
                    ▼
        Resume execution (or fail if rejected)
```

## Durability & Recovery

Every state transition is captured as a trajectory event. If Forgemaster crashes:

```
┌────────────────────────────────────────────────────────────────┐
│                     Trajectory Events                          │
│                                                                │
│  [12:00:01] run_started { run_id: 'r1' }                      │
│  [12:00:02] task_queued { task_id: 'a' }                      │
│  [12:00:03] task_started { task_id: 'a', agent_id: 'w1' }     │
│  [12:00:10] task_completed { task_id: 'a', artifacts: [...] } │  ✓ Checkpoint
│  [12:00:11] task_queued { task_id: 'b' }                      │
│  [12:00:12] task_started { task_id: 'b', agent_id: 'w2' }     │
│                                                                │
│  💥 CRASH                                                      │
│                                                                │
│  Recovery:                                                     │
│  - Task A: completed (skip)                                    │
│  - Task B: was running → re-queue                              │
│  - Task C: pending (unchanged)                                 │
└────────────────────────────────────────────────────────────────┘
```

## Core Components Summary

| Component | Purpose |
|-----------|---------|
| **Forgemaster** | TypeScript state machine that coordinates everything |
| **Domain Model** | Run, Task, TaskAttempt, Artifact entities |
| **Task Queue** | BullMQ/Redis for scheduling with concurrency limits |
| **Workspace Manager** | Git worktree creation/cleanup per task |
| **Relay Integration** | Spawns Workers/Auditors via Relay SDK |
| **MCP Tools** | Contract for agent→Forgemaster communication |
| **Trajectory Capture** | Event sourcing for durability and retrospectives |
| **Gate Handling** | Human approval checkpoints |

## What Forge Does NOT Do

- **Does NOT plan** — that's Planner's job
- **Does NOT make decisions** — agents do the thinking
- **Does NOT modify plans** — sends ChangeRequests back to Planner if structure changes needed
- **Does NOT run LLMs directly** — spawns agents that run LLMs

The separation is intentional: Forge is reliable infrastructure, agents are intelligent executors.

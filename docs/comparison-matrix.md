# Orchestration Framework Comparison Matrix

## Quick Reference

| Framework | Type | Best For | Plan Format |
|-----------|------|----------|-------------|
| **LangGraph** | Graph-based | Complex workflows, fine control | StateGraph + nodes/edges |
| **CrewAI** | Role-based | Team collaboration | Crews + tasks + agents |
| **MS Agent Framework** | Actor-based | Enterprise, multi-language | Workflows + agents |
| **OpenAI Agents SDK** | Lightweight | Simple agent apps | Agents + handoffs |
| **Temporal** | Durable execution | Long-running, fault-tolerant | Workflows + activities |
| **Prefect** | Data pipelines | Dynamic Python workflows | Flows + tasks |
| **Airflow** | DAG orchestration | Static batch pipelines | DAGs + operators |

## Detailed Comparison

### Architecture

| Framework | Core Abstraction | State Model | Execution Model |
|-----------|-----------------|-------------|-----------------|
| LangGraph | Directed graph | TypedDict/Pydantic | Pregel-style message passing |
| CrewAI | Crews of agents | Layered memory | Sequential or hierarchical |
| MS Agent Framework | Actors | Thread-based | Async message passing |
| OpenAI Agents SDK | Agent + tools | Sessions | Agent loop with tool calls |
| Temporal | Workflows + Activities | Event-sourced history | Durable execution |
| Prefect | Flows + Tasks | Python native | Dynamic task creation |
| Airflow | DAGs + Operators | XCom (cross-task) | Scheduler-based |

### Plan/Task Definition

| Framework | How Tasks Defined | Dependencies | Schema |
|-----------|-------------------|--------------|--------|
| LangGraph | Python functions (nodes) | Graph edges | Custom state schema |
| CrewAI | Task objects | `context` arrays | Task + Agent classes |
| MS Agent Framework | Workflow nodes | Workflow edges | Agent + Thread |
| OpenAI Agents SDK | Agent instructions | Handoffs | Agent class |
| Temporal | Python functions | Code flow | Workflow + Activity |
| Prefect | Decorated functions | Python flow | @flow, @task decorators |
| Airflow | Operators | `>>` or `set_downstream` | DAG YAML or Python |

### Human-in-the-Loop

| Framework | Mechanism | Granularity |
|-----------|-----------|-------------|
| LangGraph | Breakpoints, interrupts | Per-node |
| CrewAI | `human_input=True` on tasks | Per-task |
| MS Agent Framework | Checkpoint + approval | Per-workflow-step |
| OpenAI Agents SDK | `@human_approval` decorator | Per-tool-call |
| Temporal | Signals + wait conditions | Any point |
| Prefect | Manual approval tasks | Per-task |
| Airflow | External sensors | Per-task |

### Persistence & Recovery

| Framework | State Persistence | Recovery | Replay |
|-----------|------------------|----------|--------|
| LangGraph | Checkpointers (SQLite, Postgres) | From checkpoint | Yes |
| CrewAI | Memory layers (ChromaDB, SQLite) | Limited | No |
| MS Agent Framework | Thread storage | Thread continuation | Partial |
| OpenAI Agents SDK | Sessions | Session continuation | No |
| Temporal | Event history (built-in) | Full automatic | Yes (deterministic) |
| Prefect | Task state | From failure point | Partial |
| Airflow | Task state (DB) | From failure | No |

### Multi-Agent Support

| Framework | Multi-Agent Pattern | Agent Communication |
|-----------|--------------------|--------------------|
| LangGraph | Sub-graphs, parallel nodes | State passing |
| CrewAI | Crews with multiple agents | Task context |
| MS Agent Framework | Native multi-agent workflows | Message passing |
| OpenAI Agents SDK | Handoffs | Direct delegation |
| Temporal | Child workflows | Async/await |
| Prefect | Sub-flows | Task parameters |
| Airflow | DAG triggers | XCom |

### Integration Capabilities

| Framework | Protocol Support | External Tools |
|-----------|-----------------|----------------|
| LangGraph | HTTP, custom | LangChain tools |
| CrewAI | HTTP | CrewAI tools |
| MS Agent Framework | HTTP, gRPC, MCP | Semantic Kernel tools |
| OpenAI Agents SDK | HTTP | Function tools |
| Temporal | HTTP, gRPC, custom | Activity-based |
| Prefect | HTTP, cloud connectors | Block connectors |
| Airflow | HTTP, providers | Operator-based |

## What They Need from a Plan

### Common Requirements

All frameworks need from a plan:

1. **Step/Task definitions**
   - What work needs to be done
   - Natural language or structured description

2. **Dependencies**
   - What must complete before each step
   - DAG structure (explicit or implicit)

3. **Acceptance criteria**
   - How to verify completion
   - Success/failure conditions

4. **Role/capability requirements**
   - What kind of agent/worker can do this
   - Required tools or permissions

### Framework-Specific Needs

| Framework | Additional Requirements |
|-----------|------------------------|
| LangGraph | State schema, reducer definitions |
| CrewAI | Agent roles, backstories, tools per task |
| MS Agent Framework | Agent instructions, thread configuration |
| OpenAI Agents SDK | Agent instructions, tool definitions |
| Temporal | Activity timeouts, retry policies |
| Prefect | Task decorators, flow parameters |
| Airflow | Operator types, connection IDs |

## What They Report Back

### Common Outputs

1. **Execution status** (pending, running, completed, failed)
2. **Step/task outputs** (results, artifacts)
3. **Error information** (when failures occur)
4. **Timing** (start, end, duration)

### Framework-Specific Outputs

| Framework | Additional Outputs |
|-----------|-------------------|
| LangGraph | Checkpoint IDs, state snapshots |
| CrewAI | Agent reasoning, memory updates |
| MS Agent Framework | Thread history, agent responses |
| OpenAI Agents SDK | Tool call logs, session state |
| Temporal | Full event history, query responses |
| Prefect | Task run artifacts, logs |
| Airflow | XCom values, SLA misses |

## Universal Integration Contract

Based on this analysis, a Planner that works with "any" orchestrator should produce:

```typescript
interface UniversalPlanFormat {
  // Identity
  plan_id: string;
  version: number;

  // Context
  goal: string;
  context?: string;

  // The work
  steps: Array<{
    step_id: string;
    title: string;
    description: string;

    // Who can do this (role-based, not agent-specific)
    owner_role: string;

    // What must complete first (DAG)
    dependencies: string[];

    // How to verify completion
    acceptance_criteria: Array<{
      id: string;
      description: string;
      type?: 'test' | 'review' | 'metric' | 'manual';
    }>;

    // Optional: human approval required
    gate?: {
      type: 'human_approval';
      approver_role?: string;
    };

    // Optional: metadata for specific orchestrators
    metadata?: Record<string, unknown>;
  }>;

  // Orchestrator-specific extensions
  extensions?: Record<string, unknown>;
}
```

And accept status reports via:

```typescript
interface ExecutionStatusReport {
  plan_id: string;
  step_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'blocked';
  started_at?: string;
  completed_at?: string;
  outputs?: Record<string, unknown>;
  error?: {
    message: string;
    details?: unknown;
  };
}
```

## Recommendation for Planner

### Core Format

Use a simple, universal format:
- Steps with IDs
- Dependencies as step_id arrays
- Acceptance criteria as descriptions
- Roles (not specific agents)

### Optional Extensions

Allow orchestrator-specific metadata:
- LangGraph: state schema hints
- CrewAI: agent backstories
- Temporal: timeout policies

### API Contract

Expose minimal REST API:
```
GET  /plans/{plan_id}                    # Current version
GET  /plans/{plan_id}/versions/{v}       # Specific version
POST /plans/{plan_id}/status             # Accept status updates
POST /plans/{plan_id}/change-requests    # Accept plan change requests
```

### Protocol Support

Consider A2A compliance for agent-to-agent interop:
- Planner as an A2A "server agent"
- Exposes skills: create_plan, get_plan, update_status
- Standard message/task format

## Sources

All framework documentation linked in individual deep-dive documents.

# Deep Dive: Temporal

## Overview

Temporal is a **durable execution platform** that enables developers to build scalable applications without sacrificing reliability. Unlike AI-specific frameworks, Temporal is general-purpose infrastructure that guarantees "your code runs to completion no matter what."

## Why Temporal Matters for Agent Orchestration

Temporal solves the hardest problems in distributed systems:
- **Crash recovery**: Automatically resume from any failure
- **State persistence**: Full execution history maintained
- **Long-running processes**: Days, weeks, or months
- **Exactly-once semantics**: No duplicate executions

As Temporal puts it: "Durable Execution makes it trivial to implement distributed systems patterns including sagas, task queues, state machines, circuit breakers."

## Core Concepts

### 1. Workflows

The orchestration code that defines business logic:

```python
from temporalio import workflow
from datetime import timedelta

@workflow.defn
class PlanExecutionWorkflow:
    @workflow.run
    async def run(self, plan_id: str) -> str:
        # Fetch plan
        plan = await workflow.execute_activity(
            fetch_plan,
            plan_id,
            start_to_close_timeout=timedelta(seconds=30)
        )

        # Execute each step
        for step in plan["steps"]:
            result = await workflow.execute_activity(
                execute_step,
                step,
                start_to_close_timeout=timedelta(minutes=10),
                retry_policy=RetryPolicy(maximum_attempts=3)
            )

            # Report progress
            await workflow.execute_activity(
                report_status,
                {"step_id": step["step_id"], "status": "completed"}
            )

        return "Plan completed"
```

**Key properties**:
- Workflows are **deterministic** (same inputs → same outputs)
- State is automatically persisted
- Can run for arbitrary duration
- Supports signals, queries, and updates

### 2. Activities

The failure-prone interactions with external services:

```python
from temporalio import activity

@activity.defn
async def execute_step(step: dict) -> dict:
    """Activities can fail, be retried, have timeouts."""
    # Call external API, run code, interact with world
    result = await agent_relay.dispatch(step)
    return result

@activity.defn
async def fetch_plan(plan_id: str) -> dict:
    """Fetch plan from Planner service."""
    response = await httpx.get(f"{PLANNER_URL}/plans/{plan_id}")
    return response.json()
```

**Activities vs Workflows**:
- Activities: Do the actual work (network calls, DB writes)
- Workflows: Orchestrate activities (pure logic, no I/O)

### 3. Workers

Processes that execute workflows and activities:

```python
from temporalio.client import Client
from temporalio.worker import Worker

async def main():
    client = await Client.connect("localhost:7233")

    worker = Worker(
        client,
        task_queue="plan-execution",
        workflows=[PlanExecutionWorkflow],
        activities=[execute_step, fetch_plan, report_status]
    )

    await worker.run()
```

### 4. Task Queues

Named queues that route work to workers:

```python
# Start workflow on specific queue
handle = await client.start_workflow(
    PlanExecutionWorkflow.run,
    plan_id,
    id=f"plan-{plan_id}",
    task_queue="plan-execution"
)
```

## Durable Execution Model

Temporal's magic is **Event Sourcing** applied to code execution:

```
┌─────────────────────────────────────────────────────────────┐
│                    Temporal Service                         │
│                                                             │
│  Event History:                                             │
│  1. WorkflowExecutionStarted                                │
│  2. ActivityTaskScheduled (fetch_plan)                      │
│  3. ActivityTaskCompleted (fetch_plan) → plan data          │
│  4. ActivityTaskScheduled (execute_step_1)                  │
│  5. ActivityTaskCompleted (execute_step_1) → result         │
│  ...                                                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ replay
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       Worker                                │
│                                                             │
│  Workflow code replays from history:                        │
│  - Deterministic execution                                  │
│  - Activities return cached results                         │
│  - Code continues from where it left off                    │
└─────────────────────────────────────────────────────────────┘
```

**If a worker crashes**:
1. Another worker picks up the workflow
2. Replays the event history
3. Code executes same path (deterministic)
4. Activities use cached results (no re-execution)
5. Continues from exactly where it stopped

## Advanced Features

### Signals (External Input)

```python
@workflow.defn
class PlanExecutionWorkflow:
    def __init__(self):
        self.paused = False

    @workflow.signal
    async def pause(self):
        self.paused = True

    @workflow.signal
    async def resume(self):
        self.paused = False

    @workflow.run
    async def run(self, plan_id: str):
        for step in plan["steps"]:
            # Wait if paused
            await workflow.wait_condition(lambda: not self.paused)
            # Execute step...
```

### Queries (Read State)

```python
@workflow.defn
class PlanExecutionWorkflow:
    def __init__(self):
        self.current_step = None

    @workflow.query
    def get_current_step(self) -> str:
        return self.current_step
```

### Child Workflows

```python
@workflow.defn
class PlanExecutionWorkflow:
    @workflow.run
    async def run(self, plan_id: str):
        # Spawn child workflow for each step
        handles = []
        for step in plan["steps"]:
            handle = await workflow.start_child_workflow(
                StepExecutionWorkflow.run,
                step
            )
            handles.append(handle)

        # Wait for all to complete
        results = await asyncio.gather(*[h.result() for h in handles])
```

### Retry Policies

```python
from temporalio.common import RetryPolicy

@workflow.run
async def run(self, plan_id: str):
    result = await workflow.execute_activity(
        risky_activity,
        retry_policy=RetryPolicy(
            initial_interval=timedelta(seconds=1),
            backoff_coefficient=2.0,
            maximum_interval=timedelta(minutes=1),
            maximum_attempts=5,
            non_retryable_error_types=["FatalError"]
        )
    )
```

## Integration Patterns

### As an Orchestrator for Planner

Temporal is ideal infrastructure for the Orchestrator layer:

```python
@workflow.defn
class PlanOrchestrator:
    @workflow.run
    async def execute_plan(self, plan_ref: str):
        # 1. Fetch approved plan
        plan = await workflow.execute_activity(
            fetch_approved_plan,
            plan_ref
        )

        # 2. Build execution graph from dependencies
        execution_order = topological_sort(plan["steps"])

        # 3. Execute steps respecting dependencies
        completed = set()
        for batch in execution_order:
            # Run independent steps in parallel
            handles = []
            for step in batch:
                if step_dependencies_met(step, completed):
                    h = await workflow.start_child_workflow(
                        StepExecutor.run,
                        step
                    )
                    handles.append((step["step_id"], h))

            # Wait for batch
            for step_id, handle in handles:
                result = await handle.result()
                completed.add(step_id)

                # Report to Planner
                await workflow.execute_activity(
                    report_step_completion,
                    {"plan_ref": plan_ref, "step_id": step_id, "result": result}
                )

        return "Plan completed"
```

### Human-in-the-Loop with Signals

```python
@workflow.defn
class PlanOrchestrator:
    def __init__(self):
        self.approved_steps = set()

    @workflow.signal
    async def approve_step(self, step_id: str):
        self.approved_steps.add(step_id)

    @workflow.run
    async def execute_plan(self, plan_ref: str):
        plan = await workflow.execute_activity(fetch_approved_plan, plan_ref)

        for step in plan["steps"]:
            if step.get("gate", {}).get("type") == "human_approval":
                # Wait for human approval signal
                await workflow.wait_condition(
                    lambda: step["step_id"] in self.approved_steps
                )

            await workflow.execute_activity(execute_step, step)
```

## Why Temporal for Agent Orchestration

### Advantages

1. **Guaranteed completion**: Agents can crash, infrastructure can fail—workflow continues
2. **Long-running**: Agent tasks can take hours/days
3. **Observable**: Full history of every execution
4. **Scalable**: Handles millions of concurrent workflows
5. **Battle-tested**: Used by Netflix, Uber, Coinbase, Snap

### Considerations

1. **Determinism requirement**: Workflow code must be deterministic
2. **Learning curve**: Different programming model
3. **Infrastructure**: Requires Temporal server (self-hosted or cloud)
4. **Overkill for simple cases**: Adds complexity for trivial workflows

## Relevance to Planner

### What Temporal Needs from a Plan

1. **Step definitions** → Activities or child workflows
2. **Dependencies** → Execution ordering
3. **Gates** → Signal waiting points
4. **Acceptance criteria** → Activity validation

### What Temporal Provides Back

1. **Execution status** (running, completed, failed, timed_out)
2. **Full event history** (every decision, every activity)
3. **Query responses** (current state on demand)

### Integration Contract

Temporal doesn't define a plan format—it executes code. The contract is:

```python
# Planner exposes HTTP API
GET /plans/{plan_id}/versions/{version}  # Returns PlanVersion JSON

# Temporal workflow fetches plan, executes steps
# Reports back via HTTP or message queue
POST /plans/{plan_id}/runs/{run_id}/status
POST /plans/{plan_id}/change-requests  # If plan insufficient
```

## Sources

- [Temporal: How It Works](https://temporal.io/how-it-works)
- [Temporal: Durable Execution Guide](https://temporal.io/blog/what-is-durable-execution)
- [Temporal: Beyond State Machines](https://temporal.io/blog/temporal-replaces-state-machines-for-distributed-applications)
- [Temporal GitHub](https://github.com/temporalio/temporal)
- [ZenML: Temporal vs Airflow](https://www.zenml.io/blog/temporal-vs-airflow)

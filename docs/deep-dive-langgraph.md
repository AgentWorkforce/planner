# Deep Dive: LangGraph

## Overview

LangGraph is a low-level orchestration framework for building **stateful, multi-actor applications** powered by LLMs. Part of the LangChain ecosystem, it's trusted by Klarna, Replit, Elastic, and others.

## Core Abstractions

### 1. State

The shared data structure representing your application's current snapshot.

```python
from typing_extensions import TypedDict

class State(TypedDict):
    messages: list[str]
    current_step: str
    context: dict
```

**Key features**:
- Defined using `TypedDict`, `dataclass`, or Pydantic models
- Each key can have its own **reducer function** (how updates are applied)
- Default: updates override existing values
- Custom reducers enable append-only, merge, or other strategies

### 2. Nodes

Python functions that receive state, perform computation, and return updates.

```python
def analyze_task(state: State) -> dict:
    # Do work...
    return {"current_step": "analysis_complete", "context": {...}}
```

**Key features**:
- Sync or async functions
- Converted to RunnableLambda internally
- Native tracing support
- Can return partial state updates

### 3. Edges

Functions determining which node executes next.

```python
# Normal edge (fixed transition)
graph.add_edge("analyze", "plan")

# Conditional edge (dynamic routing)
def route_after_analysis(state: State) -> str:
    if state["needs_clarification"]:
        return "ask_user"
    return "execute"

graph.add_conditional_edges("analyze", route_after_analysis)
```

**Edge types**:
- **Normal**: Direct A → B transitions
- **Conditional**: Route based on state inspection
- **Entry/Exit**: Special `START` and `END` nodes

## Execution Model

LangGraph uses **message passing** inspired by Google's Pregel:

1. Nodes execute in discrete "super-steps"
2. Active nodes run in parallel within a super-step
3. Nodes pass messages (state updates) to subsequent nodes
4. Execution halts when all nodes inactive + no messages in transit

**Recursion limit**: Default 1000 super-steps (configurable)

## Building a Graph

```python
from langgraph.graph import START, END, StateGraph

# 1. Define state
class PlanState(TypedDict):
    goal: str
    steps: list[str]
    current_step: int

# 2. Define nodes
def create_plan(state: PlanState) -> dict:
    return {"steps": ["step1", "step2", "step3"]}

def execute_step(state: PlanState) -> dict:
    return {"current_step": state["current_step"] + 1}

# 3. Build graph
graph = StateGraph(PlanState)
graph.add_node("create_plan", create_plan)
graph.add_node("execute_step", execute_step)

graph.add_edge(START, "create_plan")
graph.add_edge("create_plan", "execute_step")
graph.add_edge("execute_step", END)

# 4. Compile and run
app = graph.compile()
result = app.invoke({"goal": "Build feature X"})
```

## Key Features

### Checkpointing & Persistence

```python
from langgraph.checkpoint.sqlite import SqliteSaver

memory = SqliteSaver.from_conn_string(":memory:")
app = graph.compile(checkpointer=memory)
```

Enables:
- Automatic state persistence
- Resume from any checkpoint
- Time-travel debugging
- Recovery from failures

### Human-in-the-Loop

```python
app = graph.compile(
    checkpointer=memory,
    interrupt_before=["execute_step"]  # Pause here for human review
)
```

Enables:
- Pause at specific nodes
- Human inspection/modification of state
- Continue after approval

### Breakpoints

```python
app = graph.compile(
    checkpointer=memory,
    interrupt_after=["plan_created"]
)
```

## Control Flow Patterns

### Sequential
```
A → B → C → END
```

### Branching
```
      ┌→ B →┐
A → ─┤      ├→ D
      └→ C →┘
```

### Looping
```
A → B → (condition) →┬→ END
         ↑           │
         └───────────┘
```

### Hierarchical (Sub-graphs)
```python
inner_graph = StateGraph(InnerState)
# ... build inner graph ...

outer_graph = StateGraph(OuterState)
outer_graph.add_node("sub_workflow", inner_graph.compile())
```

## Integration Patterns

### As a Plan Consumer

LangGraph could consume our Planner's output:

```python
# Fetch plan from Planner
plan = requests.get(f"{PLANNER_URL}/plans/{plan_id}").json()

# Build graph dynamically from plan steps
graph = StateGraph(ExecutionState)

for step in plan["steps"]:
    graph.add_node(step["step_id"], create_executor(step))

# Add edges based on dependencies
for step in plan["steps"]:
    for dep in step["dependencies"]:
        graph.add_edge(dep, step["step_id"])
```

### State Reporting Back

```python
def step_executor(state: State) -> dict:
    # Execute step...

    # Report status to Planner
    requests.post(f"{PLANNER_URL}/plans/{plan_id}/status", json={
        "step_id": state["current_step"],
        "status": "completed",
        "artifacts": state["artifacts"]
    })

    return {...}
```

## Relevance to Planner

### What LangGraph Needs from a Plan

1. **Step definitions** with clear input/output expectations
2. **Dependencies** expressed as a DAG
3. **Acceptance criteria** for verification
4. **Role requirements** for agent selection

### What LangGraph Provides Back

1. **Execution state** at each checkpoint
2. **Step completion status**
3. **Artifacts/outputs** from each step
4. **Error information** when steps fail

### Integration Contract

```typescript
// Planner produces:
interface PlanForLangGraph {
  plan_id: string;
  steps: Array<{
    step_id: string;
    title: string;
    description: string;
    dependencies: string[];  // DAG
    acceptance_criteria: string[];
  }>;
}

// LangGraph reports:
interface ExecutionStatus {
  plan_id: string;
  step_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  checkpoint_id?: string;
  artifacts?: Record<string, unknown>;
  error?: string;
}
```

## Sources

- [LangGraph GitHub](https://github.com/langchain-ai/langgraph)
- [LangGraph Documentation](https://docs.langchain.com/oss/python/langgraph/graph-api)
- [LangChain: Graph API Overview](https://docs.langchain.com/oss/python/langgraph/graph-api)
- [Codecademy: LangGraph Tutorial](https://www.codecademy.com/article/building-ai-workflow-with-langgraph)

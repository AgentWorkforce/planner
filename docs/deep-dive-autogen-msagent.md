# Deep Dive: Microsoft AutoGen & Agent Framework

## Evolution Timeline

```
2023: AutoGen v0.2 released (conversational multi-agent)
      ↓
2024: Actor model experiments
      ↓
Oct 2025: AutoGen v0.4 released (complete redesign)
      ↓
2025-2026: Microsoft Agent Framework (merger with Semantic Kernel)
```

## AutoGen v0.4 Architecture

### Layered Design

```
┌─────────────────────────────────────────────────────────────┐
│                    Extensions Layer                         │
│  (Azure code executor, OpenAI client, third-party tools)    │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                    AgentChat Layer                          │
│  (Group chat, code execution, pre-built agents)             │
│  - High-level API similar to v0.2                           │
│  - Easiest migration path                                   │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                      Core Layer                             │
│  (Event-driven agentic system, actor model)                 │
│  - Asynchronous messaging                                   │
│  - Modular, extensible                                      │
│  - Cross-language support                                   │
└─────────────────────────────────────────────────────────────┘
```

### Actor Model Foundation

AutoGen v0.4 adopts the **actor model** for multi-agent orchestration:

- **Actors** = computational units that:
  - Exchange messages
  - Perform work
  - Maintain internal state
  - Spawn other actors

- **Benefits**:
  - Concurrent programming model
  - Agents can run on different processes/machines
  - Different implementation languages
  - Large class of multi-agent patterns supported

### Messaging Patterns

Two primary patterns:

1. **Event-driven**: Agents respond to events autonomously
2. **Request/Response**: Traditional query-and-answer

```python
# Event-driven
@agent.on_message
async def handle_message(message: Message):
    # Process and optionally respond
    pass

# Request/Response
response = await agent.send_request(target_agent, request)
```

### Key Design Principles

1. **Asynchronous messaging** (not synchronous calls)
2. **Modular components** (agents, tools, memory, models)
3. **Type safety** (full type checking at build time)
4. **Observability** (metrics, tracing, OpenTelemetry)
5. **Cross-language** (Python, .NET, more coming)

## Microsoft Agent Framework (2025-2026)

### What It Is

A unified foundation combining:
- **AutoGen**: Multi-agent orchestration
- **Semantic Kernel**: Enterprise AI features

### Core Components

#### 1. AI Agents

```python
from agent_framework import Agent, AgentThread

# Create agent
agent = Agent(
    name="planner",
    instructions="You are a planning specialist...",
    model_client=azure_openai_client,
    tools=[search_tool, file_tool]
)

# Create thread (state management)
thread = AgentThread()

# Run agent
response = await agent.run(
    thread=thread,
    messages=[{"role": "user", "content": "Create a plan for..."}]
)
```

**Agent components**:
- Model clients (Azure OpenAI, OpenAI)
- Agent thread (state management)
- Context providers (agent memory)
- Middleware (intercepting actions)
- MCP clients (tool integration)

#### 2. Workflows

Graph-based workflows for multi-step tasks:

```python
from agent_framework.workflow import Workflow, Node

workflow = Workflow()

# Add nodes
workflow.add_node("analyze", analyze_function)
workflow.add_node("plan", planning_agent)
workflow.add_node("execute", execution_agent)

# Add edges
workflow.add_edge("analyze", "plan")
workflow.add_conditional_edge("plan", route_by_complexity)
```

**Workflow features**:
- Conditional routing
- Parallel processing
- Nested workflows
- Human-in-the-loop checkpointing
- Multi-agent orchestration

### When to Use Agents vs Functions

| Scenario | Use |
|----------|-----|
| Unstructured environment | Agents |
| Dynamic, unpredictable tasks | Agents |
| Predefined rules and sequences | Functions |
| Highly structured tasks | Functions |

## Integration Patterns

### Consuming Plans from Planner

```python
from agent_framework import Agent, Workflow

async def execute_plan(plan_ref: str):
    # Fetch plan
    plan = await fetch_plan(plan_ref)

    # Create workflow from plan
    workflow = Workflow()

    for step in plan["steps"]:
        # Create agent for each role (or reuse)
        agent = get_or_create_agent(step["owner_role"])

        # Add as workflow node
        workflow.add_node(
            step["step_id"],
            agent.run,
            inputs={"task": step["description"]}
        )

    # Add edges from dependencies
    for step in plan["steps"]:
        for dep in step["dependencies"]:
            workflow.add_edge(dep, step["step_id"])

    # Execute
    result = await workflow.run()
    return result
```

### Multi-Agent Patterns

```python
# Supervisor pattern
supervisor = Agent(name="supervisor", ...)
worker1 = Agent(name="researcher", ...)
worker2 = Agent(name="writer", ...)

workflow = Workflow()
workflow.add_node("supervise", supervisor)
workflow.add_node("research", worker1)
workflow.add_node("write", worker2)

# Supervisor routes to workers
workflow.add_conditional_edge("supervise", route_to_worker)
workflow.add_edge("research", "supervise")
workflow.add_edge("write", "supervise")
```

## Relevance to Planner

### What MS Agent Framework Needs from a Plan

1. **Step definitions** → Workflow nodes or agent tasks
2. **Role requirements** → Agent selection/creation
3. **Dependencies** → Workflow edges
4. **Acceptance criteria** → Validation functions

### What It Provides Back

1. **Execution status** per step
2. **Agent responses** and artifacts
3. **Thread history** (full conversation)

### Integration Contract

```typescript
// Planner produces:
interface PlanForMSAgent {
  plan_id: string;
  steps: Array<{
    step_id: string;
    title: string;
    description: string;
    owner_role: string;  // Maps to Agent
    dependencies: string[];  // Maps to Workflow edges
    acceptance_criteria: Array<{
      description: string;
    }>;
  }>;
}

// MS Agent Framework reports:
interface ExecutionReport {
  plan_id: string;
  step_id: string;
  status: 'running' | 'completed' | 'failed';
  agent_response?: string;
  thread_id?: string;  // For continuation
}
```

## Key Differences from Other Frameworks

| Aspect | MS Agent Framework | LangGraph | CrewAI |
|--------|-------------------|-----------|--------|
| Foundation | Actor model | Pregel-style graphs | Role-based crews |
| Language | Python, .NET | Python, JS | Python |
| Enterprise | First-class | Via LangSmith | Limited |
| Memory | Thread-based | Checkpointers | Layered (ChromaDB) |
| Async | Native async | Optional | Optional |

## Sources

- [Microsoft Research: AutoGen v0.4](https://www.microsoft.com/en-us/research/blog/autogen-v0-4-reimagining-the-foundation-of-agentic-ai-for-scale-extensibility-and-robustness/)
- [Microsoft Learn: Agent Framework Overview](https://learn.microsoft.com/en-us/agent-framework/overview/agent-framework-overview)
- [AutoGen GitHub](https://github.com/microsoft/autogen)
- [AutoGen to Agent Framework Migration](https://learn.microsoft.com/en-us/agent-framework/migration-guide/from-autogen/)

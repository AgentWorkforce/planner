# Deep Dive: OpenAI Agents SDK

## Evolution

```
Oct 2024: Swarm (educational, experimental)
    ↓
2025: OpenAI Agents SDK (production-ready upgrade)
```

## Overview

The OpenAI Agents SDK enables building "agentic AI apps in a lightweight, easy-to-use package with very few abstractions."

**Design philosophy**: Minimal abstractions, Python-first, production-ready.

## Core Primitives

### 1. Agents

LLMs equipped with instructions and tools:

```python
from openai_agents import Agent

research_agent = Agent(
    name="Researcher",
    instructions="You are a research specialist. Gather comprehensive information on topics.",
    tools=[web_search, document_reader]
)

writer_agent = Agent(
    name="Writer",
    instructions="You are a technical writer. Create clear, well-structured documents.",
    tools=[file_writer]
)
```

### 2. Handoffs

Agents functioning as tools to delegate to other agents:

```python
from openai_agents import Agent, handoff

# Define specialist agents
analyst = Agent(name="Analyst", instructions="...")
coder = Agent(name="Coder", instructions="...")

# Main agent can hand off to specialists
main_agent = Agent(
    name="Coordinator",
    instructions="Route tasks to appropriate specialists.",
    handoffs=[analyst, coder]  # These become callable tools
)
```

**How handoffs work**:
- Agents are registered as tools on the parent agent
- Parent can "call" another agent like calling a function
- Control transfers to the called agent
- Results return to the parent

### 3. Guardrails

Validation mechanisms for inputs and outputs:

```python
from openai_agents import Agent, guardrail

@guardrail
def check_for_pii(input: str) -> bool:
    """Return False if PII detected."""
    return not contains_pii(input)

@guardrail
def validate_output_format(output: str) -> bool:
    """Ensure output matches expected schema."""
    return is_valid_json(output)

agent = Agent(
    name="SecureAgent",
    input_guardrails=[check_for_pii],
    output_guardrails=[validate_output_format]
)
```

**Guardrail features**:
- Run in parallel with agent execution
- Can block execution if validation fails
- Input and output validation separate

### 4. Function Tools

Any Python function becomes a tool:

```python
from openai_agents import Agent, function_tool

@function_tool
def search_database(query: str) -> list[dict]:
    """Search the database for matching records.

    Args:
        query: The search query string

    Returns:
        List of matching records
    """
    return db.search(query)

agent = Agent(
    name="DBAgent",
    tools=[search_database]  # Automatic schema generation
)
```

**Features**:
- Automatic JSON schema generation from type hints
- Docstrings become tool descriptions
- Return values automatically serialized

## Execution Model

### Runner

The execution engine that handles the agent loop:

```python
from openai_agents import Agent, Runner

agent = Agent(name="MyAgent", instructions="...")
runner = Runner()

# Simple invocation
result = await runner.run(agent, "What is the capital of France?")

# With context
result = await runner.run(
    agent,
    messages=[
        {"role": "user", "content": "Analyze this data..."},
        {"role": "assistant", "content": "Previous analysis..."},
        {"role": "user", "content": "Now summarize."}
    ]
)
```

### Agent Loop

Built-in loop handles:
1. Send messages to LLM
2. LLM decides: respond or call tool
3. If tool call → execute tool → return result to LLM
4. Repeat until LLM responds without tool call
5. Return final response

```
User Input
    ↓
┌───────────────────────────────────────┐
│            Agent Loop                 │
│                                       │
│  LLM ←→ Tool Execution ←→ Results    │
│    ↓                                  │
│  (repeat until no tool calls)         │
└───────────────────────────────────────┘
    ↓
Final Response
```

## Advanced Features

### Sessions (Persistent Memory)

```python
from openai_agents import Agent, Session

session = Session(storage="sqlite:///sessions.db")

# Conversation persists across runs
result1 = await runner.run(agent, "My name is Alice", session=session)
result2 = await runner.run(agent, "What's my name?", session=session)
# Result: "Your name is Alice"
```

### Human-in-the-Loop

```python
from openai_agents import Agent, human_approval

@human_approval(message="Approve this action?")
def dangerous_action(params: dict):
    """Action that requires human approval."""
    return execute_dangerous_thing(params)

agent = Agent(tools=[dangerous_action])
```

### Tracing & Observability

```python
from openai_agents import Agent, enable_tracing

enable_tracing(endpoint="https://my-observability-platform.com")

# All agent runs now traced
result = await runner.run(agent, "...")
# Traces available in dashboard
```

## Multi-Agent Patterns

### Coordinator Pattern

```python
researcher = Agent(name="Researcher", tools=[search])
writer = Agent(name="Writer", tools=[write_file])
reviewer = Agent(name="Reviewer", tools=[analyze])

coordinator = Agent(
    name="Coordinator",
    instructions="""
    You coordinate a team:
    1. Use Researcher for gathering information
    2. Use Writer for creating content
    3. Use Reviewer for quality checks
    """,
    handoffs=[researcher, writer, reviewer]
)

result = await runner.run(coordinator, "Write a report on AI planning")
```

### Pipeline Pattern

```python
async def pipeline(task: str):
    # Stage 1: Research
    research = await runner.run(researcher, f"Research: {task}")

    # Stage 2: Write
    draft = await runner.run(writer, f"Write about: {research}")

    # Stage 3: Review
    final = await runner.run(reviewer, f"Review and improve: {draft}")

    return final
```

## Integration with Plans

### Consuming Planner Output

```python
from openai_agents import Agent, Runner

async def execute_plan(plan: dict):
    runner = Runner()

    # Create agents for each role
    agents = {}
    for step in plan["steps"]:
        role = step["owner_role"]
        if role not in agents:
            agents[role] = Agent(
                name=role,
                instructions=f"You are a {role} specialist.",
                tools=get_tools_for_role(role)
            )

    # Execute steps in order (respecting dependencies)
    completed = {}
    for step in topological_sort(plan["steps"]):
        # Gather context from dependencies
        context = "\n".join([
            completed[dep] for dep in step["dependencies"]
        ])

        # Run agent for this step
        result = await runner.run(
            agents[step["owner_role"]],
            f"Task: {step['description']}\n\nContext:\n{context}"
        )

        completed[step["step_id"]] = result

        # Report to Planner
        await report_status(plan["plan_id"], step["step_id"], "completed")

    return completed
```

## Comparison with Swarm

| Feature | Swarm (2024) | Agents SDK (2025) |
|---------|-------------|-------------------|
| Status | Educational | Production-ready |
| State | Stateless between calls | Persistent sessions |
| Guardrails | None | First-class |
| Tracing | None | Built-in |
| Memory | None | Sessions |
| Human-in-loop | Manual | Built-in |

## Relevance to Planner

### What OpenAI Agents SDK Needs from a Plan

1. **Step descriptions** → Agent prompts
2. **Role assignments** → Agent selection
3. **Dependencies** → Execution ordering
4. **Acceptance criteria** → Guardrail validation

### What It Provides Back

1. **Agent responses** per step
2. **Tool call logs**
3. **Session state**
4. **Trace data**

### Integration Contract

```typescript
// Planner produces:
interface PlanForOpenAIAgents {
  plan_id: string;
  steps: Array<{
    step_id: string;
    description: string;  // Agent prompt
    owner_role: string;   // Agent name
    dependencies: string[];
    acceptance_criteria: Array<{
      description: string;  // Guardrail input
    }>;
  }>;
}

// OpenAI Agents reports:
interface StepResult {
  plan_id: string;
  step_id: string;
  status: 'completed' | 'failed';
  response: string;
  tool_calls?: Array<{
    tool: string;
    input: any;
    output: any;
  }>;
}
```

## Sources

- [OpenAI Agents SDK Documentation](https://openai.github.io/openai-agents-python/)
- [OpenAI: New Tools for Building Agents](https://openai.com/index/new-tools-for-building-agents/)
- [OpenAI Swarm GitHub](https://github.com/openai/swarm)
- [OpenAI Cookbook: Orchestrating Agents](https://cookbook.openai.com/examples/orchestrating_agents)

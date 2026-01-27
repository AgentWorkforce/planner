# Deep Dive: CrewAI

## Overview

CrewAI is "the leading open-source framework for orchestrating autonomous AI agents." It emphasizes **role-based collaboration** where agents work as teams on complex tasks.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                          FLOW                               │
│  (Process definition: steps, logic, state, events)          │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                      CREW                            │   │
│  │  (Team of agents with roles + tasks)                 │   │
│  │                                                      │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐             │   │
│  │  │ Agent A │  │ Agent B │  │ Agent C │             │   │
│  │  │(role)   │  │(role)   │  │(role)   │             │   │
│  │  └────┬────┘  └────┬────┘  └────┬────┘             │   │
│  │       │            │            │                   │   │
│  │  ┌────▼────┐  ┌────▼────┐  ┌────▼────┐             │   │
│  │  │ Task 1  │  │ Task 2  │  │ Task 3  │             │   │
│  │  └─────────┘  └─────────┘  └─────────┘             │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Flows

The management layer that defines:
- Steps and execution logic
- State persistence
- Event-driven triggers
- Conditional branching

```python
from crewai.flow.flow import Flow, listen, start

class PlanningFlow(Flow):
    @start()
    def receive_goal(self):
        return {"goal": self.state.input_goal}

    @listen(receive_goal)
    def create_plan(self):
        # Delegate to a Crew for complex planning
        result = self.planning_crew.kickoff(inputs=self.state)
        return {"plan": result}
```

### 2. Crews

Teams of agents with:
- Defined roles and objectives
- Task assignments
- Collaboration patterns

```python
from crewai import Crew, Agent, Task

# Define agents with roles
researcher = Agent(
    role="Research Analyst",
    goal="Gather comprehensive information",
    backstory="Expert at finding and synthesizing information",
    tools=[search_tool, web_scraper]
)

writer = Agent(
    role="Technical Writer",
    goal="Create clear documentation",
    backstory="Skilled at explaining complex topics"
)

# Define tasks
research_task = Task(
    description="Research the topic thoroughly",
    expected_output="Comprehensive research notes",
    agent=researcher
)

write_task = Task(
    description="Write documentation based on research",
    expected_output="Polished technical document",
    agent=writer,
    context=[research_task]  # Dependency!
)

# Create crew
crew = Crew(
    agents=[researcher, writer],
    tasks=[research_task, write_task],
    process="sequential"  # or "hierarchical"
)
```

### 3. Agents

Individual team members with:
- **Role**: What they specialize in
- **Goal**: What they're trying to achieve
- **Backstory**: Context for their expertise
- **Tools**: Capabilities they can use

### 4. Tasks

Work items with:
- **Description**: What needs to be done
- **Expected Output**: Completion criteria
- **Agent**: Who's responsible (optional)
- **Context**: Dependencies on other tasks
- **Tools**: Task-specific capabilities

## Task Properties (Full)

```python
Task(
    # Core
    description="Detailed task description",
    expected_output="What success looks like",
    agent=assigned_agent,  # Optional

    # Dependencies
    context=[other_task1, other_task2],  # Input from these tasks

    # Output
    output_file="results.md",  # Persist output
    output_json=PydanticModel,  # Structured output
    output_pydantic=PydanticModel,

    # Execution
    async_execution=True,  # Run asynchronously
    human_input=True,  # Require human review

    # Callbacks
    callback=my_callback_function,

    # Validation
    guardrail=validation_function
)
```

## Execution Models

### Sequential Process

Tasks execute linearly:

```python
crew = Crew(
    agents=[agent1, agent2],
    tasks=[task1, task2, task3],
    process="sequential"
)
```

Flow: task1 → task2 → task3

### Hierarchical Process

Manager agent coordinates:

```python
crew = Crew(
    agents=[agent1, agent2],
    tasks=[task1, task2],
    process="hierarchical",
    manager_llm=ChatOpenAI(model="gpt-4")
)
```

Manager delegates tasks, validates outputs, handles coordination.

## Memory Systems

CrewAI provides layered memory:

| Type | Storage | Purpose |
|------|---------|---------|
| Short-term | ChromaDB vector store | Working context |
| Long-term | SQLite | Persistent learnings |
| Entity | Vector embeddings | People, places, concepts |

```python
crew = Crew(
    agents=[...],
    tasks=[...],
    memory=True,  # Enable memory
    embedder={
        "provider": "openai",
        "config": {"model": "text-embedding-3-small"}
    }
)
```

## Execution Methods

```python
# Synchronous
result = crew.kickoff()

# With inputs
result = crew.kickoff(inputs={"topic": "AI planning"})

# For each item
results = crew.kickoff_for_each(inputs=[item1, item2, item3])

# Async
result = await crew.akickoff()
results = await crew.akickoff_for_each(inputs=[...])
```

## Integration Patterns

### As a Plan Consumer

CrewAI could consume our Planner's output:

```python
def build_crew_from_plan(plan_version: dict) -> Crew:
    agents = {}
    tasks = []

    # Create agents for each unique role
    for step in plan_version["steps"]:
        role = step["owner_role"]
        if role not in agents:
            agents[role] = Agent(
                role=role,
                goal=f"Complete {role} tasks effectively",
                backstory=f"Expert in {role} domain"
            )

    # Create tasks with dependencies
    task_map = {}
    for step in plan_version["steps"]:
        context_tasks = [task_map[dep] for dep in step["dependencies"]]
        task = Task(
            description=step["description"],
            expected_output=step["acceptance_criteria"][0]["description"],
            agent=agents[step["owner_role"]],
            context=context_tasks if context_tasks else None
        )
        task_map[step["step_id"]] = task
        tasks.append(task)

    return Crew(agents=list(agents.values()), tasks=tasks)
```

### Reporting Back to Planner

```python
def task_callback(output):
    requests.post(f"{PLANNER_URL}/plans/{plan_id}/status", json={
        "step_id": output.task.step_id,
        "status": "completed",
        "result": output.raw
    })

task = Task(
    description="...",
    callback=task_callback
)
```

## Relevance to Planner

### What CrewAI Needs from a Plan

1. **Role definitions** → CrewAI agents
2. **Task descriptions** with expected outputs → CrewAI tasks
3. **Dependencies** (context) → Task context arrays
4. **Acceptance criteria** → Expected output definitions

### What CrewAI Provides Back

1. **Task outputs** (raw text or structured)
2. **Execution logs**
3. **Memory/context accumulated**

### Integration Contract

```typescript
// Planner produces:
interface PlanForCrewAI {
  plan_id: string;
  steps: Array<{
    step_id: string;
    title: string;
    description: string;
    owner_role: string;  // Maps to CrewAI Agent role
    dependencies: string[];  // Maps to Task context
    acceptance_criteria: Array<{
      description: string;  // Maps to expected_output
    }>;
  }>;
}

// CrewAI reports:
interface TaskCompletion {
  plan_id: string;
  step_id: string;
  status: 'completed' | 'failed';
  output: string;
  tokens_used?: number;
}
```

## Key Differences from LangGraph

| Aspect | CrewAI | LangGraph |
|--------|--------|-----------|
| Abstraction | High (roles, crews) | Low (nodes, edges) |
| Focus | Team collaboration | Graph execution |
| State | Built-in memory layers | Custom state schema |
| Dependencies | Task context arrays | Graph edges |
| Human-in-loop | `human_input=True` flag | Breakpoints/interrupts |

## Sources

- [CrewAI Documentation](https://docs.crewai.com/introduction)
- [CrewAI Tasks Docs](https://docs.crewai.com/concepts/tasks)
- [CrewAI Crews Docs](https://docs.crewai.com/concepts/crews)

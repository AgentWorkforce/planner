# Research: Agent Coordination & Spawning Patterns

## The Bootstrap Problem

**Question**: In a multi-agent system, who spawns the first agent? What triggers it?

**Answer**: The "bootstrap" is almost always handled by **non-agent infrastructure**:

1. **External triggers** (user queries) activate a predefined lead/orchestrator agent
2. **Framework/middleware code** initializes the first agent
3. **Predefined hierarchies** where the root coordinator is initialized by system infrastructure

Pure agent self-organization (agents spawning themselves from nothing) is avoided through architectural design.

## Coordination Architectures

### 1. Orchestrator-Worker (Hierarchical)

**How it works**: Lead agent analyzes task, develops strategy, spawns specialized workers

**Anthropic's Research System** (reference implementation):
1. User submits query
2. Lead agent analyzes and develops strategy
3. Lead agent saves plan to memory (for context beyond 200k tokens)
4. Lead agent spawns multiple subagents to explore in parallel
5. Subagents return findings
6. Lead agent synthesizes and decides if more research needed
7. Citation agent processes final output

**Key characteristics**:
- Synchronous execution (lead waits for workers)
- Clear delegation with detailed task descriptions
- Explicit objectives and output formats
- Task boundaries prevent duplication/gaps

### 2. Network (Peer-to-Peer)

**How it works**: Agents operate as peers, communicating to decide who acts next

**Characteristics**:
- No central coordinator
- Agents negotiate task ownership
- Can lead to emergent behavior
- Harder to reason about/debug

### 3. Supervisor (Flat with Coordinator)

**How it works**: Single supervisor decides which agent acts next, but agents are peers otherwise

**Characteristics**:
- Supervisor handles routing, not execution
- Workers are independent but guided
- Clearer than pure network, less bottleneck than hierarchical

## Decomposition Strategies

### Functional Decomposition
Split by technical domain/expertise:
- Frontend agent, Backend agent, Database agent
- Each handles their specialty

### Spatial Decomposition
Split by files/directories:
- Agents work on separate codebase sections
- Minimizes conflicts

### Temporal Decomposition
Split by execution phases:
- Analysis → Planning → Implementation → Verification
- Later stages depend on earlier completions

## Coordination Mechanisms

### Pipeline Coordination
Sequential processing where each stage's output feeds the next
```
Agent A → Agent B → Agent C → Result
```

### MapReduce Coordination
Parallel processing with aggregation:
- **Map phase**: Process items in parallel
- **Reduce phase**: Aggregate results

### Consensus Coordination
Multiple agents verify work for critical operations:
- Redundant execution
- Voting or agreement protocols
- Higher accuracy, higher cost

### Event-Driven Coordination
Real-time coordination for responsive systems:
- Agents react to events
- Pub/sub messaging patterns

## Resource Management

Critical controls for multi-agent systems:

| Control | Purpose |
|---------|---------|
| **Tool Access Restrictions** | Agents receive only necessary capabilities |
| **File Locking** | Prevent concurrent edits to same file |
| **Concurrency Limits** | Prevent system overload |
| **Resource Isolation** | Security boundaries between agents |

## Agent Relay Specifics

The agentworkforce/relay provides:

### Agent Spawning
```bash
# Coordinator + daemon
agent-relay claude
agent-relay codex

# Named workers
agent-relay create-agent -n Name <cmd>
```

- Spawns via pseudo-terminals (`claude --dangerously-skip-permissions`)
- Sets `AGENT_RELAY_OUTBOX` for file-based messaging
- Role-based agents match `.claude/agents/*.md` files

### Agent Communication
```
TO: AgentName
Message content
```

Features:
- Synchronous: `->relay:Bob [await]` or `->relay:Bob [await:30s]`
- Broadcast: `TO: *`
- Cross-project: `TO: project:agent`
- Sub-5ms P2P latency via daemon

### What Relay Provides vs. What It Doesn't

**Provides**:
- Real-time messaging (~5ms latency)
- Agent spawning infrastructure
- Playback/continuation of agent reasoning
- Channels, broadcast, consensus primitives

**Does NOT provide**:
- Orchestration logic (who does what when)
- Planning structure
- Workflow management
- State machines for execution

This is exactly why we need Planner (structured intent) + Orchestrator (execution logic) on top of Relay (transport).

## Implications for Planner

### Planner's Role in Coordination

1. **Defines the plan** (what agents should do)
2. **Specifies dependencies** (what order things can happen)
3. **Assigns roles** (what kind of agent, not which specific agent)
4. **Sets acceptance criteria** (how to verify completion)

### Orchestrator's Role (using Relay)

1. **Interprets the plan**
2. **Spawns agents** (via Relay primitives)
3. **Routes tasks** (based on role mapping)
4. **Handles coordination** (pipeline, mapreduce, etc.)
5. **Verifies completion** (against acceptance criteria)
6. **Manages failures** (retries, escalation, change requests)

### The "First Agent" Question for Our System

In our architecture:
1. **User/system** initiates by creating a goal
2. **Intake** (separate service) captures and structures it
3. **Planner** produces a versioned plan
4. **Orchestrator** is triggered by plan publication
5. **Orchestrator** spawns first execution agent via Relay

The bootstrap is: `User → Intake → Planner → Orchestrator → Relay → Agents`

## Sources

- [Anthropic: How We Built Our Multi-Agent Research System](https://www.anthropic.com/engineering/multi-agent-research-system)
- [Claude Blog: When to Use Multi-Agent Systems](https://claude.com/blog/building-multi-agent-systems-when-and-how-to-use-them)
- [Building an Agentic System: Multi-Agent Orchestration](https://gerred.github.io/building-an-agentic-system/second-edition/part-iv-advanced-patterns/chapter-10-multi-agent-orchestration.html)
- [Galileo: Multi-Agent Coordination Strategies](https://galileo.ai/blog/multi-agent-coordination-strategies)
- [Google ADK: Multi-Agent Systems](https://google.github.io/adk-docs/agents/multi-agents/)

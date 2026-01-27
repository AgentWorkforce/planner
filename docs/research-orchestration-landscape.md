# Research: AI Agent Orchestration Landscape

## Executive Summary

The AI agent orchestration space has matured significantly, with several frameworks emerging as leaders. Understanding their patterns is critical for designing a Planner that can work with "any" orchestrator.

## Major Frameworks

### LangGraph (LangChain ecosystem)

**Architecture**: Graph-based state management
- Represents workflows as directed graphs with nodes and edges
- Passes only necessary state deltas between nodes (most efficient token usage)
- Best performance: 2.2x faster than CrewAI in benchmarks
- 8-9x more token-efficient than LangChain and AutoGen

**Strengths**:
- Visual, structured workflow representation
- Fine-grained control over state transitions
- Excellent for complex workflows needing detailed orchestration

**Integration Pattern**: Workflows defined as code, state machines with explicit transitions

### CrewAI

**Architecture**: Role-based collaborative autonomy
- Agents defined by roles that can delegate, share updates, coordinate
- Higher-level abstraction than LangGraph
- Built-in layered memory (ChromaDB vector store, SQLite for tasks/long-term)

**Strengths**:
- Production-ready with role-based task delegation
- Natural mapping to team structures
- Built-in memory management

**Integration Pattern**: Role assignment + goal specification, framework handles sequencing

### Microsoft AutoGen

**Architecture**: Conversational orchestration
- Agents collaborate through dialogue/debate
- Workflows treated as conversations between agents
- Flexible routing and async communication

**Strengths**:
- Natural for multi-agent reasoning experiments
- Good for simulation-heavy tasks
- Merged with Semantic Kernel for enterprise (Oct 2025)

**Integration Pattern**: Message-based coordination, conversation as control flow

## Orchestration Patterns

### Centralized

**Supervisor Pattern**: Single manager agent directs specialized agents
- Sequential: Linear pipelines with fixed dependencies
- Hierarchical: Tiered structures for complex, multi-department tasks

**Pros**: Clear control flow, easier debugging
**Cons**: Bottleneck at supervisor, single point of failure

### Decentralized

**Group Chat**: Agents collaborate through shared conversation threads
**Handoff**: Agents dynamically delegate to peers with appropriate expertise

**Pros**: Flexible, no single bottleneck
**Cons**: Harder to reason about, potential for chaos

### Federated

Combines centralized and decentralized for regulated/distributed environments
- Cross-organizational collaboration
- Maintains governance

## Common Architectural Elements

| Element | Description |
|---------|-------------|
| **State Management** | How context flows between agents (full histories vs. optimized deltas) |
| **Communication Protocol** | Agent-to-agent messaging patterns |
| **Tool Integration** | MCP (Anthropic), A2A (Google) emerging as standards |
| **Autonomy Spectrum** | From autonomous reasoning to explicit instruction-following |

## Key Insight: Plan vs. Execute Separation

All major frameworks separate **what to do** from **how to do it**:

1. **Planning phase**: Decompose task, identify steps, determine dependencies
2. **Execution phase**: Run steps, handle failures, verify results

This separation is exactly what our Planner/Orchestrator split accomplishes. The Planner produces the "what" (structured plans), and the Orchestrator handles the "how" (execution with retries, parallelism, etc.).

## Integration Implications for Planner

### What Orchestrators Need from Plans

1. **Step definitions**: What work needs to be done
2. **Dependencies**: DAG of what depends on what (for parallelization)
3. **Acceptance criteria**: How to verify step completion
4. **Role/capability requirements**: What kind of agent can do this step
5. **Gates**: Where human approval is needed

### What Orchestrators Provide Back

1. **Execution status**: Per-step progress
2. **Completion evidence**: Outputs, artifacts
3. **Change requests**: When plan is insufficient

### Universal Integration Points

A Planner working with "any" orchestrator needs:

```
# Orchestrator fetches approved plan
GET /plans/{plan_id}/versions/{version}

# Response: PlanVersion JSON with steps, dependencies, criteria

# Orchestrator can push status updates
POST /plans/{plan_id}/runs/{run_id}/status

# Orchestrator can request plan changes
POST /plans/{plan_id}/change-requests
```

The key is that the **plan format is the contract**. Different orchestrators can interpret and execute the same plan differently, but the plan structure remains consistent.

## Sources

- [Turing: AI Agent Frameworks Comparison](https://www.turing.com/resources/ai-agent-frameworks)
- [AIMultiple: Agentic Orchestration Frameworks](https://research.aimultiple.com/agentic-orchestration/)
- [GetMaxim: Top 5 AI Agent Frameworks](https://www.getmaxim.ai/articles/top-5-ai-agent-frameworks-in-2025-a-practical-guide-for-ai-builders/)
- [Lindy: AI Agent Frameworks Reviewed](https://www.lindy.ai/blog/best-ai-agent-frameworks)
- [Softcery: 14 AI Agent Frameworks Compared](https://softcery.com/lab/top-14-ai-agent-frameworks-of-2025-a-founders-guide-to-building-smarter-systems)

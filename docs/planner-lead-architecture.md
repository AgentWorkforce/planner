# PlannerLead Architecture: Persistent Service vs spawn()

## Why PlannerLead Uses Anthropic API Directly (Persistent Service) vs spawn()

### The Core Distinction

| Pattern | `spawn()` | Persistent Service (Anthropic API) |
|---------|-----------|-----------------------------------|
| **Lifecycle** | Ephemeral - spawned per task, released when done | Long-lived - runs for server lifetime |
| **State** | Stateless - fresh context each spawn | Stateful - maintains conversation history |
| **Latency** | ~2-5s startup per spawn | ~200ms per response (already warm) |
| **Use case** | Task workers ("implement this step") | Orchestrators/coordinators ("help me plan") |

### What `spawn()` Does

When you call `spawn()`, the relay daemon:
1. Launches a new Claude CLI process (`claude --dangerously-skip-permissions -p "task..."`)
2. The agent does its work
3. You `release()` when done
4. The process terminates

**This is perfect for**: "Go implement this feature and report back"

**This is wrong for**: "Be available to answer questions whenever I message you"

### Why PlannerLead Needed the Persistent Pattern

1. **Always Listening**: PlannerLead must monitor all `#planner` and `#plan-*` channels continuously. Spawn creates a process that exits when done - it can't "wait" for messages.

2. **Conversation Memory**: When a user says "add another step like the last one", PlannerLead needs to remember the conversation. Spawned agents start fresh each time.

3. **Response Latency**: Spawning takes 2-5 seconds. For a chat interface, that's unacceptable. Calling the Anthropic API directly: ~200ms.

4. **Single Identity**: PlannerLead is "one agent" in the relay - it has a consistent name (`PlannerLead`), can receive messages, and maintains presence. Spawned workers are temporary.

### The Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    planner-core process                     │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              PlannerLead Service                     │   │
│  │                                                      │   │
│  │  • RelayClient connection (persistent)               │   │
│  │  • onMessage handler (always listening)              │   │
│  │  • Anthropic API calls (for LLM responses)           │   │
│  │  • Conversation history (per channel)                │   │
│  │  • Tool execution (add_step, spawn_agent, etc.)      │   │
│  └─────────────────────────────────────────────────────┘   │
│                            │                                │
│                            │ spawn() when needed            │
│                            ▼                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ Worker-1    │  │ Worker-2    │  │ Worker-N    │         │
│  │ (spawned)   │  │ (spawned)   │  │ (spawned)   │         │
│  │ ephemeral   │  │ ephemeral   │  │ ephemeral   │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

### Now PlannerLead Can Spawn Workers

With the `spawn_agent` tool, PlannerLead can **delegate** to ephemeral workers:

```
User: "Implement step 1 of this plan"

PlannerLead (persistent):
  1. Understands the request
  2. Uses spawn_agent tool to create "impl-worker-1"
  3. Sends step details to the worker
  4. Worker does the implementation
  5. Reports back to PlannerLead
  6. PlannerLead releases the worker
  7. PlannerLead summarizes results to user
```

### Summary

**spawn()** = "Create a worker to do this job, then dismiss them"

**Persistent service** = "Be the coordinator who's always here, managing the workers"

PlannerLead is the coordinator. It can't be a worker because workers don't persist.

---

## Implementation Details

### Files

- `src/relay/planner-lead.ts` - Main service (persistent)
- `src/relay/planner-lead-tools.ts` - Tool definitions including `spawn_agent`
- `src/relay/planner-lead-prompt.ts` - System prompt
- `src/relay/conversation-history.ts` - Per-channel message history
- `src/relay/client.ts` - RelayClient wrapper with `spawnAgent()`, `releaseAgent()`

### Tools Available to PlannerLead

| Tool | Purpose |
|------|---------|
| `read_plan` | Read plan details |
| `list_plans` | List all plans |
| `add_step` | Add step to draft plan |
| `edit_step` | Modify existing step |
| `spawn_agent` | Spawn a worker agent |
| `release_agent` | Terminate a spawned agent |
| `message_agent` | Send message to another agent |
| `list_agents` | List spawned agents |

### Initialization

```typescript
// In server startup (src/index.ts)
import { initPlannerLead } from './relay/planner-lead.js';

// After storage is ready
initPlannerLead(storage);
```

This starts the persistent service that:
1. Connects to relay daemon
2. Registers message handlers
3. Announces itself in #planner
4. Listens for messages indefinitely

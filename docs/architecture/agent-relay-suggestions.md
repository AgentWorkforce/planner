# Feature Suggestions for agent-trajectories and agent-relay

**Status:** Ideas for upstream contribution
**Created:** 2026-02-05

These suggestions emerged from building multi-stage agent pipelines where upstream agents produce context that downstream agents need to understand. They would benefit any project that:

- Chains multiple agents together (ideation → planning → execution)
- Wants agents to understand "why" not just "what"
- Needs trajectory recording without subprocess overhead
- Uses spawned agents that should auto-record their work

---

## For `agent-trajectories` library

### 1. `toPromptContext()` helper on Retrospective

**Problem**: When passing trajectory context to downstream agents, everyone writes the same formatting code to convert retrospectives into prompt-friendly markdown.

**Suggestion**: Built-in helper on the Retrospective type:

```typescript
// Current: manual formatting everywhere
function formatForPrompt(retro: Retrospective, label: string): string {
  const lines = [`## Prior Context: ${label}`, '', retro.summary, ...];
  // ... everyone reimplements this
}

// Suggested: built-in
const context = trajectory.retrospective.toPromptContext({
  label: 'Prior Work',
  include: ['summary', 'approach', 'decisions', 'challenges'], // configurable
  format: 'markdown' // or 'json', 'yaml'
});
```

**Non-invasive**: Adds method to existing type, doesn't change core behavior.

**Who benefits**: Any project that chains agents and wants upstream context in downstream prompts.

### 2. AsyncStorageAdapter interface

**Problem**: FileStorage is synchronous, which limits use cases that need non-blocking writes or indexed queries.

**Suggestion**: Async variant of StorageAdapter:

```typescript
interface AsyncStorageAdapter {
  save(trajectory: Trajectory): Promise<void>;
  get(id: string): Promise<Trajectory | null>;
  search(query: string): Promise<TrajectorySummary[]>;
  list(options?: ListOptions): Promise<TrajectorySummary[]>;
}

// Enables SQLite adapter for indexed queries
class SQLiteStorage implements AsyncStorageAdapter {
  // Indexed by source.system, source.id, status, timestamps
  // Async writes, connection pooling
}
```

**Non-invasive**: New interface alongside existing one. FileStorage could implement both.

**Who benefits**: Projects with higher write frequency, projects needing queries beyond simple ID lookup.

### 3. Append-only event log mode

**Problem**: FileStorage rewrites the full JSON file on every `save()`. Fine for ~30 events/session, problematic for higher-frequency recording.

**Suggestion**: Optional append mode:

```typescript
const storage = new FileStorage({
  baseDir: '.trajectories',
  mode: 'append' // vs 'rewrite' (default)
});
```

In append mode:
- Events written as JSONL (one line per event)
- Periodic compaction to full JSON on trajectory completion
- Much better I/O for high-frequency use cases

**Non-invasive**: Optional mode, default behavior unchanged.

**Who benefits**: Projects recording many events per trajectory, real-time logging scenarios.

---

## For `agent-relay`

### 1. Add `env` parameter to SDK `spawn()`

**Problem**: `TmuxWrapper` auto-injects trajectory environment variables (`TRAJECTORIES_PROJECT`, `TRAJECTORIES_AGENT`, etc.), but the SDK's `spawn()` function doesn't expose this capability.

**Suggestion**: Add `env` parameter:

```typescript
// Current SDK
spawn({ name: 'Worker', cli: 'claude', task: '...' });

// Suggested
spawn({
  name: 'Worker',
  cli: 'claude',
  task: '...',
  env: {
    TRAJECTORIES_PROJECT: 'my-project',
    TRAJECTORIES_AGENT: 'Worker',
    CUSTOM_VAR: 'value',
  }
});
```

**Why it matters**: Enables trajectory auto-wiring for spawned agents. Currently users must inject instructions into prompt text as a workaround.

**Who benefits**: Anyone spawning agents that should record trajectories, anyone needing custom env vars in spawned processes.

### 2. Library-direct mode for TrajectoryIntegration

**Problem**: `TrajectoryIntegration` wraps the `trail` CLI via subprocess for every write. This adds latency and requires the CLI to be installed globally.

**Suggestion**: Option to use `agent-trajectories` library directly:

```typescript
const integration = new TrajectoryIntegration(projectId, agentName, {
  preferLibrary: true // Use agent-trajectories directly if available as dependency
});

// Falls back to CLI subprocess if library not installed
```

**Non-invasive**: Opt-in, maintains backward compatibility with CLI-only setups.

**Who benefits**: Projects that want trajectory recording without subprocess overhead, projects that can't install global CLIs.

### 3. Retrospective context auto-injection

**Problem**: Multi-stage pipelines commonly need to pass upstream retrospectives to downstream agents. Everyone implements this manually.

**Suggestion**: Built-in support when spawning agents:

```typescript
spawn({
  name: 'DownstreamWorker',
  cli: 'claude',
  task: '...',
  trajectory: {
    injectUpstreamContext: true,
    upstreamSource: { system: 'planning', id: planId }
  }
});

// Task prompt automatically includes:
// ## Prior Context: Planning
// [formatted retrospective content]
```

**Who benefits**: Any multi-stage agent pipeline where downstream agents need upstream context.

---

## For spawned agent architectures

These suggestions support a pattern where **persistent services become spawned Claude Code agents** — gaining full tooling (Read, Write, Bash, etc.) and automatic trajectory wiring, while custom domain tools are exposed via MCP.

### 4. MCP tool helper for custom functions

**Problem**: When agents run as spawned Claude Code processes, custom domain tools (e.g., `add_step`, `create_ticket`, `update_database`) must be exposed via MCP. This requires boilerplate.

**Suggestion**: Helper to expose TypeScript functions as MCP tools:

```typescript
import { createMCPToolServer } from '@agent-relay/mcp';

const server = createMCPToolServer({
  name: 'domain-tools',
  tools: {
    create_item: {
      description: 'Create an item in the system',
      parameters: CreateItemSchema, // Zod schema
      handler: async (params) => { /* implementation */ }
    },
    update_status: {
      description: 'Update item status',
      parameters: UpdateStatusSchema,
      handler: async (params) => { /* implementation */ }
    },
  }
});

// Spawned agent connects to this MCP server
spawn({
  name: 'DomainWorker',
  cli: 'claude',
  task: '...',
  mcp: [server.uri]
});
```

**Who benefits**: Anyone transitioning from "Anthropic SDK + custom tool handlers" to "spawned Claude Code agents + MCP tools".

### 5. Overseer pattern helper

**Problem**: A common pattern is a lightweight "overseer" that routes messages to spawned agents per session/task. Everyone reimplements session tracking, agent lifecycle, and routing.

**Suggestion**: Built-in overseer primitive:

```typescript
import { createOverseer } from '@agent-relay/overseer';

const overseer = createOverseer({
  name: 'SessionOverseer',
  channels: ['#sessions-*'],

  onMessage: async (sessionId, message) => {
    return overseer.routeToAgent(sessionId, message);
  },

  spawnAgent: async (sessionId) => {
    const context = await getSessionContext(sessionId);
    return spawn({
      name: `worker-${sessionId}`,
      cli: 'claude',
      task: buildPrompt(context),
      // Trajectory auto-wired
    });
  },

  onSessionEnd: async (sessionId) => {
    // Agent released, trajectory auto-completed
  }
});
```

**Who benefits**: Any project with session-based or task-based agent spawning patterns.

---

## Priority Summary

| Suggestion | Library | Impact | Effort | Key Benefit |
|------------|---------|--------|--------|-------------|
| `env` param in spawn() | relay | High | Low | Unlocks trajectory auto-wiring |
| `toPromptContext()` helper | trajectories | Medium | Low | Eliminates common boilerplate |
| Library-direct mode | relay | Medium | Medium | No subprocess overhead |
| AsyncStorageAdapter | trajectories | Medium | Medium | SQLite support, async writes |
| MCP tool helper | relay | High | Medium | Easy custom tool exposure |
| Retrospective auto-injection | relay | High | Medium | Built-in context chaining |
| Append-only mode | trajectories | Low | Medium | Higher-frequency recording |
| Overseer pattern | relay | High | High | Session management primitive |

**Recommendation**: The `env` parameter in `spawn()` is the single highest-ROI change — it's minimal code change with maximum benefit for trajectory integration.

---

## Use Cases These Enable

1. **Multi-stage pipelines**: Ideation → Planning → Execution where each stage's reasoning flows to the next
2. **Spawned agent fleets**: Workers that auto-record trajectories without prompt injection hacks
3. **Persistent-to-spawned migration**: Transitioning from SDK-loop agents to Claude Code agents with MCP tools
4. **Session-based systems**: Chat sessions, support tickets, or tasks where one agent handles one session
5. **High-frequency recording**: Execution monitoring, real-time logging, detailed audit trails

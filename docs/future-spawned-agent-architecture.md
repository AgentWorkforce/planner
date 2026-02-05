# Future: Spawned Agent Architecture for Persistent Services

**Status:** Idea for future consideration
**Created:** 2026-02-05
**Context:** Discussed during trajectory integration planning

## Current Architecture

PlannerLead, Interviewer, and Navigator are **persistent services** using the Anthropic SDK directly:

```
Server Process
├── RelayClient (PlannerLead)
│   └── anthropic.messages.create() loop with custom tools
├── RelayClient (Interviewer)
│   └── anthropic.messages.create() loop with custom tools
└── RelayClient (Navigator)
    └── anthropic.messages.create() loop with custom tools
```

- They listen on relay channels and respond to messages
- They maintain conversation state in-memory across messages
- Custom tool definitions (add_step, spawn_specialist, etc.) are implemented in TypeScript
- Trajectory recording requires manual instrumentation at each tool call site

## Proposed Architecture

**Hybrid model:** Lightweight persistent "overseer" + spawned Claude Code agents per session.

```
Server Process (Overseer)                    Spawned Agents (per session)
─────────────────────────                    ───────────────────────────
RelayClient listens on channels              Claude Code process via TmuxWrapper
Routes messages to correct agent             Full tooling (Read, Write, Bash, etc.)
Manages spawn/release lifecycle              Trajectory auto-wired via env vars
No Anthropic SDK calls                       Exits when session/plan completes
                                             Hooks auto-detect phases/tools/errors
```

### How It Works

1. **Ideation session starts** → Overseer spawns Interviewer agent with task prompt containing session context
2. **Messages arrive** → Overseer routes to spawned agent via relay
3. **Session completes (send-to-planner)** → Agent exits, trajectory auto-completed with retrospective
4. **Plan created** → Overseer spawns PlannerLead agent with ideation retrospective in task prompt
5. **Plan approved** → Agent exits, trajectory auto-completed

### Benefits

**Trajectory auto-wiring:**
- TmuxWrapper injects `TRAJECTORIES_PROJECT`, `TRAJECTORIES_DATA_DIR`, `TRAJECTORIES_AGENT`, `TRAIL_AUTO_PHASE`
- `createTrajectoryHooks()` provides lifecycle hooks that auto-detect:
  - PDERO phase transitions from agent output
  - Tool calls (Read, Write, Bash, etc.)
  - Errors and warnings
- `onSessionEnd` hook auto-completes trajectory with retrospective
- Zero manual instrumentation needed

**Process isolation:**
- One bad session doesn't crash the server
- Each agent runs in its own process
- Natural resource cleanup on exit

**Full Claude Code tooling:**
- Agents get Read, Write, Edit, Bash, Glob, Grep, etc.
- No need to re-implement tool handling
- MCP server access if configured

**Simpler server:**
- Overseer just routes messages and manages lifecycle
- No Anthropic SDK integration in server code
- Easier to reason about

**Natural lifecycle boundaries:**
- Session start = spawn agent
- Session end = release agent = trajectory complete
- Trajectory lifecycle matches session lifecycle perfectly

### Challenges

**Custom tools:**
- Current: `add_step`, `read_plan`, `spawn_specialist`, etc. are TypeScript functions
- Spawned model: Need to expose these via MCP server or HTTP endpoints
- Agent calls them like any other tool

**State management:**
- Current: In-memory state across messages in same session
- Spawned model: Agent naturally maintains state while alive
- But: If agent crashes mid-session, state is lost (could persist to disk)

**Upstream context injection:**
- Still need to inject ideation retrospective into PlannerLead's task prompt
- Still need to inject planning retrospective into forge worker's task prompt
- This doesn't change — just moves from "system prompt" to "task prompt"

**Rewrite scope:**
- PlannerLead, Interviewer, Navigator all need rewriting
- From "RelayClient + Anthropic SDK loop" to "Claude Code agent with custom instructions"
- Moderate effort, but touches core agent code

### Implementation Sketch

**Overseer (simplified):**
```typescript
class IdeationOverseer {
  private agents = new Map<string, SpawnedAgent>();

  async onMessage(sessionId: string, message: string) {
    let agent = this.agents.get(sessionId);
    if (!agent) {
      agent = await this.spawnInterviewer(sessionId);
      this.agents.set(sessionId, agent);
    }
    await agent.send(message);
  }

  async spawnInterviewer(sessionId: string) {
    const session = await getSession(sessionId);
    return spawn({
      name: `interviewer-${sessionId}`,
      cli: 'claude',
      task: buildInterviewerPrompt(session),
      // TmuxWrapper auto-injects trajectory env vars
    });
  }

  async onSessionComplete(sessionId: string) {
    const agent = this.agents.get(sessionId);
    if (agent) {
      await release(agent);
      this.agents.delete(sessionId);
    }
    // Trajectory auto-completed by onSessionEnd hook
  }
}
```

**Agent task prompt (Interviewer):**
```markdown
You are the Interviewer for ideation session ${sessionId}.

## Your Role
Help the user explore and clarify their idea through thoughtful questions.
Build understanding that a planner can use to create a concrete plan.

## Session Context
Initial Intent: "${initialIntent}"

## Tools Available (via MCP)
- spawn_specialist: Bring in expert perspectives
- update_understanding: Record insights for planners
- send_to_planner: Hand off to planning when ready

## Trajectory
Your work is being recorded automatically. Focus on:
- Recording key decisions with reasoning
- Noting what you learned about the user's needs
- Summarizing your approach when done

When the user is ready, use send_to_planner to complete.
```

### Decision Factors

**Favor spawned model if:**
- Trajectory auto-wiring is highly valuable (less manual instrumentation)
- Process isolation matters (stability, resource cleanup)
- We want full Claude Code tooling in agents
- We're okay with the rewrite effort

**Favor current model if:**
- Manual trajectory instrumentation is acceptable
- Current architecture is "good enough" and stable
- We want to ship faster without architectural changes
- Custom tool handling is preferable to MCP exposure

### Related Files

Current architecture:
- `packages/server/src/relay/planner-lead.ts` — PlannerLead implementation
- `packages/ideation/src/interviewer/service.ts` — Interviewer implementation
- `packages/ideation/src/navigator/service.ts` — Navigator implementation

Relay trajectory integration:
- `@agent-relay/trajectory` — TrajectoryIntegration class
- `@agent-relay/hooks` — createTrajectoryHooks()
- `@agent-relay/wrapper` — TmuxWrapper with env var injection

### Open Questions

1. Should the overseer be per-package (IdeationOverseer, PlannerOverseer) or unified?
2. How do we handle agent crashes mid-session? Persist state? Auto-restart?
3. Should custom tools be MCP servers or HTTP endpoints?
4. What's the migration path — big bang or incremental per-agent?

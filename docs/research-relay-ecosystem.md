# Research: Agent Relay Ecosystem

## Overview

The agentworkforce organization provides infrastructure for AI agent coordination. This is our transport layer.

## Repository Inventory

| Repo | Status | Purpose |
|------|--------|---------|
| `relay` | Mature | Real-time agent-to-agent messaging |
| `relay-dashboard` | Mature | Web UI for monitoring agent swarms |
| `relay-visualizer` | Active | Interactive visualization of relay |
| `trajectories` | Active | Document layer for agent reasoning |
| `planner` | **Empty** | Task planning UI (this is what we're building!) |
| `tic-tac-toe` | Demo | Proof-of-concept multi-agent game |
| `simple-swarm` | Demo | Educational examples |
| `limit` | Utility | Usage limit monitoring |

## Tech Stack

### Languages
- TypeScript: 83.4%
- Rust: 6.1% (for `relay-pty` binary)
- JavaScript: 5.4%
- Shell: 3.6%

### Runtime
- Node.js 20+
- Rust for performance-critical PTY handling

### Core Dependencies

**Server/API**:
- Express v5.2.1 (web framework)
- WebSocket (ws) v8.18.3 (real-time comms)
- HTTP-proxy-middleware v3.0.5

**Database**:
- Better-sqlite3 v12.6.2 (local storage)

**CLI/Tooling**:
- Commander v12.1.0 (CLI parsing)
- Chokidar v5.0.0 (file watching)

**Development**:
- TypeScript v5.9.3
- Vitest v2.1.9 (testing)
- ESLint + TypeScript-ESLint
- Turbo v2.3.0 (monorepo)
- Esbuild v0.27.2 (bundler)

### Build System
- npm workspaces (monorepo management)
- Turbo (task orchestration)
- Cargo (Rust compilation)

## Relay Architecture

### Core Components

```
┌─────────────────────────────────────────────────────────────┐
│                      relay-daemon                           │
│                                                             │
│  • Central coordination via Unix Domain Socket              │
│  • Message routing between agents                           │
│  • Sub-5ms P2P latency                                      │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
   ┌─────────┐          ┌─────────┐          ┌─────────┐
   │ Agent A │          │ Agent B │          │ Agent C │
   │ (PTY)   │          │ (PTY)   │          │ (PTY)   │
   └─────────┘          └─────────┘          └─────────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │   relay-pty     │
                    │   (Rust binary) │
                    │                 │
                    │ Direct PTY      │
                    │ writes ~550ms   │
                    └─────────────────┘
```

### Monorepo Packages (21 packages)

**Core**:
- `api-types` — Type definitions
- `sdk` — Developer SDK
- `protocol` — Communication protocol
- `bridge` — External integrations
- `wrapper` — Abstractions

**Infrastructure**:
- `daemon` — Background service
- `spawner` — Agent spawning
- `mcp` — Model Context Protocol
- `hooks` — Extensibility
- `policy` — Policy enforcement
- `config` — Configuration

**Data/State**:
- `memory` — In-memory handling
- `state` — State management
- `storage` — Persistence
- `trajectory` — Trajectory tracking
- `continuity` — Session recovery

**Operations**:
- `telemetry` — Monitoring
- `resiliency` — Fault tolerance
- `user-directory` — User management
- `utils` — Utilities
- `cli-tester` — Testing tools

## Agent Communication Protocol

### Message Format
```
TO: AgentName
Message content here
```

### Features

| Feature | Syntax | Purpose |
|---------|--------|---------|
| Direct message | `TO: Bob` | Send to specific agent |
| Synchronous | `->relay:Bob [await]` | Wait for response |
| Timeout | `->relay:Bob [await:30s]` | Wait with timeout |
| Broadcast | `TO: *` | Send to all agents |
| Cross-project | `TO: project:agent` | Bridge repositories |

### Environment Variables
- `AGENT_RELAY_OUTBOX` — File-based messaging directory
- Data persists in `.agent-relay/` (auto-gitignored)

## Trajectories Integration

Trajectories provide the "document layer" for agent work:

```
Layer 1: Agent-Relay      → Real-time messaging
Layer 2: Claude-Mem       → Tool observations, concepts
Layer 3: Trajectories     → Task narratives, decisions
```

A trajectory captures:
- **Chapters**: Logical work segments
- **Events**: Prompts, tool calls, decisions
- **Retrospective**: Agent reflection
- **Artifacts**: Links to commits/files

## Dashboard Architecture

Three operation modes:

| Mode | Description | Port |
|------|-------------|------|
| Full | Direct integration, spawns agents | 3888 |
| Proxy | Forwards to separate daemon | 3889 |
| Mock | Standalone with fixture data | any |

Tech stack:
- Next.js frontend (React)
- Express server backend
- WebSocket for real-time updates

## Integration Patterns for Planner

### Option A: HTTP-Only (Simple)

Planner is standalone HTTP service:
```
Orchestrator ──HTTP GET──► Planner (fetch plans)
Orchestrator ──HTTP POST──► Planner (change requests)
```

Relay handles agent-to-agent only.

### Option B: Relay Participant

Planner joins as a relay agent:
```
PlannerAgent ←──relay──→ OrchestratorAgent
PlannerAgent ←──relay──→ ImplementationAgents
```

Enables:
- Planning team collaboration
- Handoff "meetings"
- Oversight during execution

### Option C: Hybrid

- HTTP APIs for Orchestrator integration
- Relay for optional planning agent features
- Best of both worlds

## Alignment with Relay Tech Stack

For consistency with the ecosystem, Planner should use:

| Concern | Choice | Rationale |
|---------|--------|-----------|
| Language | TypeScript | Matches relay |
| Runtime | Node.js 20+ | Matches relay |
| Database | SQLite (better-sqlite3) | Matches relay storage |
| API | Express | Matches relay |
| Testing | Vitest | Matches relay |
| Build | Turbo + esbuild | Matches relay |
| Monorepo | npm workspaces | Matches relay |

## What Relay Does NOT Provide

Critical gaps that Planner/Orchestrator must fill:

1. **Planning structure** — Relay is transport, not semantics
2. **Workflow logic** — No state machines, no sequencing rules
3. **Approval workflows** — No human-in-the-loop primitives
4. **Versioning** — Messages are ephemeral, not versioned artifacts
5. **Orchestration patterns** — No built-in hierarchical/peer/supervisor

This confirms the architecture: **Relay is transport layer, Planner/Orchestrator add structure and semantics.**

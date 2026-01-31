# planner-core

Structured intent authoring for agentic systems. Plans before execution, not during.

## Install

```bash
npm install
```

**Requirements:** Node.js 20+

## Quick Start

```bash
# Start everything (daemon + backend + frontend)
npm run dev

# Or run components separately
npm run dev:backend   # API server on :3000
npm run dev:frontend  # UI on :5173
```

Then open http://localhost:5173 to create your first plan.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              INTAKE                                     │
│         Monitors channels • Detects requests • Routes to Planner        │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         PLANNER (this repo)                             │
│                                                                         │
│  • Accepts any expression of intent (vague idea → detailed spec)        │
│  • AI helps brainstorm, refine, and scope                               │
│  • Produces versioned, multi-scope PlanVersions                         │
│  • Manages approval workflow (draft → approved → published)             │
│  • Outputs immutable plan_ref for Orchestrator consumption              │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ plan_ref (approved JSON)
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           ORCHESTRATOR                                  │
│     Fetches plan_ref • Compiles into Run • Dispatches to agents         │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        AGENT RELAY (transport)                          │
│          Real-time agent messaging • ~5ms latency • Any CLI             │
└─────────────────────────────────────────────────────────────────────────┘
```

## What Planner Does

| Capability | Description |
|------------|-------------|
| **Accept any intent** | From vague ideas ("improve UX") to detailed specs |
| **Refine and scope** | AI helps brainstorm, clarify, and structure |
| **Multi-scope plans** | Real work crosses repos/teams/domains |
| **Infer dependencies** | AI builds the DAG from step descriptions |
| **Version everything** | Every change produces a new version with diffs |
| **Approval workflow** | Approve to lock; approved versions are immutable |
| **Publish** | Export plan artifacts and return stable `plan_ref` |

## What Planner Does NOT Do

- No execution of plan steps
- No retries/timeouts/concurrency management
- No scheduling or resource allocation
- No mutation of approved versions

**Planner spawns agents for planning. Orchestrator spawns agents for execution.**

## API Reference

| Endpoint | Description |
|----------|-------------|
| `GET /api/plans` | List all plans |
| `POST /api/plans` | Create new plan |
| `GET /api/plans/:id` | Get plan with latest version |
| `GET /api/plans/:id/versions/:v` | Get specific version |
| `POST /api/plans/:id/versions` | Create new version |
| `PATCH /api/plans/:id/versions/:v` | Update version (draft only) |
| `POST /api/plans/:id/versions/:v/approve` | Lock version |
| `POST /api/plans/:id/versions/:v/publish` | Release to orchestrator |
| `GET /api/initiatives` | List initiatives |
| `POST /api/initiatives` | Create initiative |

## Plan Lifecycle

```
┌─────────────────────────────────────────────────────────────────────┐
│                            DRAFT                                    │
│  ┌─────────────────────┐         ┌─────────────────────────────┐   │
│  │   working           │────────▶│   submitted                 │   │
│  │   (editing)         │ submit  │   (ready for review)        │   │
│  └─────────────────────┘         └─────────────────────────────┘   │
│                                             │                       │
│  AI works continuously in both states       │                       │
└─────────────────────────────────────────────┼───────────────────────┘
                                              │ approve
                                              ▼
                                      ┌───────────────┐
                                      │   APPROVED    │ (locked)
                                      └───────┬───────┘
                                              │ publish
                                              ▼
                                      ┌───────────────┐
                                      │   PUBLISHED   │ (executing)
                                      └───────────────┘
```

**Key invariant:** Approved/published versions are immutable. Any change creates a new version.

## Project Structure

```
planner-core/
├── src/
│   ├── api/           # HTTP endpoints
│   ├── domain/        # Core entities (Plan, Step, Version)
│   ├── storage/       # SQLite persistence
│   ├── relay/         # Agent messaging integration
│   ├── events/        # SSE for real-time updates
│   └── server.ts      # Express server
│
├── packages/
│   └── planner-ui/    # React frontend
│       ├── src/
│       │   ├── components/  # UI components
│       │   ├── hooks/       # Custom React hooks
│       │   ├── lib/         # API client
│       │   └── pages/       # Route views
│       └── ...
│
└── docs/              # Architecture docs
```

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Type checking
npm run typecheck

# Build
npm run build
```

### Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start daemon + backend + frontend |
| `npm run dev:stop` | Stop all dev processes |
| `npm run dev:status` | Check what's running |
| `npm run dev:backend` | Backend only (hot reload) |
| `npm run dev:frontend` | Frontend only (Vite) |
| `npm test` | Run all tests |
| `npm run test:backend` | Backend tests only |
| `npm run test:ui` | Frontend tests only |

## Technology Stack

| Concern | Choice |
|---------|--------|
| Language | TypeScript |
| Runtime | Node.js 20+ |
| Database | SQLite (better-sqlite3) |
| Backend | Express |
| Frontend | React + Vite + Tailwind |
| Validation | Zod |
| Testing | Vitest |
| Messaging | agent-relay SDK |

## Philosophy

**Do one thing well**: Structure intent into actionable plans.

planner-core is a planning layer, not an execution engine. It integrates with:
- Any orchestration system (your own, Temporal, external)
- Any agent runtime (Claude, Codex, Gemini, custom)
- Any messaging layer (agent-relay recommended)

```
┌──────────────────────────────────────────┐
│         Your Agentic System              │
├──────────────────────────────────────────┤
│    Memory    │    UI/Dashboard           │
│    (any)     │       (any)               │
├──────────────────────────────────────────┤
│              planner                     │
│       Structured intent authoring        │
├──────────────────────────────────────────┤
│           Orchestrator                   │
│         Plan execution engine            │
├──────────────────────────────────────────┤
│           agent-relay                    │
│        Real-time agent messaging         │
├──────────────────────────────────────────┤
│  Claude  │  Codex  │  Gemini  │  Custom  │
└──────────────────────────────────────────┘
```

## Related Projects

| Project | Purpose |
|---------|---------|
| [agent-relay](https://github.com/AgentWorkforce/relay) | Real-time agent messaging |
| [relay-dashboard](https://github.com/AgentWorkforce/relay-dashboard) | Agent monitoring UI |
| [trajectories](https://github.com/AgentWorkforce/trajectories) | Agent reasoning capture |

## License

Apache-2.0 - Copyright 2025 Agent Workforce Incorporated

---

**Links:** [Documentation](./docs) | [Issues](https://github.com/jahala/plannr/issues)

# plannr

Agentic planning and execution platform. From brainstorming to structured plans to automated execution.

## Install

```bash
npm install
```

**Prerequisites:**
- Node.js 20+
- agent-relay CLI (optional): `npm install -g @agent-relay/cli`

## Quick Start

```bash
# Start all services (daemon + backend + all UIs)
npm run dev

# Or run components separately
npm run dev:backend   # API server on :3001
npm run dev:frontend  # Planner UI on :3000
```

**Service URLs:**
- Planner UI: http://localhost:3000
- Ideation UI: http://localhost:3002
- Forge UI: http://localhost:3003
- API Server: http://localhost:3001

### Configuration

```bash
# Optional: Enable AI features (planning agent, chat, brainstorming)
export ANTHROPIC_API_KEY=sk-ant-...
```

Without the API key, the app runs in mock mode - all features work, but AI responses are simulated.

**On first run**, the database is automatically seeded with the "Planner v1" initiative - the actual plans used to build the Planner itself (~70 plans covering domain model, REST API, UI components, and relay integration). This gives you real content to explore immediately.

To re-seed or update after changes to `docs/flow/`:

```bash
npx tsx scripts/migrate-flow-to-db.ts
```

## Architecture

Plannr is a full-stack platform implementing multiple layers of the agentic workflow:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          THIS REPO (plannr)                             │
│                                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ Ideation │  │ Planner  │  │  Forge   │  │  Tuner   │              │
│  │          │  │          │  │          │  │          │              │
│  │ Refine & │  │ Author & │  │ Execute  │  │ Adaptive │              │
│  │ brainstorm│ │ version  │  │ plans    │  │ learning │              │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘              │
└─────────────────────────────────────────────────────────────────────────┘
```

Each layer maintains single responsibility while integrating seamlessly:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              INTAKE                                     │
│         Monitors channels • Detects requests • Routes to Planner        │
│                         (future external service)                       │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                            IDEATION                                     │
│                                                                         │
│  • Brainstorming sessions with AI                                      │
│  • Requirement refinement through conversation                         │
│  • Outputs structured intent ready for planning                        │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                            PLANNER                                      │
│                                                                         │
│  • Accepts any expression of intent (vague idea → detailed spec)        │
│  • AI helps structure and scope                                        │
│  • Produces versioned, multi-scope PlanVersions                         │
│  • Manages approval workflow (draft → approved → published)             │
│  • Outputs immutable plan_ref for execution                             │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ plan_ref (approved JSON)
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         FORGE (Orchestrator)                            │
│                                                                         │
│  • Fetches approved PlanVersion by plan_ref                             │
│  • Compiles into executable Run (state machine + agent slots)           │
│  • Dispatches steps to agents via role mapping                          │
│  • Verifies acceptance criteria, handles retries/failures               │
│  • Sends ChangeRequests back to Planner when changes needed             │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        AGENT RELAY (transport)                          │
│          Real-time agent messaging • ~5ms latency • Any CLI             │
│                  https://github.com/agentworkforce/relay                │
└─────────────────────────────────────────────────────────────────────────┘
```

## Project Structure

```
plannr/
├── packages/
│   ├── server/         # Meta-server (mounts all services)
│   ├── planner/        # Plan authoring & versioning
│   ├── ideation/       # Brainstorming & requirement refinement
│   ├── forge-core/     # Plan execution engine
│   ├── tuner/          # Adaptive learning & model selection
│   ├── testbench/      # End-to-end pipeline testing
│   ├── planner-ui/     # Plan authoring UI
│   ├── ideation-ui/    # Brainstorming sessions UI
│   ├── forge-ui/       # Execution monitoring UI
│   ├── shared-ui/      # Design system & shared components
│   ├── storage-base/   # SQLite storage abstraction
│   └── errors/         # Centralized error types
├── scripts/            # Dev tooling (dev.sh, migrations)
└── docs/               # Architecture & flow docs
```

## Services & Ports

| Service | Port | Package |
|---------|------|---------|
| API Server | 3001 | server |
| Planner UI | 3000 | planner-ui |
| Ideation UI | 3002 | ideation-ui |
| Forge UI | 3003 | forge-ui |
| Tuner | 4002 | tuner |

## What Planner Does

The Planner domain within plannr provides structured intent authoring:

| Capability | Description |
|------------|-------------|
| **Accept any intent** | From vague ideas ("improve UX") to detailed specs |
| **Refine and scope** | AI helps brainstorm, clarify, and structure |
| **Multi-scope plans** | Real work crosses repos/teams/domains |
| **Infer dependencies** | AI builds the DAG from step descriptions |
| **Version everything** | Every change produces a new version with diffs |
| **Approval workflow** | Approve to lock; approved versions are immutable |
| **Publish** | Export plan artifacts and return stable `plan_ref` |

## Domain Separation

Each domain has a single responsibility:

**Ideation**: Brainstorming and requirement refinement. No plan execution.

**Planner**: Plan authoring and versioning. No execution, no requirement capture.

**Forge**: Plan execution and agent orchestration. No planning, no mutation of approved plans.

**Tuner**: Adaptive learning and model selection. Observes outcomes, adjusts configurations.

This separation enables:
- Plans to be reviewed before execution
- Clear audit trail of intent vs. execution
- Multiple orchestration strategies with the same plan format

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

## API Reference

The API server exposes endpoints across all domains:

### Planner API (`/api/plans/*`)

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

### Ideation API (`/api/ideation/sessions/*`)

Endpoints for managing brainstorming sessions, messages, and conversation history.

### Forge API (`/api/forge/runs/*`)

Endpoints for plan execution, run status, agent coordination, and acceptance criteria verification.

See individual package READMEs for detailed API documentation.

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
| `npm run dev` | Start all services |
| `npm run dev:stop` | Stop all services |
| `npm run dev:status` | Check what's running |
| `npm run dev:backend` | Backend only (hot reload) |
| `npm run dev:frontend` | Planner UI only |
| `npm test` | Run all tests |
| `npm run test:backend` | Backend tests only |
| `npm run test:ui` | Frontend tests only |
| `npm run typecheck` | TypeScript checking |

## Technology Stack

| Concern | Choice |
|---------|--------|
| Language | TypeScript |
| Runtime | Node.js 20+ |
| Database | SQLite (better-sqlite3) |
| Backend | Express 5 |
| Frontend | React 18 + Vite + Tailwind v4 |
| Validation | Zod |
| Testing | Vitest + Playwright |
| AI | Anthropic SDK |
| Messaging | agent-relay SDK |

## Philosophy

**Structured intent before execution.** Plannr embodies the principle that agentic systems benefit from explicit planning phases rather than ad-hoc execution.

Each domain does one thing well:
- **Ideation** refines requirements through conversation
- **Planner** structures intent into actionable plans
- **Forge** executes those plans with agents
- **Tuner** learns from outcomes to improve future performance

The platform integrates with:
- Any agent runtime (Claude, Codex, Gemini, custom)
- Any messaging layer (agent-relay recommended)
- External orchestrators via published plan artifacts

## Related Projects

| Project | Purpose |
|---------|---------|
| [agent-relay](https://github.com/AgentWorkforce/relay) | Real-time agent messaging |
| [relay-dashboard](https://github.com/AgentWorkforce/relay-dashboard) | Agent monitoring UI |
| [trajectories](https://github.com/AgentWorkforce/trajectories) | Agent reasoning capture |

## License

Apache-2.0 - Copyright 2025 Agent Workforce Incorporated

---

**Links:** [Documentation](./docs) | [Issues](https://github.com/AgentWorkforce/planner/issues)

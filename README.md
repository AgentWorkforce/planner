# plannr

Agentic planning and execution platform. From signal intake to brainstorming to structured plans to automated execution — with knowledge extraction at every stage.

## Install

```bash
npm install
```

**Prerequisites:**
- Node.js 20+
- Redis (required for Cultivate job queues — other services work without it)
- agent-relay CLI (optional): `npm install -g @agent-relay/cli`

## Quick Start

```bash
# Start all services (relay daemon + backend + UIs)
./scripts/dev.sh start

# Or run just the essentials
npm run start -w server    # API server on :3001
npm run dev -w @plannr/tend # Unified UI on :3004
```

**Tend** is the primary workspace UI at http://localhost:3004 — it provides unified access to all domains (planner, ideation, forge, cultivate) in a single AI-native interface.

### Configuration

Copy `.env.example` to `.env` and fill in values:

```bash
# Required for AI features
ANTHROPIC_API_KEY=sk-ant-...

# Required for Cultivate signal pipeline
CULTIVATE_REDIS_URL=redis://localhost:6379
```

Without the API key, the app runs in mock mode — all features work, but AI responses are simulated.

**On first run**, the database is automatically seeded with the "Planner v1" initiative — the actual plans used to build the Planner itself (~70 plans covering domain model, REST API, UI components, and relay integration). This gives you real content to explore immediately.

## Architecture

Plannr is a full-stack platform with six backend domains and a unified frontend:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          THIS REPO (plannr)                             │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                     Tend (unified UI)                             │   │
│  │     AI-native workspace — single entry point for all domains     │   │
│  │     Planner views · Ideation views · Forge views · Cultivate     │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                  │
│  │Cultivate │ │ Ideation │ │ Planner  │ │  Forge   │                  │
│  │          │ │          │ │          │ │          │                  │
│  │ Signal   │ │ Refine & │ │ Author & │ │ Execute  │                  │
│  │ intake   │ │brainstorm│ │ version  │ │ plans    │                  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘                  │
│                                                                         │
│  ┌──────────┐ ┌──────────┐                                             │
│  │   Mull   │ │  Tuner   │  Orthogonal layers —                        │
│  │Knowledge │ │ Adaptive │  operate across all domains                  │
│  │extraction│ │ learning │                                              │
│  └──────────┘ └──────────┘                                             │
└─────────────────────────────────────────────────────────────────────────┘
```

### Domain Pipeline

```
CULTIVATE ──signals──▶ IDEATION ──refined intent──▶ PLANNER ──plan_ref──▶ FORGE ──agents──▶ RELAY
                                                                              │
                                                                    MULL ◀────┘ (extracts knowledge
                                                                                 from any session)
```

**Cultivate** (WIP) watches external channels (APIs, webhooks, RSS, social media), applies three-tier filtering (keywords → rules → ML → LLM extraction), scores signals with 8 factors, and clusters them using grounded theory. 30+ source presets across 5 authority tiers.

**Ideation** hosts brainstorming sessions with AI specialist agents. Refines vague requirements through structured conversation into intent ready for planning.

**Planner** accepts any expression of intent — from a vague idea to a detailed spec — and produces versioned, multi-scope PlanVersions with DAG dependencies, acceptance criteria, and approval workflows. Approved versions are immutable.

**Forge** fetches approved plans, compiles them into executable Runs (state machine + agent slots), dispatches steps to agents via relay, verifies acceptance criteria, and handles retries and failures. Sends ChangeRequests back to Planner when structural changes are needed.

**Mull** extracts knowledge from completed sessions — decisions, patterns, constraints, gotchas — into structured topic files. Two-stage pipeline: deterministic NLP extraction (compromise.js) followed by LLM synthesis (Haiku). Runs as CLI tool or server plugin.

**Tuner** observes outcomes across all domains and adjusts scoring weights, filter rules, and model selection to improve future performance.

### Tend (Unified UI)

Tend replaces the standalone per-domain UIs with a single AI-native workspace. It provides views for all domains — plan authoring, brainstorming sessions, execution monitoring, and signal management — with shared navigation, command palette (Cmd+K), and consistent design language.

Standalone UIs (`planner-ui`, `forge-ui`) still exist for development but Tend is the primary interface.

## Project Structure

```
plannr/
├── packages/
│   ├── server/         # Meta-server (mounts all domain plugins)
│   ├── planner/        # Plan authoring & versioning
│   ├── ideation/       # Brainstorming & requirement refinement
│   ├── forge-core/     # Plan execution engine
│   ├── cultivate/      # Signal intake pipeline (WIP)
│   ├── mull/           # Knowledge extraction pipeline
│   ├── tuner/          # Adaptive learning & model selection
│   ├── testbench/      # End-to-end pipeline testing
│   ├── tend/           # Unified workspace UI (primary)
│   ├── planner-ui/     # Plan authoring UI (standalone, legacy)
│   ├── forge-ui/       # Execution monitoring UI (standalone, legacy)
│   ├── shared-ui/      # Design system & shared components
│   ├── storage-base/   # SQLite storage abstraction
│   └── errors/         # Centralized error types
├── scripts/            # Dev tooling (dev.sh, migrations)
└── docs/               # Architecture & flow docs
```

## Services & Ports

| Service | Port | Package | Notes |
|---------|------|---------|-------|
| API Server | 3001 | server | Backend for all domains |
| Tend | 3004 | tend | Primary UI |
| Planner UI | 3000 | planner-ui | Standalone (legacy) |
| Forge UI | 3003 | forge-ui | Standalone (legacy) |
| Tuner | 4002 | tuner | Adaptive learning service |

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

Endpoints for plan execution, run management, agent coordination, gate approvals, and acceptance criteria verification.

### Cultivate API (`/api/cultivate/*`) — WIP

Endpoints for greenhouses, signals, clusters, sources, presets, document ingestion, recommendations, filter rules, and SSE event streaming.

### Mull API (`/api/mull/*`)

Endpoints for triggering knowledge extraction runs, checking memory status, and reading topic files.

## Development

```bash
# Install dependencies
npm install

# Start everything
./scripts/dev.sh start

# Stop everything
./scripts/dev.sh stop

# Individual services
./scripts/dev.sh backend start    # API server only
./scripts/dev.sh tend start       # Tend UI only
./scripts/dev.sh tuner start      # Tuner service only

# Run tests
npm test

# Type checking
npm run typecheck
```

### Mull CLI

Mull can also run standalone from the command line:

```bash
# Process a single session
npx tsx packages/mull/src/cli.ts <session-id>

# Process all unprocessed sessions
npx tsx packages/mull/src/cli.ts --all

# Dry run (extract without writing)
npx tsx packages/mull/src/cli.ts --all --dry-run
```

## Technology Stack

| Concern | Choice |
|---------|--------|
| Language | TypeScript |
| Runtime | Node.js 20+ |
| Database | SQLite (better-sqlite3) |
| Job Queue | BullMQ + Redis (Cultivate) |
| Backend | Express 5 |
| Frontend | React 18 + Vite + Tailwind v4 |
| Design System | Radix UI + shadcn/ui + cva |
| Validation | Zod |
| Testing | Vitest + Playwright |
| AI | Anthropic SDK (Claude) |
| Local ML | Transformers.js (Cultivate classification) |
| NLP | compromise.js (Mull extraction) |
| Messaging | agent-relay SDK |

## Philosophy

**Structured intent before execution.** Plannr embodies the principle that agentic systems benefit from explicit planning phases rather than ad-hoc execution.

Each domain does one thing well:
- **Cultivate** gathers signals from the outside world
- **Ideation** refines requirements through conversation
- **Planner** structures intent into actionable plans
- **Forge** executes those plans with agents
- **Mull** extracts knowledge from every interaction
- **Tuner** learns from outcomes to improve future performance
- **Tend** provides a unified interface across all domains

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

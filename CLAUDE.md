# Planner Core

## General Rules

Before asking questions about the codebase, ALWAYS investigate by reading relevant files first. Do not ask the user questions you could answer by grepping or reading code. The user expects you to be self-sufficient in exploration.

## Code Standards

This project uses TypeScript as the primary language. All new code should be TypeScript. When editing existing files, check for shared components (e.g., shared-ui) before creating new ones. Always check imports resolve correctly.

## UI Development

When making changes, NEVER use Playwright/browser automation for small UI tweaks. Make the code change directly and let the user verify visually. Only use browser automation when explicitly asked to test end-to-end flows.

## Git Workflow

When working with git: always confirm the correct branch and remote (origin vs upstream) before pushing. Never assume which branch to push to — verify with the user or check the current branch context.

Do NOT take shortcuts during merges or file operations. Never skip files, stub out content, or use lazy approaches that could cause data loss. When restoring or merging files, verify completeness before reporting done.

## Debugging

When debugging issues, identify and fix the ROOT CAUSE — do not apply band-aid fixes, XML stripping hacks, or workarounds. If you don't understand the architecture, read the code until you do before proposing a fix.

## What This Is

This repository implements the **Planner** layer of a three-tier agentic architecture:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              INTAKE                                     │
│                                                                         │
│  • Monitors channels (Slack, email, GitHub) for requests                │
│  • Detects "this looks like a request" vs. noise                        │
│  • Routes to Planner                                                    │
│                                                                         │
│  Does NOT: help brainstorm, refine scope, or structure plans            │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         PLANNER (this repo)                             │
│                                                                         │
│  • Accepts any expression of intent (vague idea to detailed spec)       │
│  • AI helps brainstorm, refine, and scope                               │
│  • Produces versioned, multi-scope PlanVersions                         │
│  • Manages approval workflow (draft → approved → published)             │
│  • Outputs immutable plan_ref for Orchestrator consumption              │
│                                                                         │
│  Does NOT: spawn agents, send tasks, retry, schedule, monitor channels  │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ plan_ref (approved JSON)
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           ORCHESTRATOR                                  │
│                                                                         │
│  • Fetches approved PlanVersion by plan_ref                             │
│  • Compiles into executable Run (state machine + agent slots)           │
│  • Dispatches steps to agents via role mapping                          │
│  • Verifies acceptance criteria, handles retries/failures               │
│  • Sends ChangeRequests back to Planner when structural changes needed  │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      AGENT RELAY (transport layer)                      │
│                                                                         │
│  • Real-time agent-to-agent messaging (~5ms latency)                    │
│  • Agent spawning via pseudo-terminals (claude --dangerously-skip...)   │
│  • Playback/continuation of agent reasoning                             │
│  • Channels, broadcast, consensus primitives                            │
│                                                                         │
│  Source: https://github.com/agentworkforce/relay                        │
└─────────────────────────────────────────────────────────────────────────┘
```

## The Bigger Picture

This Planner integrates with the **agentworkforce** ecosystem:

| Component | Status | Purpose |
|-----------|--------|---------|
| `relay` | Mature | Messaging layer between agents |
| `relay-dashboard` | Mature | UI for monitoring agent swarms |
| `trajectories` | Active | Document layer capturing agent reasoning |
| `planner` | **Empty (this is it)** | Plan authoring & versioning |
| Orchestrator | TBD | Plan execution engine |

The relay is the transport, but it's "just messaging" — it doesn't impose orchestration patterns. The Planner provides the **structured intent** (what should happen), and the Orchestrator provides the **execution engine** (making it happen using relay as transport).

## Core Concepts

### PlanVersion (what Planner produces)

```typescript
interface PlanVersion {
  plan_id: string;
  version: number;  // monotonic within plan
  status: 'draft' | 'approved' | 'published';

  summary: { goal: string; context?: string; };

  steps: Step[];  // DAG of work items

  metadata?: Record<string, unknown>;

  // Timestamps
  created_at: string;
  updated_at: string;
}

interface Step {
  step_id: string;  // stable within version
  title: string;

  // AI-inferred from step descriptions and context (displayed, rarely edited)
  dependencies: string[];

  // Scope context (which repo/team/domain)
  scope?: string;

  // What humans care about
  description?: string;
  owner_role?: string;  // e.g., "backend:Coder" - NOT a specific agent
  acceptance_criteria?: AcceptanceCriterion[];
  gate?: {
    type: 'human_approval';
    approver_role?: string;
  };

  // For nested complexity
  sub_plan_id?: string;  // Reference to another PlanVersion
}

interface AcceptanceCriterion {
  id: string;
  description: string;
  type?: string;  // 'test', 'review', 'metric', etc.
}
```

### Plan Lifecycle

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

**Three states + submitted flag**:
- `draft` = editable (working or submitted for Portfolio review)
- `approved` = locked, immutable
- `published` = released to orchestrator

**Submit vs Approve**:
- **Submit**: Coordination signal to Portfolio/reviewers ("ready for review")
- **Approve**: Accountability checkpoint ("I sign off") - locks the plan

**Key invariant:** Approved/published versions are immutable. Any change creates a new version.

### Versioning & Diffs

- Every meaningful change produces a new version
- Diffs are structural (step added/removed/modified), not just text
- Field-level change tracking for steps
- Dependencies edge changes tracked
- Support for RFC 6902-style patches

## What Planner Does

1. **Accept any intent**: From vague ideas ("improve UX") to detailed specs
2. **Refine and scope**: AI helps brainstorm, clarify, and structure through conversation
3. **Create multi-scope plans**: Real work crosses repos/teams/domains—this is the default
4. **Infer dependencies**: AI builds the DAG from step descriptions, humans express intent
5. **Version everything**: Every meaningful change produces a new version with diffs
6. **Approval workflow**: Approve to lock; approved versions are immutable
7. **Publish**: Export plan artifacts (JSON canonical + Markdown render) and return stable `plan_ref`
8. **Optional run overlay**: Show execution status per step if Orchestrator provides it (read-only)

## What Planner Does NOT Do

- No spawning agents
- No sending tasks to agents
- No retries/timeouts/concurrency management
- No scheduling or resource allocation
- No "run engine"
- No portfolio governance logic (that's a separate concern)
- No mutation of approved versions
- No monitoring channels for requests (that's Intake)

## Integration Points

### Orchestrator → Planner (fetch plans)

```
GET /plans/{plan_id}                          # latest plan
GET /plans/{plan_id}/versions/{version}       # specific version
POST /plans/{plan_id}/versions/{version}/publish  # publish for execution
```

### Orchestrator → Planner (feedback loop)

```
POST /runs/{run_id}/change-requests           # structural change needed
```

When Orchestrator discovers the plan is inadequate (missing steps, wrong dependencies), it creates a ChangeRequest. This triggers a new PlanVersion draft, NOT mutation of the approved version.

### Relay Integration (optional)

Planner can use relay for:
- Planning team collaboration (multiple planning agents)
- Handoff "meetings" with implementation agents
- Planner agent sitting in on execution to oversee

But Planner itself doesn't require relay — it can be a standalone HTTP service.

## Design Principles

### 1. Do One Thing Well

Planner plans. It doesn't execute. This separation enables:
- Plans to be reviewed before execution
- Multiple orchestration strategies with the same plan format
- Clear audit trail of intent vs. execution

### 2. Immutability After Approval

Once approved, a PlanVersion cannot change. This ensures:
- Orchestrator always executes what was approved
- Audit trail integrity
- No "moving target" during execution

### 3. Structured Over Freeform

Plans have schema. Steps have IDs. Dependencies are explicit. This enables:
- Automated validation
- Meaningful diffs
- Machine-readable handoff to Orchestrator

### 4. Human-in-the-Loop by Default

Gates and approval workflows are first-class. The system assumes:
- Not everything should auto-advance
- Humans need visibility into agent decisions
- Some steps require explicit sign-off

## Technology Decisions

Based on ecosystem analysis (matching relay stack):

| Concern | Choice | Rationale |
|---------|--------|-----------|
| Language | TypeScript | Matches relay (83.4% TS) |
| Runtime | Node.js 20+ | Matches relay |
| Database | SQLite (better-sqlite3) | Matches relay storage, start simple |
| API | Express + REST | Matches relay server |
| Schema | Zod | Type-safe validation |
| Testing | Vitest | Matches relay |
| Build | Turbo + esbuild | Matches relay monorepo |

## The Bootstrap Flow

**Who spawns the first agent?** Non-agent infrastructure.

```
1. Human creates goal (via UI, CLI, API)
         │
2. [Intake captures - future service]
         │
3. Planner produces PlanVersion
         │
4. Human reviews and approves
         │
5. Planner publishes → plan_ref
         │
6. Orchestrator fetches plan_ref
         │
7. Orchestrator spawns agent(s) via Relay
         │
8. Agents execute, communicate via Relay
```

## Multi-Scope Plans (The Default)

Real work crosses boundaries. A feature typically touches multiple repos, teams, or domains. Multi-scope plans are the norm, not the exception.

```
"Add user authentication"
├── api-service (scope)
│   ├── Add OAuth endpoints
│   └── Add session middleware
├── web-frontend (scope)
│   ├── Add login page
│   └── Add protected routes
└── infrastructure (scope)
    └── Add OAuth secrets
```

**Scopes** group steps by context (repo, team, domain). The AI:
1. Identifies which scopes are affected by the goal
2. Generates steps per scope
3. Infers dependencies across scopes

For nested complexity, steps can reference **sub-plans** (another PlanVersion).

See [docs/planner-scale.md](./docs/planner-scale.md) for details on:
- Multi-scope plan structure
- Hierarchical navigation (zoom levels, breadcrumbs)
- Approval flow at scale (bottom-up, top-down, phased)
- Progress rollup from sub-plans to parent

**Recommended limits**:
- 15-20 steps per scope (cognitive manageability)
- 3 levels max hierarchy depth (practical navigation)

## HTN/PDDL Strategy

**Key insight**: Formalism should be hidden from users by default.

### Phase 1: Pragmatic (MVP)
- Steps + explicit dependencies (user writes DAG)
- Acceptance criteria (natural language)
- No formalism visible

### Phase 2: Decomposition (built-in)
- Compound steps that expand to sub-plans
- Hierarchical navigation for large projects
- See "Handling Scale" above

### Phase 3: Verification (optional)
- Preconditions/effects for validation
- Gap detection ("no step produces X that Y needs")
- For critical workflows only

## Orchestrator-Agnostic Design

**Requirement**: Planner works with "any" orchestrator.

The **plan format is the contract**. Different orchestrators can:
- Interpret steps differently
- Use different parallelization strategies
- Have different retry policies
- Map roles to agents differently

But they all consume the same PlanVersion format.

## Open Questions

1. **Planning agents**: Should Planner itself use agents (via Relay) to create plans? Or just call LLMs directly?

2. **Run overlay**: Is showing execution status a v1 requirement, or can we defer?

3. **Versioning granularity**: Every save = version? Or only meaningful changes?

4. **Approval rigidity**: Strict state machine (draft→review→approved→published) or flexible transitions?

## File Structure (planned)

```
src/
├── domain/           # Core entities (Plan, Step, Version)
│   ├── plan.ts
│   ├── step.ts
│   └── version.ts
├── storage/          # Persistence adapters
│   ├── interface.ts
│   └── sqlite.ts     # Start simple
├── api/              # HTTP endpoints
│   ├── routes.ts
│   └── handlers/
├── diff/             # Versioning and diff logic
│   ├── compute.ts
│   └── apply.ts
├── validation/       # Schema validation
│   └── schemas.ts
└── index.ts

# Optional future packages:
packages/
├── planner-core/     # This - domain + storage + API
├── planner-ui/       # React components (if needed)
└── planner-relay/    # Relay integration adapter
```

## Development Workflow (Flow System)

**Use `/flow` for all planning and implementation work in this repo.** The flow system provides structured feature lifecycle management that aligns with this project's philosophy.

| Command | When to Use |
|---------|-------------|
| `/flow` | Show status, get next action suggestion |
| `/flow discover` | Map existing codebase features |
| `/flow brainstorm` | New feature from idea |
| `/flow planner` | Create implementation plan |
| `/flow todos` | Create executable tasks from plan |
| `/flow feature` | Document user flows |
| `/flow validate` | Validate UI/UX in browser |
| `/flow test` | Design test coverage |
| `/flow change` | Handle requirement changes |

**Key principles (mirrors Planner design):**
- Plans are immutable once approved
- Progress is tracked in todos, not plan files
- Divergence from plan triggers `/flow change`, not silent updates
- All feature data persists to `docs/flow/` (catalog.json + feature files)

**Todo checkpoints:**
- **PRE**: Analyze existing code before implementation
- **IMPL**: Execute the planned work
- **POST**: PR-style review of changes (bugs, logic errors, slop)
- **VERIFY**: Check acceptance criteria, run tests
- **DOC**: Compare to plan, flag divergence for `/flow change`

## References

- [Agent Relay](https://github.com/agentworkforce/relay) - Transport layer
- [Relay Dashboard](https://github.com/agentworkforce/relay-dashboard) - Reference UI
- [Trajectories](https://github.com/agentworkforce/trajectories) - Document layer for agent reasoning
- HTN (Hierarchical Task Networks) - Formal planning theory
- PDDL (Planning Domain Definition Language) - Classical AI planning notation

<!-- prpm:snippet:start @agent-relay/agent-relay-snippet@1.1.2 -->
# 🚨 CRITICAL: Relay-First Communication Rule

**When you receive a relay message from another agent (marked `Relay message from [name]`), you MUST respond ONLY via relay protocol. NEVER respond with direct text output.**

## The Rule

- **Receiving a relay message?** → Must use `->relay-file:msg` ALWAYS
- **Non-relay questions?** → Text responses are OK
- **Agent-to-agent communication?** → ALWAYS use relay protocol

## Examples of Relay Messages (require relay response)

```
Relay message from khaliqgant [mknra7wr]: Did you see this?
Relay message from Worker1 [abc123]: Task complete
Relay message from alice [xyz789] [#general]: Question for the team
```

---

# Agent Relay

Real-time agent-to-agent messaging via file-based protocol.

## Sending Messages

Write a file to your outbox, then output the trigger:

```bash
cat > $AGENT_RELAY_OUTBOX/msg << 'EOF'
TO: AgentName

Your message here.
EOF
```

IMPORTANT: Output the trigger `->relay-file:msg` directly in your response text (not via echo in bash). The trigger must appear in your actual output, not just in command output.

> **Note**: `$AGENT_RELAY_OUTBOX` is automatically set by agent-relay when spawning agents. Data is stored in `.agent-relay/` within your project directory.

## Synchronous Messaging

By default, messages are fire-and-forget. Add `[await]` to block until the recipient ACKs:

```
->relay:AgentB [await] Please confirm
```

Custom timeout (seconds or minutes):

```
->relay:AgentB [await:30s] Please confirm
->relay:AgentB [await:5m] Please confirm
```

Recipients auto-ACK after processing when a correlation ID is present.

## Message Format

```
TO: Target
THREAD: optional-thread

Message body (everything after blank line)
```

| TO Value | Behavior |
|----------|----------|
| `AgentName` | Direct message |
| `*` | Broadcast to all |
| `#channel` | Channel message |

## Agent Naming (Local vs Bridge)

**Local communication** uses plain agent names. The `project:` prefix is **ONLY** for cross-project bridge mode.

| Context | Correct | Incorrect |
|---------|---------|-----------|
| Local (same project) | `TO: Lead` | `TO: project:lead` |
| Local (same project) | `TO: Worker1` | `TO: myproject:Worker1` |
| Bridge (cross-project) | `TO: frontend:Designer` | N/A |
| Bridge (to another lead) | `TO: otherproject:lead` | N/A |

**Common mistake**: Using `project:lead` when communicating locally. This will fail because the relay looks for an agent literally named "project:lead".

```bash
# CORRECT - local communication to Lead agent
cat > $AGENT_RELAY_OUTBOX/msg << 'EOF'
TO: Lead

Status update here.
EOF
```

```bash
# WRONG - project: prefix is only for bridge mode
cat > $AGENT_RELAY_OUTBOX/msg << 'EOF'
TO: project:lead

This will fail locally!
EOF
```

## Spawning & Releasing

**IMPORTANT**: The filename is always `spawn` (not `spawn-agentname`) and the trigger is always `->relay-file:spawn`. Spawn agents one at a time sequentially.

```bash
# Spawn
cat > $AGENT_RELAY_OUTBOX/spawn << 'EOF'
KIND: spawn
NAME: WorkerName
CLI: claude

Task description here.
EOF
```
Then: `->relay-file:spawn`

```bash
# Release
cat > $AGENT_RELAY_OUTBOX/release << 'EOF'
KIND: release
NAME: WorkerName
EOF
```
Then: `->relay-file:release`

## When You Are Spawned

If you were spawned by another agent:

1. **Check who spawned you**: `echo $AGENT_RELAY_SPAWNER`
2. **Your first message** is your task from your spawner - reply to THEM, not "spawner"
3. **Report status** to your spawner (your lead), not broadcast

```bash
# Check your spawner
echo "I was spawned by: $AGENT_RELAY_SPAWNER"

# Reply to your spawner
cat > $AGENT_RELAY_OUTBOX/msg << 'EOF'
TO: $AGENT_RELAY_SPAWNER

ACK: Starting on the task.
EOF
```
Then: `->relay-file:msg`

## Receiving Messages

Messages appear as:
```
Relay message from Alice [abc123]: Content here
```

Channel messages include `[#channel]`:
```
Relay message from Alice [abc123] [#general]: Hello!
```
Reply to the channel shown, not the sender.

## Protocol

- **ACK** when you receive a task: `ACK: Brief description`
- **DONE** when complete: `DONE: What was accomplished`
- Send status to your **lead** (the agent in `$AGENT_RELAY_SPAWNER`), not broadcast

## Headers Reference

| Header | Required | Description |
|--------|----------|-------------|
| TO | Yes (messages) | Target agent/channel |
| KIND | No | `message` (default), `spawn`, `release` |
| NAME | Yes (spawn/release) | Agent name |
| CLI | Yes (spawn) | CLI to use |
| THREAD | No | Thread identifier |
<!-- prpm:snippet:end @agent-relay/agent-relay-snippet@1.1.2 -->

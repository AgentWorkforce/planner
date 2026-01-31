# Planner Domain Model

This document describes the core entities ("particles") of the Planner system, how they nest and relate, and how they connect to the broader agentic architecture (Intake, Portfolio, Planner, Orchestrator).

---

## The Particles of a Plan

A **Plan** is composed of nested entities, like Russian dolls. Each level contains the next.

### Hierarchy (Outer → Inner)

```
┌─────────────────────────────────────────────────────────────────┐
│  PLAN                                                           │
│  └─ plan_id, created_at, updated_at                             │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  PLAN VERSION  (immutable once approved)                  │  │
│  │  └─ version, status, summary, timestamps                  │  │
│  │                                                           │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │  STEP  (grouped by scope, forms DAG)                │  │  │
│  │  │  └─ step_id, title, scope, description              │  │  │
│  │  │  └─ dependencies[], owner_role                      │  │  │
│  │  │  └─ sub_plan_id → (recursive Plan reference)        │  │  │
│  │  │                                                     │  │  │
│  │  │  ┌───────────────────────────────────────────────┐  │  │  │
│  │  │  │  ACCEPTANCE CRITERION                         │  │  │  │
│  │  │  │  └─ id, description, type                     │  │  │  │
│  │  │  └───────────────────────────────────────────────┘  │  │  │
│  │  │                                                     │  │  │
│  │  │  ┌───────────────────────────────────────────────┐  │  │  │
│  │  │  │  GATE  (approval checkpoint)                  │  │  │  │
│  │  │  │  └─ type: 'human_approval', approver_role     │  │  │  │
│  │  │  └───────────────────────────────────────────────┘  │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Entity Definitions

| Entity | Description | Contains |
|--------|-------------|----------|
| **Plan** | A container with a stable ID. Tracks creation timestamps. | PlanVersions |
| **PlanVersion** | An immutable snapshot of intent. Has status (draft/approved/published). | Steps, Summary |
| **Summary** | Embedded in PlanVersion. Contains `goal` (required) and `context` (optional). | — |
| **Step** | The atomic unit of work. Forms a DAG via `dependencies[]`. | AcceptanceCriteria, Gate |
| **AcceptanceCriterion** | What must be true for a step to be complete. | — |
| **Gate** | An optional human approval checkpoint before proceeding. | — |

### Key Properties

**Goal** is not a separate entity—it's embedded in `PlanVersion.summary.goal`. It represents the "why" (desired outcome), while Steps represent the "how" (work items).

**sub_plan_id** on Step enables recursion: a step can reference another Plan for hierarchical decomposition.

---

## Where Scope Fits In

**Scope is NOT a nested entity.** It's a property on Step used for grouping.

```typescript
Step {
  step_id: string
  title: string
  scope?: string      // ← Just a string tag (e.g., "backend", "frontend")
  dependencies: string[]
  ...
}
```

### Two Organizational Axes

The system has two different ways to organize work:

| Axis | Type | Purpose | Analogy |
|------|------|---------|---------|
| **Initiative → Plan → Step** | Hierarchical (containment) | "What's inside what" | Folders, Russian dolls |
| **Scope** | Cross-cutting (categorization) | "What domain/team owns this" | Tags, labels, filters |

### How Scope Cuts Across the Hierarchy

```
                          SCOPE (horizontal slice)
                    ┌──────────────────────────────────────────┐
                    │   backend    frontend    infrastructure  │
                    │      │          │             │          │
 H  Initiative ─────┼──────┼──────────┼─────────────┼──────────┤
 I       │          │      │          │             │          │
 E       ▼          │      │          │             │          │
 R  Plan "Auth" ────┼──────┼──────────┼─────────────┼──────────┤
 A       │          │      │          │             │          │
 R       ▼          │      ▼          ▼             ▼          │
 C  Steps ──────────┼─► [OAuth] ─► [Login] ─► [Secrets]        │
 H                  │                                          │
 Y                  └──────────────────────────────────────────┘
```

**Key insight:** Scope is a filter, not a container.
- One Step has exactly one Scope (or none)
- One Plan spans multiple Scopes
- One Initiative spans multiple Scopes across multiple Plans
- You can filter any level by scope: "Show me all backend work"

This is why the swimlane view groups by scope (rows) while showing the step DAG (columns)—it renders the cross-cutting dimension.

---

## The Four Areas and Their Particles

The Planner exists within a larger agentic architecture:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                 INTAKE                                          │
│  "Capture intent from the world"                                                │
│                                                                                 │
│  Core Particles:                                                                │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐                       │
│  │  CHANNEL    │────▶│   REQUEST   │────▶│   TRIAGE    │                       │
│  │ slack/email │     │ raw intent  │     │ priority/   │                       │
│  │ github/etc  │     │ + source    │     │ routing     │                       │
│  └─────────────┘     └─────────────┘     └─────────────┘                       │
└───────────────────────────────┬─────────────────────────────────────────────────┘
                                │ routes request
                                ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                               PORTFOLIO                                         │
│  "Prioritize and govern across initiatives"                                     │
│                                                                                 │
│  Core Particles:                                                                │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐                       │
│  │ INITIATIVE  │────▶│   BUDGET    │     │  APPROVAL   │                       │
│  │ strategic   │     │ resources/  │     │  QUEUE      │                       │
│  │ grouping    │     │ constraints │     │             │                       │
│  └─────────────┘     └─────────────┘     └─────────────┘                       │
│        │                                        ▲                               │
│        │ contains                               │                               │
│        ▼                                        │ submits for approval          │
└────────┼────────────────────────────────────────┼───────────────────────────────┘
         │                                        │
         ▼                                        │
┌─────────────────────────────────────────────────────────────────────────────────┐
│                               PLANNER                                           │
│  "Structure intent into executable plans"                                       │
│                                                                                 │
│  Core Particles:                                                                │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐   │
│  │    PLAN     │────▶│ PLANVERSION │────▶│    STEP     │────▶│  CRITERION  │   │
│  │ container   │     │ immutable   │     │ atomic work │     │  + GATE     │   │
│  │             │     │ snapshot    │     │ unit (DAG)  │     │             │   │
│  └─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘   │
│                             │                                                   │
│                             │ plan_ref                                          │
│                             ▼                                                   │
│                      ┌─────────────┐                                            │
│                      │  CHANGE     │◀───────────────────────────────────┐       │
│                      │  REQUEST    │                                    │       │
│                      └─────────────┘                                    │       │
└─────────────────────────────┬───────────────────────────────────────────┼───────┘
                              │ publishes plan_ref                        │
                              ▼                                           │
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              ORCHESTRATOR                                       │
│  "Execute plans with agents"                                                    │
│                                                                                 │
│  Core Particles:                                                                │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐   │
│  │    RUN      │────▶│    TASK     │────▶│   AGENT     │────▶│   RESULT    │   │
│  │ execution   │     │ dispatchable│     │ worker +    │     │ output +    │   │
│  │ instance    │     │ unit        │     │ role        │     │ artifacts   │   │
│  └─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘   │
│                                                                     │           │
│                                           creates ChangeRequest ────┘           │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Each Area's Primary Particle

| Area | Primary Particle | What It Cares About |
|------|------------------|---------------------|
| **Intake** | **Request** | Source channel, raw text, routing decision, urgency |
| **Portfolio** | **Initiative** | Strategic alignment, resource budget, plan status rollup |
| **Planner** | **PlanVersion** | Goal, steps DAG, approval status, immutability |
| **Orchestrator** | **Run** | Execution state, task dispatch, agent assignment, retries |

### Cross-Area Relationships

| From | To | Relationship |
|------|-----|--------------|
| Intake → Planner | Request becomes Plan |
| Intake → Portfolio | Request assigned to Initiative |
| Portfolio → Planner | Initiative contains Plans |
| Portfolio → Planner | Approval unlocks PlanVersion |
| Planner → Orchestrator | Published plan_ref starts Run |
| Planner → Orchestrator | Step becomes Task |
| Orchestrator → Planner | Execution feedback creates ChangeRequest |

### The Handoff Chain

```
Request → Plan → PlanVersion (approved) → Run → Task → Agent → Result
   │                    │                   │              │
   │                    │                   │              └─ artifacts, logs
   │                    │                   └─ state machine, retries
   │                    └─ immutable contract
   └─ raw intent
```

**Key insight:** The **PlanVersion** is the contract that crosses boundaries. Orchestrator never modifies it—if execution reveals the plan is wrong, it creates a **ChangeRequest** that flows back to Planner to produce a new version.

---

## Logical vs Physical: Where Code Actually Lives

A common question: *"If a step has `scope: backend`, does that mean there's a `backend` repo?"*

**No.** The domain model is intentionally **logical** (about intent and organization), not **physical** (about where code lives). The mapping between logical concepts and physical resources happens at execution time.

### The Boundary

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         PLANNER (Logical World)                                 │
│                                                                                 │
│   scope = "backend"             ← What domain/team owns this work?              │
│   owner_role = "backend:Coder"  ← What capability is needed?                    │
│   acceptance_criteria           ← What must be true when done?                  │
│                                                                                 │
│   These describe INTENT - they don't specify implementation details             │
└─────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │  mapping (configuration)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                       ORCHESTRATOR (Physical World)                             │
│                                                                                 │
│   repo = "api-service"          ← Where does the code live?                     │
│   agent = "claude-agent-7"      ← Which instance does the work?                 │
│   branch = "feature/oauth"      ← What git ref?                                 │
│   workspace = "/sandbox/abc123" ← Where does the agent work?                    │
│                                                                                 │
│   These are EXECUTION DETAILS - resolved at runtime                             │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Why This Separation Matters

1. **Same plan, different environments** — A plan written for "backend" work can execute against different repos in dev vs prod, or across teams with different repo structures.

2. **Flexible repo organization** — Scopes don't dictate repo structure:
   - One scope can span multiple repos
   - One repo can contain multiple scopes (monorepo)
   - The mapping is organizational choice, not system constraint

3. **Plans remain stable** — Physical details (repo URLs, branch conventions) can change without invalidating approved plans.

### Common Mappings

**Multi-repo organization:**
```
Scope: "backend"        →  Repo: "api-service"
Scope: "frontend"       →  Repo: "web-app"
Scope: "infrastructure" →  Repo: "terraform-config"
```

**Monorepo organization:**
```
Scope: "backend"        →  Repo: "monorepo", Path: "packages/api"
Scope: "frontend"       →  Repo: "monorepo", Path: "packages/web"
Scope: "shared"         →  Repo: "monorepo", Path: "packages/common"
```

**Complex mapping (one scope, multiple repos):**
```
Scope: "backend"        →  Repo: "api-service"      (main service)
                        →  Repo: "shared-libs"      (packages/auth)
                        →  Repo: "api-gateway"      (routing config)
```

### Where the Mapping Lives

This is **configuration**, not part of the domain model. Options include:

| Approach | Location | Best For |
|----------|----------|----------|
| Scope Registry | Orchestrator config | Org-wide conventions |
| Per-Initiative | Portfolio metadata | Initiative-specific repos |
| Per-Plan | Plan metadata | One-off or experimental work |
| Convention | Implicit (scope name = repo name) | Simple setups |

### The Pattern: Logical → Physical

This separation pattern applies throughout:

| Planner (Logical) | Orchestrator (Physical) |
|-------------------|-------------------------|
| `scope: "backend"` | `repo`, `path`, `branch` |
| `owner_role: "backend:Coder"` | `agent_id`, `workspace` |
| `step_id` | `task_id`, `sandbox_path` |
| `acceptance_criteria` | Test commands, assertions, CI checks |

### What Happens to Artifacts

When an agent completes work, it produces artifacts (typically code changes) in a sandboxed environment. The orchestrator handles the physical placement:

```
Agent (in sandbox)                    Orchestrator
──────────────────                    ────────────

Produces: code changes      ────────► Looks up: scope → repo mapping
In: sandboxed git repo                Applies: branch naming convention
                                      Executes: git push, create PR
Knows:                                Links: PR back to Run/Task
- task.step_id
- task.scope

Doesn't know:
- Target repo URL
- Branch naming rules
- PR template
```

This keeps agents focused on the work itself, while organizational policies (where code goes, how PRs are formatted) remain configurable at the orchestration layer.

---

## Zoom Levels: Portfolio vs Planner

Different areas see the same data at different granularities.

### What Each Level Sees

```
PORTFOLIO (zoomed out)              PLANNER (zoomed in)
──────────────────────              ────────────────────

Initiative                          Plan
├─ Plan (collapsed)                 └─ PlanVersion
│   └─ % complete                      ├─ summary.goal
│   └─ status badge                    └─ steps[]
│   └─ owner                               ├─ Scope: backend
├─ Plan (collapsed)                        │   └─ Step → Step → Step
└─ Plan (collapsed)                        └─ Scope: frontend
                                               └─ Step → Step
```

### Collection Names at Each Level

| Level | Collection Name | Contains | Who Cares |
|-------|-----------------|----------|-----------|
| **Portfolio** | **Initiative** | Plans | Execs, PMs |
| **Planner** | **Plan** | PlanVersions | Tech leads |
| **Planner** | **PlanVersion** | Steps (grouped by Scope) | Implementers |
| **Orchestrator** | **Run** | Tasks | Agents |

### Zoom Actions

| Viewer | Hierarchy View | Scope View |
|--------|---------------|------------|
| **Exec/PM** | "What initiatives are in flight?" | "How much backend work is queued?" |
| **Tech Lead** | "What plans are in this initiative?" | "Show me all infra steps across plans" |
| **Developer** | "What steps are in this plan?" | "What's my team's backlog?" |

---

## Summary

### The Nesting Order (Outer → Inner)

1. **Plan** — Container with stable ID
2. **PlanVersion** — Immutable snapshot (draft → approved → published)
3. **Step** — Atomic work unit, forms DAG via dependencies
4. **AcceptanceCriterion** / **Gate** — Completion criteria and approval checkpoints

### The Two Axes

- **Hierarchy** (vertical): Initiative → Plan → Step (containment)
- **Scope** (horizontal): backend, frontend, infrastructure (cross-cutting filter)

### Logical vs Physical

The domain model describes **intent**, not implementation:
- **Scope** is logical (team/domain ownership) — mapped to repos at execution
- **owner_role** is logical (capability needed) — mapped to agents at execution
- **acceptance_criteria** is logical (what must be true) — mapped to tests at execution

This separation allows plans to remain stable while physical details (repos, agents, infrastructure) can vary by environment.

### The Contract

**PlanVersion** is the immutable contract between Planner and Orchestrator. Changes flow back as **ChangeRequests**, never as mutations.

---

## Data Storage Architecture

### The Two Consumers Problem

Domain data must serve two very different consumers:

| Consumer | Needs | Pattern |
|----------|-------|---------|
| **Backend/API** | Fast queries, joins, filtering, aggregation | Relational tables, indexes |
| **LLMs/Agents** | Self-contained documents, traversable context | JSON blobs |

An LLM can traverse a JSON blob naturally—it sees the whole structure at once. But asking an LLM to mentally "join" across multiple tables is awkward and error-prone.

### The Hybrid Approach

Store relationally for queries, serve as JSON for consumption:

```sql
CREATE TABLE plan_versions (
  -- Relational fields for querying/joining
  id UUID PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES plans(id),
  version INT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,

  -- JSONB for the full document (LLM-friendly)
  document JSONB NOT NULL,

  UNIQUE(plan_id, version)
);
```

This gives you:
- **Fast relational queries** on status, plan_id, version
- **Single JSON blob** ready for LLM consumption without joins
- **Schema flexibility** for the document contents

### PostgreSQL JSONB Capabilities

PostgreSQL can query JSONB almost as flexibly as regular tables:

```sql
-- Get a field as text
SELECT document->>'status' FROM plan_versions;

-- Check containment (is this subset present?)
SELECT * FROM plan_versions WHERE document @> '{"status": "draft"}';

-- Check if key exists
SELECT * FROM plan_versions WHERE document ? 'scope';

-- JSONPath queries (PostgreSQL 12+)
SELECT * FROM plan_versions
WHERE jsonb_path_exists(document, '$.steps[*] ? (@.gate != null)');

-- Array element access
SELECT document->'steps'->0->>'title' FROM plan_versions;
```

**Indexing JSONB:**
```sql
-- GIN index for containment queries (@>, ?, etc.)
CREATE INDEX idx_pv_document ON plan_versions USING GIN(document);

-- B-tree index on extracted field
CREATE INDEX idx_pv_status ON plan_versions ((document->>'status'));
```

### Tradeoffs: Tables vs JSONB

| Aspect | Relational Tables | JSONB |
|--------|-------------------|-------|
| Query syntax | Standard SQL | Requires operators (`->`, `@>`) |
| Type safety | DB-enforced | App-enforced (Zod) |
| Schema changes | Requires migrations | Flexible, add fields freely |
| Index efficiency | Optimal by default | Needs explicit GIN/expression indexes |
| Joins | Natural | Possible but awkward |
| LLM friendliness | Requires assembly | Ready to serve |
| Debugging | Easy row inspection | Need to expand JSON |

### Recommended Pattern for Each Area

| Area | Primary Storage | Rationale |
|------|-----------------|-----------|
| **Intake** | JSONB-heavy | Requests are unstructured, schema varies by channel |
| **Portfolio** | Relational | Heavy on aggregations, rollups, cross-initiative queries |
| **Planner** | Hybrid | Query by status/plan_id, but serve full documents to LLMs |
| **Orchestrator** | Relational | Real-time state machine, needs fast updates and queries |

### Cross-Subdomain Access

Each subdomain owns its data. Cross-domain access happens via:

1. **API contracts** — RESTful endpoints with defined schemas
2. **Views for read-only access** — Database views that expose safe subsets
3. **Event propagation** — Changes published as events for others to consume

```
┌─────────────────┐          ┌─────────────────┐
│    PLANNER      │          │  ORCHESTRATOR   │
│                 │          │                 │
│  plan_versions  │◀─────────│  GET /plans/:id │
│  (owns data)    │  API     │  (reads via API)│
│                 │          │                 │
└─────────────────┘          └─────────────────┘
```

**Key principle:** No direct schema joins across subdomains. Each area can evolve its storage independently as long as the API contract is maintained.

### LLM Context Pattern

When serving data to LLMs, include enough context to be self-contained:

```typescript
// BAD: LLM would need to make multiple requests
{
  "step_id": "abc123",
  "plan_version_id": "xyz789"  // LLM has to fetch this separately
}

// GOOD: Self-contained document
{
  "step": {
    "step_id": "abc123",
    "title": "Add OAuth endpoints",
    "scope": "backend"
  },
  "plan_context": {
    "goal": "Add user authentication",
    "version": 3,
    "status": "approved"
  },
  "related_steps": [
    { "step_id": "def456", "title": "Add login page", "relationship": "depends_on_this" }
  ]
}
```

This "denormalized for consumption" pattern is the opposite of traditional database normalization—but it's exactly what LLMs need to reason effectively.

---

## Complete Subdomain Schemas

Each subdomain owns its data and exposes it via APIs. No direct cross-schema joins.

### Intake Schema

Intake captures raw intent from the world and routes it appropriately.

```sql
-- ============================================
-- INTAKE SUBDOMAIN
-- "Capture intent from the world"
-- ============================================

-- Channels: Sources of incoming requests
CREATE TABLE intake.channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  name TEXT NOT NULL UNIQUE,           -- 'slack-eng', 'github-issues', 'email-support'
  type TEXT NOT NULL,                  -- 'slack', 'github', 'email', 'api'

  -- Configuration (varies by type)
  config JSONB NOT NULL DEFAULT '{}',  -- webhook_url, api_key reference, filters

  -- State
  status TEXT NOT NULL DEFAULT 'active',  -- 'active', 'paused', 'disabled'
  last_poll_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Requests: Raw intent captured from channels
CREATE TABLE intake.requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source
  channel_id UUID NOT NULL REFERENCES intake.channels(id),
  external_id TEXT,                    -- Original ID in source system

  -- Raw content (JSONB - schema varies by channel)
  raw_payload JSONB NOT NULL,          -- Original message/issue/email

  -- Extracted intent
  title TEXT,                          -- AI-extracted or user-provided
  description TEXT,                    -- Cleaned/summarized content
  requester JSONB,                     -- { name, email, slack_id, etc. }

  -- Routing
  triage_status TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'triaged', 'rejected'
  urgency TEXT,                        -- 'low', 'normal', 'high', 'critical'

  -- Links (set after triage)
  routed_to_plan_id UUID,              -- If becomes a Plan
  routed_to_initiative_id UUID,        -- If assigned to Initiative

  -- Outcome tracking (denormalized for "what happened to my request?" UX)
  -- Authoritative source: Planner/Orchestrator (synced via events)
  outcome_status TEXT,                 -- 'plan_created', 'executing', 'completed', 'failed', null
  outcome_summary TEXT,                -- "Plan v3 approved, 8/12 steps complete"
  outcome_updated_at TIMESTAMPTZ,

  -- Ownership tracking (denormalized for "who's working on this?" UX)
  -- Authoritative source: Planner.plans (synced via events)
  assigned_owner TEXT,                 -- 'user:jane', 'team:backend'
  assigned_at TIMESTAMPTZ,

  -- Timestamps
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  triaged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Triage decisions: Audit trail for routing
CREATE TABLE intake.triage_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES intake.requests(id),

  -- Decision
  decision TEXT NOT NULL,              -- 'create_plan', 'add_to_initiative', 'reject', 'defer'
  reason TEXT,                         -- Why this decision

  -- Routing target
  target_type TEXT,                    -- 'plan', 'initiative', null
  target_id UUID,                      -- ID of created/assigned entity

  -- Who/what decided
  decided_by TEXT NOT NULL,            -- 'auto', 'user:jane', 'agent:triage-bot'
  confidence DECIMAL(3,2),             -- 0.00-1.00 for AI decisions

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Channel stats: Admin dashboard metrics (updated periodically)
CREATE TABLE intake.channel_stats (
  channel_id UUID PRIMARY KEY REFERENCES intake.channels(id),

  -- Volume metrics
  requests_total INT NOT NULL DEFAULT 0,
  requests_today INT NOT NULL DEFAULT 0,
  requests_this_week INT NOT NULL DEFAULT 0,

  -- Triage metrics (for admin: "how's auto-triage performing?")
  auto_triage_count INT NOT NULL DEFAULT 0,
  auto_triage_accuracy DECIMAL(3,2),   -- 0.00-1.00, based on corrections

  -- Timing metrics
  avg_triage_time_mins INT,            -- Avg time from received to triaged
  avg_completion_time_days INT,        -- Avg time from request to outcome_status='completed'

  -- Top requesters (JSONB for flexibility)
  top_requesters JSONB DEFAULT '[]',   -- [{ requester_id, name, count }]

  last_computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_requests_channel ON intake.requests(channel_id);
CREATE INDEX idx_requests_triage_status ON intake.requests(triage_status);
CREATE INDEX idx_requests_received ON intake.requests(received_at DESC);
CREATE INDEX idx_requests_outcome ON intake.requests(outcome_status);
CREATE INDEX idx_triage_request ON intake.triage_decisions(request_id);
```

**Intake API Contract:**
```
GET  /intake/requests                    -- List requests (filterable)
GET  /intake/requests/:id                -- Get request with triage history
POST /intake/requests                    -- Create request (from webhook/API)
POST /intake/requests/:id/triage         -- Submit triage decision
```

---

### Portfolio Schema

Portfolio manages strategic initiatives and governance.

```sql
-- ============================================
-- PORTFOLIO SUBDOMAIN
-- "Prioritize and govern across initiatives"
-- ============================================

-- Initiatives: Strategic groupings of work
CREATE TABLE portfolio.initiatives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  name TEXT NOT NULL,
  description TEXT,

  -- Ownership
  owner TEXT,                          -- 'team:platform', 'user:jane'
  stakeholders JSONB DEFAULT '[]',     -- [{ name, role, contact }]

  -- Strategic context
  objectives JSONB DEFAULT '[]',       -- OKR links, strategic goals
  priority INT,                        -- 1 = highest

  -- Status
  status TEXT NOT NULL DEFAULT 'active',  -- 'draft', 'active', 'paused', 'completed', 'cancelled'

  -- Time bounds
  target_start DATE,
  target_end DATE,

  -- Health indicators (denormalized for executive dashboard UX)
  -- Authoritative source: Computed from plans/runs (updated via events + periodic job)
  health_status TEXT DEFAULT 'unknown', -- 'healthy', 'at_risk', 'blocked', 'unknown'
  health_details JSONB DEFAULT '{}',   -- { blocked_plans: 1, failed_runs: 2, overdue_steps: 5 }

  plans_count INT NOT NULL DEFAULT 0,
  plans_draft INT NOT NULL DEFAULT 0,
  plans_approved INT NOT NULL DEFAULT 0,
  plans_executing INT NOT NULL DEFAULT 0,
  plans_completed INT NOT NULL DEFAULT 0,

  -- Last activity (for "stale initiative" detection)
  last_activity_at TIMESTAMPTZ,
  last_activity_type TEXT,             -- 'plan_created', 'run_completed', 'step_completed'

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Budgets: Resource constraints per initiative
CREATE TABLE portfolio.budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  initiative_id UUID NOT NULL REFERENCES portfolio.initiatives(id),

  -- Resource type
  resource_type TEXT NOT NULL,         -- 'compute_hours', 'api_calls', 'human_hours'

  -- Limits
  allocated DECIMAL(12,2) NOT NULL,    -- Total budget
  consumed DECIMAL(12,2) NOT NULL DEFAULT 0,

  -- Time period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Alert thresholds
  warn_threshold DECIMAL(3,2) DEFAULT 0.80,  -- Alert at 80%

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(initiative_id, resource_type, period_start)
);

-- Initiative-Plan links: Which plans belong to which initiative
CREATE TABLE portfolio.initiative_plans (
  initiative_id UUID NOT NULL REFERENCES portfolio.initiatives(id),
  plan_id UUID NOT NULL,               -- References planner.plans (via API)

  -- Metadata
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  added_by TEXT,

  -- Plan status cache (denormalized for dashboard UX)
  -- Authoritative source: Planner (synced via events)
  plan_goal TEXT,                      -- Cached for display
  plan_status TEXT,                    -- 'draft', 'approved', 'published'
  plan_version INT,                    -- Latest version number

  -- Execution status cache (denormalized for "is it running?" UX)
  -- Authoritative source: Orchestrator (synced via events)
  latest_run_id UUID,                  -- Most recent run
  latest_run_status TEXT,              -- 'pending', 'running', 'completed', 'failed'
  run_progress_pct INT,                -- 0-100 for quick dashboard display

  status_updated_at TIMESTAMPTZ,

  PRIMARY KEY (initiative_id, plan_id)
);

-- Approval queue: Governance workflow
CREATE TABLE portfolio.approval_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What needs approval
  entity_type TEXT NOT NULL,           -- 'plan_version', 'budget_increase', 'initiative'
  entity_id UUID NOT NULL,

  -- Request details
  requested_by TEXT NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  request_reason TEXT,

  -- Context for approver (denormalized for "what am I approving?" UX)
  -- Authoritative source: Varies by entity_type
  entity_title TEXT,                   -- Plan goal, initiative name, etc.
  entity_summary TEXT,                 -- Brief description of what's being approved
  change_summary JSONB,                -- For plan_version: { steps_added: 2, scopes: ['backend'] }
  impact_assessment TEXT,              -- 'low', 'medium', 'high' - computed or manual

  -- Initiative context (for grouping approvals by initiative)
  initiative_id UUID,
  initiative_name TEXT,

  -- Approval chain
  required_approvers JSONB NOT NULL,   -- ['role:tech_lead', 'user:jane']
  approvals JSONB NOT NULL DEFAULT '[]',  -- [{ approver, approved_at, comment }]

  -- Status
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'approved', 'rejected', 'expired'
  resolved_at TIMESTAMPTZ,

  -- Expiry
  expires_at TIMESTAMPTZ
);

-- Progress snapshots: Point-in-time rollups (for dashboards)
CREATE TABLE portfolio.progress_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  initiative_id UUID NOT NULL REFERENCES portfolio.initiatives(id),

  -- Snapshot data
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Rollup metrics
  total_plans INT NOT NULL DEFAULT 0,
  plans_by_status JSONB NOT NULL,      -- { draft: 2, approved: 5, published: 3 }
  total_steps INT NOT NULL DEFAULT 0,
  steps_completed INT NOT NULL DEFAULT 0,

  -- Scope breakdown
  steps_by_scope JSONB,                -- { backend: 12, frontend: 8 }

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_initiatives_status ON portfolio.initiatives(status);
CREATE INDEX idx_initiatives_priority ON portfolio.initiatives(priority);
CREATE INDEX idx_budgets_initiative ON portfolio.budgets(initiative_id);
CREATE INDEX idx_approval_status ON portfolio.approval_queue(status);
CREATE INDEX idx_approval_entity ON portfolio.approval_queue(entity_type, entity_id);
CREATE INDEX idx_snapshots_initiative ON portfolio.progress_snapshots(initiative_id, snapshot_at DESC);
```

**Portfolio API Contract:**
```
GET  /portfolio/initiatives              -- List initiatives
GET  /portfolio/initiatives/:id          -- Get initiative with plans summary
POST /portfolio/initiatives              -- Create initiative
PUT  /portfolio/initiatives/:id          -- Update initiative

GET  /portfolio/initiatives/:id/plans    -- List plans in initiative (fetches from Planner)
POST /portfolio/initiatives/:id/plans    -- Add plan to initiative

POST /portfolio/approvals                -- Request approval
POST /portfolio/approvals/:id/approve    -- Approve
POST /portfolio/approvals/:id/reject     -- Reject

GET  /portfolio/initiatives/:id/progress -- Get progress rollup
```

---

### Planner Schema

Planner structures intent into executable plans. Uses hybrid storage for LLM consumption.

```sql
-- ============================================
-- PLANNER SUBDOMAIN
-- "Structure intent into executable plans"
-- ============================================

-- Plans: Containers with stable IDs
CREATE TABLE planner.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Optional link to intake request that spawned this
  source_request_id UUID,              -- References intake.requests (via API)

  -- Initiative context (denormalized from Portfolio for convenience)
  -- NOTE: Portfolio.initiative_plans is the authoritative source
  -- This is a cached reference for query convenience and LLM context
  initiative_id UUID,                  -- References portfolio.initiatives (via API)
  initiative_name TEXT,                -- Cached for display/LLM context

  -- Execution status (denormalized from Orchestrator for "is it running?" UX)
  -- Authoritative source: Orchestrator (synced via events)
  active_run_id UUID,                  -- Currently running (null if not executing)
  latest_run_status TEXT,              -- 'pending', 'running', 'completed', 'failed'
  latest_run_progress JSONB,           -- { completed: 5, total: 12, failed: 0 }
  execution_updated_at TIMESTAMPTZ,

  -- Ownership (for "who owns this plan?" UX)
  owner TEXT,                          -- 'user:jane', 'team:backend'
  collaborators JSONB DEFAULT '[]',    -- [{ user_id, role, added_at }]

  -- Quality indicators (computed, for admin "which plans need attention?" UX)
  quality_score INT,                   -- 0-100, computed from completeness
  quality_issues JSONB DEFAULT '[]',   -- [{ type: 'missing_description', step_id: '...' }]

  -- Collaboration state (for "who's editing?" UX)
  active_editors JSONB DEFAULT '[]',   -- [{ user_id, cursor_position, last_active_at }]
  last_edited_by TEXT,
  last_edited_at TIMESTAMPTZ,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Plan versions: Immutable snapshots (THE CORE ENTITY)
CREATE TABLE planner.plan_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Parent
  plan_id UUID NOT NULL REFERENCES planner.plans(id),
  version INT NOT NULL,

  -- Status (state machine: draft → approved → published)
  status TEXT NOT NULL DEFAULT 'draft',
  submitted_at TIMESTAMPTZ,            -- When submitted for review
  approved_at TIMESTAMPTZ,
  approved_by TEXT,
  published_at TIMESTAMPTZ,

  -- ========================================
  -- THE DOCUMENT (LLM-friendly JSONB blob)
  -- ========================================
  -- Contains: summary, steps[], and all nested entities
  -- This is what gets served to LLMs and agents
  document JSONB NOT NULL,

  -- Extracted fields for querying (denormalized from document)
  goal TEXT GENERATED ALWAYS AS (document->>'goal') STORED,
  step_count INT GENERATED ALWAYS AS (jsonb_array_length(document->'steps')) STORED,
  scopes TEXT[] GENERATED ALWAYS AS (
    ARRAY(SELECT DISTINCT jsonb_array_elements_text(
      jsonb_path_query_array(document, '$.steps[*].scope')
    ))
  ) STORED,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(plan_id, version)
);

-- Document JSONB structure:
-- {
--   "summary": {
--     "goal": "Add user authentication",
--     "context": "Part of Q1 security initiative"
--   },
--   "initiative": {                        -- Optional: denormalized for LLM context
--     "id": "uuid",
--     "name": "Q1 Security Hardening",
--     "objectives": ["Achieve SOC2 compliance", "Reduce auth-related incidents"]
--   },
--   "steps": [
--     {
--       "step_id": "uuid",
--       "title": "Add OAuth endpoints",
--       "scope": "backend",
--       "description": "...",
--       "dependencies": ["other-step-id"],
--       "owner_role": "backend:Coder",
--       "acceptance_criteria": [
--         { "id": "ac1", "description": "OAuth flow works", "type": "test" }
--       ],
--       "gate": { "type": "human_approval", "approver_role": "tech_lead" }
--     }
--   ],
--   "metadata": { ... }
-- }

-- Change requests: Feedback from Orchestrator
CREATE TABLE planner.change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source
  plan_version_id UUID NOT NULL REFERENCES planner.plan_versions(id),
  run_id UUID,                         -- References orchestrator.runs (via API)

  -- What changed
  change_type TEXT NOT NULL,           -- 'add_step', 'modify_step', 'remove_step', 'reorder'

  -- Details (JSONB for flexibility)
  change_details JSONB NOT NULL,       -- { step_id, reason, suggested_changes }

  -- Status
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'accepted', 'rejected'

  -- Resolution
  resolved_by TEXT,
  resolved_at TIMESTAMPTZ,
  resulting_version_id UUID REFERENCES planner.plan_versions(id),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Version diffs: Structural changes between versions
CREATE TABLE planner.version_diffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  from_version_id UUID NOT NULL REFERENCES planner.plan_versions(id),
  to_version_id UUID NOT NULL REFERENCES planner.plan_versions(id),

  -- Diff as JSON (RFC 6902 style patches)
  diff JSONB NOT NULL,

  -- Summary stats
  steps_added INT NOT NULL DEFAULT 0,
  steps_removed INT NOT NULL DEFAULT 0,
  steps_modified INT NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(from_version_id, to_version_id)
);

-- Indexes
CREATE INDEX idx_plans_created ON planner.plans(created_at DESC);
CREATE INDEX idx_plans_initiative ON planner.plans(initiative_id);
CREATE INDEX idx_plan_versions_plan ON planner.plan_versions(plan_id);
CREATE INDEX idx_plan_versions_status ON planner.plan_versions(status);
CREATE INDEX idx_plan_versions_goal ON planner.plan_versions(goal);  -- Generated column
CREATE INDEX idx_plan_versions_scopes ON planner.plan_versions USING GIN(scopes);  -- Array search
CREATE INDEX idx_plan_versions_document ON planner.plan_versions USING GIN(document);  -- JSONB search
CREATE INDEX idx_change_requests_version ON planner.change_requests(plan_version_id);
CREATE INDEX idx_change_requests_status ON planner.change_requests(status);
```

**Denormalization Pattern (Initiative Context):**

The `initiative_id` and `initiative_name` fields are **cached references**, not the source of truth:

```
Portfolio (authoritative)              Planner (cached)
─────────────────────────              ────────────────
initiative_plans                       plans.initiative_id
  └─ plan_id, initiative_id            plans.initiative_name
                                       document.initiative { ... }

Sync strategy:
1. When plan is added to initiative → Portfolio calls Planner to update cache
2. When initiative is renamed → Portfolio calls Planner to update cached name
3. On conflict → Portfolio wins (it's the source of truth)
```

This gives Planner:
- Query convenience: `GET /planner/plans?initiative_id=xyz`
- LLM context: Initiative goals/objectives embedded in document
- Independence: Can still function if Portfolio is down (stale but usable)

**Planner API Contract:**
```
GET  /planner/plans                      -- List plans (filterable by initiative_id)
GET  /planner/plans/:id                  -- Get plan with versions
POST /planner/plans                      -- Create plan

GET  /planner/plans/:id/versions         -- List versions
GET  /planner/plans/:id/versions/:v      -- Get specific version (returns document)
POST /planner/plans/:id/versions         -- Create new version
PUT  /planner/plans/:id/versions/:v      -- Update draft version

POST /planner/plans/:id/versions/:v/submit   -- Submit for review
POST /planner/plans/:id/versions/:v/approve  -- Approve (locks version)
POST /planner/plans/:id/versions/:v/publish  -- Publish (returns plan_ref)

GET  /planner/plans/:id/versions/:v/diff/:other  -- Get diff between versions

POST /planner/change-requests            -- Create change request (from Orchestrator)
GET  /planner/change-requests/:id        -- Get change request
PUT  /planner/change-requests/:id        -- Resolve change request
```

---

### Orchestrator Schema

Orchestrator executes plans with agents. Heavily relational for real-time state management.

```sql
-- ============================================
-- ORCHESTRATOR SUBDOMAIN
-- "Execute plans with agents"
-- ============================================

-- Runs: Execution instances of a published plan
CREATE TABLE orchestrator.runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What we're executing
  plan_ref TEXT NOT NULL,              -- 'planner:plan_id:version' (immutable reference)
  plan_id UUID NOT NULL,               -- Extracted for querying
  plan_snapshot JSONB NOT NULL,        -- Cached copy of plan document at start

  -- Initiative context (denormalized for filtering/grouping UX)
  -- Authoritative source: Portfolio (via plan_snapshot.initiative or API)
  initiative_id UUID,                  -- For "show runs by initiative"
  initiative_name TEXT,                -- For display

  -- End-to-end traceability (for "trace this back to the original request" UX)
  source_request_id UUID,              -- From planner.plans.source_request_id

  -- Cost tracking (for admin "how much did this run cost?" UX)
  cost_estimate JSONB,                 -- { tokens: 50000, compute_hours: 0.5 } - estimated at start
  cost_actual JSONB,                   -- { tokens: 45000, compute_hours: 0.4 } - updated as we go
  cost_updated_at TIMESTAMPTZ,

  -- State machine
  status TEXT NOT NULL DEFAULT 'pending',
    -- 'pending', 'running', 'paused', 'completed', 'failed', 'cancelled'

  -- Progress
  tasks_total INT NOT NULL DEFAULT 0,
  tasks_completed INT NOT NULL DEFAULT 0,
  tasks_failed INT NOT NULL DEFAULT 0,

  -- Configuration
  config JSONB DEFAULT '{}',           -- Scope mappings, retry policies, etc.

  -- Error handling
  error_message TEXT,
  error_details JSONB,

  -- Timestamps
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tasks: Dispatchable units (one per step)
CREATE TABLE orchestrator.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES orchestrator.runs(id),

  -- Link to plan step
  step_id TEXT NOT NULL,               -- From plan_snapshot
  step_title TEXT NOT NULL,            -- Denormalized for display
  step_scope TEXT,                     -- Denormalized for filtering

  -- Physical mapping (resolved at dispatch)
  repo TEXT,
  repo_path TEXT,
  branch TEXT,
  workspace_path TEXT,

  -- Assignment
  agent_id UUID REFERENCES orchestrator.agents(id),
  assigned_at TIMESTAMPTZ,

  -- State
  status TEXT NOT NULL DEFAULT 'blocked',
    -- 'blocked', 'ready', 'assigned', 'running', 'verifying', 'completed', 'failed'

  -- Blocking
  blocked_by TEXT[],                   -- step_ids that must complete first

  -- Retries
  attempt_count INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 3,
  last_error TEXT,

  -- Verification
  verification_status TEXT,            -- 'pending', 'passed', 'failed'
  verification_details JSONB,

  -- Timestamps
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(run_id, step_id)
);

-- Agents: Workers that execute tasks
CREATE TABLE orchestrator.agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  name TEXT NOT NULL,
  type TEXT NOT NULL,                  -- 'claude-code', 'custom', 'human'

  -- Capabilities
  roles TEXT[] NOT NULL,               -- ['backend:Coder', 'frontend:Reviewer']

  -- Connection
  relay_address TEXT,                  -- Address in relay network
  spawn_config JSONB,                  -- PTY spawn configuration

  -- State
  status TEXT NOT NULL DEFAULT 'idle',  -- 'idle', 'busy', 'offline', 'error'
  current_task_id UUID REFERENCES orchestrator.tasks(id),

  -- Stats
  tasks_completed INT NOT NULL DEFAULT 0,
  tasks_failed INT NOT NULL DEFAULT 0,
  avg_task_duration_ms BIGINT,

  -- Timestamps
  last_heartbeat_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Results: Outputs from completed tasks
CREATE TABLE orchestrator.results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES orchestrator.tasks(id),

  -- Outcome
  success BOOLEAN NOT NULL,

  -- Artifacts
  artifacts JSONB DEFAULT '[]',        -- [{ type, path, url, sha }]

  -- Code changes
  commit_sha TEXT,
  pr_url TEXT,
  pr_number INT,

  -- Agent output
  agent_summary TEXT,                  -- Agent's description of what was done
  agent_log_path TEXT,                 -- Path to full conversation/reasoning

  -- Metrics
  duration_ms BIGINT,
  tokens_used JSONB,                   -- { input: 1000, output: 500 }

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Task events: Audit trail for task state changes
CREATE TABLE orchestrator.task_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES orchestrator.tasks(id),

  event_type TEXT NOT NULL,            -- 'created', 'assigned', 'started', 'completed', 'failed', 'retried'

  -- Details
  details JSONB,

  -- Who/what caused it
  actor TEXT,                          -- 'system', 'agent:abc', 'user:jane'

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Scope mappings: Logical → Physical resolution
CREATE TABLE orchestrator.scope_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Scope (can be initiative-specific or global)
  initiative_id UUID,                  -- null = global default
  scope TEXT NOT NULL,

  -- Physical target
  repo_url TEXT NOT NULL,
  repo_path TEXT DEFAULT '',           -- For monorepos
  default_branch TEXT DEFAULT 'main',

  -- Conventions
  branch_pattern TEXT DEFAULT 'feature/{step_id}',
  pr_template TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(initiative_id, scope)
);

-- System stats: Operator dashboard metrics (updated frequently)
CREATE TABLE orchestrator.system_stats (
  id INT PRIMARY KEY DEFAULT 1,        -- Single row table
  CHECK (id = 1),                      -- Enforce single row

  -- Queue metrics (for "what's waiting?" UX)
  tasks_blocked INT NOT NULL DEFAULT 0,
  tasks_ready INT NOT NULL DEFAULT 0,  -- Ready but not assigned
  tasks_running INT NOT NULL DEFAULT 0,
  avg_wait_time_ms BIGINT,             -- Avg time from ready to assigned

  -- Agent metrics (for "agent health" UX)
  agents_total INT NOT NULL DEFAULT 0,
  agents_idle INT NOT NULL DEFAULT 0,
  agents_busy INT NOT NULL DEFAULT 0,
  agents_offline INT NOT NULL DEFAULT 0,
  agents_error INT NOT NULL DEFAULT 0,

  -- Throughput metrics
  tasks_completed_today INT NOT NULL DEFAULT 0,
  tasks_failed_today INT NOT NULL DEFAULT 0,
  avg_task_duration_ms BIGINT,

  -- Cost metrics (for admin "budget tracking" UX)
  tokens_used_today BIGINT NOT NULL DEFAULT 0,
  cost_usd_today DECIMAL(10,2),

  last_computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Agent performance: Per-agent metrics for admin
CREATE TABLE orchestrator.agent_stats (
  agent_id UUID PRIMARY KEY REFERENCES orchestrator.agents(id),

  -- Performance metrics
  tasks_completed_24h INT NOT NULL DEFAULT 0,
  tasks_failed_24h INT NOT NULL DEFAULT 0,
  success_rate DECIMAL(3,2),           -- 0.00-1.00

  -- Efficiency metrics
  avg_duration_ms BIGINT,
  tokens_per_task_avg BIGINT,

  -- Availability
  uptime_pct DECIMAL(3,2),             -- Over last 24h
  last_error TEXT,
  last_error_at TIMESTAMPTZ,

  last_computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_runs_status ON orchestrator.runs(status);
CREATE INDEX idx_runs_plan_ref ON orchestrator.runs(plan_ref);
CREATE INDEX idx_runs_plan_id ON orchestrator.runs(plan_id);
CREATE INDEX idx_runs_initiative ON orchestrator.runs(initiative_id);
CREATE INDEX idx_runs_source_request ON orchestrator.runs(source_request_id);
CREATE INDEX idx_runs_created ON orchestrator.runs(created_at DESC);

CREATE INDEX idx_tasks_run ON orchestrator.tasks(run_id);
CREATE INDEX idx_tasks_status ON orchestrator.tasks(status);
CREATE INDEX idx_tasks_agent ON orchestrator.tasks(agent_id);
CREATE INDEX idx_tasks_scope ON orchestrator.tasks(step_scope);

CREATE INDEX idx_agents_status ON orchestrator.agents(status);
CREATE INDEX idx_agents_roles ON orchestrator.agents USING GIN(roles);

CREATE INDEX idx_results_task ON orchestrator.results(task_id);
CREATE INDEX idx_task_events_task ON orchestrator.task_events(task_id);
CREATE INDEX idx_task_events_created ON orchestrator.task_events(created_at DESC);

CREATE INDEX idx_scope_mappings_scope ON orchestrator.scope_mappings(scope);
```

**Orchestrator API Contract:**
```
POST /orchestrator/runs                  -- Start run from plan_ref
GET  /orchestrator/runs/:id              -- Get run with tasks
PUT  /orchestrator/runs/:id              -- Update run (pause/resume/cancel)

GET  /orchestrator/runs/:id/tasks        -- List tasks
GET  /orchestrator/runs/:id/tasks/:tid   -- Get task details
POST /orchestrator/runs/:id/tasks/:tid/retry  -- Retry failed task

GET  /orchestrator/agents                -- List agents
POST /orchestrator/agents                -- Register agent
PUT  /orchestrator/agents/:id            -- Update agent status

POST /orchestrator/agents/:id/claim      -- Agent claims ready task
POST /orchestrator/agents/:id/complete   -- Agent reports completion
POST /orchestrator/agents/:id/fail       -- Agent reports failure

GET  /orchestrator/scope-mappings        -- List scope mappings
POST /orchestrator/scope-mappings        -- Create mapping
```

---

### Cross-Domain Summary

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              SCHEMA OWNERSHIP                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   INTAKE                    PORTFOLIO                PLANNER                    │
│   ───────                   ─────────                ───────                    │
│   channels                  initiatives              plans                      │
│   requests ─────────────────▶ initiative_plans ◀─────plan_versions              │
│   triage_decisions          budgets                  change_requests ◀──┐       │
│                             approval_queue           version_diffs      │       │
│                             progress_snapshots                          │       │
│                                    │                       │            │       │
│                                    │ fetches progress      │ plan_ref   │       │
│                                    ▼                       ▼            │       │
│                                                                         │       │
│                             ORCHESTRATOR                                │       │
│                             ────────────                                │       │
│                             runs ───────────────────────────────────────┘       │
│                             tasks                                               │
│                             agents                                              │
│                             results                                             │
│                             task_events                                         │
│                             scope_mappings                                      │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

Cross-domain data flows via APIs, not direct joins:

  Intake → Planner:      POST /planner/plans (creates plan from request)
  Intake → Portfolio:    POST /portfolio/initiatives/:id/plans (assigns to initiative)
  Portfolio → Planner:   GET /planner/plans/:id (fetches plan details for rollup)
  Portfolio → Planner:   PUT /planner/plans/:id/initiative (syncs initiative context - cached)
  Planner → Orchestrator: Publish returns plan_ref, Orchestrator calls GET /planner/plans/:id/versions/:v
  Orchestrator → Planner: POST /planner/change-requests (structural feedback)

Denormalized fields by user persona:

  ┌─────────────────────────────────────────────────────────────────────────────┐
  │  END USER / REQUESTER                                                        │
  │  "What happened to my request? Who's working on it?"                         │
  ├─────────────────────────────────────────────────────────────────────────────┤
  │  intake.requests.outcome_status/summary  ← Planner + Orchestrator events     │
  │  intake.requests.assigned_owner          ← Planner.plans.owner               │
  └─────────────────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────────────────────┐
  │  PM / EXECUTIVE                                                              │
  │  "How are my initiatives? What's at risk?"                                   │
  ├─────────────────────────────────────────────────────────────────────────────┤
  │  portfolio.initiatives.health_status     ← computed from plans/runs          │
  │  portfolio.initiatives.plans_*           ← Planner events                    │
  │  portfolio.initiative_plans.plan_*       ← Planner.plan_versions             │
  │  portfolio.initiative_plans.latest_run_* ← Orchestrator.runs                 │
  └─────────────────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────────────────────┐
  │  APPROVER                                                                    │
  │  "What am I approving? What's the impact?"                                   │
  ├─────────────────────────────────────────────────────────────────────────────┤
  │  portfolio.approval_queue.entity_title   ← Planner/Portfolio                 │
  │  portfolio.approval_queue.change_summary ← Planner.version_diffs             │
  │  portfolio.approval_queue.initiative_*   ← Portfolio.initiatives             │
  └─────────────────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────────────────────┐
  │  PLAN AUTHOR / COLLABORATOR                                                  │
  │  "Is it running? Who else is editing?"                                       │
  ├─────────────────────────────────────────────────────────────────────────────┤
  │  planner.plans.initiative_id/name        ← Portfolio.initiative_plans        │
  │  planner.plans.active_run_id/status      ← Orchestrator.runs                 │
  │  planner.plans.active_editors            ← real-time (WebSocket/presence)    │
  │  planner.plans.quality_score/issues      ← computed locally                  │
  └─────────────────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────────────────────┐
  │  OPERATOR                                                                    │
  │  "What's running? What's the queue? Any failures?"                           │
  ├─────────────────────────────────────────────────────────────────────────────┤
  │  orchestrator.runs.initiative_id/name    ← Portfolio (via plan)              │
  │  orchestrator.runs.source_request_id     ← Planner.plans                     │
  │  orchestrator.runs.cost_actual           ← computed from results             │
  │  orchestrator.system_stats.*             ← computed periodically             │
  └─────────────────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────────────────────┐
  │  ADMIN                                                                       │
  │  "Channel health? Agent performance? System utilization?"                    │
  ├─────────────────────────────────────────────────────────────────────────────┤
  │  intake.channel_stats.*                  ← computed periodically             │
  │  orchestrator.agent_stats.*              ← computed periodically             │
  │  orchestrator.system_stats.*             ← computed frequently               │
  └─────────────────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────────────────────┐
  │  LLM / AGENT                                                                 │
  │  "Full context for this task"                                                │
  ├─────────────────────────────────────────────────────────────────────────────┤
  │  plan_versions.document.initiative       ← Portfolio                         │
  │  runs.plan_snapshot                      ← Planner.plan_versions             │
  │  tasks.step_title/scope                  ← runs.plan_snapshot                │
  └─────────────────────────────────────────────────────────────────────────────┘
```

---

### Sync Strategy: Events vs Polling

These denormalized fields are kept in sync via **domain events**:

```
┌─────────────┐  PlanVersionApproved   ┌─────────────┐
│   PLANNER   │ ─────────────────────► │  PORTFOLIO  │
│             │  PlanVersionPublished  │             │
└─────────────┘                        └─────────────┘
       │                                      │
       │ RunStarted                           │ updates
       │ RunCompleted                         │ initiative_plans.*
       │ RunFailed                            ▼
       │                               ┌─────────────┐
       └──────────────────────────────►│   INTAKE    │
                                       │             │
                                       │ updates     │
┌─────────────┐  RunStatusChanged      │ requests.*  │
│ ORCHESTRATOR│ ─────────────────────► └─────────────┘
│             │  TaskCompleted
│             │ ─────────────────────► PLANNER (updates plans.active_run_*)
└─────────────┘
```

**Event payloads include enough context** so receivers can update their caches without additional API calls:

```typescript
// Example: RunStatusChanged event
{
  event: 'RunStatusChanged',
  run_id: 'uuid',
  plan_id: 'uuid',
  initiative_id: 'uuid',  // Included so Portfolio can update without lookup
  status: 'completed',
  progress: { completed: 12, total: 12, failed: 0 }
}
```

**Staleness is acceptable** for these cached fields:
- Dashboard shows "running" for a few seconds after completion = OK
- User clicks through to Orchestrator for real-time view
- Events are processed async, typically <1s latency

---

## Trajectories: The Observability Layer

### What Trajectories Is

Trajectories (from [AgentWorkforce/trajectories](https://github.com/AgentWorkforce/trajectories)) is a **document layer for agent reasoning**. It captures the complete "train of thought" behind AI agent work—why decisions were made, what alternatives were considered, and what assumptions guided the work.

Unlike our four subdomains, trajectories is **orthogonal infrastructure**—it cuts across all of them.

### How It Differs from Subdomains

| Our Subdomains | Trajectories |
|----------------|--------------|
| **Operational** — define what should happen | **Observational** — records what did happen |
| **Domain-centric** — organized around business entities | **Agent-centric** — organized around work sessions |
| **Prescriptive** — plans, tasks, approvals | **Retrospective** — reasoning, decisions, reflection |

### The Vertical Cut

```
                          ┌─────────────────────────┐
                          │      TRAJECTORIES       │
                          │   (reasoning capture)   │
                          │                         │
                          │  chapters, events,      │
                          │  retrospectives,        │
                          │  artifacts              │
                          └───────────┬─────────────┘
                                      │
        ┌─────────────────────────────┼─────────────────────────────┐
        │                             │                             │
        ▼                             ▼                             ▼
┌───────────────┐            ┌───────────────┐            ┌───────────────┐
│    INTAKE     │            │    PLANNER    │            │  ORCHESTRATOR │
│               │            │               │            │               │
│  Triage agent │            │ Planning agent│            │ Execution     │
│  reasoning    │            │ reasoning     │            │ agents        │
└───────────────┘            └───────────────┘            └───────────────┘
```

Agents can operate in any subdomain. Trajectories captures their reasoning regardless of which domain they're working in.

### Trajectory Data Model

A trajectory contains four main components:

1. **Chapters** — Logical work segments (exploration, implementation, testing phases)
2. **Events** — Prompts, tool invocations, decisions, inter-agent communications
3. **Retrospective** — Agent reflection including summary, decision rationale, confidence scoring
4. **Artifacts** — References to commits, modified files, task system links

Stored as `.trajectory.json` files with auto-generated `.trajectory.md` summaries for human readability.

### Integration Pattern

Trajectories operates as a **separate, orthogonal service**:

1. **Loosely coupled** — Subdomains publish events, trajectories consumes them
2. **Optional** — Subdomains work without it; trajectories enhances observability
3. **Reference links** — Subdomains can optionally link to trajectory records

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         SUBDOMAIN (any)                                 │
│                                                                         │
│  Agent does work → publishes event → stores result                      │
│                          │                                              │
│                          ▼                                              │
│              AgentWorkCompleted event                                   │
│              {                                                          │
│                entity_type: 'triage_decision',                          │
│                entity_id: 'uuid',                                       │
│                agent_id: 'triage-bot',                                  │
│                trajectory_ref: 'file:///.trajectory.json'               │
│              }                                                          │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         TRAJECTORIES                                    │
│                                                                         │
│  • Receives event                                                       │
│  • Links trajectory to entity                                           │
│  • Indexes for query (by entity, by agent, by time)                     │
│  • Stores trajectory document                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

### Reference Links in Schemas

Each subdomain can optionally link to trajectory records where agent reasoning exists:

```sql
-- Intake: Link triage decisions to agent reasoning
ALTER TABLE intake.triage_decisions ADD COLUMN
  trajectory_id UUID;  -- References trajectories service (via API)

-- Planner: Link AI-generated plan versions to reasoning
ALTER TABLE planner.plan_versions ADD COLUMN
  trajectory_id UUID;  -- If AI-generated

-- Planner: Link change requests to reasoning
ALTER TABLE planner.change_requests ADD COLUMN
  trajectory_id UUID;  -- Agent's reasoning for the change

-- Orchestrator: Link runs to overall execution reasoning
ALTER TABLE orchestrator.runs ADD COLUMN
  trajectory_id UUID;

-- Orchestrator: Link task results to per-task reasoning
ALTER TABLE orchestrator.results ADD COLUMN
  trajectory_id UUID;
```

### What Trajectories Enables

| Capability | Without Trajectories | With Trajectories |
|------------|---------------------|-------------------|
| **Why was this decision made?** | Only the decision stored | Full reasoning chain |
| **What alternatives were considered?** | No record | Decision logs with trade-offs |
| **How confident was the agent?** | Maybe a confidence score | Confidence + rationale |
| **Can another agent continue this work?** | Would start fresh | Full context for pickup |
| **What went wrong?** | Error message only | Complete reasoning trace |

### Query Patterns

Trajectories enables queries like:

```
GET /trajectories?entity_type=triage_decision&entity_id=xyz
    → "Why did the triage bot reject this request?"

GET /trajectories?entity_type=plan_version&entity_id=abc
    → "Show reasoning for this plan's creation"

GET /trajectories?entity_type=run&entity_id=run-123
    → "What did agents do during this run?"

GET /trajectories?agent_id=triage-bot&since=2026-01-01
    → "Show agent X's recent decisions"
```

### Memory Stack Architecture

Trajectories operates as Layer 3 in a three-layer memory stack:

```
Layer 1: Agent-Relay      → Real-time messaging, message persistence
Layer 2: Claude-Mem       → Tool observations, semantic concepts
Layer 3: Trajectories     → Task narratives, decisions, retrospectives
```

Each layer functions independently while contributing to comprehensive agent memory.

### Storage Backends

Trajectories supports multiple backends:
- **Filesystem** (default) — Git-friendly `.trajectory.json` files
- **SQLite** — Local indexing for search
- **PostgreSQL/S3** — Team-scale storage

### Key Design Decision

**Trajectories is orthogonal, not a 5th subdomain.**

It doesn't change our four-subdomain architecture—it complements it as an observability layer. Subdomains:
- Add optional `trajectory_id` reference fields
- Publish events that trajectories can consume
- Continue to function without trajectories dependency

This maintains our "contract boundaries" principle while enabling the "why" behind agent decisions to be captured and queried.

---

## Future Architecture: Insights & Platform

While the four core subdomains (Intake, Portfolio, Planner, Orchestrator) cover the primary workflow, long-term operation reveals two cross-cutting concerns that may warrant dedicated subdomains.

### Current Coverage Gaps

| Concern | Currently Handled By | Gap |
|---------|---------------------|-----|
| **Learning from past runs** | Trajectories (raw data) | No aggregation, pattern detection, or recommendations |
| **System health monitoring** | Each subdomain internally | No unified view, alerting, or capacity planning |
| **Post-mortems** | Manual process | No structured capture or trend analysis |
| **Cost tracking** | Orchestrator.results | No forecasting or optimization suggestions |

### Future Subdomain: Insights

**Purpose**: Learn from agent behavior to improve future performance.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              INSIGHTS                                   │
│                                                                         │
│  • Aggregates trajectories across runs                                  │
│  • Detects patterns (common failures, successful strategies)            │
│  • Generates recommendations for Planner (better step decomposition)    │
│  • Surfaces agent learnings for human review                            │
│  • Tracks plan effectiveness over time                                  │
│  • Structures post-mortems with actionable insights                     │
│                                                                         │
│  Consumes: Trajectories, Orchestrator.results, Planner.versions         │
│  Produces: Recommendations, learnings, effectiveness metrics            │
└─────────────────────────────────────────────────────────────────────────┘
```

**Potential Schema**:

```sql
CREATE SCHEMA insights;

-- Pattern detection across trajectories
CREATE TABLE insights.patterns (
  pattern_id UUID PRIMARY KEY,
  pattern_type TEXT NOT NULL,  -- 'failure_mode', 'success_strategy', 'agent_behavior'
  description TEXT NOT NULL,
  occurrence_count INTEGER DEFAULT 1,
  first_seen TIMESTAMPTZ NOT NULL,
  last_seen TIMESTAMPTZ NOT NULL,
  confidence DECIMAL(3,2),  -- 0.00-1.00

  -- Evidence links
  trajectory_ids UUID[],  -- Array of related trajectories
  example_run_ids UUID[],

  metadata JSONB
);

-- Recommendations generated from patterns
CREATE TABLE insights.recommendations (
  recommendation_id UUID PRIMARY KEY,
  target_type TEXT NOT NULL,  -- 'planner', 'orchestrator', 'human'
  target_scope TEXT,  -- Which repo/team/domain

  title TEXT NOT NULL,
  description TEXT NOT NULL,
  evidence_pattern_ids UUID[],

  status TEXT DEFAULT 'pending',  -- 'pending', 'applied', 'dismissed'
  applied_at TIMESTAMPTZ,
  applied_by TEXT,

  created_at TIMESTAMPTZ DEFAULT now()
);

-- Agent learnings (extracted from retrospectives)
CREATE TABLE insights.agent_learnings (
  learning_id UUID PRIMARY KEY,
  agent_role TEXT NOT NULL,

  learning_type TEXT NOT NULL,  -- 'capability', 'limitation', 'preference'
  description TEXT NOT NULL,

  source_trajectory_id UUID,
  confidence DECIMAL(3,2),

  created_at TIMESTAMPTZ DEFAULT now()
);

-- Plan effectiveness tracking
CREATE TABLE insights.plan_effectiveness (
  effectiveness_id UUID PRIMARY KEY,
  plan_id UUID NOT NULL,
  version INTEGER NOT NULL,

  -- Metrics
  success_rate DECIMAL(3,2),
  avg_duration_hours DECIMAL(10,2),
  retry_rate DECIMAL(3,2),
  human_intervention_rate DECIMAL(3,2),

  -- Breakdown
  step_effectiveness JSONB,  -- Per-step metrics

  sample_size INTEGER,
  calculated_at TIMESTAMPTZ DEFAULT now()
);

-- Structured post-mortems
CREATE TABLE insights.post_mortems (
  post_mortem_id UUID PRIMARY KEY,
  run_id UUID NOT NULL,

  -- What happened
  summary TEXT NOT NULL,
  timeline JSONB,  -- Key events with timestamps
  root_cause TEXT,
  contributing_factors TEXT[],

  -- What we learned
  lessons JSONB,
  action_items JSONB,

  -- Links
  trajectory_id UUID,
  pattern_ids UUID[],  -- Patterns this confirms/creates

  created_at TIMESTAMPTZ DEFAULT now(),
  created_by TEXT
);
```

### Future Subdomain: Platform

**Purpose**: Unified operational intelligence across all subdomains.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              PLATFORM                                   │
│                                                                         │
│  • Unified health dashboard across all subdomains                       │
│  • Alert management and escalation                                      │
│  • Incident tracking and correlation                                    │
│  • SLA monitoring and reporting                                         │
│  • Cost tracking and forecasting                                        │
│  • Capacity planning for agent resources                                │
│                                                                         │
│  Consumes: Health endpoints from all subdomains, Orchestrator.results   │
│  Produces: Alerts, reports, forecasts, incidents                        │
└─────────────────────────────────────────────────────────────────────────┘
```

**Potential Schema**:

```sql
CREATE SCHEMA platform;

-- Unified system health
CREATE TABLE platform.system_health (
  health_id UUID PRIMARY KEY,
  subdomain TEXT NOT NULL,  -- 'intake', 'portfolio', 'planner', 'orchestrator'

  status TEXT NOT NULL,  -- 'healthy', 'degraded', 'down'
  latency_p50_ms INTEGER,
  latency_p99_ms INTEGER,
  error_rate DECIMAL(5,4),

  details JSONB,

  recorded_at TIMESTAMPTZ DEFAULT now()
);

-- Alert configuration and state
CREATE TABLE platform.alerts (
  alert_id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  subdomain TEXT,  -- NULL for cross-subdomain alerts

  condition JSONB NOT NULL,  -- Alert trigger logic
  severity TEXT NOT NULL,  -- 'info', 'warning', 'critical'

  state TEXT DEFAULT 'ok',  -- 'ok', 'firing', 'acknowledged'
  last_fired_at TIMESTAMPTZ,
  acknowledged_by TEXT,
  acknowledged_at TIMESTAMPTZ,

  notification_channels TEXT[],

  created_at TIMESTAMPTZ DEFAULT now()
);

-- Incident tracking
CREATE TABLE platform.incidents (
  incident_id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  severity TEXT NOT NULL,  -- 'sev1', 'sev2', 'sev3', 'sev4'

  status TEXT DEFAULT 'open',  -- 'open', 'investigating', 'mitigated', 'resolved'

  affected_subdomains TEXT[],
  triggered_by_alert_id UUID,

  started_at TIMESTAMPTZ NOT NULL,
  mitigated_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,

  timeline JSONB,  -- Event log
  root_cause TEXT,

  post_mortem_id UUID  -- Links to insights.post_mortems
);

-- SLA metrics
CREATE TABLE platform.sla_metrics (
  metric_id UUID PRIMARY KEY,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,

  -- Availability
  uptime_percentage DECIMAL(5,4),

  -- Performance
  plan_creation_p99_seconds DECIMAL(10,2),
  run_start_p99_seconds DECIMAL(10,2),

  -- Throughput
  plans_created INTEGER,
  runs_completed INTEGER,
  runs_failed INTEGER,

  calculated_at TIMESTAMPTZ DEFAULT now()
);

-- Cost tracking
CREATE TABLE platform.cost_tracking (
  cost_id UUID PRIMARY KEY,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,

  category TEXT NOT NULL,  -- 'compute', 'llm_tokens', 'storage', 'relay'
  subdomain TEXT,

  amount_cents INTEGER NOT NULL,
  currency TEXT DEFAULT 'USD',

  breakdown JSONB,  -- Detailed cost breakdown

  recorded_at TIMESTAMPTZ DEFAULT now()
);

-- Capacity forecasting
CREATE TABLE platform.capacity_forecast (
  forecast_id UUID PRIMARY KEY,
  resource_type TEXT NOT NULL,  -- 'agent_slots', 'storage_gb', 'llm_tokens_monthly'

  current_usage DECIMAL(20,4),
  current_capacity DECIMAL(20,4),

  forecast_7d DECIMAL(20,4),
  forecast_30d DECIMAL(20,4),
  forecast_90d DECIMAL(20,4),

  recommendation TEXT,  -- 'ok', 'scale_warning', 'scale_critical'

  calculated_at TIMESTAMPTZ DEFAULT now()
);
```

### Phased Extraction Pattern

**Phase 1: Extend Existing** (Now)
- Add basic metrics tables to Orchestrator
- Add simple pattern detection in application code
- No new subdomains

**Phase 2: Extract Insights** (When learning loop becomes valuable)
```
Trigger: "We keep making the same planning mistakes"
Signal: Manual post-mortems reveal recurring patterns
Action: Extract Insights as dedicated subdomain
```

**Phase 3: Extract Platform** (When operational complexity justifies)
```
Trigger: "We need unified alerting across all services"
Signal: Multiple subdomains, multiple teams, SLA requirements
Action: Extract Platform as dedicated subdomain
```

### Extraction Criteria

| Subdomain | Extract When | Keep Embedded If |
|-----------|--------------|------------------|
| **Insights** | Pattern detection adds measurable value to planning; team wants AI learning loop | Post-mortems remain manual; patterns are simple |
| **Platform** | Multiple subdomains in production; SLA commitments; dedicated ops team | Single team; can monitor each subdomain independently |

### Complete Future Architecture

```
                    ┌─────────────────────────────────────────┐
                    │              TRAJECTORIES               │
                    │         (observability layer)           │
                    │   chapters · events · retrospectives    │
                    └─────────────────────────────────────────┘
                                        │
                                        │ feeds
                                        ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   INTAKE    │────▶│  PORTFOLIO  │────▶│   PLANNER   │────▶│ORCHESTRATOR │
│             │     │             │     │             │     │             │
│  channels   │     │  triage     │     │  versions   │     │    runs     │
│  requests   │     │  roadmap    │     │  steps      │     │   results   │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
        │                   │                   │                   │
        │                   │                   │                   │
        └───────────────────┼───────────────────┼───────────────────┘
                            │                   │
                            ▼                   ▼
                    ┌─────────────────────────────────────────┐
                    │               INSIGHTS                  │
                    │          (future subdomain)             │
                    │   patterns · learnings · effectiveness  │
                    └─────────────────────────────────────────┘
                                        │
                                        │ informs
                                        ▼
                    ┌─────────────────────────────────────────┐
                    │               PLATFORM                  │
                    │          (future subdomain)             │
                    │     health · alerts · costs · SLAs      │
                    └─────────────────────────────────────────┘
```

### Key Design Decision

**Phased extraction over upfront complexity.**

We don't need Insights or Platform as separate subdomains today. The four core subdomains + Trajectories handle current needs. But by documenting these future subdomains now:
- We avoid designing ourselves into corners
- We know where cross-cutting concerns should eventually live
- We can incrementally extend existing subdomains knowing extraction is planned
- Teams have a roadmap for when operational maturity requires dedicated services

The trigger for extraction is clear: when the learning loop (Insights) or operational unified view (Platform) becomes valuable enough to justify the coordination cost of a new subdomain boundary.

---

## See Also

- **[Software Reality Engine](./software-reality-engine.md)** — How Planner + Trajectories creates something classic planning tools cannot: a closed-loop system that knows what you want (plans), how you got there (trajectories), and what you actually have (verified reality). Enables drift detection, code archaeology, intelligent continuation, and auto-generated documentation.

- **[Distant Future: Management Intelligence Layer](./future-management-intelligence.md)** — Aspirational vision for a full management operating system including Strategy, Alignment, Organization, People (Performance/Engagement/Coaching), and Governance subdomains. Explores how trajectory capture of both human and agent work could enable unprecedented management intelligence.

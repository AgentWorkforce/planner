# Planner Design: Doing One Thing Well

## The One Thing

**Planner transforms fuzzy intent into structured, versioned, approvable specifications for execution.**

It doesn't originate goals (that's Intake).
It doesn't prioritize goals (that's Portfolio).
It doesn't execute plans (that's Orchestrator).
It doesn't coordinate agents (that's Relay).

It **only** takes a goal and produces a plan that:
- Is structured (DAG of steps with explicit dependencies)
- Is versioned (every meaningful change tracked)
- Is reviewable (humans can understand and approve)
- Is executable (Orchestrator can consume it)

## Why This Matters

### The Problem with Unstructured Planning

Without a dedicated planning layer:
- Goals go directly to execution → no review, no approval, no audit trail
- Plans live in documents → can't be validated, diffed, or versioned
- Changes happen mid-execution → "moving target" problem
- Multiple orchestrators need multiple plan formats → fragmentation

### What Planner Provides

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         FUZZY INTENT                                    │
│                                                                         │
│  "We need dark mode for the app. It should respect system              │
│   preferences and work across all components. Design already           │
│   has mockups. Don't forget accessibility."                            │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           PLANNER                                       │
│                                                                         │
│  PlanVersion v1 (draft):                                               │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Step 1: Audit existing color usage                              │   │
│  │   owner: frontend:Analyst                                       │   │
│  │   criteria: Color inventory document produced                   │   │
│  │   depends_on: []                                                │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                     │                                                   │
│                     ▼                                                   │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Step 2: Define theme token system                               │   │
│  │   owner: frontend:Designer                                      │   │
│  │   criteria: Tokens documented, light/dark values defined        │   │
│  │   depends_on: [step-1]                                          │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                     │                                                   │
│          ┌─────────┴─────────┐                                         │
│          ▼                   ▼                                         │
│  ┌───────────────┐   ┌───────────────┐                                 │
│  │ Step 3: ...   │   │ Step 4: ...   │  (parallel branches)            │
│  └───────────────┘   └───────────────┘                                 │
│          │                   │                                         │
│          └─────────┬─────────┘                                         │
│                    ▼                                                   │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Step 5: Accessibility audit                                     │   │
│  │   owner: frontend:Accessibility                                 │   │
│  │   gate: human_approval (required before release)                │   │
│  │   criteria: WCAG AA contrast ratios pass                        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      STRUCTURED CONTRACT                                │
│                                                                         │
│  - Machine-readable (JSON with schema)                                  │
│  - Human-reviewable (renders to Markdown)                               │
│  - Versionable (v1 → v2 → v3 with diffs)                               │
│  - Validatable (acyclic DAG, valid references)                         │
│  - Approvable (workflow states)                                        │
│  - Immutable once approved                                              │
└─────────────────────────────────────────────────────────────────────────┘
```

## Core Capabilities

### 1. Plan Creation

Transform goal + context into a structured plan.

**Inputs:**
- Goal: What to achieve (required)
- Context: Constraints, preferences, codebase references (optional)
- Suggested structure: Hints for decomposition (optional)

**Outputs:**
- PlanVersion in `draft` status
- Valid DAG of steps with dependencies
- Acceptance criteria for each step
- Owner roles (not specific agents) for each step

**How it might work:**
- Manual: Human writes steps directly (API/CLI/UI)
- AI-assisted: LLM proposes plan from goal, human refines
- Template-based: Apply known pattern with customization
- Hybrid: AI proposes, human edits, AI validates

### 2. Versioning

Track every meaningful change with structural diffs.

**What constitutes a new version:**
- Step added, removed, or modified
- Dependency changed
- Acceptance criteria changed
- Gate added or removed
- NOT: Whitespace, formatting, metadata-only changes

**Diff capabilities:**
- Structural: Which steps changed?
- Field-level: What changed within a step?
- Dependency graph: How did the DAG change?
- Rollback: Can revert to any previous version

**Example diff:**
```json
{
  "from_version": 2,
  "to_version": 3,
  "changes": [
    {
      "type": "step_modified",
      "step_id": "step-3",
      "field_changes": [
        {
          "field": "acceptance_criteria",
          "action": "added",
          "value": { "id": "ac-3-2", "description": "Performance benchmark passes" }
        }
      ]
    },
    {
      "type": "step_added",
      "step": { "step_id": "step-6", "title": "Load testing", ... }
    },
    {
      "type": "dependency_added",
      "from_step": "step-6",
      "to_step": "step-5"
    }
  ]
}
```

### 3. Approval Workflow

State machine for plan lifecycle:

```
                                    archive
                    ┌────────────────────────────────────┐
                    │                                    │
                    ▼                                    │
              ┌──────────┐                               │
   create ──▶ │  draft   │ ◀───┐                        │
              └────┬─────┘     │                        │
                   │           │ request_changes        │
                   │ submit    │                        │
                   ▼           │                        │
              ┌──────────┐     │                        │
              │  review  │ ────┤                        │
              └────┬─────┘     │                        │
                   │           │ reject                 │
                   │ approve   │                        │
                   ▼           │                        │
              ┌──────────┐     │                        │
              │ approved │ ────┘                        │
              └────┬─────┘                              │
                   │                                    │
                   │ publish                            │
                   ▼                                    │
              ┌──────────┐                              │
              │published │ ─────────────────────────────┘
              └──────────┘
                   │
                   │ (Orchestrator fetches)
                   ▼
```

**Key invariants:**
- `approved` and `published` versions are **immutable**
- Any change to an approved version creates a **new version** starting at `draft`
- Only `published` versions are consumable by Orchestrator
- State transitions are audited (who, when, why)

### 4. Validation

Ensure plans are structurally sound before approval.

**Structural validation:**
- DAG is acyclic (no circular dependencies)
- All dependency references exist
- All step IDs are unique
- No orphan steps (unreachable from root)

**Completeness validation:**
- Every step has acceptance criteria
- Owner role is specified
- Description is non-empty
- Gates have valid approver roles

**Semantic validation (optional/advanced):**
- Roles exist in the system
- Dependencies make logical sense
- Estimated effort is reasonable

### 5. Export/Publish

Produce consumable artifacts:

**For Orchestrator:**
- Canonical JSON with full schema
- Stable `plan_ref` (plan_id + version)
- Webhook notification on publish

**For Humans:**
- Markdown rendering of plan
- Visual DAG representation
- Diff reports between versions

**For External Systems (optional):**
- Linear-compatible issue export
- Jira import format
- Custom export adapters

## Interaction Model: Upstream

The layers above Planner (Intake, Triage, Portfolio) are the **source of planning requests**.

### What Upstream Needs from Planner

1. **Create plans from goals**
2. **Get plan status** (for portfolio visibility)
3. **Cancel/archive plans** (when priorities change)
4. **Receive notifications** (when plans are ready)

### API Contract (Upstream → Planner)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    INTAKE / TRIAGE / PORTFOLIO                          │
│                                                                         │
│  "Initiative XYZ needs a plan. Here's the goal and context."           │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                │ POST /plans
                                │ {
                                │   goal: "Implement dark mode",
                                │   context: {
                                │     constraints: ["Must work on iOS"],
                                │     codebase_refs: ["src/styles/"],
                                │     source_initiative: "init-123"
                                │   }
                                │ }
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              PLANNER                                    │
│                                                                         │
│  Creates PlanVersion v1 (draft)                                        │
│  Returns: { plan_id: "plan-456", version: 1, status: "draft" }         │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                │ GET /plans/plan-456/status
                                │ → { status: "approved", version: 3, ... }
                                │
                                │ POST /plans/plan-456/archive
                                │ → { archived: true }
                                │
                                │ Webhook: plan.published
                                │ → { plan_id: "plan-456", version: 3 }
                                ▼
```

### What Upstream Does NOT Do

- Does not modify plans directly (Planner owns plan content)
- Does not approve plans (that's Planner's workflow)
- Does not understand step structure (treats plan as unit)

### Event Flow

```
Portfolio: "Create plan for initiative X"
    │
    ▼
Planner: Creates draft, notifies "plan.created"
    │
    ▼
(Planning happens - AI or human writes steps)
    │
    ▼
Planner: Moves to review, notifies "plan.review_requested"
    │
    ▼
(Reviewers approve)
    │
    ▼
Planner: Moves to approved, notifies "plan.approved"
    │
    ▼
Portfolio: Decides when to publish (based on priorities/capacity)
    │
    ▼
Planner: Publishes, notifies "plan.published"
    │
    ▼
(Orchestrator can now fetch and execute)
```

## Interaction Model: Downstream

The Orchestrator is the **consumer of published plans**.

### What Orchestrator Needs from Planner

1. **Fetch approved/published plans**
2. **Understand step structure** (what to execute)
3. **Request changes** (when execution reveals inadequacy)
4. **Report status** (optional, for run overlay)

### API Contract (Planner → Orchestrator)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           ORCHESTRATOR                                  │
│                                                                         │
│  "I need the plan for execution"                                       │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                │ GET /plans/plan-456
                                │ Accept: application/json
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              PLANNER                                    │
│                                                                         │
│  Returns latest published version:                                     │
│  {                                                                      │
│    plan_id: "plan-456",                                                │
│    version: 3,                                                         │
│    status: "published",                                                │
│    summary: { goal: "Implement dark mode", context: "..." },           │
│    steps: [                                                            │
│      {                                                                 │
│        step_id: "step-1",                                              │
│        title: "Audit existing color usage",                            │
│        description: "...",                                             │
│        owner_role: "frontend:Analyst",                                 │
│        dependencies: [],                                               │
│        acceptance_criteria: [                                          │
│          { id: "ac-1-1", description: "Color inventory produced" }     │
│        ]                                                               │
│      },                                                                │
│      ...                                                               │
│    ]                                                                   │
│  }                                                                      │
└─────────────────────────────────────────────────────────────────────────┘
```

### Change Request Flow

When execution reveals the plan is inadequate:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           ORCHESTRATOR                                  │
│                                                                         │
│  "Step 3 failed - we need an additional step for database migration"   │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                │ POST /plans/plan-456/change-requests
                                │ {
                                │   reason: "Database schema incompatible",
                                │   suggested_changes: {
                                │     add_steps: [{
                                │       title: "Database migration",
                                │       owner_role: "backend:DBA",
                                │       dependencies: ["step-2"],
                                │       ...
                                │     }],
                                │     modify_dependencies: [{
                                │       step_id: "step-3",
                                │       add_dependency: "step-new-migration"
                                │     }]
                                │   }
                                │ }
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              PLANNER                                    │
│                                                                         │
│  1. Records change request                                             │
│  2. Creates new version (v4) in draft                                  │
│  3. Applies suggested changes (if valid)                               │
│  4. Notifies: "change_request.received"                                │
│  5. Returns: { change_request_id, new_version: 4 }                     │
│                                                                         │
│  New version goes through approval workflow again                       │
└─────────────────────────────────────────────────────────────────────────┘
```

### Run Status Overlay (Optional)

Orchestrator can push execution status for visibility:

```
POST /plans/plan-456/runs/run-789/status
{
  run_id: "run-789",
  started_at: "2026-01-27T10:00:00Z",
  step_statuses: [
    { step_id: "step-1", status: "completed", completed_at: "..." },
    { step_id: "step-2", status: "running", started_at: "..." },
    { step_id: "step-3", status: "pending" }
  ]
}
```

This is **read-only from Planner's perspective** - it just displays the status. Planner does not control execution.

## The Universal Plan Format

What makes the format work with any orchestrator:

### Orchestrator-Agnostic Elements

```typescript
interface PlanVersion {
  // Identity
  plan_id: string;
  version: number;
  status: 'draft' | 'approved' | 'published';  // 3 states (AI reviews continuously)

  // Human context
  summary: {
    goal: string;
    context?: string;
  };

  // The work (universal structure)
  steps: Step[];

  // Timestamps
  created_at: string;
  updated_at: string;
}

interface Step {
  // Identity
  step_id: string;
  title: string;
  dependencies: string[];       // DAG structure

  // Step type: primitive (actual work) or compound (expands to sub-plan)
  type: 'primitive' | 'compound';

  // Primitive step fields
  description?: string;
  owner_role?: string;          // Role, not specific agent
  acceptance_criteria?: AcceptanceCriterion[];
  gate?: {
    type: 'human_approval';
    approver_role?: string;
  };
  priority?: 1 | 2 | 3;
  estimates?: { effort?: string };
  notes?: string;

  // Compound step fields (for large plans)
  sub_plan_id?: string;         // Reference to another PlanVersion

  // Orchestrator-specific (opaque to Planner)
  metadata?: Record<string, unknown>;
}
```

See [planner-scale.md](./planner-scale.md) for handling large plans with compound steps.

### Why This Works

| Element | LangGraph | CrewAI | Temporal | Airflow |
|---------|-----------|--------|----------|---------|
| `step_id` | Node ID | Task ID | Activity ID | Task ID |
| `dependencies` | Graph edges | `context` | Code flow | `>>` operator |
| `owner_role` | — | Agent role | Worker queue | — |
| `acceptance_criteria` | Output validation | Task expected output | Activity result check | Sensor |
| `gate` | Breakpoint | `human_input` | Signal/wait | External sensor |
| `metadata` | State hints | Agent config | Retry policy | Operator params |

The orchestrator translates universal format → native execution model.

## What "Doing One Thing Well" Means

### Planner Is:

1. **The authoritative source of structured intent**
   - Single source of truth for what should happen
   - Not scattered across documents, tickets, conversations

2. **A versioning system for plans**
   - Like Git for code, but for plans
   - Every change tracked, diffable, reversible

3. **An approval workflow engine**
   - Ensures human oversight before execution
   - Creates audit trail

4. **A validation layer**
   - Catches structural problems before execution
   - Ensures plans are executable

5. **A contract provider**
   - Published plan is the agreement
   - Orchestrator executes what was approved

### Planner Is NOT:

1. **A task queue** (that's Orchestrator)
2. **A scheduler** (that's Orchestrator)
3. **An agent coordinator** (that's Relay + Orchestrator)
4. **A project management tool** (that's Linear/Jira/etc.)
5. **A portfolio manager** (that's a separate layer)
6. **An execution engine** (absolutely not)

## Design Principles

### 1. Separation of Planning and Execution

The plan is a specification, not a program. Planner doesn't know:
- Which agents will do the work
- How retries will be handled
- What concurrency strategy to use
- When steps will actually run

This separation enables:
- Review before execution
- Multiple orchestration strategies
- Clear audit trail
- Reuse of plans

### 2. Immutability After Approval

Once a plan is approved:
- Its content cannot change
- New versions can be created, but don't modify the approved one
- Orchestrator always executes what was approved

This creates:
- Reliable contracts
- Audit trail integrity
- No "moving target" during execution

### 3. Roles Over Agents

Plans specify `owner_role`, not specific agents:
- "backend:Coder" not "agent-123"
- "frontend:Designer" not "claude-instance-456"

This enables:
- Agent substitution
- Load balancing
- Capability-based routing

### 4. Human-in-the-Loop by Default

Plans assume oversight:
- Drafts require submission for review
- Approval is explicit, not automatic
- Gates can block execution for sign-off
- Every state transition is audited

### 5. Structure Enables Tooling

Because plans have schema:
- Validation catches errors early
- Diffs show meaningful changes
- Visualization is possible
- Export to other formats works

## Summary

**Planner does one thing well: it turns fuzzy intent into structured, versioned, approvable contracts for execution.**

It interacts upstream (Intake/Triage/Portfolio) by:
- Receiving goals and context
- Reporting plan status
- Accepting archive/cancel requests
- Sending lifecycle notifications

It interacts downstream (Orchestrator) by:
- Providing approved plans on demand
- Accepting change requests
- Optionally displaying run status

Everything else—execution, coordination, scheduling, resource allocation—belongs to other layers.

The plan is the contract. Planner is the notary.

# Forge "Knobs" Architecture Analysis

> Based on Anthropic's research on incoherence in long reasoning chains, this document analyzes how Forge currently implements (or doesn't) tunable control knobs for managing variance, recovery, and learning in agentic execution.

**Reference**: [The Hot Mess of AI](https://alignment.anthropic.com/2026/hot-mess-of-ai/) - Anthropic Research, 2026

## The DOT Framework

The email proposes three interlocking systems that compound when combined:

| System | Purpose | Failure Mode Without |
|--------|---------|---------------------|
| **Decomposition** | Reduces variance (smaller, well-specified steps) | High-variance runs |
| **Orchestration** | Catches failures early, enables recovery | Errors compound unchecked |
| **Trajectories** | Makes failures debuggable and avoidable | Failures are black boxes |

**Key Insight**: Decomposition + Orchestration + Trajectories are durable architectural patterns regardless of model improvements.

---

## Current Forge Architecture Overview

### What Forge Has

| Component | Status | Notes |
|-----------|--------|-------|
| Run/Task execution | ✅ Solid | State machine, status transitions |
| Trajectory capture | ✅ Comprehensive | 34 event types with schemas |
| Checkpointing | ✅ Implemented | Fire-and-forget async snapshots |
| Human gates | ✅ Implemented | Approval workflow |
| Questions | ✅ Implemented | Blocking levels, priority scoring |
| User decision learning | ✅ Implemented | Similarity-based auto-answer |
| Guardian observers | ✅ Implemented | Security, Architect, QA, Compliance |
| Recovery service | ✅ Implemented | Orphan detection, retry on restart |
| Retrospectives | ✅ Implemented | Confidence capture (unused) |

### What Forge Lacks

| Capability | Status | Impact |
|------------|--------|--------|
| Decomposition control | ❌ Missing | Plans are flat, no hierarchy |
| Execution budgets | ❌ Missing | No token/time tracking |
| Variance control | ❌ Missing | No thresholds, no replan triggers |
| Recovery strategies | ⚠️ Partial | Only retry, no rollback/branch/escalate |
| Ensembling | ❌ Missing | One agent per task |
| Drift detection | ❌ Missing | No pattern comparison |
| Trajectory injection | ❌ Missing | Agents don't reason WITH trajectory |
| Parallelism control | ❌ Missing | No concurrency limits |
| Confidence handling | ⚠️ Captured but unused | No control flow integration |

---

## Knob Categories

### 1. Planning Knobs (Before Execution)

#### 1.1 Decomposition Depth

**Current State**: Plans are flat arrays of `ForgeStep`. The `sub_plan_id` field exists in Planner types but is not implemented in Forge.

**Vision**: Control when task X becomes a 5-step vs 50-step plan based on:
- Novelty (new domain = more decomposition)
- Dependency complexity
- Verification cost

**Proposed Schema**:
```typescript
decomposition_config: {
  max_step_complexity: 'atomic' | 'simple' | 'compound',
  auto_decompose_threshold: number,  // Token estimate threshold
  allow_sub_plans: boolean,
}
```

**Gap Analysis**:
- No complexity estimation per step
- No sub-plan creation/execution
- No hierarchical run management

---

#### 1.2 Agent Fit

**Current State**: Coarse `owner_role` → CLI mapping in `ForgeConfig`. One CLI per role.

```typescript
// Current
role_cli_mapping: {
  "backend:Coder": { cli: "claude", timeout: 300, audit: true }
}
```

**Vision**: Select agent based on:
- Fast/cheap vs slow/reliable
- Tool-using vs reasoning-only
- Specialist vs generalist

**Proposed Schema**:
```typescript
// Extended CLI config
{
  cli: string,
  timeout: number,
  audit: boolean,
  // NEW:
  cost_profile: 'cheap' | 'standard' | 'premium',
  speed_profile: 'fast' | 'balanced' | 'thorough',
  capability_requirements: ['tool_use', 'reasoning', 'code_gen', 'review'],
  token_budget: number,
  model_preference: string,  // e.g., "haiku", "sonnet", "opus"
}

// Per-step override
step.agent_fit_override: {
  prefer_model: string,
  require_capabilities: string[],
}
```

**Gap Analysis**:
- No model selection logic
- No capability matching
- No cost/speed trade-off configuration

---

#### 1.3 Task Contracts

**Current State**: Acceptance criteria exist but are free-form text. No explicit input/output schemas.

```typescript
// Current
acceptance_criteria: [
  { id: "ac1", description: "Tests pass", type: "test" }
]
```

**Vision**: Explicit inputs, outputs, and "done" definitions so downstream steps don't guess.

**Proposed Schema**:
```typescript
contract: {
  inputs: [
    { name: string, type: 'artifact' | 'context' | 'parameter', source: string, required: boolean }
  ],
  outputs: [
    { name: string, type: ArtifactType, validation: 'exists' | 'schema' | 'test' | 'human' }
  ],
  done_definition: {
    all_outputs_present: boolean,
    acceptance_criteria_pass: boolean,
    custom_check: string,  // Script/command
  }
}
```

**Gap Analysis**:
- No structured input/output tracking
- No output validation beyond audit
- No contract enforcement

---

### 2. Execution Knobs (During the Run)

#### 2.1 Variance Control

**Current State**:
- No budgets (token, time, cost)
- No consistency rules
- No replan triggers
- Retry is unlimited (no max attempts enforced)

**Vision**: Step checks, consistency rules, budgets, "replan vs continue" triggers.

**Proposed Schema**:
```typescript
execution_policy: {
  // Budgets
  total_token_budget: number,
  per_task_token_budget: number,
  total_time_budget_seconds: number,
  per_task_time_budget_seconds: number,

  // Retry control
  max_retries_per_task: number,
  retry_backoff: 'none' | 'linear' | 'exponential',

  // Replan triggers
  replan_on_cascade_failure: boolean,
  replan_threshold_blocked_tasks: number,

  // Consistency
  require_deterministic_outputs: boolean,
  output_drift_threshold: number,  // 0-1
}
```

**Gap Analysis**:
- No token tracking infrastructure
- No time tracking per task (only CLI timeout)
- No replan mechanism exists

---

#### 2.2 Dependencies & Parallelism

**Current State**:
- Dependencies enforced via `getReadyTasks()`
- All ready tasks execute independently
- No concurrency limits
- No conflict detection

**Vision**: Sequential vs parallel control, conflict merge strategies.

**Proposed Schema**:
```typescript
parallelism: {
  max_concurrent_tasks: number,
  max_concurrent_per_scope: number,
  prefer_sequential_in_scope: boolean,
  conflict_resolution: 'queue' | 'fail' | 'merge',
}
```

**Gap Analysis**:
- No task queue/scheduler
- No scope-based isolation
- No conflict detection

---

#### 2.3 State & Memory

**Current State**:
- Checkpoints capture run state for recovery
- No rollback capability (forward-only)
- No state isolation per task
- Workspaces created but cleanup is time-based

**Vision**: Read-only vs changeable state, snapshot/rollback capability.

**Proposed Schema**:
```typescript
state_management: {
  snapshot_frequency: 'per_task' | 'per_gate' | 'on_demand',
  enable_rollback: boolean,
  rollback_strategy: 'task' | 'scope' | 'full_run',
  preserve_artifacts_on_rollback: boolean,
}
```

**Gap Analysis**:
- Checkpoints exist but can't rollback
- No pre-task snapshots
- No artifact preservation logic

---

### 3. Recovery Knobs (When Things Go Wrong)

#### 3.1 Verification

**Current State**:
- Audit service with findings (pass/fail per criterion)
- Binary: audit enabled or disabled per role
- No risk-based check selection

**Vision**: Cheap checks always-on, heavy checks on high-risk steps.

**Proposed Schema**:
```typescript
verification: {
  risk_level: 'low' | 'medium' | 'high' | 'critical',

  // Always run
  quick_checks: ['output_exists', 'no_errors', 'format_valid'],

  // Risk-based
  deep_checks: ['test_suite', 'security_scan', 'human_review'],
  deep_check_threshold: 'low' | 'medium' | 'high',
}
```

**Gap Analysis**:
- No risk classification
- No tiered verification
- No check selection logic

---

#### 3.2 Recovery Strategy

**Current State**:
- Only retry (create new attempt)
- No rollback
- No alternative path selection
- Escalation is manual (gates/questions)

**Vision**: Retry vs revise vs rollback vs branch vs human escalation.

**Proposed Schema**:
```typescript
recovery_strategy: {
  on_failure: 'retry' | 'revise' | 'rollback' | 'branch' | 'escalate' | 'skip',

  retry_config: {
    max_attempts: number,
    backoff_seconds: number,
  },

  revise_config: {
    prompt_modifier: string,
    max_revisions: number,
  },

  escalation_config: {
    escalate_to: 'gate' | 'question' | 'abort',
    escalation_message: string,
  },
}
```

**Gap Analysis**:
- No revise logic (modified prompt retry)
- No rollback implementation
- No branch/alternative path
- No automatic escalation

---

#### 3.3 Ensembling

**Current State**: One agent per task. No parallel execution strategies.

**Vision**: Run 2-5 independent implementations on critical steps, aggregate results.

**Proposed Schema**:
```typescript
ensemble: {
  enabled: boolean,
  parallel_attempts: number,  // 2-5

  variant_strategy: 'same_prompt' | 'varied_prompts' | 'different_models',

  aggregation: 'first_success' | 'majority_vote' | 'human_select',
}
```

**Gap Analysis**:
- No multi-agent task execution
- No result aggregation
- No variant generation

---

### 4. Trajectory Knobs (What We Capture & How We Use It)

#### 4.1 Query-During-Run

**Current State**:
- Events queryable via API (`listTrajectoryEvents`)
- SSE streaming for real-time updates
- **NOT** injected into agent prompts

**Vision**: Agent reasons WITH the trajectory, not just leaves it behind.

**Proposed Schema**:
```typescript
trajectory_injection: {
  enabled: boolean,

  inject_on_task_start: {
    include_run_summary: boolean,
    include_recent_decisions: number,  // Last N
    include_similar_past_tasks: boolean,
  },

  inject_on_retry: {
    include_previous_attempt: boolean,
    include_failure_analysis: boolean,
  },
}
```

**Gap Analysis**:
- No trajectory → prompt pipeline
- No relevance filtering
- No context assembly service

---

#### 4.2 Granularity

**Current State**: 34 event types captured, including tool calls. Not configurable.

**Vision**: Configure what to capture - every tool call vs just decisions and chapter boundaries.

**Proposed Schema**:
```typescript
trajectory_granularity: {
  capture_level: 'minimal' | 'standard' | 'verbose',

  // Minimal: run/task lifecycle only
  // Standard: + decisions, gates, questions
  // Verbose: + tool calls, progress updates

  custom_events: string[],  // Additional event types to capture
}
```

**Gap Analysis**:
- No configurable capture level
- All 34 types always captured
- Storage grows unbounded

---

#### 4.3 Active Query ("Does this contradict step 3?")

**Current State**: No self-checking mechanism for agents.

**Vision**: Agent actively queries trajectory for consistency.

**Proposed Schema**:
```typescript
active_query: {
  enabled: boolean,

  consistency_checks: [
    { type: 'decision_alignment', scope: 'run' | 'task' },
    { type: 'output_compatibility', scope: 'dependencies' },
  ],

  on_inconsistency: 'warn' | 'block' | 'human_review',
}
```

**Gap Analysis**:
- No consistency check service
- No agent → trajectory query interface
- No inconsistency detection

---

#### 4.4 Cross-Run Memory

**Current State**:
- `UserTrajectoryService` tracks user decisions across runs
- Similarity-based lookup (Levenshtein)
- Auto-answer from trajectory history
- **NOT** full trajectory precedent lookup

**Vision**: Query past trajectories for precedent - "How did we solve this before?"

**Proposed Schema**:
```typescript
cross_run_memory: {
  enabled: boolean,

  precedent_lookup: {
    similarity_threshold: number,
    max_precedents: number,
    scope: 'user' | 'organization' | 'global',
  },

  learning: {
    store_successful_patterns: boolean,
    store_failure_patterns: boolean,
  },
}
```

**Gap Analysis**:
- Only user decisions stored, not full patterns
- No successful pattern library
- No failure pattern library

---

#### 4.5 Drift Detection

**Current State**: No drift detection.

**Vision**: When does inconsistency trigger a flag vs just get logged?

**Proposed Schema**:
```typescript
drift_detection: {
  enabled: boolean,

  monitor: ['output_format', 'decision_pattern', 'time_pattern', 'error_rate'],

  alert_threshold: number,  // 0-1

  on_alert: 'log' | 'question' | 'pause' | 'abort',
}
```

**Gap Analysis**:
- No baseline pattern establishment
- No drift comparison logic
- No alert mechanism

---

#### 4.6 Handoff Context

**Current State**: No explicit context passing between agents.

**Vision**: How does Agent B inherit Agent A's trajectory as working memory, not just history?

**Proposed Schema**:
```typescript
handoff_context: {
  artifacts: Artifact[],

  decisions: [{
    decision_id: string,
    description: string,
    reasoning: string,
    alternatives_considered: string[],
  }],

  concerns: string[],

  context_summary: string,
}
```

**Gap Analysis**:
- No structured handoff creation
- No context inheritance mechanism
- No working memory transfer

---

### 5. Meta Knobs (Cross-Cutting)

#### 5.1 Budgeting

**Current State**:
- CLI timeout per role
- `FORGE_AGENT_STUCK_THRESHOLD` env var (5 min default)
- No token tracking
- No cost tracking

**Vision**: Token/time allocation; where to spend based on phase (MVP: build fast vs Production: prioritize validation).

**Proposed Schema**:
```typescript
budgeting: {
  phase: 'mvp' | 'development' | 'production',

  allocation: {
    mvp: { speed_weight: 0.8, quality_weight: 0.2 },
    development: { speed_weight: 0.5, quality_weight: 0.5 },
    production: { speed_weight: 0.2, quality_weight: 0.8 },
  },

  limits: {
    total_tokens: number,
    total_cost_usd: number,
    total_time_seconds: number,
  },
}
```

**Gap Analysis**:
- No phase-aware allocation
- No token metering
- No cost tracking

---

#### 5.2 Confidence Handling

**Current State**:
- `Retrospective.confidence` captured (0-1)
- `UserPreference.confidence` calculated from evidence count
- **NOT** used in control flow

**Vision**: What does "low confidence" trigger? Clarify, re-run, or escalate?

**Proposed Schema**:
```typescript
confidence_policy: {
  low_confidence_threshold: number,  // e.g., 0.5

  on_low_confidence: 'continue' | 'clarify' | 'rerun' | 'escalate',

  require_confidence_above: number,  // Minimum to pass
}
```

**Gap Analysis**:
- Confidence captured but ignored
- No threshold checking
- No control flow integration

---

## Implementation Priority

### High Priority (Foundation)

| Change | Effort | Rationale |
|--------|--------|-----------|
| Add `ExecutionPolicy` to Run | Medium | Enables budget tracking and retry control |
| Build `TrajectoryContextBuilder` | Medium | Enables agents to reason WITH trajectory |
| Wire confidence to control flow | Low | Already captured, just needs integration |
| Add recovery strategy config | Medium | Extends beyond simple retry |

### Medium Priority (Capability)

| Change | Effort | Rationale |
|--------|--------|-----------|
| Build `DriftMonitor` | High | Pattern comparison is complex |
| Add ensembling support | High | Multi-agent execution infrastructure |
| Implement decomposition | High | Requires hierarchical run management |
| Add parallelism control | Medium | Task scheduler with limits |

### Low Priority (Polish)

| Change | Effort | Rationale |
|--------|--------|-----------|
| Configurable trajectory granularity | Low | Already comprehensive |
| Cross-run precedent library | Medium | Builds on existing UserTrajectory |
| Phase-aware budget allocation | Low | Configuration only |

---

## Open Questions

1. **Where do knobs live?**
   - Per-run (ExecutionPolicy on Run entity)?
   - Per-organization (ForgeConfig)?
   - Per-step (Step-level overrides)?
   - Combination (inherit with override)?

2. **How do knobs interact?**
   - Does high confidence override low budget?
   - Does ensemble override parallelism limits?
   - Need a priority/conflict resolution model.

3. **Who sets the knobs?**
   - Planner (during plan creation)?
   - Human (during run creation)?
   - System (based on learned patterns)?
   - Portfolio (governance rules)?

4. **How do we learn optimal knob settings?**
   - Track correlation between knob settings and outcomes
   - Build heuristics over time
   - Eventually: auto-tune based on task characteristics

---

## Deep-Dive Analysis

### Services Layer (14 Services)

#### CheckpointService (`checkpointing.ts:36-179`)

**Purpose**: Create durability snapshots of run state for recovery after restarts.

**Key Integration Points**:
- **Injection point**: `GetActiveAgentsFn` (line 9-type, line 41-ctor)
- **Triggers**: manual, task_completed, task_failed, gate_resolved, run_paused, run_resumed, agent_spawned, agent_released (line 14-22)
- **Non-blocking**: Fire-and-forget via `createCheckpointAsync()` (line 82)

**Knob Integration**:
- ✅ Fully injectable (no hardcoded agent assumptions)
- Could add: Checkpoint frequency configuration (per-task vs per-gate vs on-demand)
- Could add: Pre-task snapshots for rollback capability

#### RecoveryService (`recovery.ts:83-276`)

**Purpose**: Recover active runs after Forgemaster restart.

**Current Capabilities**:
- Orphan detection: Compare expected vs actual agents
- Retry logic: Retry tasks for missing agents
- Configurable: `orphanGracePeriodMs` (default 30s)

**Knob Integration**:
- ❌ Only retry strategy (no rollback, no branch, no escalate)
- Could add: Recovery strategy selection per task
- Could add: Automatic escalation on repeated failures

#### HealthMonitor (`health-monitor.ts:57-291`)

**Purpose**: Track agent heartbeats and detect stuck agents.

**Configuration**:
- `stuckThresholdMs` (line 10, default 300000ms = 5min, env: `FORGE_AGENT_STUCK_THRESHOLD`)
- `checkIntervalMs` (line 16, default 60000ms = 1min)
- `autoStart` (line 22, default false)

**Knob Integration**:
- ✅ All thresholds configurable via constructor or `updateConfig()`
- ✅ Callback-driven via `onStuckAgents(callback)` (line 113)
- Could add: Per-task stuck thresholds based on expected duration

#### TrajectoryCapture (`trajectory-capture.ts:40-283`)

**Purpose**: Capture and persist all execution events.

**Events/Side Effects**:
- Validates payload against Zod schema (line 78)
- Stores event via storage (line 97) - non-blocking
- Emits 'trajectory' event for SSE subscribers (line 106)

**Knob Integration**:
- ✅ Validation modes: Strict vs lenient via `strictValidation` option (line 59)
- ❌ No configurable capture level (all 34 types always captured)
- Could add: Event filtering based on granularity setting

#### QuestionService (`question-service.ts:94-687`)

**Purpose**: Manage question queue with deduplication, auto-answer, and timeout.

**Auto-Answer Mechanism**:
1. Check trajectory for answered questions (line 148-183)
2. Check pending questions for subscription (line 186-205)
3. Similarity threshold: default 0.8 (line 145)
4. Auto-default on timeout (line 434-462)

**Knob Integration**:
- ✅ Configurable timeout: `defaultTimeoutMs` (default 5min)
- ✅ Similarity threshold configurable
- Could add: Per-question auto-answer policy
- Could add: Escalation rules based on blocking level

#### RetrospectiveService (`retrospective-service.ts`)

**Purpose**: Capture agent reflections including confidence scores.

**Current State**:
- `Retrospective.confidence` captured (0-1)
- **NOT** used in control flow

**Knob Integration**:
- ❌ Confidence captured but ignored
- Could add: Confidence threshold for task acceptance
- Could add: Low-confidence escalation triggers

---

### MCP Tools Analysis (6 Tools)

#### Current Tools

| Tool | Purpose | Limitations |
|------|---------|-------------|
| `report_progress` | Binary progress tracking | No detailed state, no historical patterns |
| `report_complete` | Mark task completed with artifacts | No verification of artifacts, automatic state transition |
| `report_blocked` | Signal blockage | Suggestions are hints only, no severity/urgency |
| `request_human_input` | Request human decision | No context attachment, opaque priority score |
| `record_decision` | Document decisions | No confidence, no validation against criteria |
| `report_audit_result` | Report criterion validation | Binary pass/fail, no remediation guidance |

#### Critical Missing Tools

**Gap 1: Query-During-Run** (Critical for reasoning)

Agents cannot query run state while executing. Scenarios blocked:
- Coder agent: "Have I already fixed this file in this run?"
- Auditor: "What was the acceptance criteria for this step?"
- Next agent: "What did the previous agent document?"

```typescript
// Proposed: query_run_state
{
  name: 'query_run_state',
  parameters: {
    task_id: UUID,
    query_type: 'run_summary' | 'task_history' | 'completed_steps' | 'blocked_steps'
  }
}
```

**Gap 2: Trajectory Query** (For consistency checking)

```typescript
// Proposed: query_trajectory
{
  name: 'query_trajectory',
  parameters: {
    run_id: UUID,
    query: {
      event_types?: string[],
      task_id?: UUID,
      since?: ISO8601,
      contains_decision_about?: string
    }
  }
}
```

**Gap 3: Handoff Context** (For agent-to-agent communication)

```typescript
// Proposed: get_handoff_context
{
  name: 'get_handoff_context',
  parameters: {
    task_id: UUID
  },
  response: {
    predecessor_decisions: Decision[],
    artifacts_available: Artifact[],
    concerns_raised: string[],
    context_summary: string
  }
}
```

**Gap 4: Signal Uncertainty** (For confidence handling)

```typescript
// Proposed: signal_confidence
{
  name: 'signal_confidence',
  parameters: {
    task_id: UUID,
    confidence: number,  // 0-1
    reason?: string,
    should_escalate?: boolean
  }
}
```

---

### Storage Schema Analysis

#### Current Tables (14)

| Category | Tables |
|----------|--------|
| Core Execution | `runs`, `tasks`, `task_attempts`, `artifacts`, `gates` |
| Human Interaction | `questions`, `workspace_cleanup` |
| Trajectory | `trajectory_events`, `guardian_trajectories`, `active_guardians` |
| User Learning | `user_trajectory_events`, `user_preferences` |
| Durability | `checkpoints` |

#### Missing Data Structures

**1. Execution Budgets** - No tracking or enforcement at run level
- No global token budget tracking
- No cost accumulation across tasks
- No budget exhaustion events

**2. Run-Level Policies** - Policies are implicit in code, not data-driven
- Retry logic hardcoded in application layer
- Gates are task-level, not run-level
- No storage of policy decisions or overrides

**3. Cross-Run Learning** - No baseline storage for learning
- No aggregated metrics or baselines
- No pattern detection across runs
- No "this task usually takes 5-10 minutes" baseline

**4. Drift Detection** - No systematic approach
- No baseline storage for comparison
- No drift score or alert mechanism

---

### Proposed Schema Extensions

#### 1. RUN_POLICIES Table

```sql
CREATE TABLE run_policies (
  policy_id TEXT PRIMARY KEY NOT NULL,
  run_id TEXT NOT NULL UNIQUE,

  -- Execution limits
  max_retries_per_task INTEGER DEFAULT 3,
  max_concurrent_tasks INTEGER DEFAULT 5,
  timeout_minutes INTEGER,

  -- Token/Cost budgets
  token_budget INTEGER,
  cost_budget REAL,
  cost_currency TEXT DEFAULT 'USD',

  -- Approval policies
  approval_required_for_cost_above REAL,
  approval_required_for_error BOOLEAN DEFAULT 0,

  -- Agent policies
  allow_agent_tool_use BOOLEAN DEFAULT 1,
  require_audit BOOLEAN DEFAULT 1,
  require_retrospective BOOLEAN DEFAULT 1,

  -- Metadata
  source TEXT CHECK (source IN ('default', 'plan', 'override', 'template')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,

  FOREIGN KEY (run_id) REFERENCES runs(run_id) ON DELETE CASCADE
);
```

#### 2. RUN_BUDGETS Table (Real-time Consumption)

```sql
CREATE TABLE run_budgets (
  budget_id TEXT PRIMARY KEY NOT NULL,
  run_id TEXT NOT NULL UNIQUE,

  -- Token tracking
  tokens_allowed INTEGER NOT NULL,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  tokens_reserved INTEGER NOT NULL DEFAULT 0,

  -- Cost tracking
  cost_allowed REAL NOT NULL,
  cost_used REAL NOT NULL DEFAULT 0,
  cost_reserved REAL NOT NULL DEFAULT 0,

  -- Time tracking
  time_allowed_seconds INTEGER,
  time_used_seconds INTEGER DEFAULT 0,

  -- Exhaustion events
  status TEXT NOT NULL DEFAULT 'active' CHECK (
    status IN ('active', 'low_warning', 'exceeded', 'paused', 'cancelled')
  ),
  exhaustion_at TEXT,
  exhaustion_reason TEXT,

  last_updated_at TEXT NOT NULL,

  FOREIGN KEY (run_id) REFERENCES runs(run_id) ON DELETE CASCADE
);
```

#### 3. EXECUTION_BASELINES Table (For Drift Detection)

```sql
CREATE TABLE execution_baselines (
  baseline_id TEXT PRIMARY KEY NOT NULL,

  -- Scope
  scope_type TEXT NOT NULL CHECK (scope_type IN ('step_type', 'role', 'project', 'global')),
  scope_value TEXT NOT NULL,

  -- Metrics
  metric_type TEXT NOT NULL CHECK (metric_type IN (
    'duration_ms', 'token_usage', 'retry_count', 'success_rate', 'cost'
  )),

  -- Statistics
  sample_count INTEGER NOT NULL DEFAULT 0,
  mean_value REAL NOT NULL,
  std_dev REAL NOT NULL DEFAULT 0,
  min_value REAL NOT NULL,
  max_value REAL NOT NULL,
  p50_value REAL,
  p95_value REAL,

  -- Drift detection
  drift_threshold_multiplier REAL DEFAULT 2.0,

  last_updated_at TEXT NOT NULL,

  UNIQUE (scope_type, scope_value, metric_type)
);
```

#### 4. TASK_EXECUTION_METRICS Table (For Learning)

```sql
CREATE TABLE task_execution_metrics (
  metric_id TEXT PRIMARY KEY NOT NULL,
  run_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  step_id TEXT NOT NULL,

  -- Timing
  started_at TEXT NOT NULL,
  ended_at TEXT,
  duration_ms INTEGER,

  -- Resource usage
  tokens_input INTEGER,
  tokens_output INTEGER,
  cost_usd REAL,

  -- Outcome
  attempt_number INTEGER NOT NULL,
  outcome TEXT CHECK (outcome IN ('success', 'failure', 'timeout', 'blocked')),
  error_category TEXT,

  -- For learning
  actual_complexity TEXT CHECK (actual_complexity IN ('trivial', 'low', 'medium', 'high')),
  was_decomposed BOOLEAN DEFAULT 0,
  agent_fit_score REAL,

  FOREIGN KEY (run_id) REFERENCES runs(run_id) ON DELETE CASCADE,
  FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE CASCADE
);
```

---

### Planner-Forge Contract Extensions

#### Current Flow: Planner → Forge

```
ForgePlan {
  plan_id, version, goal, steps[]
}

ForgeStep {
  step_id, title, description, scope?, owner_role?,
  dependencies[], acceptance_criteria[], gate?,
  repo_url?, cli?, audit?
}
```

#### Missing: ExecutionPolicy in Plan

```typescript
export const ExecutionPolicySchema = z.object({
  // Parallelization
  parallelization: z.object({
    max_concurrent_tasks: z.number().int().positive().optional(),
    prefer_sequential: z.boolean().default(false),
    parallel_groups: z.array(z.array(z.string())).optional(),
  }).optional(),

  // Decomposition guidance
  decomposition: z.object({
    allow_recomposition: z.boolean().default(true),
    prefer_atomic: z.boolean().default(false),
    max_subtask_depth: z.number().int().min(1).default(2),
  }).optional(),

  // Failure handling
  failure_handling: z.object({
    max_retries: z.number().int().default(3),
    escalate_on: z.array(z.enum(['timeout', 'auth_error', 'resource_exhaustion'])).optional(),
    pause_on_failure_count: z.number().int().optional(),
  }).optional(),

  // Budget hints
  budgets: z.object({
    target_cost_usd: z.number().optional(),
    max_cost_usd: z.number().optional(),
    time_limit_minutes: z.number().optional(),
  }).optional(),
});
```

#### Missing: ExecutionHints per Step

```typescript
export const ExecutionHintsSchema = z.object({
  // Task contract clarity
  context_needs: z.array(z.string()).optional(),
  output_contract: z.object({
    type: z.string(),
    format: z.string().optional(),
    example: z.string().optional(),
  }).optional(),

  // Decomposition hints
  decomposable: z.boolean().optional(),
  atomic_subtasks: z.array(z.object({
    name: z.string(),
    description: z.string(),
  })).optional(),

  // Agent fit
  complexity_estimate: z.enum(['trivial', 'low', 'medium', 'high']).optional(),
  skill_requirements: z.array(z.string()).optional(),

  // Execution policies
  max_duration_minutes: z.number().optional(),
  prefer_human_supervision: z.boolean().optional(),
});
```

#### Missing: Feedback Loop to Planner

```typescript
export const TaskExecutionResultSchema = z.object({
  task_id: z.string().uuid(),
  step_id: z.string(),

  // Timing
  started_at: z.string(),
  ended_at: z.string(),
  duration_seconds: z.number(),

  // Outcome
  outcome: z.enum(['success', 'failure', 'timeout', 'blocked']),
  error_message: z.string().optional(),

  // Execution metrics (for learning)
  actual_complexity: z.enum(['trivial', 'low', 'medium', 'high']).optional(),
  required_retries: z.number().optional(),
  agent_fit_score: z.number().optional(),

  // Suggestions for future planning
  suggestions: z.object({
    should_always_decompose: z.boolean().optional(),
    should_run_sequential: z.boolean().optional(),
    insufficient_context: z.array(z.string()).optional(),
    missing_prerequisite_steps: z.array(z.string()).optional(),
  }).optional(),
});
```

---

### Trajectory Event Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     EVENT SOURCES                               │
│                                                                 │
│    ┌───────────────────┐              ┌───────────────────────┐ │
│    │  MCP TOOLS        │              │  STATE TRANSITIONS    │ │
│    │  (Agents call)    │              │  (Domain logic)       │ │
│    │                   │              │                       │ │
│    │  • record-decision│              │  • trackedTransition  │ │
│    │  • report-progress│              │    Run()              │ │
│    │  • report-complete│              │  • trackedTransition  │ │
│    │  • report-audit   │              │    Task()             │ │
│    │  • request-human  │              │  • trackGateReached() │ │
│    │  • report-blocked │              │  • trackAgentSpawned()│ │
│    └─────────┬─────────┘              └───────────┬───────────┘ │
│              └────────────────┬───────────────────┘             │
└───────────────────────────────┼─────────────────────────────────┘
                                │
                                ▼
          ┌─────────────────────────────────────────┐
          │   TrajectoryCapture.capture()           │
          │   (trajectory-capture.ts)               │
          └─────────────────────┬───────────────────┘
                                │
          ┌─────────────────────┼─────────────────────┐
          │                     │                     │
          ▼                     ▼                     ▼
    ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
    │  VALIDATE   │     │   STORE     │     │   EMIT      │
    │  (Zod)      │     │  (SQLite)   │     │  (SSE)      │
    └─────────────┘     └─────────────┘     └─────────────┘
```

#### All 34 Event Types

**Run Lifecycle (6)**: RunStarted, RunCompleted, RunFailed, RunPaused, RunCancelled, RunResumed

**Task Lifecycle (6)**: TaskStarted, TaskCompleted, TaskFailed, TaskBlocked, TaskQueued, TaskRetrying

**Agent Events (4)**: AgentSpawned, AgentProgress, AgentToolCall, AgentExited

**Gate & Human Input (9)**: GateReached, GateApproved, GateRejected, HumanInputRequested, QuestionAnswered, QuestionDismissed, QuestionAutoAnswered, QuestionAutoDefaulted, QuestionSubscriberAdded

**Audit & Decision (4)**: AuditStarted, AuditCompleted, DecisionRecorded, CheckpointCreated

**Guardian Events (4)**: GuardianSpawned, GuardianStopped, GuardianObservation, GuardianTriggerReceived

**Retrospective Events (4)**: RetrospectiveRecorded, RetrospectiveTimeout, RetrospectiveParseError, RetrospectiveValidationError

#### Knob Integration Points in Trajectory Flow

| Integration Point | Location | Knob Category |
|-------------------|----------|---------------|
| Event filtering | `capture()` entry | Granularity |
| Drift baseline update | After `createTrajectoryEvent` | Drift Detection |
| Agent context injection | Before `AgentSpawned` | Query-During-Run |
| Consistency check | On `DecisionRecorded` | Active Query |
| Budget tracking | On `TaskCompleted` | Budgeting |
| Learning update | On run completion | Cross-Run Memory |

---

## Refined Implementation Priority

### Phase 1: Foundation (Enables Everything Else)

| Change | Effort | Files | Rationale |
|--------|--------|-------|-----------|
| Add `ExecutionPolicy` to Run entity | Medium | types.ts, sqlite.ts, schema.ts | All knobs need a place to live |
| Add `run_policies` table | Low | schema.ts, sqlite.ts | Store policy configuration |
| Add `run_budgets` table | Low | schema.ts, sqlite.ts | Track consumption |
| Wire ExecutionPolicy from Planner | Medium | adapters/plan-adapter.ts | Planner sets the knobs |

### Phase 2: Core Knobs (High-Value Capabilities)

| Change | Effort | Files | Rationale |
|--------|--------|-------|-----------|
| Add `query_run_state` MCP tool | Medium | mcp/tools.ts | Agents reason with trajectory |
| Add `query_trajectory` MCP tool | Medium | mcp/tools.ts | Consistency checking |
| Implement retry limits | Low | recovery.ts, run-service.ts | Basic variance control |
| Wire confidence to control flow | Low | retrospective-service.ts | Already captured, just needs hooks |
| Add parallelism limits | Medium | run-service.ts | Prevent resource contention |

### Phase 3: Advanced Features

| Change | Effort | Files | Rationale |
|--------|--------|-------|-----------|
| Add `execution_baselines` table | Medium | schema.ts, sqlite.ts | Foundation for drift |
| Build `DriftMonitor` service | High | services/drift-monitor.ts | Pattern comparison |
| Add `get_handoff_context` MCP tool | Medium | mcp/tools.ts | Agent-to-agent context |
| Implement recovery strategies beyond retry | High | recovery.ts | Rollback, branch, escalate |
| Add ensembling support | High | run-service.ts | Multi-agent task execution |

### Phase 4: Learning Layer

| Change | Effort | Files | Rationale |
|--------|--------|-------|-----------|
| Add `task_execution_metrics` table | Low | schema.ts | Collect learning data |
| Implement TaskExecutionResult feedback | Medium | adapters/status-reporter.ts | Report back to Planner |
| Build baseline aggregation | Medium | services/baseline-service.ts | Cross-run learning |
| Auto-tune knob suggestions | High | services/tuning-service.ts | Learned heuristics |

---

## Open Questions

1. **Where do knobs live?**
   - Per-run (ExecutionPolicy on Run entity)?
   - Per-organization (ForgeConfig)?
   - Per-step (Step-level overrides)?
   - **Recommendation**: Combination with inheritance (org defaults → plan policy → step override)

2. **How do knobs interact?**
   - Does high confidence override low budget?
   - Does ensemble override parallelism limits?
   - **Recommendation**: Define explicit priority rules in ExecutionPolicy schema

3. **Who sets the knobs?**
   - Planner (during plan creation)?
   - Human (during run creation)?
   - System (based on learned patterns)?
   - Portfolio (governance rules)?
   - **Recommendation**: Layered approach with source tracking (`source` field in run_policies)

4. **How do we learn optimal knob settings?**
   - Track correlation between knob settings and outcomes
   - Build heuristics over time
   - Eventually: auto-tune based on task characteristics
   - **Recommendation**: Start with task_execution_metrics collection, analyze later

---

## Model Selection Optimizer (Operations Research Approach)

### Current State Analysis

**Forge has NO model selection logic.**

```typescript
// Current: CliConfigSchema (forge-config.ts:9-18)
{
  cli: z.string(),        // Just "claude" - no model versioning
  timeout: z.number(),    // Per-task timeout
  audit: z.boolean(),     // Run audit step
}

// Resolution: Static config lookup
resolveCliConfig(config, role) → config.role_cli_mapping[role] || config.default_cli
```

**What's Missing:**
- No model specification (haiku vs sonnet vs opus)
- No token tracking (no API integration)
- No cost tracking
- No capability matching
- No performance history
- No learning from outcomes

### The Operations Research Problem

**Goal**: Given a task with characteristics T, select model M that minimizes cost while meeting quality/speed constraints.

```
minimize: cost(M, T)
subject to:
  quality(M, T) >= quality_threshold
  latency(M, T) <= latency_threshold
  capabilities(M) ⊇ requirements(T)
```

This is a **multi-objective optimization** problem with:
- Competing objectives (cost vs quality vs speed)
- Stochastic outcomes (model performance varies)
- Learning opportunity (outcomes improve selection over time)

### Proposed Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        MODEL SELECTION OPTIMIZER                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐  │
│  │  TASK CLASSIFIER │    │  MODEL REGISTRY  │    │  PERFORMANCE DB  │  │
│  │                  │    │                  │    │                  │  │
│  │ • task_type      │    │ • capabilities   │    │ • success_rate   │  │
│  │ • complexity     │    │ • cost_per_token │    │ • avg_duration   │  │
│  │ • requirements   │    │ • speed_profile  │    │ • avg_tokens     │  │
│  │ • context_size   │    │ • context_limit  │    │ • avg_cost       │  │
│  └────────┬─────────┘    └────────┬─────────┘    └────────┬─────────┘  │
│           │                       │                       │             │
│           └───────────────────────┼───────────────────────┘             │
│                                   │                                     │
│                                   ▼                                     │
│                    ┌──────────────────────────────┐                     │
│                    │     SELECTION ALGORITHM      │                     │
│                    │                              │                     │
│                    │  • Constraint satisfaction   │                     │
│                    │  • Multi-armed bandit        │                     │
│                    │  • Thompson sampling         │                     │
│                    │  • Contextual bandit         │                     │
│                    └──────────────┬───────────────┘                     │
│                                   │                                     │
│                                   ▼                                     │
│                         ┌─────────────────┐                             │
│                         │ MODEL SELECTION │                             │
│                         │                 │                             │
│                         │ "claude-sonnet" │                             │
│                         └─────────────────┘                             │
│                                   │                                     │
│                                   ▼                                     │
│                    ┌──────────────────────────────┐                     │
│                    │       EXECUTION              │                     │
│                    │                              │                     │
│                    │  • Track tokens used         │                     │
│                    │  • Track duration            │                     │
│                    │  • Track outcome             │                     │
│                    └──────────────┬───────────────┘                     │
│                                   │                                     │
│                                   ▼                                     │
│                    ┌──────────────────────────────┐                     │
│                    │      FEEDBACK LOOP           │                     │
│                    │                              │                     │
│                    │  Update performance DB with  │                     │
│                    │  actual outcomes             │                     │
│                    └──────────────────────────────┘                     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Component Designs

#### 1. Model Registry

```typescript
export const ModelProfileSchema = z.object({
  model_id: z.string(),           // "claude-3-5-sonnet-20241022"
  display_name: z.string(),       // "Sonnet"
  provider: z.string(),           // "anthropic"

  // Capabilities
  capabilities: z.array(z.enum([
    'code_generation',
    'code_review',
    'reasoning',
    'tool_use',
    'long_context',
    'fast_response',
    'creative_writing',
    'structured_output',
  ])),

  // Limits
  max_context_tokens: z.number(),   // 200000
  max_output_tokens: z.number(),    // 8192

  // Cost (per million tokens)
  cost_per_mtok_input: z.number(),  // 3.00
  cost_per_mtok_output: z.number(), // 15.00

  // Performance profile
  speed_profile: z.enum(['fast', 'balanced', 'thorough']),
  quality_profile: z.enum(['basic', 'standard', 'premium']),

  // Availability
  enabled: z.boolean(),
  rate_limit_rpm: z.number().optional(),
});

// Example registry
const MODEL_REGISTRY: ModelProfile[] = [
  {
    model_id: 'claude-3-5-haiku-20241022',
    display_name: 'Haiku',
    provider: 'anthropic',
    capabilities: ['code_generation', 'tool_use', 'fast_response'],
    max_context_tokens: 200000,
    max_output_tokens: 8192,
    cost_per_mtok_input: 1.00,
    cost_per_mtok_output: 5.00,
    speed_profile: 'fast',
    quality_profile: 'basic',
    enabled: true,
  },
  {
    model_id: 'claude-3-5-sonnet-20241022',
    display_name: 'Sonnet',
    provider: 'anthropic',
    capabilities: ['code_generation', 'code_review', 'reasoning', 'tool_use', 'structured_output'],
    max_context_tokens: 200000,
    max_output_tokens: 8192,
    cost_per_mtok_input: 3.00,
    cost_per_mtok_output: 15.00,
    speed_profile: 'balanced',
    quality_profile: 'standard',
    enabled: true,
  },
  {
    model_id: 'claude-3-opus-20240229',
    display_name: 'Opus',
    provider: 'anthropic',
    capabilities: ['code_generation', 'code_review', 'reasoning', 'tool_use', 'long_context', 'creative_writing', 'structured_output'],
    max_context_tokens: 200000,
    max_output_tokens: 4096,
    cost_per_mtok_input: 15.00,
    cost_per_mtok_output: 75.00,
    speed_profile: 'thorough',
    quality_profile: 'premium',
    enabled: true,
  },
];
```

#### 2. Task Classification

```typescript
export const TaskClassificationSchema = z.object({
  // Task identity
  task_type: z.enum([
    'code_generation',
    'code_modification',
    'code_review',
    'testing',
    'documentation',
    'architecture',
    'debugging',
    'refactoring',
    'deployment',
    'analysis',
  ]),

  // Complexity estimate
  complexity: z.enum(['trivial', 'simple', 'moderate', 'complex', 'very_complex']),

  // Requirements
  required_capabilities: z.array(z.string()),

  // Context estimation
  estimated_context_tokens: z.number(),
  estimated_output_tokens: z.number(),

  // Constraints
  max_cost_usd: z.number().optional(),
  max_latency_seconds: z.number().optional(),
  min_quality_level: z.enum(['basic', 'standard', 'premium']).optional(),

  // Historical identifiers for learning
  step_pattern: z.string().optional(),  // "implement-api-endpoint"
  role_pattern: z.string().optional(),  // "backend:Coder"
});

// Classification function (could be AI-powered)
function classifyTask(step: ForgeStep, context: RunContext): TaskClassification {
  // Heuristics for MVP
  const taskType = inferTaskType(step.title, step.description);
  const complexity = estimateComplexity(step);
  const capabilities = inferCapabilities(taskType, step.acceptance_criteria);
  const contextSize = estimateContextSize(step, context);

  return {
    task_type: taskType,
    complexity,
    required_capabilities: capabilities,
    estimated_context_tokens: contextSize.input,
    estimated_output_tokens: contextSize.output,
    step_pattern: normalizeStepPattern(step.title),
    role_pattern: step.owner_role,
  };
}
```

#### 3. Performance Database

```sql
-- Model-task performance history
CREATE TABLE model_task_performance (
  performance_id TEXT PRIMARY KEY NOT NULL,

  -- Identifiers
  model_id TEXT NOT NULL,              -- "claude-3-5-sonnet-20241022"
  task_type TEXT NOT NULL,             -- "code_generation"
  complexity TEXT NOT NULL,            -- "moderate"
  step_pattern TEXT,                   -- "implement-api-endpoint" (optional)
  role_pattern TEXT,                   -- "backend:Coder" (optional)

  -- Statistics (aggregated)
  sample_count INTEGER NOT NULL DEFAULT 0,

  -- Success metrics
  success_rate REAL NOT NULL DEFAULT 0.5,  -- 0-1
  first_try_success_rate REAL,             -- Without retry

  -- Cost metrics
  avg_tokens_input INTEGER,
  avg_tokens_output INTEGER,
  avg_cost_usd REAL,

  -- Speed metrics
  avg_duration_ms INTEGER,
  p50_duration_ms INTEGER,
  p95_duration_ms INTEGER,

  -- Quality metrics (from audits)
  avg_audit_score REAL,                -- 0-1 if available

  -- Bayesian priors (for Thompson sampling)
  alpha REAL NOT NULL DEFAULT 1.0,     -- Successes + prior
  beta REAL NOT NULL DEFAULT 1.0,      -- Failures + prior

  last_updated_at TEXT NOT NULL,

  UNIQUE (model_id, task_type, complexity, step_pattern, role_pattern)
);

CREATE INDEX idx_mtp_lookup ON model_task_performance(
  task_type, complexity, model_id
);

-- Individual execution records
CREATE TABLE model_executions (
  execution_id TEXT PRIMARY KEY NOT NULL,
  run_id TEXT NOT NULL,
  task_id TEXT NOT NULL,

  -- Model used
  model_id TEXT NOT NULL,

  -- Classification at selection time
  task_type TEXT NOT NULL,
  complexity TEXT NOT NULL,
  step_pattern TEXT,
  role_pattern TEXT,

  -- Actual usage
  tokens_input INTEGER,
  tokens_output INTEGER,
  cost_usd REAL,
  duration_ms INTEGER,

  -- Outcome
  outcome TEXT CHECK (outcome IN ('success', 'failure', 'timeout', 'partial')),
  retry_count INTEGER DEFAULT 0,
  error_category TEXT,

  -- Quality (if audited)
  audit_score REAL,
  audit_findings_count INTEGER,

  -- Selection reasoning
  selection_reason TEXT,              -- "cost_optimized", "quality_required", "exploration"
  alternative_models TEXT,            -- JSON array of considered alternatives

  created_at TEXT NOT NULL,

  FOREIGN KEY (run_id) REFERENCES runs(run_id) ON DELETE CASCADE,
  FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE CASCADE
);
```

#### 4. Selection Algorithm

```typescript
interface SelectionConstraints {
  max_cost_usd?: number;
  max_latency_ms?: number;
  min_quality_level?: 'basic' | 'standard' | 'premium';
  required_capabilities?: string[];
}

interface SelectionResult {
  model_id: string;
  confidence: number;
  reason: string;
  expected_cost: number;
  expected_duration_ms: number;
  expected_success_rate: number;
  alternatives: {
    model_id: string;
    reason_rejected: string;
  }[];
}

class ModelSelector {
  constructor(
    private registry: ModelProfile[],
    private performanceDb: ModelTaskPerformanceRepo,
    private explorationRate: number = 0.1  // 10% exploration
  ) {}

  async select(
    classification: TaskClassification,
    constraints: SelectionConstraints
  ): Promise<SelectionResult> {
    // 1. Filter by hard constraints (capabilities, context limit)
    const eligible = this.filterEligible(classification, constraints);

    if (eligible.length === 0) {
      throw new Error('No eligible models for task requirements');
    }

    // 2. Get performance history for eligible models
    const performances = await this.getPerformances(eligible, classification);

    // 3. Decide: exploit (use best known) or explore (try alternatives)
    if (Math.random() < this.explorationRate && eligible.length > 1) {
      return this.selectExploration(eligible, performances, classification);
    }

    // 4. Exploit: Select best model using Thompson sampling
    return this.selectExploitation(eligible, performances, classification, constraints);
  }

  private filterEligible(
    classification: TaskClassification,
    constraints: SelectionConstraints
  ): ModelProfile[] {
    return this.registry.filter(model => {
      // Must have required capabilities
      if (constraints.required_capabilities) {
        const hasAll = constraints.required_capabilities.every(
          cap => model.capabilities.includes(cap)
        );
        if (!hasAll) return false;
      }

      // Must fit context
      if (classification.estimated_context_tokens > model.max_context_tokens) {
        return false;
      }

      // Must meet quality minimum
      if (constraints.min_quality_level) {
        const qualityOrder = { basic: 1, standard: 2, premium: 3 };
        if (qualityOrder[model.quality_profile] < qualityOrder[constraints.min_quality_level]) {
          return false;
        }
      }

      // Must be enabled
      return model.enabled;
    });
  }

  private async selectExploitation(
    eligible: ModelProfile[],
    performances: Map<string, ModelTaskPerformance>,
    classification: TaskClassification,
    constraints: SelectionConstraints
  ): SelectionResult {
    // Thompson sampling: sample from Beta distributions
    const samples = eligible.map(model => {
      const perf = performances.get(model.model_id);
      const alpha = perf?.alpha ?? 1;
      const beta = perf?.beta ?? 1;

      // Sample from Beta(alpha, beta)
      const successSample = this.sampleBeta(alpha, beta);

      // Calculate expected cost
      const expectedCost = this.estimateCost(model, classification, perf);

      // Score: balance success rate vs cost (adjustable)
      const costPenalty = constraints.max_cost_usd
        ? Math.max(0, expectedCost / constraints.max_cost_usd - 1)
        : 0;

      const score = successSample * (1 - costPenalty * 0.5);

      return {
        model,
        score,
        successSample,
        expectedCost,
        performance: perf,
      };
    });

    // Sort by score descending
    samples.sort((a, b) => b.score - a.score);

    const best = samples[0];
    const alternatives = samples.slice(1).map(s => ({
      model_id: s.model.model_id,
      reason_rejected: s.score < best.score
        ? `Lower expected success rate (${(s.successSample * 100).toFixed(1)}%)`
        : `Higher cost ($${s.expectedCost.toFixed(4)})`,
    }));

    return {
      model_id: best.model.model_id,
      confidence: best.successSample,
      reason: 'thompson_sampling',
      expected_cost: best.expectedCost,
      expected_duration_ms: best.performance?.avg_duration_ms ?? 30000,
      expected_success_rate: best.successSample,
      alternatives,
    };
  }

  private selectExploration(
    eligible: ModelProfile[],
    performances: Map<string, ModelTaskPerformance>,
    classification: TaskClassification
  ): SelectionResult {
    // Find model with least samples (most uncertainty)
    let leastSampled = eligible[0];
    let minSamples = Infinity;

    for (const model of eligible) {
      const perf = performances.get(model.model_id);
      const samples = perf?.sample_count ?? 0;
      if (samples < minSamples) {
        minSamples = samples;
        leastSampled = model;
      }
    }

    return {
      model_id: leastSampled.model_id,
      confidence: 0.5,  // Unknown
      reason: 'exploration',
      expected_cost: this.estimateCost(leastSampled, classification),
      expected_duration_ms: 30000,  // Default
      expected_success_rate: 0.5,
      alternatives: eligible
        .filter(m => m.model_id !== leastSampled.model_id)
        .map(m => ({
          model_id: m.model_id,
          reason_rejected: 'Selected different model for exploration',
        })),
    };
  }

  private sampleBeta(alpha: number, beta: number): number {
    // Use jStat or implement Beta sampling
    // Simplified: use mean for now
    return alpha / (alpha + beta);
  }

  private estimateCost(
    model: ModelProfile,
    classification: TaskClassification,
    perf?: ModelTaskPerformance
  ): number {
    const inputTokens = perf?.avg_tokens_input ?? classification.estimated_context_tokens;
    const outputTokens = perf?.avg_tokens_output ?? classification.estimated_output_tokens;

    return (
      (inputTokens / 1_000_000) * model.cost_per_mtok_input +
      (outputTokens / 1_000_000) * model.cost_per_mtok_output
    );
  }
}
```

#### 5. Learning Loop

```typescript
class PerformanceLearner {
  constructor(
    private performanceDb: ModelTaskPerformanceRepo
  ) {}

  async recordExecution(
    execution: ModelExecution
  ): Promise<void> {
    // 1. Store individual execution
    await this.performanceDb.createExecution(execution);

    // 2. Update aggregate statistics
    const key = {
      model_id: execution.model_id,
      task_type: execution.task_type,
      complexity: execution.complexity,
      step_pattern: execution.step_pattern,
      role_pattern: execution.role_pattern,
    };

    const current = await this.performanceDb.getPerformance(key);

    const success = execution.outcome === 'success';

    const updated: ModelTaskPerformance = current
      ? this.updateStatistics(current, execution, success)
      : this.initializeStatistics(key, execution, success);

    await this.performanceDb.upsertPerformance(updated);
  }

  private updateStatistics(
    current: ModelTaskPerformance,
    execution: ModelExecution,
    success: boolean
  ): ModelTaskPerformance {
    const n = current.sample_count;
    const newN = n + 1;

    // Update Bayesian priors (Beta distribution)
    const alpha = current.alpha + (success ? 1 : 0);
    const beta = current.beta + (success ? 0 : 1);

    // Update running averages
    const avgTokensInput = this.runningAvg(current.avg_tokens_input, execution.tokens_input, n);
    const avgTokensOutput = this.runningAvg(current.avg_tokens_output, execution.tokens_output, n);
    const avgCostUsd = this.runningAvg(current.avg_cost_usd, execution.cost_usd, n);
    const avgDurationMs = this.runningAvg(current.avg_duration_ms, execution.duration_ms, n);

    // Update success rate (could derive from alpha/beta, but explicit is clearer)
    const successRate = alpha / (alpha + beta);

    return {
      ...current,
      sample_count: newN,
      success_rate: successRate,
      alpha,
      beta,
      avg_tokens_input: avgTokensInput,
      avg_tokens_output: avgTokensOutput,
      avg_cost_usd: avgCostUsd,
      avg_duration_ms: avgDurationMs,
      last_updated_at: new Date().toISOString(),
    };
  }

  private runningAvg(current: number | null, newValue: number | null, n: number): number | null {
    if (newValue === null) return current;
    if (current === null) return newValue;
    return (current * n + newValue) / (n + 1);
  }
}
```

### Phased Implementation

#### Phase 1: Instrumentation (Foundation)

**Goal**: Start collecting the data needed for optimization.

| Task | Effort | Description |
|------|--------|-------------|
| Extend CliConfig with model field | Low | Add `model: string` to config schema |
| Add token tracking hook | Medium | Intercept Claude API calls to capture usage |
| Create model_executions table | Low | Store per-task execution data |
| Log model selection events | Low | Trajectory event for model selection |

**Outcome**: Data collection begins, no behavior change yet.

#### Phase 2: Model Registry & Classification

**Goal**: Build the infrastructure for intelligent selection.

| Task | Effort | Description |
|------|--------|-------------|
| Create ModelRegistry service | Medium | Hardcoded registry of available models |
| Build TaskClassifier | Medium | Heuristic-based classification from step metadata |
| Add model_task_performance table | Low | Aggregate statistics table |
| Wire classification to run creation | Medium | Classify tasks at run start |

**Outcome**: Tasks are classified, models are catalogued.

#### Phase 3: Basic Selection Algorithm

**Goal**: Replace static config with data-driven selection.

| Task | Effort | Description |
|------|--------|-------------|
| Implement ModelSelector | High | Thompson sampling algorithm |
| Add selection constraints | Medium | Cost/quality/speed parameters |
| Create selection API | Low | `/runs/{id}/select-model` endpoint |
| Add exploration toggle | Low | Enable/disable exploration mode |

**Outcome**: Model selection uses historical performance.

#### Phase 4: Learning Loop

**Goal**: Continuous improvement from execution outcomes.

| Task | Effort | Description |
|------|--------|-------------|
| Build PerformanceLearner | Medium | Update statistics from execution results |
| Add performance dashboard | Medium | UI to view model performance by task type |
| Implement decay factor | Low | Weight recent data more heavily |
| Add anomaly detection | Medium | Flag unexpected performance changes |

**Outcome**: System learns and improves over time.

### Key Metrics to Track

| Metric | Purpose | Source |
|--------|---------|--------|
| **Success rate** | Primary optimization target | Task outcome |
| **Tokens used** | Cost estimation | Claude API response |
| **Cost per task** | Budget optimization | Computed from tokens |
| **Duration** | Speed optimization | Task timestamps |
| **Retry count** | Quality signal | Task attempts |
| **Audit score** | Quality signal | Audit findings |

### Expected Patterns to Discover

Based on general knowledge, the optimizer might learn:

| Task Type | Optimal Model | Reason |
|-----------|---------------|--------|
| Simple code changes | Haiku | Fast, cheap, sufficient quality |
| Complex architecture | Opus | Needs deep reasoning |
| Code review | Sonnet | Good balance of speed/quality |
| Documentation | Haiku | Straightforward, cost-efficient |
| Debugging | Sonnet/Opus | Depends on complexity |
| Refactoring | Sonnet | Needs context but not max reasoning |

These patterns would emerge from data, not be hardcoded.

### Open Questions

1. **How to handle cold start?**
   - Start with priors from model quality profiles?
   - Run initial "calibration" phase with all models?
   - Use transfer learning from similar task types?

2. **How to balance exploration vs exploitation?**
   - Fixed exploration rate (e.g., 10%)?
   - Decay exploration over time?
   - UCB (Upper Confidence Bound) instead of Thompson?

3. **How to handle model API changes?**
   - Model updates invalidate historical data
   - Need version tracking and baseline reset
   - Gradual phase-in with parallel evaluation?

4. **How to expose this to users?**
   - Auto mode (let system decide)?
   - Manual override always available?
   - Show confidence/reasoning for transparency?

---

## Next Steps

1. **Schema design review** - Finalize ExecutionPolicy and related types with team
2. **MCP tool prioritization** - Which query tools are most valuable first?
3. **Migration planning** - How to handle existing runs without policies?
4. **UI integration** - How does Forge UI surface knob configuration?
5. **Planner integration** - How does Planner produce ExecutionPolicy?
6. **Token tracking** - Build instrumentation to capture API usage
7. **Model selection prototype** - MVP with simple heuristics before full optimization

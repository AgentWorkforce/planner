# Forge-Core: Comprehensive Orchestration Engine Investigation

**Investigated Date:** February 6, 2026
**Codebase:** Planned (Auckland) - Forge Core Package
**Status:** Complete Analysis

---

## Executive Summary

Forge is **not just conversation** — it's a sophisticated orchestration engine that compiles approved plans into executable runs, spawns real agents via relay, and manages their execution through a sophisticated DOT Framework (Delegation, Observation, Testing). It's the bridge between planning and execution in the three-tier agentic architecture.

**Key insight:** Forge is a state machine engine with trajectory capture, budget enforcement, confidence handling, and adaptive recovery. It's fundamentally a task DAG scheduler with agent dispatch, not a conversational system.

---

## 1. What is a Run? (Data Model & States)

### Run Entity Definition
**File:** `/packages/forge-core/src/domain/types.ts:379-396`

```typescript
export const RunSchema = z.object({
  run_id: z.string().uuid(),
  plan_id: z.string().uuid(),
  plan_version: z.number().int().positive(),
  status: RunStatusSchema,
  has_pending_gate: z.boolean(),
  execution_policy: ExecutionPolicySchema.optional(),
  workspace_path: z.string().optional(),
  started_at: z.string().datetime().optional(),
  completed_at: z.string().datetime().optional(),
  error: z.string().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
```

### Run State Machine
**File:** `/packages/forge-core/src/domain/types.ts:16-34`

**Valid Run States:**
```
pending ──→ running ──→ paused
                ├──→ completed (all tasks done)
                ├──→ failed (unrecoverable error)
                └──→ cancelled (user cancellation)

paused ──→ running (resume)
         └──→ cancelled

completed/failed/cancelled: terminal states (no transitions)
```

**Transition Logic:** `/packages/forge-core/src/domain/types.ts:1132-1144, 1197-1218`

### Key Fields:

| Field | Purpose |
|-------|---------|
| `run_id` | Unique identifier (UUID) |
| `plan_id` | Reference to the approved plan from Planner |
| `plan_version` | Version number of the plan |
| `status` | Current execution state |
| `has_pending_gate` | Flag indicating human gate approval is blocking execution |
| `execution_policy` | DOT Framework configuration (budget, retry, parallelism, etc.) |
| `workspace_path` | Working directory for all agents in this run |
| `started_at` | When execution began (set on first transition to running) |
| `completed_at` | When execution ended (set on terminal state) |
| `error` | Human-readable error if run failed |

### What Triggers a Run?

**File:** `/packages/forge-core/src/api/handlers/runs.ts:90-179`

1. **HTTP POST /api/forge/runs** with ForgePlan (inline or by reference)
2. Request body includes:
   - `plan`: Full ForgePlan with steps, dependencies, acceptance criteria
   - `workspace_path`: Optional working directory for agents
   - `execution_policy`: Optional DOT Framework configuration

3. **Handler flow:**
   - Validates ForgePlan schema
   - Creates Run entity in `pending` state
   - Creates Task entity for each step
   - Transitions Run to `running` state
   - Emits `run_started` trajectory event
   - Calls `scheduleReadyTasks(run_id)` asynchronously (non-blocking)

---

## 2. What is a Task? (Relationship to Steps & Lifecycle)

### Task Entity Definition
**File:** `/packages/forge-core/src/domain/types.ts:417-444`

```typescript
export const TaskSchema = z.object({
  task_id: z.string().uuid(),
  run_id: z.string().uuid(),
  step_id: z.string().min(1),           // From plan step
  step_title: z.string().min(1),        // Human-readable title
  status: TaskStatusSchema,
  dependencies: z.array(z.string()),    // step_ids of dependencies
  scope: z.string().optional(),         // Repo/domain context
  owner_role: z.string().optional(),    // Role for CLI/model mapping
  step_description: z.string().optional(),
  acceptance_criteria: z.array(AcceptanceCriterionSchema).optional(),
  workspace_path: z.string().optional(),
  agent_id: z.string().optional(),      // Set when agent spawned
  current_attempt: z.number().int().optional(),
  gate_id: z.string().uuid().optional(), // References human approval gate
  input_artifacts: z.array(ArtifactReferenceSchema).optional(),
  output_artifacts: z.array(ArtifactReferenceSchema).optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
```

### Task State Machine (Execution Lifecycle)
**File:** `/packages/forge-core/src/domain/types.ts:40-73, 1149-1164`

```
pending
  ↓
queued ← Dependency check passed, ready to execute
  ↓
running ← Agent spawned and executing
  ├─ auditing ← Agent reported complete, validation in progress
  ├─ awaiting_approval ← Gate requires human sign-off
  ├─ completed ← Success
  ├─ failed ← Unrecoverable error (after retry exhausted)
  └─ blocked ← Dependency failed

blocked → pending (retry escalation) or failed (give up)
failed → pending (recovery attempt) or stays failed
auditing → completed | failed | pending
awaiting_approval → completed | failed
```

### Step-to-Task Mapping
**File:** `/packages/forge-core/src/api/handlers/runs.ts:128-142`

Each `ForgeStep` in the plan becomes exactly one `Task`:

```typescript
// Create tasks from plan steps
for (const step of plan.steps) {
  const task = createTask(savedRun.run_id, step, workspacePath);
  const savedTask = deps.storage.createTask(task);
}
```

**Mapping:**
| ForgeStep Field | Task Field | Notes |
|-----------------|------------|-------|
| `step_id` | `step_id` | Stable identifier within plan |
| `title` | `step_title` | Human-readable title |
| `description` | `step_description` | Detailed instructions |
| `dependencies` | `dependencies` | Array of step_ids this task depends on |
| `scope` | `scope` | Repo/domain context |
| `owner_role` | `owner_role` | Role for CLI and model selection |
| `acceptance_criteria` | `acceptance_criteria` | Requirements to verify |
| `gate` | (creates Gate entity) | If present, task blocks until approved |

---

## 3. How Are Agents Spawned?

### Agent Spawning Flow

**Orchestrator Entry Point:**
**File:** `/packages/forge-core/src/services/orchestrator.ts:241-310`

1. **dispatchTask()** is called for each ready task
2. Resolves CLI config from `ForgeConfig` by `owner_role`
3. Builds `SpawnTaskOptions` with:
   - Task metadata (title, description, step_id)
   - Scope and owner role
   - Acceptance criteria
   - Workspace path
   - Recommended model (from ModelSelector)
   - Timeout (from ExecutionPolicy)

4. Calls `spawnTask(options)` (injected dependency)
5. Stores `agent_id` in task
6. Tracks agent in local `AgentTracker` map
7. Creates `TaskAttempt` record

### Real Agent Spawning via Relay
**File:** `/packages/server/src/relay/forge-spawner.ts:150-173`

```typescript
export const spawnForgeTask: SpawnTaskFn = async (options: SpawnTaskOptions): Promise<SpawnTaskResult> => {
  const agentName = `Worker-${options.taskId.slice(0, 8)}`;
  const task = buildTaskPrompt(options);

  const result = await spawnAgent({
    name: agentName,
    cli: options.cli,
    task,
    cwd: process.cwd(),
  });

  if (!result.success) {
    throw new Error(`Failed to spawn agent ${agentName}: ${result.error || 'Unknown error'}`);
  }

  return {
    agentId: result.name || agentName,
    pid: result.pid,
  };
};
```

### Agent Configuration

**Spawned Agent Receives:**
1. **Agent Name:** `Worker-{first-8-chars-of-task-id}`
2. **CLI Command:** From ForgeConfig role_cli_mapping (default: "claude")
3. **Task Prompt:** Built from step details, includes:
   - Task ID and Run ID
   - Step title and description
   - Workspace path (if provided)
   - Scope and role
   - Acceptance criteria (human-readable list)
   - **CRITICAL**: MCP instructions for reporting completion
4. **Timeout:** From ExecutionPolicy (default: 300 seconds)
5. **Model:** Recommended by ModelSelector (haiku/sonnet/opus)

### Agent Tools (MCP)
**File:** `/packages/forge-core/src/mcp/tools/*.ts`

Agents have 7 tools available:

| Tool | Purpose | Required? |
|------|---------|-----------|
| `report_complete` | Mark task done, submit artifacts | **YES** |
| `report_progress` | Send status during long tasks | Optional |
| `report_blocked` | Signal inability to proceed | Optional |
| `request_human_input` | Ask a question and wait for answer | Optional |
| `record_decision` | Log a decision for user trajectory | Optional |
| `report_audit_result` | Submit detailed audit findings | Optional |

### Example Agent Dispatch
**File:** `/packages/server/src/relay/forge-spawner.ts:81-144`

MCP Instructions embedded in prompt tell agent:
```bash
curl -X POST http://localhost:3001/api/forge/mcp/tools/call \
  -H "Content-Type: application/json" \
  -d '{
    "name": "report_complete",
    "arguments": {
      "task_id": "...",
      "artifacts": [
        {"type": "commit", "reference": "sha..."},
        {"type": "pr", "reference": "https://..."}
      ],
      "notes": "Implemented feature X"
    }
  }'
```

---

## 4. Result Tracking: How Forge Knows When Agents Are Done

### Three Completion Mechanisms

#### A. MCP Tool Call: `report_complete`
**File:** `/packages/forge-core/src/mcp/tools/report-complete.ts:82-173`

When agent calls tool:
1. Validates task exists and status is `running`
2. Creates Artifact entities for each reported artifact
3. Determines task's next state:
   - If `gate_id` exists → `awaiting_approval` (human review needed)
   - Otherwise → `completed` (success)
4. Updates task status in storage
5. Emits `task_completed` trajectory event
6. Returns task's new status to agent

**Artifacts Captured:**
| Type | Example | Use |
|------|---------|-----|
| `commit` | Git SHA hash | Code changes |
| `pr` | PR URL | Pull request link |
| `file` | File path | Generated artifacts |
| `deployment` | URL/reference | Deployment target |
| `test_result` | JSON report | Test execution results |

#### B. Polling for Status Changes
**File:** `/packages/forge-core/src/services/orchestrator.ts:317-334`

Orchestrator runs a polling loop every 2 seconds:
```typescript
private async checkCompletions(runId: string): Promise<void> {
  const agentTrackers = this.activeRuns.get(runId);
  for (const [taskId, tracker] of agentTrackers.entries()) {
    const task = this.storage.getTask(taskId);

    if (task.status === TaskStatus.Completed) {
      await this.handleTaskCompletion(task, runId, tracker);
    } else if (task.status === TaskStatus.Failed) {
      await this.handleTaskFailure(task, runId, tracker);
    }
  }
}
```

#### C. Timeout Detection
**File:** `/packages/forge-core/src/services/health-monitor.ts`

TaskTimeoutManager tracks elapsed time:
- Start tracking when agent spawned
- Check per-task timeout (`execution_policy.budgets.per_task_time_seconds`)
- Auto-fail if timeout exceeded

### Result Recording

**File:** `/packages/forge-core/src/services/orchestrator.ts:339-396`

When task completes:
1. Calculate duration from tracker.startTime
2. Generate synthetic usage metrics:
   - `tokensUsed`: Random 1000-6000 tokens
   - `costUsd`: tokens * 0.000003
   - `confidence`: 0.95 (synthetic)
3. Call `RunService.handleTaskCompletion()`
4. Validate against confidence thresholds
5. Record task artifacts via ArtifactValidator
6. Emit `TaskOutcomeEmission` to Tuner (fire-and-forget)

---

## 5. Full Execution Flow: From Approved Plan to Results

### Sequence Diagram

```
1. HUMAN creates plan via Planner
2. HUMAN approves plan (locks version)
3. HUMAN publishes plan → Planner returns plan_ref
                         ↓
4. EXTERNAL system (e.g., relay, UI) calls POST /api/forge/runs
   with ForgePlan and execution_policy
                         ↓
5. FORGE CREATES RUN & TASKS
   - Creates Run in "pending" state
   - Creates Task for each step in "pending" state
   - Transitions Run to "running"
   - Emits trajectory event "run_started"
   - Calls scheduleReadyTasks(runId) asynchronously
                         ↓
6. ORCHESTRATOR.executeRun(runId) starts main loop
   while true:
     a. Get ready tasks (dependencies met)
     b. Filter by artifact availability
     c. Filter by parallelism limits (max_concurrent_tasks)
     d. Check budget (time, tokens, cost)
     e. For each task to dispatch:
        - Select model via ModelSelector
        - Resolve CLI config
        - Build prompt
        - Call spawnTask(options) → starts agent via relay
        - Update task.status = running
        - Track in AgentTracker
        - Create TaskAttempt record
     f. Poll for 2 seconds
     g. Check for completions (task.status changed)
                         ↓
7. AGENT (spawned by relay) receives task prompt
   - Reads task details, acceptance criteria
   - Plans approach
   - Executes work
   - Calls report_complete with artifacts
                         ↓
8. FORGE RECEIVES REPORT_COMPLETE
   - Validates task still exists
   - Creates Artifact records
   - Updates task.status → completed (or awaiting_approval if gate)
   - Emits trajectory event task_completed
   - Records usage metrics
                         ↓
9. ORCHESTRATOR DETECTS COMPLETION
   - Polling loop detects status change
   - Calls handleTaskCompletion()
   - Validates confidence threshold
   - Records task outcome → Tuner (fire-and-forget)
                         ↓
10. TASK DEPENDENCIES UNBLOCK
    - Next cycle: getReadyTasks() returns dependent tasks
    - Process repeats
                         ↓
11. RUN FINALIZES
    - No ready tasks, no running tasks
    - All tasks have terminal status
    - Calculate final metrics (duration, costs, attempts)
    - Update Run.status = completed
    - Emit trajectory event run_completed
    - Emit RunOutcomeEmission to Tuner
    - Clean up AgentTracker map
                         ↓
12. RESULTS AVAILABLE
    - GET /api/forge/runs/{run_id} returns full state
    - GET /api/forge/runs/{run_id}/events streams trajectory
    - Tuner processes outcomes for learning
```

---

## 6. Trajectory Capture: Event-Based Observability

### What is Trajectory Capture?

**File:** `/packages/forge-core/src/services/trajectory-capture.ts:30-108`

A non-blocking event capture system that records every state change during execution.

**Features:**
- Validates payloads against Zod schemas
- Stores events to database asynchronously (non-blocking)
- Emits to SSE subscribers in real-time
- Returns created event (for chaining)
- Soft fails: logs warnings but doesn't throw

### 43+ Event Types

**File:** `/packages/forge-core/src/domain/trajectory-events.ts:17-129`

**Run Lifecycle Events:**
```
run_started, run_completed, run_failed, run_paused, run_cancelled, run_resumed
```

**Task Lifecycle Events:**
```
task_started, task_completed, task_failed, task_blocked, task_queued, task_retrying
```

**Agent Lifecycle Events:**
```
agent_spawned, agent_progress, agent_tool_call, agent_exited
```

**Gate & Human Input Events:**
```
gate_reached, gate_approved, gate_rejected
human_input_requested, question_answered, question_dismissed
question_auto_answered, question_auto_defaulted, question_subscriber_added
```

**Audit & Validation Events:**
```
audit_started, audit_completed
```

**Decision & Checkpoint Events:**
```
decision_recorded, checkpoint_created
```

**Guardian Events:**
```
guardian_spawned, guardian_stopped, guardian_observation, guardian_trigger_received
```

**Retrospective Events:**
```
retrospective_recorded, retrospective_timeout, retrospective_parse_error, retrospective_validation_error
```

**Recovery Events:**
```
recovery_strategy_selected, task_escalated, task_skipped
```

**Budget Events:**
```
budget_initialized, budget_updated, budget_warning
```

### Example Trajectory Event

When task completes, this event is captured:

```typescript
trajectoryCapture.capture(
  run_id,
  TrajectoryEventType.TaskCompleted,
  {
    step_id: task.step_id,
    step_title: task.step_title,
    attempt_number: currentAttempt?.attempt_number ?? 1,
    artifacts_produced: createdArtifacts.length,
    notes: "Optional notes from agent",
  },
  task_id
);
```

Stored as:
```
{
  event_id: UUID,
  run_id: UUID,
  task_id: UUID,
  event_type: "task_completed",
  payload: { ... },
  timestamp: ISO8601
}
```

### Real-Time Streaming

**File:** `/packages/forge-core/src/api/handlers/sse.ts`

Client can subscribe to events:
```
GET /api/forge/runs/{run_id}/events
```

Streams SSE messages:
```
event: trajectory
data: {event_id, run_id, event_type, payload, timestamp}
```

---

## 7. User Trajectory: Cross-Run Learning

### Purpose

**File:** `/packages/forge-core/src/services/user-trajectory-service.ts:75-123`

Captures user decisions (especially question answers) and derives preferences for auto-answering future similar questions.

### Decision Recording

When user answers a question during a run:

```typescript
userTrajectoryService.recordUserDecision({
  userId: "human-user-id",
  scope: "run" | "project" | "global",
  questionText: "Should we use feature X?",
  selectedOption: "yes",
  reasoning: "Aligns with architecture",
  runId: "...",
  projectId: "...",
  category: "feature_flag_decisions"
});
```

**Record stored:**
- `user_id`, `scope`, `category`
- `question_text`, `selected_option`, `reasoning`
- `run_id`, `task_id`, `project_id` (context)
- `timestamp`, `user_trajectory_event_id`

### Preference Derivation

**File:** `/packages/forge-core/src/services/user-trajectory-service.ts:129-150`

Pattern detection: After 3+ similar decisions on same question:

```
{
  user_id: "...",
  scope: "project",
  category: "feature_flag_decisions",
  preference: "yes",
  confidence: 0.92,
  evidence_count: 4,  // 4 similar past decisions
  last_updated: ISO8601
}
```

### Auto-Answering Similar Questions

When agent asks similar question in future run:

1. Search user trajectory for matching category + scope
2. Calculate question similarity (text comparison)
3. If similarity > 0.85 and confidence > 0.7:
   - Auto-answer with stored preference
   - Mark as `auto_answered_from_trajectory`
   - Log in trajectory
4. Otherwise, block and wait for human input

---

## 8. Retry & Failure Handling: Recovery Ladder

### Failure Detection

**File:** `/packages/forge-core/src/services/orchestrator.ts:401-447`

When Orchestrator detects task.status = failed:

```typescript
private async handleTaskFailure(task: Task, runId: string, tracker: AgentTracker) {
  // Get error from latest attempt
  const attempts = this.storage.listAttemptsByTask(task.task_id);
  const latestAttempt = attempts[attempts.length - 1];
  const errorMessage = latestAttempt?.error || 'Task execution failed';

  // Delegate to RunService recovery handler
  await this.runService.handleTaskFailure(task, runId, tracker.attemptNumber, errorMessage, executionPolicy);
}
```

### Recovery Strategy Ladder

**File:** `/packages/forge-core/src/domain/types.ts:295-308`

```typescript
export enum RecoveryStrategy {
  Retry = 'retry',           // Simple retry without context
  Revise = 'revise',         // Retry with failure analysis (Reflexion pattern)
  Rollback = 'rollback',     // Undo to last known good state
  Branch = 'branch',         // Create alternative execution path
  Escalate = 'escalate',     // Create human approval gate
  Skip = 'skip',             // Skip task and continue
}
```

### Retry Configuration

**File:** `/packages/forge-core/src/domain/types.ts:278-289`

```typescript
export const RetryConfigSchema = z.object({
  max_retries_per_task: z.number().int().min(0).default(3),
  backoff: z.enum(['none', 'linear', 'exponential']).default('exponential'),
  backoff_base_seconds: z.number().positive().default(30),
  include_failure_analysis: z.boolean().default(true),
});
```

**Backoff Calculation:**
- `none`: Immediate retry
- `linear`: delay = backoff_base_seconds * attempt_number
- `exponential`: delay = backoff_base_seconds ^ attempt_number

### Failure Handling Flow

**File:** `/packages/forge-core/src/services/run-service.ts:359-385`

1. Stop tracking timeout
2. Record failure in budget tracking
3. Get ExecutionPolicy (retry config)
4. Call TaskFailureHandler.handleTaskFailure()
5. TaskFailureHandler applies ladder:
   - Attempt count < max_retries?
     - YES: Update task.status = pending (re-queue)
     - NO: Check confidence threshold
   - Confidence >= 0.3?
     - YES: Mark task failed, emit outcome
     - NO: Escalate via gate, mark awaiting_approval

### Research Basis

Per comments in code:
- **METR 2025:** P(success) ≈ 0.5^(T/50min) — budget-based failure prediction
- **Reflexion 2023:** Self-correction with failure analysis provides +20-30% improvement
- **Multi-Agent Taxonomy 2025:** 98% of silent failures detectable with validation

---

## 9. Acceptance Criteria Verification

### Two-Phase Verification

#### Phase 1: Artifact-Based Validation (Built-in)

**File:** `/packages/forge-core/src/services/artifact-validator.ts:74-138`

When task completes, ArtifactValidator checks:

1. **Input Artifacts Available?**
   - Does task have `input_artifacts` defined?
   - Are they all produced by previously completed tasks?
   - Optional artifacts (required=false) don't block

2. **Output Artifacts Registered?**
   - Agent reported artifacts via `report_complete` tool
   - Artifacts stored by type (commit, PR, file, etc.)
   - Linked to task for dependency tracking

```typescript
validateTaskInputs(task: Task, runId: string): ArtifactValidationResult {
  const inputArtifacts = task.input_artifacts ?? [];
  const producedArtifacts = this.storage.listArtifactsByRun(runId);

  for (const inputRef of inputArtifacts) {
    const match = this.findMatchingArtifact(inputRef, producedArtifacts);
    if (!match && inputRef.required !== false) {
      missing.push(inputRef);
    }
  }

  return {
    canProceed: missing.length === 0,
    missing,
    available,
    optionalMissing,
  };
}
```

#### Phase 2: Acceptance Criteria Audit (Optional)

**File:** `/packages/forge-core/src/domain/types.ts:203-209`

Agent can submit detailed audit findings via MCP:

```typescript
export interface AcceptanceCriterion {
  id: string;
  description: string;  // e.g., "API returns 200 OK"
  type?: string;        // e.g., "test", "review", "metric"
}

export interface AuditFinding {
  criterion_id: string;
  status: 'pass' | 'fail';
  details: string;      // Evidence for the finding
}
```

Agent uses tool:
```bash
curl -X POST .../mcp/tools/call -d '{
  "name": "report_audit_result",
  "arguments": {
    "task_id": "...",
    "findings": [
      {"criterion_id": "ac-1", "status": "pass", "details": "API test returned 200"},
      {"criterion_id": "ac-2", "status": "pass", "details": "Database migrated"}
    ]
  }
}'
```

Findings stored on TaskAttempt:

```typescript
export interface TaskAttempt {
  attempt_id: UUID,
  task_id: UUID,
  attempt_number: number,
  started_at: ISO8601,
  ended_at: ISO8601,
  outcome: 'success' | 'failure' | 'timeout' | 'cancelled',
  error?: string,
  audit_findings?: AuditFinding[],
}
```

### Verification Flow

1. **Task Queued → Ready:** Artifact dependencies checked (prereq)
2. **Task Reported Complete:** Agent submits artifacts + optional audit findings
3. **Artifact Validation:** Missing input artifacts? → Block dependent tasks
4. **Audit Review (if gate present):** Human reviews findings before approval
5. **Task Marked Complete:** Propagates to unlock dependent tasks

---

## 10. Relationship to Planner: The Handoff

### Plan → Run Compilation

**File:** `/packages/forge-core/src/api/handlers/runs.ts:128-142`

**Planner Output (ForgePlan):**
```typescript
{
  plan_id: UUID,
  version: number,
  summary: { goal: string, context?: string },
  steps: [
    {
      step_id: string,
      title: string,
      description: string,
      scope: string,
      owner_role: string,
      dependencies: [step_id, ...],
      acceptance_criteria: [{id, description, type?}, ...],
      gate: { type: 'human_approval', approver_role? },
      repo_url?: string,
      cli?: string,
      audit?: boolean,
    },
    ...
  ]
}
```

**Forge Compilation:**

1. **Run Creation:** Translates plan_id/version into new Run
2. **Task Generation:** Each step → one Task with:
   - Same dependencies (step_id → step_id)
   - Same acceptance_criteria
   - Same scope, owner_role
   - Same gate config
3. **Parallel Execution:** Tasks execute respecting DAG (no strict ordering)

### Feedback Loop: ChangeRequest

**File:** Architecture docs mention (not yet in forge-core, planned)**

When Forge discovers plan inadequacy:
1. Creates `ChangeRequest` with needed structural changes
2. Sends back to Planner with evidence
3. Planner drafts new version (doesn't modify approved)
4. Human reviews and approves new version
5. Orchestrator can use new plan_ref for remaining work

---

## 11. DOT Framework: Execution Controls

### Components

**1. BudgetService** — Token/time/cost limits
**File:** `/packages/forge-core/src/services/budget-service.ts`

Tracks:
- `per_task_time_seconds`: Max seconds per task (default: 300)
- `per_task_token_limit`: Max tokens per task (default: 100,000)
- `total_cost_limit_usd`: Max total cost for run (default: $10)

Emits `budget_warning` event at 80% utilization.

**2. TaskQueue** — Parallelism control
**File:** `/packages/forge-core/src/services/task-queue.ts`

Limits concurrent execution:
- `max_concurrent_tasks`: Max tasks running simultaneously (default: 5)
- `max_concurrent_per_scope`: Optional per-scope limits
- `prefer_sequential_in_scope`: Run tasks in same scope sequentially

**3. ConfidenceHandler** — Validation thresholds
**File:** `/packages/forge-core/src/services/confidence-handler.ts`

Agent confidence (0-1) triggers:
- `confidence < 0.3` (escalation threshold): **Fail immediately**
- `0.3 ≤ confidence < 0.5` (review threshold): **Needs clarification** (gate)
- `confidence ≥ 0.5`: **Continue normally**

**4. ModelSelector** — LLM selection
**File:** `/packages/forge-core/src/services/model-selector.ts`

Picks model for task:
- `haiku`: Fast, cheap, simple tasks
- `sonnet`: Balanced, most tasks
- `opus`: Complex reasoning, critical tasks

Based on task complexity (planned to come from Planner).

**5. TaskFailureHandler** — Recovery ladder
**File:** `/packages/forge-core/src/services/recovery.ts`

Implements Reflexion pattern:
- Attempt < max_retries? → Retry with failure context
- Else → Escalate via gate or mark failed

**6. TaskTimeoutManager** — Per-task timeouts
**File:** `/packages/forge-core/src/services/health-monitor.ts`

Tracks elapsed time:
- Timeout = `execution_policy.budgets.per_task_time_seconds`
- Auto-fails if exceeded
- Terminates agent

### Execution Policy

**File:** `/packages/forge-core/src/domain/types.ts:355-373`

```typescript
export const ExecutionPolicySchema = z.object({
  budgets: BudgetsConfigSchema.default({}),
  retry: RetryConfigSchema.default({}),
  parallelism: ParallelismConfigSchema.default({}),
  replan: ReplanConfigSchema.default({}),
  confidence: ConfidenceConfigSchema.default({}),
});

export const DEFAULT_EXECUTION_POLICY: ExecutionPolicy = {
  budgets: {
    per_task_time_seconds: 300,
    per_task_token_limit: 100000,
    total_cost_limit_usd: 10.0,
  },
  retry: {
    max_retries_per_task: 3,
    backoff: 'exponential',
    backoff_base_seconds: 30,
    include_failure_analysis: true,
  },
  parallelism: {
    max_concurrent_tasks: 5,
  },
  replan: {
    on_cascade_failure: false,
  },
  confidence: {
    escalation_threshold: 0.3,
    review_threshold: 0.5,
  },
};
```

---

## 12. Test vs. Real Execution Modes

### Three Execution Modes

**File:** `/packages/forge-core/src/services/agent-spawner.ts:62-67`

```typescript
export type ForgeExecutionMode = 'test' | 'real' | 'training';
```

#### Mode 1: `test` (TestExecutor)
**File:** `/packages/forge-core/src/services/test-executor.ts`

**When to use:** Testbench, CI/CD validation, scenario simulation

**Behavior:**
1. No real agents spawned
2. Tasks auto-complete after random delay (100-300ms)
3. Synthetic metrics generated:
   - Duration: random
   - Tokens: 1000-6000
   - Cost: tokens * $0.000003
   - Outcome: Always success
4. Outcomes emitted to Tuner tagged `source: 'test'`
5. Tuner **ignores** for learning (test data marked separately)

**Entry point:** `TestExecutor.scheduleReadyTasks(runId)`

#### Mode 2: `real` (Orchestrator)
**File:** `/packages/forge-core/src/services/orchestrator.ts`

**When to use:** Production execution, actual work

**Behavior:**
1. Real agents spawned via relay
2. Agents execute actual tasks (code changes, etc.)
3. Agents call MCP tools to report results
4. Real usage metrics captured (from agent or Tuner)
5. Outcomes emitted tagged `source: 'production'`
6. Tuner **learns** from outcomes

**Entry point:** `Orchestrator.scheduleReadyTasks(runId)`

#### Mode 3: `training` (TestExecutor with training tag)
**File:** `/packages/forge-core/src/services/test-executor.ts:30`

**When to use:** Training the Tuner on synthetic scenarios

**Behavior:**
- Same as `test` mode but:
- Outcomes tagged `source: 'training'`
- Tuner **does learn** from this data (labeled as training)

### Mode Selection

**File:** `/packages/server/src/index.ts` (initialization)

Determined at startup:
1. Check if relay is connected
2. If connected: Use `Orchestrator` (real mode)
3. If disconnected: Use `TestExecutor` (test mode)

Can be overridden via environment:
```bash
FORGE_MODE=test  # Force test even if relay connected
```

---

## Summary: Forge is an Orchestration State Machine

| Aspect | Implementation |
|--------|-----------------|
| **What it is** | Task DAG scheduler + agent dispatcher |
| **Entry point** | HTTP POST /api/forge/runs |
| **What triggers it** | Approved plan from Planner |
| **How it executes** | Spawns real agents via relay, polls for completion |
| **How it tracks agents** | Polling + MCP tool callbacks |
| **How it handles failure** | Recovery ladder (retry → gate → skip) |
| **How it validates** | Artifact validation + confidence scoring + auditing |
| **How it learns** | Trajectory events + user decisions → Tuner |
| **States** | Run: pending→running→paused→completed/failed/cancelled |
| **Task states** | pending→queued→running→(auditing/awaiting_approval)→completed/failed/blocked |
| **Extensibility** | DOT Framework knobs (budget, parallelism, confidence, retry) |

---

## File Structure Summary

### Core Domain (`/domain`)
- `types.ts`: All entities (Run, Task, Gate, Artifact, etc.) + state machines + factory functions
- `trajectory-events.ts`: 43+ event types + payload schemas
- `user-trajectory.ts`: User decision tracking + preference derivation
- `retrospective.ts`: Task retrospective analysis structures

### Services (`/services`)
- `orchestrator.ts`: Main execution loop, agent dispatch, completion polling
- `run-service.ts`: DOT Framework integration point
- `agent-spawner.ts`: Types for agent spawning (DI pattern)
- `budget-service.ts`: Token/time/cost tracking
- `task-queue.ts`: Parallelism control
- `confidence-handler.ts`: Confidence-based control flow
- `recovery.ts`: Failure recovery ladder + checkpoint recovery
- `gate-service.ts`: Human approval gates
- `artifact-validator.ts`: Input/output artifact validation
- `trajectory-capture.ts`: Non-blocking event capture
- `user-trajectory-service.ts`: Decision recording + preference learning
- `model-selector.ts`: LLM selection logic
- `test-executor.ts`: Synthetic execution for testing/training

### Storage (`/storage`)
- `interface.ts`: ForgeStorage abstract interface
- `schema.ts`: SQLite schema
- `sqlite/*.ts`: Implementation per entity type

### API (`/api`)
- `routes/runs.ts`: Run CRUD endpoints
- `handlers/runs.ts`: Run creation, listing, details
- `handlers/tasks.ts`: Task details, retrospective
- `handlers/gates.ts`: Gate approval/rejection
- `handlers/questions.ts`: Question handling
- `handlers/trajectory.ts`: Trajectory event queries
- `mcp/tools/*.ts`: Agent tools (report_complete, report_progress, etc.)

### Relay Bridge (`server/relay`)
- `forge-spawner.ts`: Wraps relay spawn into SpawnTaskFn interface
- `forge-bridge.ts`: (Planned) Two-way relay communication

---

## Key Insights

1. **Forge ≠ Conversation:** It's a state machine engine for executing plans, not a chatbot.

2. **Deterministic Execution:** Each run compiles a specific plan version at a specific time with specific execution policies.

3. **Trajectory as Audit Trail:** Every state change is captured and replayed for debugging, learning, and accountability.

4. **DOT Framework as Control Knobs:** Budget, parallelism, confidence, retry, and recovery strategies are all configurable without code changes.

5. **User Trajectory for Adaptation:** System learns user preferences and auto-answers similar questions in future runs.

6. **Agents as Plugins:** Real agents via relay in production, synthetic agents in testing, both follow same interface (MCP tools).

7. **Acceptance Criteria as Live Validation:** Combines artifact-based dependencies (did producer finish?) with agent-reported audit findings (did it work as intended?).

8. **Handoff to Orchestrator:** When Orchestrator detects plan inadequacy, it sends ChangeRequest back to Planner rather than modifying the approved plan.

---

**End of Investigation**

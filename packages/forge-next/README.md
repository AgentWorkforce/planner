# @plannr/forge-next

Thin execution layer built on `@agent-relay/sdk` WorkflowRunner. Compiles approved PlanVersions into relay workflow configurations and manages the runtime concerns of execution: gate checkpoints, agent questions, step monitoring, cost tracking, and satisfaction scoring.

## Architecture

forge-next sits between the Planner domain and the agent-relay SDK. It does not spawn agents directly — that is the relay SDK's responsibility. Its job is to translate structured plans into relay-executable workflow configs and to keep the execution surface observable.

```
Planner (approved PlanVersion)
         │
         ▼
    compilePlan()          ← pure data transformation
         │
         ▼
  RelayYamlConfig
         │
         ▼
  WorkflowRunner           ← @agent-relay/sdk
         │
   ┌─────┼─────┐
   │     │     │
GateManager  QuestionManager  RunMonitor
   │                              │
   └──────────┬───────────────────┘
              ▼
          SSE stream             ← /runs/:id/events
         (emitAndPersist)
```

**Key concepts:**

- **ForgeNextRun**: Wrapper around a relay WorkflowRunner execution. Stores the compiled workflow config, current status, and the relay's internal run ID once started.
- **compilePlan**: Pure function. Takes a PlanVersion's steps and a ForgeConfig, returns a `RelayYamlConfig` and a map of acceptance criteria per step for post-execution scoring.
- **ModelSelector**: Keyword-based model tier routing (haiku / sonnet / opus) applied per step at compile time.
- **GateManager**: Pauses the WorkflowRunner when a gated step completes. Resumes on approval, aborts on rejection.
- **QuestionManager**: Persists questions that agents raise during execution. Agents poll for answers; humans respond via the API.
- **RunMonitor**: Subscribes to runner events to track per-step timing, estimate cost, detect stalls, accumulate failure history, and trigger satisfaction scoring.
- **SatisfactionScorer**: Heuristic keyword-overlap scoring of step output against acceptance criteria. Produces a 0-100 score with matched and failed criterion lists.
- **SSE event stream**: All events (runner, gate, question, monitor) are written to the client and persisted to storage. Late-connecting clients receive a full replay of prior events.

## Single-Run-at-a-Time Invariant

forge-next maintains one active WorkflowRunner instance. GateManager, QuestionManager, and RunMonitor each have `reset()` methods that must be called between runs to clear state. Attempting to start a second run while one is executing is a caller error and will produce undefined behaviour.

## Compiler

`compilePlan()` is a pure data transformation with no side effects.

```typescript
import { compilePlan, ModelSelector } from '@plannr/forge-next';

const selector = new ModelSelector();

const { config, stepCriteria } = compilePlan(
  { plan_id: 'abc', version: 3, summary: { goal: 'Add OAuth login' } },
  steps,          // PlanStep[] from the approved PlanVersion
  forgeConfig,    // ForgeConfig: workspace_path, step_overrides, execution_policy
  selector,
);

// config is a RelayYamlConfig ready for WorkflowRunner.start(config)
// stepCriteria is Map<step_id, AcceptanceCriterion[]> for post-execution scoring
```

### Agent name derivation

Each unique `owner_role` in the active steps becomes one agent definition. The role string is lowercased and non-alphanumeric runs are replaced with hyphens (`backend:Coder` becomes `backend-coder`). Steps without an `owner_role` share a `default-worker` agent.

### Step task composition

Each workflow step's task string is composed from the step's title, description, and acceptance criteria. For plans with more than 15 active steps a Plan Context section is appended using a pyramid strategy:

- Direct dependencies: title plus first acceptance criterion.
- All remaining steps: grouped by scope, titles only.

If the combined context exceeds an 8 000-character budget, the "other steps" section is dropped and only direct dependencies are kept.

### Step skipping

Steps with `skip: true` in `ForgeConfig.step_overrides` are excluded from compilation. Their IDs are also removed from the `dependsOn` arrays of any steps that referenced them, so the DAG remains valid.

### Verification

The first acceptance criterion of each step is used to generate a relay `output_contains` verification check, giving the runner a lightweight post-step signal before moving to dependents.

## Model Selection

`ModelSelector` classifies each step by keyword matching against the concatenated title, description, scope, and owner role.

| Signal | Model | Example keywords |
|--------|-------|-----------------|
| Architecture or security-critical | `opus` | `architect`, `security`, `auth`, `schema migration`, `api contract` |
| Trivial or routine | `haiku` | `format`, `lint`, `rename`, `changelog`, `readme`, `bump version` |
| Everything else | `sonnet` | (default) |

Per-step overrides in `ForgeConfig.step_overrides` take priority over selector output.

Cost multipliers relative to sonnet baseline: haiku 0.27x, sonnet 1.0x, opus 4.0x.

## Gate Management

Steps whose plan definition includes `gate: { type: 'human_approval' }` pause execution after the step completes.

```
step:completed event (gated step)
         │
  GateManager._handleGateTrigger()
         │
  runner.pause()
  storage.createGate({ status: 'pending' })
  emit('gate:pending')
         │
         ▼
  POST /gates/:id/approve   →   runner.unpause()
  POST /gates/:id/reject    →   runner.abort()
```

`GateManager` extends `EventEmitter`. The SSE handler subscribes to `gate:pending`, `gate:approved`, and `gate:rejected` events and forwards them to connected clients via `emitAndPersist`.

## Question Management

Agents can ask questions at any point during execution via an MCP tool call. `QuestionManager` persists the question and notifies clients.

```
agent asks question (MCP tool)
         │
  QuestionManager.askQuestion()
  storage.createQuestion({ status: 'pending' })
  emit('question:pending')
         │
         ▼
  POST /questions/:id/answer
  POST /questions/:id/dismiss
         │
  emit('question:answered' | 'question:dismissed')
```

Agents poll `getAnswer(questionId)` for a response. The method returns `null` while the question is pending or dismissed, and the answer string once answered. No blocking or runner pausing occurs — the agent controls its own wait loop.

## Run Monitor

`RunMonitor` subscribes to the WorkflowRunner event stream and derives higher-level signals.

### Lifecycle

```typescript
monitor.setForgeRunId(runId);
monitor.setWorkflowConfig(relayYamlConfig);   // resolves step → model mapping
monitor.setStepCriteria(stepCriteria);         // from compilePlan()
monitor.bind(runner);                          // starts stall detection interval
// ... execution runs ...
monitor.reset();                               // call between runs
```

### Step metrics

On each `step:completed` event:
- Duration is computed from start timestamp.
- Cost is estimated as `(duration_minutes * 0.05 USD) * model_multiplier`.
- A `step:metrics` event is emitted with duration and estimated cost.
- If the step has acceptance criteria and the runner provided output, satisfaction scoring runs immediately.
- A `run:metrics` event is emitted with totals across all completed steps.

### Stall detection

A background interval runs every 30 seconds. Steps that have started but not completed are checked against per-model thresholds:

| Model | Stall threshold |
|-------|----------------|
| `haiku` | 2 minutes |
| `sonnet` | 5 minutes |
| `opus` | 10 minutes |

A `stall:warning` event is emitted once per step per attempt. The warning is suppressed for subsequent checks until the step retries.

### Failure accumulation

On `step:failed`, the error message is appended to the step's failure history. On `step:retrying`, a `step:retry-context` event is emitted with the last three deduplicated failures and the total failure count. This gives the agent explicit context about what went wrong in previous attempts rather than starting blind.

## Satisfaction Scoring

`scoreStepOutput()` is a synchronous, zero-cost heuristic that runs after each step completes.

**Algorithm:**
1. Extract keywords from the step output (lowercase tokens of 3+ characters, stop words removed).
2. For each acceptance criterion, extract its keywords and compute overlap ratio against the output keywords.
3. A criterion is considered matched if at least 40% of its keywords appear in the output.
4. Score = `(matched criteria / total criteria) * 100`, rounded to the nearest integer.

**Edge cases:**
- No acceptance criteria: score is 50 (neutral, cannot judge).
- No output: score is 0, all criteria reported as failed.

The scorer emits a `step:scored` event with the score, human-readable reasoning, and explicit matched and failed criterion lists. The average satisfaction score across all scored steps is included in `run:metrics`.

This is a first-pass signal. Higher-fidelity LLM-as-judge evaluation can be layered on top without changes to the event schema.

## SSE Event Stream

`GET /runs/:id/events` opens a persistent SSE connection.

### Catch-up semantics

On connection, all events previously persisted for the run are replayed in order before live events begin. A client that reconnects mid-run receives the full history and continues from where it left off without needing any additional API calls.

### emitAndPersist

Every event written to an SSE client is also written to the `forge_next_events` table before being sent to the response stream. This ensures the catch-up replay is always consistent with what clients observed in real time.

### Keepalive

A comment ping is written to the stream every 15 seconds to prevent proxy and load balancer timeout disconnections.

### Event types

| Event type | Source | Description |
|-----------|--------|-------------|
| `run:started` | WorkflowRunner | Relay workflow has begun |
| `run:completed` | WorkflowRunner | All steps finished successfully |
| `run:failed` | WorkflowRunner | Run ended with failure |
| `run:cancelled` | WorkflowRunner | Run was cancelled |
| `step:started` | WorkflowRunner | A step has begun executing |
| `step:completed` | WorkflowRunner | A step completed |
| `step:failed` | WorkflowRunner | A step failed (may retry) |
| `step:retrying` | WorkflowRunner | A step is about to retry |
| `step:metrics` | RunMonitor | Duration and estimated cost for a completed step |
| `step:scored` | RunMonitor | Satisfaction score for a completed step |
| `step:retry-context` | RunMonitor | Accumulated failure context before a retry |
| `step:failed-enriched` | RunMonitor | Failure with full history attached |
| `run:metrics` | RunMonitor | Aggregate cost, completion count, average satisfaction |
| `stall:warning` | RunMonitor | Step has exceeded its model-tier stall threshold |
| `gate:pending` | GateManager | A gated step completed; run is paused awaiting approval |
| `gate:approved` | GateManager | Gate was approved; run has resumed |
| `gate:rejected` | GateManager | Gate was rejected; run has been aborted |
| `question:pending` | QuestionManager | Agent submitted a question |
| `question:answered` | QuestionManager | A question was answered |
| `question:dismissed` | QuestionManager | A question was dismissed without an answer |

## Integration

Mount as an Express plugin:

```typescript
import { WorkflowRunner } from '@agent-relay/sdk/workflows';
import {
  createForgeNextRouter,
  GateManager,
  QuestionManager,
  RunMonitor,
  SqliteForgeNextStorage,
} from '@plannr/forge-next';

const storage = new SqliteForgeNextStorage('./forge-next.db');
const runner = new WorkflowRunner();
const gateManager = new GateManager(storage);
const questionManager = new QuestionManager(storage);
const runMonitor = new RunMonitor();

app.use(
  '/api/forge-next',
  createForgeNextRouter({
    storage,
    runner,
    gateManager,
    questionManager,
    runMonitor,
    fetchPlan: async (planId, version) => {
      // Retrieve plan from @plannr/planner storage — injected to avoid
      // a hard import dependency between forge-next and planner.
      return planStorage.getPlanVersion(planId, version);
    },
  }),
);
```

## API Endpoints

### Runs

```
POST   /runs                    # Create run from plan (compiles and stores workflow config)
GET    /runs                    # List runs
GET    /runs/:id                # Get run details
GET    /runs/:id/events         # SSE event stream (with catch-up replay)
POST   /runs/:id/pause          # Pause execution
POST   /runs/:id/resume         # Resume a paused run
POST   /runs/:id/cancel         # Cancel run
```

### Gates

```
GET    /runs/:runId/gates       # List gates for a run
POST   /gates/:id/approve       # Approve a pending gate (unpauses runner)
POST   /gates/:id/reject        # Reject a pending gate (aborts runner)
```

### Questions

```
GET    /runs/:runId/questions   # List questions for a run
POST   /questions/:id/answer    # Provide an answer to a pending question
POST   /questions/:id/dismiss   # Dismiss a pending question
```

## Exports

### Core functions
- `compilePlan` — compile a PlanVersion into a RelayYamlConfig

### Classes
- `ModelSelector` — keyword-based model tier routing
- `GateManager` — human approval gate orchestration
- `QuestionManager` — agent question lifecycle management
- `RunMonitor` — step timing, cost estimation, stall detection, satisfaction scoring

### API
- `createForgeNextRouter` — Express router factory

### Domain types
- `ForgeNextRun`, `Gate`, `GateStatus`, `Question`, `QuestionStatus`
- `ForgeNextEvent`, `ForgeConfig`, `StepOverride`
- `StepMetricsEvent`, `RunMetricsEvent`, `StallWarningEvent`
- `StepRetryContextEvent`, `StepFailedEnrichedEvent`, `StepScoredEvent`

### Storage
- `ForgeNextStorage` (interface)
- `SqliteForgeNextStorage`

## Development

```bash
npm run build      # Compile TypeScript
npm run typecheck  # Type checking only
npm test           # Run tests with Vitest
```

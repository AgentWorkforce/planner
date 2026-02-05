# Trajectories: Execution History as Working Memory

> How we capture execution history and use it for reasoning, handoffs, and learning.

---

## Why Trajectories Matter

Without trajectories:
- Failures are black boxes ("it failed somewhere")
- Agents repeat the same mistakes
- Handoffs lose context ("what did the previous agent decide?")
- No learning from past runs

With trajectories:
- Every decision, action, and outcome is recorded
- Agents can reason WITH the record, not just leave it behind
- Context flows seamlessly between agents
- Patterns emerge for future optimization

### Research Foundation

| Finding | Value | Source |
|---------|-------|--------|
| Context middle performance drop | 40-60% | Lost in the Middle 2024 |
| Effective context utilization | 65-75% of advertised max | Lost in the Middle 2024 |
| Optimal working memory | 4-8K tokens | MEM1 2025 |
| Reflexion self-correction | +20-30% on hard tasks | Reflexion 2023 |

**Key insight**: Where you place information in context matters as much as what you include. Critical information at boundaries (start/end) is retrieved 40-60% more reliably than information buried in the middle.

---

## Current State

Today's Forge has comprehensive trajectory capture:

| Capability | Status | Notes |
|------------|--------|-------|
| Event capture | ✅ 34 event types | Run, task, agent, gate, audit, guardian events |
| Storage | ✅ SQLite | `trajectory_events`, `guardian_trajectories` tables |
| Streaming | ✅ SSE | Real-time UI updates |
| User decision learning | ✅ Implemented | Similarity-based auto-answer for questions |

**What's missing**:
- **Trajectory injection**: Agents don't receive trajectory context in prompts
- **Handoff context**: No structured context transfer between agents
- **Consistency checking**: No active query for "does this contradict step 3?"
- **Drift detection**: No comparison to baselines
- **Cross-run learning**: Only user decisions learned, not execution patterns

---

## Event Capture

### All 34 Event Types

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           EVENT CATEGORIES                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  RUN LIFECYCLE (6)                                                      │
│  RunStarted, RunCompleted, RunFailed, RunPaused, RunCancelled,          │
│  RunResumed                                                             │
│                                                                         │
│  TASK LIFECYCLE (6)                                                     │
│  TaskStarted, TaskCompleted, TaskFailed, TaskBlocked, TaskQueued,       │
│  TaskRetrying                                                           │
│                                                                         │
│  AGENT EVENTS (4)                                                       │
│  AgentSpawned, AgentProgress, AgentToolCall, AgentExited                │
│                                                                         │
│  GATE & HUMAN INPUT (9)                                                 │
│  GateReached, GateApproved, GateRejected, HumanInputRequested,          │
│  QuestionAnswered, QuestionDismissed, QuestionAutoAnswered,             │
│  QuestionAutoDefaulted, QuestionSubscriberAdded                         │
│                                                                         │
│  AUDIT & DECISION (4)                                                   │
│  AuditStarted, AuditCompleted, DecisionRecorded, CheckpointCreated      │
│                                                                         │
│  GUARDIAN EVENTS (4)                                                    │
│  GuardianSpawned, GuardianStopped, GuardianObservation,                 │
│  GuardianTriggerReceived                                                │
│                                                                         │
│  RETROSPECTIVE EVENTS (4)                                               │
│  RetrospectiveRecorded, RetrospectiveTimeout, RetrospectiveParseError,  │
│  RetrospectiveValidationError                                           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Event Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         EVENT SOURCES                                    │
│                                                                         │
│    ┌───────────────────┐              ┌───────────────────────┐         │
│    │  MCP TOOLS        │              │  STATE TRANSITIONS    │         │
│    │  (Agents call)    │              │  (Domain logic)       │         │
│    │                   │              │                       │         │
│    │  • record-decision│              │  • Run.transition()   │         │
│    │  • report-progress│              │  • Task.transition()  │         │
│    │  • report-complete│              │  • trackGateReached() │         │
│    │  • report-audit   │              │  • trackAgentSpawned()│         │
│    │  • request-human  │              │                       │         │
│    │  • report-blocked │              │                       │         │
│    └─────────┬─────────┘              └───────────┬───────────┘         │
│              │                                    │                     │
│              └────────────────┬───────────────────┘                     │
└───────────────────────────────┼─────────────────────────────────────────┘
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

### Configurable Granularity

Not all runs need the same level of detail.

```typescript
interface TrajectoryGranularity {
  capture_level: 'minimal' | 'standard' | 'verbose';

  // minimal: Run/task lifecycle only (6+6 events)
  // standard: + decisions, gates, questions (~20 events)
  // verbose: + tool calls, progress updates (all 34)

  custom_events?: string[];  // Additional events to capture
}
```

### Recommended Defaults

```yaml
trajectory_granularity:
  capture_level: standard  # Balance detail vs storage

  # Add verbose for:
  # - Debugging runs
  # - Critical/high-risk plans
  # - Learning/analysis runs
```

---

## Query-During-Run

**Core insight**: Agents should reason WITH the trajectory, not just leave it behind.

### Current Problem

```
Agent A completes task → Records decision → Agent B starts
                                            │
                                            └── Has no context about
                                                Agent A's decisions
```

### Target State

```
Agent A completes task → Records decision → Agent B starts
                                            │
                                            └── Receives relevant
                                                trajectory context
                                                in prompt
```

### Trajectory Injection (Research-Backed)

**Critical research findings**:
- **Lost in the Middle**: 40-60% performance drop when relevant info is in context middle vs boundaries
- **Effective context**: Only 65-75% of advertised max context actually works reliably
- **Working memory**: Agents learn to consolidate to 4-8K tokens optimal range

```typescript
interface TrajectoryInjection {
  enabled: boolean;

  // Token budgets (from MEM1 research)
  budget: {
    total_context_tokens: number;     // Safe practical limit: 12K
    working_memory_tokens: number;    // Optimal: 4-8K (we use 6K)
  };

  // Position strategy (from Lost in the Middle research)
  position_strategy: {
    critical_info: 'start' | 'end';   // Boundaries: 40-60% better retrieval
    supporting_context: 'middle';      // Less critical, OK in middle
  };

  inject_on_task_start: {
    include_run_summary: boolean;
    include_recent_decisions: number;  // Last N decisions
    include_predecessor_handoff: boolean;  // NEW: context from dependencies
    include_similar_past_tasks: boolean;
  };

  inject_on_retry: {
    include_previous_attempt: boolean;
    include_failure_analysis: boolean;  // Reflexion: +20-30% improvement
  };
}
```

### Proposed MCP Tools

**Tool 1: query_run_state**

Enables agents to understand current run context.

```typescript
const queryRunStateTool = {
  name: 'query_run_state',
  description: 'Query the current state of this run',
  parameters: {
    task_id: { type: 'string', description: 'Your task ID' },
    query_type: {
      type: 'string',
      enum: ['run_summary', 'task_history', 'completed_steps', 'blocked_steps', 'my_context'],
    },
  },
};

// Response examples:
// run_summary → "Building user auth system. 5/12 steps complete. 2 blocked."
// task_history → List of completed tasks with outcomes
// my_context → Decisions and artifacts relevant to this task
```

**Tool 2: query_trajectory**

Enables agents to search execution history.

```typescript
const queryTrajectoryTool = {
  name: 'query_trajectory',
  description: 'Search the execution trajectory for specific events',
  parameters: {
    run_id: { type: 'string' },
    query: {
      event_types: { type: 'array', items: { type: 'string' } },
      task_id: { type: 'string', optional: true },
      since: { type: 'string', format: 'date-time', optional: true },
      contains_decision_about: { type: 'string', optional: true },
    },
  },
};

// Example query: "Find all decisions about authentication"
// → Returns DecisionRecorded events matching "authentication"
```

### TrajectoryContextBuilder (Research-Aware)

Service that assembles relevant context for agent prompts with deliberate positioning.

```typescript
class TrajectoryContextBuilder {
  // Token budgets from research
  private static readonly TOTAL_BUDGET = 12000;      // Safe practical limit
  private static readonly WORKING_MEMORY = 6000;     // Optimal 4-8K range

  constructor(
    private storage: TrajectoryStorage,
    private config: TrajectoryInjection
  ) {}

  async buildTaskStartContext(task: Task, run: Run): Promise<string> {
    // Position-aware assembly (Lost in the Middle research)
    const startParts: string[] = [];   // Critical info at START
    const middleParts: string[] = [];  // Supporting context
    const endParts: string[] = [];     // Immediate action context

    // START: Run summary and key decisions
    if (this.config.inject_on_task_start.include_run_summary) {
      startParts.push(await this.buildRunSummary(run));
    }

    if (this.config.inject_on_task_start.include_recent_decisions > 0) {
      const decisions = await this.getRecentDecisions(
        run.run_id,
        this.config.inject_on_task_start.include_recent_decisions
      );
      startParts.push(this.formatDecisions(decisions));
    }

    // MIDDLE: Supporting context (OK for less critical retrieval)
    if (this.config.inject_on_task_start.include_similar_past_tasks) {
      const similar = await this.findSimilarPastTasks(task);
      middleParts.push(this.formatSimilarTasks(similar));
    }

    // END: Predecessor handoff (most immediate context)
    if (this.config.inject_on_task_start.include_predecessor_handoff) {
      const handoff = await this.getPredecessorHandoff(task);
      if (handoff) {
        endParts.push(this.formatHandoff(handoff));
      }
    }

    // Assemble with position awareness
    const assembled = [
      ...startParts,
      ...middleParts,
      ...endParts,
    ].join('\n\n---\n\n');

    // Enforce token budget
    return this.truncateToTokenBudget(assembled, TrajectoryContextBuilder.WORKING_MEMORY);
  }

  async buildRetryContext(task: Task, previousAttempt: TaskAttempt): Promise<string> {
    const parts: string[] = [];

    if (this.config.inject_on_retry.include_previous_attempt) {
      parts.push(`## Previous Attempt\n${previousAttempt.output_summary}`);
    }

    if (this.config.inject_on_retry.include_failure_analysis) {
      const analysis = await this.analyzeFailure(previousAttempt);
      parts.push(`## Failure Analysis\n${analysis}`);
    }

    return parts.join('\n\n');
  }

  private async buildRunSummary(run: Run): Promise<string> {
    const completed = await this.storage.countByStatus(run.run_id, 'completed');
    const total = await this.storage.countTasks(run.run_id);
    const blocked = await this.storage.countByStatus(run.run_id, 'blocked');

    return `## Run Context
Goal: ${run.goal}
Progress: ${completed}/${total} steps complete
Blocked: ${blocked} steps waiting`;
  }

  private formatDecisions(decisions: DecisionEvent[]): string {
    if (decisions.length === 0) return '';

    const formatted = decisions.map(d =>
      `- **${d.payload.title}**: ${d.payload.reasoning}`
    ).join('\n');

    return `## Recent Decisions\n${formatted}`;
  }
}
```

### Recommended Defaults (Research-Backed)

```yaml
trajectory_injection:
  enabled: true

  # Token budgets (from MEM1 + Lost in the Middle research)
  budget:
    total_context_tokens: 12000   # Safe practical limit (65-75% of max)
    working_memory_tokens: 6000   # Middle of optimal 4-8K range

  # Position strategy (from Lost in the Middle: 40-60% drop in middle)
  position_strategy:
    critical_info: boundaries     # Run summary, key decisions at start/end
    supporting_context: middle    # Verbose content, examples OK in middle

  inject_on_task_start:
    include_run_summary: true           # At START of context
    include_recent_decisions: 5         # Last 5 at START
    include_predecessor_handoff: true   # Critical for dependency chains
    include_similar_past_tasks: false   # Start simple

  inject_on_retry:
    include_previous_attempt: true
    include_failure_analysis: true      # Reflexion: +20-30% improvement
```

### Context Position Strategy

Based on Lost in the Middle research, position matters significantly:

| Content Type | Position | Rationale |
|--------------|----------|-----------|
| Run summary | **Start** | Agent needs orientation first |
| Key decisions | **Start** | Must not contradict prior work |
| Failure analysis | **End** | Most recent, needs action |
| Predecessor handoff | **End** | Immediate context for task |
| Examples, verbose docs | Middle | OK if retrieval isn't critical |
| Supporting context | Middle | Reference material |

**Practical implication**: The TrajectoryContextBuilder should compose context with deliberate ordering, not append-only.

---

## Handoff Context

When Agent A finishes and Agent B starts on a dependent task, B needs A's working memory.

### Current Problem

```
Agent A (Architect)           Agent B (Coder)
├── Designs auth system       ├── Implements auth
├── Decides: Use JWT          │   └── Has no idea about
├── Considers: Sessions       │       JWT decision or
├── Rejects: Because X        │       why sessions rejected
└── Produces: design.md       └── May re-decide or contradict
```

### Handoff Context Schema

```typescript
interface HandoffContext {
  // Artifacts from predecessor
  artifacts: {
    name: string;
    type: string;
    path: string;
    summary?: string;
  }[];

  // Decisions made
  decisions: {
    decision_id: string;
    title: string;
    choice: string;
    reasoning: string;
    alternatives_considered?: string[];
  }[];

  // Open concerns
  concerns: string[];

  // Summary for quick orientation
  context_summary: string;
}
```

### Proposed MCP Tool

```typescript
const getHandoffContextTool = {
  name: 'get_handoff_context',
  description: 'Get context from predecessor tasks',
  parameters: {
    task_id: { type: 'string', description: 'Your task ID' },
  },
  response: {
    predecessor_tasks: [{
      step_id: 'string',
      step_title: 'string',
      handoff: 'HandoffContext',
    }],
  },
};
```

### Handoff Generation

When a task completes, generate handoff context:

```typescript
async function generateHandoffContext(
  task: Task,
  attempt: TaskAttempt
): Promise<HandoffContext> {
  // 1. Collect artifacts
  const artifacts = await getArtifacts(task.task_id);

  // 2. Collect decisions from trajectory
  const decisionEvents = await getTrajectoryEvents(task.task_id, 'DecisionRecorded');
  const decisions = decisionEvents.map(e => ({
    decision_id: e.payload.decision_id,
    title: e.payload.title,
    choice: e.payload.choice,
    reasoning: e.payload.reasoning,
    alternatives_considered: e.payload.alternatives,
  }));

  // 3. Extract concerns (from retrospective or explicit flags)
  const retrospective = await getRetrospective(attempt.attempt_id);
  const concerns = retrospective?.concerns || [];

  // 4. Generate summary
  const summary = await summarizeForHandoff(task, artifacts, decisions);

  return {
    artifacts: artifacts.map(a => ({
      name: a.name,
      type: a.type,
      path: a.path,
      summary: a.description,
    })),
    decisions,
    concerns,
    context_summary: summary,
  };
}
```

---

## Active Query: Consistency Checking

Agents should be able to check if their actions contradict prior decisions.

### Use Cases

1. **Before committing a decision**: "Is this consistent with what was decided earlier?"
2. **After producing output**: "Does this output align with the acceptance criteria?"
3. **When uncertain**: "What was the rationale for the related decision in step 3?"

### Proposed Schema

```typescript
interface ActiveQueryConfig {
  enabled: boolean;

  consistency_checks: {
    type: 'decision_alignment' | 'output_compatibility' | 'requirement_coverage';
    scope: 'run' | 'task' | 'dependencies';
  }[];

  on_inconsistency: 'warn' | 'block' | 'human_review';
}
```

### Consistency Check Service

```typescript
class ConsistencyChecker {
  async checkDecisionAlignment(
    proposedDecision: Decision,
    runId: string
  ): Promise<ConsistencyResult> {
    // Get all prior decisions in this run
    const priorDecisions = await this.getDecisions(runId);

    // Look for contradictions
    const contradictions = priorDecisions.filter(prior =>
      this.isContradiction(proposedDecision, prior)
    );

    if (contradictions.length > 0) {
      return {
        consistent: false,
        contradictions: contradictions.map(c => ({
          prior_decision: c,
          conflict_description: this.describeConflict(proposedDecision, c),
        })),
      };
    }

    return { consistent: true };
  }

  private isContradiction(proposed: Decision, prior: Decision): boolean {
    // Domain-specific logic to detect contradictions
    // Could use embedding similarity, keyword matching, or LLM judgment

    // Simple heuristic: same topic, different choice
    const sameTopic = this.calculateTopicSimilarity(proposed.title, prior.title) > 0.8;
    const differentChoice = proposed.choice !== prior.choice;

    return sameTopic && differentChoice;
  }
}
```

---

## Cross-Run Learning

Learn from past runs to improve future execution.

### Current: User Decision Learning

```typescript
// Existing: UserTrajectoryService
// Tracks: Which questions were asked, how users answered
// Uses: Similarity-based lookup to auto-answer similar questions

// Example:
// Past: "Should I use TypeScript?" → User said "Yes"
// Now: "Should I use TypeScript?" → Auto-answer "Yes" (similarity 0.95)
```

### Target: Pattern Learning

```typescript
interface CrossRunMemory {
  enabled: boolean;

  precedent_lookup: {
    similarity_threshold: number;
    max_precedents: number;
    scope: 'user' | 'organization' | 'global';
  };

  learning: {
    store_successful_patterns: boolean;
    store_failure_patterns: boolean;
  };
}
```

### What to Learn

| Pattern Type | What We Capture | How We Use It |
|--------------|-----------------|---------------|
| **Step execution time** | Duration per step pattern | Estimate complexity, set timeouts |
| **Retry patterns** | Which steps need retries | Adjust max_retries, decomposition |
| **Model performance** | Success rate per task type | Model selection optimization |
| **Decision patterns** | Common choices per context | Suggest defaults, auto-answer |
| **Failure patterns** | Error categories, root causes | Proactive warnings, different approaches |

### Pattern Storage

```sql
-- Execution baselines
CREATE TABLE execution_baselines (
  baseline_id TEXT PRIMARY KEY NOT NULL,

  -- Scope
  scope_type TEXT NOT NULL CHECK (scope_type IN ('step_type', 'role', 'project', 'global')),
  scope_value TEXT NOT NULL,

  -- Metric
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

-- Successful patterns
CREATE TABLE successful_patterns (
  pattern_id TEXT PRIMARY KEY NOT NULL,
  step_pattern TEXT NOT NULL,
  context_hash TEXT,  -- Hash of relevant context
  approach TEXT NOT NULL,  -- What worked
  success_count INTEGER DEFAULT 1,
  last_used_at TEXT NOT NULL
);

-- Failure patterns
CREATE TABLE failure_patterns (
  pattern_id TEXT PRIMARY KEY NOT NULL,
  step_pattern TEXT NOT NULL,
  error_category TEXT NOT NULL,
  root_cause TEXT,
  recovery_that_worked TEXT,
  occurrence_count INTEGER DEFAULT 1,
  last_seen_at TEXT NOT NULL
);
```

---

## Drift Detection

Detect when execution deviates from expected patterns.

**Research context**: 36% of multi-agent failures are silent (Multi-Agent Taxonomy 2025). Drift detection is essential for catching these failures before they cascade. With proper validation, 98% of silent failures become detectable.

### What to Monitor

| Signal | Baseline | Alert When | Research Basis |
|--------|----------|------------|----------------|
| Task duration | Historical mean ± 2σ | > 2σ from baseline | METR error formula |
| Token usage | Historical mean ± 2σ | > 2σ from baseline | Cost control |
| Retry rate | Historical rate | Sudden increase | Diminishing returns after 3 |
| Error patterns | Known categories | New error category | 36% silent failures |
| Output format | Expected schema | Schema violation | 98% detectable |
| Confidence scores | Baseline per task type | < threshold | Silent failure indicator |

### Drift Monitor

```typescript
interface DriftDetection {
  enabled: boolean;

  monitor: ('output_format' | 'decision_pattern' | 'time_pattern' | 'error_rate')[];

  alert_threshold: number;  // Standard deviations

  on_alert: 'log' | 'question' | 'pause' | 'abort';
}

class DriftMonitor {
  async checkTaskDrift(task: Task, execution: TaskExecution): Promise<DriftAlert | null> {
    const baseline = await this.getBaseline(task.step_pattern);

    if (!baseline || baseline.sample_count < 10) {
      // Not enough data for drift detection
      return null;
    }

    // Check duration drift
    const durationZScore = (execution.duration_ms - baseline.mean_duration) / baseline.std_duration;
    if (Math.abs(durationZScore) > this.config.alert_threshold) {
      return {
        type: 'time_pattern',
        message: `Task took ${execution.duration_ms}ms, expected ${baseline.mean_duration}ms ± ${baseline.std_duration}ms`,
        zscore: durationZScore,
        recommended_action: this.config.on_alert,
      };
    }

    // Check token drift
    const tokenZScore = (execution.tokens_used - baseline.mean_tokens) / baseline.std_tokens;
    if (Math.abs(tokenZScore) > this.config.alert_threshold) {
      return {
        type: 'time_pattern',
        message: `Task used ${execution.tokens_used} tokens, expected ${baseline.mean_tokens} ± ${baseline.std_tokens}`,
        zscore: tokenZScore,
        recommended_action: this.config.on_alert,
      };
    }

    return null;
  }
}
```

### Recommended Defaults

```yaml
drift_detection:
  enabled: true
  monitor:
    - time_pattern
    - error_rate
  alert_threshold: 2.0  # Standard deviations
  on_alert: question  # Ask human before continuing
```

---

## Feedback Loop to Planner

Execution outcomes should inform future planning.

### Task Execution Result

When a task completes, send structured feedback:

```typescript
interface TaskExecutionResult {
  task_id: string;
  step_id: string;

  // Timing
  started_at: string;
  ended_at: string;
  duration_seconds: number;

  // Outcome
  outcome: 'success' | 'failure' | 'timeout' | 'blocked';
  error_message?: string;

  // Execution metrics
  actual_complexity?: 'trivial' | 'simple' | 'moderate' | 'complex' | 'very_complex';
  required_retries?: number;
  model_used?: string;

  // Suggestions for future planning
  suggestions?: {
    should_always_decompose?: boolean;
    should_run_sequential?: boolean;
    insufficient_context?: string[];
    missing_prerequisite_steps?: string[];
    complexity_estimate_was_wrong?: boolean;
  };
}
```

### Planner Integration

```
┌───────────────┐                    ┌───────────────┐
│    PLANNER    │◄───────────────────│     FORGE     │
│               │  TaskExecutionResult│               │
│  • Update     │                    │  • Complete   │
│    complexity │                    │    task       │
│    estimates  │                    │  • Generate   │
│  • Learn      │                    │    feedback   │
│    patterns   │                    │               │
└───────────────┘                    └───────────────┘
```

---

## Implementation Phases

### Phase 1: Query Tools (Enable Agent Reasoning)

| Task | Effort | Description |
|------|--------|-------------|
| Add `query_run_state` MCP tool | Medium | Basic run context |
| Add `query_trajectory` MCP tool | Medium | Trajectory search |
| Build TrajectoryContextBuilder | Medium | Assemble context for prompts |

### Phase 2: Handoff Context

| Task | Effort | Description |
|------|--------|-------------|
| Add `get_handoff_context` MCP tool | Medium | Predecessor context |
| Generate handoff on task completion | Medium | Extract decisions/artifacts |
| Inject handoff into dependent tasks | Medium | Automatic context transfer |

### Phase 3: Consistency Checking

| Task | Effort | Description |
|------|--------|-------------|
| Build ConsistencyChecker service | High | Contradiction detection |
| Add pre-decision consistency check | Medium | Block contradictions |
| Integrate with MCP tools | Low | Surface in agent workflow |

### Phase 4: Cross-Run Learning

| Task | Effort | Description |
|------|--------|-------------|
| Add execution_baselines table | Low | Store patterns |
| Build baseline aggregation | Medium | Update from outcomes |
| Add drift detection | High | Compare to baselines |
| Build feedback loop to Planner | Medium | Inform future plans |

---

## Open Questions

1. **How much context is too much?** ✅ **ANSWERED by research**: Optimal working memory is 4-8K tokens (MEM1 2025). Effective context is 65-75% of advertised max. Position matters: 40-60% drop when critical info is in middle.

2. **Contradiction resolution**: When drift is detected, who decides what to do? Always human? Sometimes auto-resolve?
   - *Research guidance*: 36% of failures are silent; detection is critical. Auto-escalate to human for unexpected drift.

3. **Learning scope**: Should patterns be per-user, per-org, or global? Privacy vs. collective learning trade-off.

4. **Trajectory retention**: How long to keep detailed trajectories? Storage vs. analysis capability trade-off.

---

## Research Sources

| Source | Citation | Key Finding |
|--------|----------|-------------|
| Lost in the Middle 2024 | [aclanthology.org/2024.tacl-1.9](https://aclanthology.org/2024.tacl-1.9/) | 40-60% drop in context middle |
| MEM1 2025 | [arxiv.org/html/2506.15841v2](https://arxiv.org/html/2506.15841v2) | Optimal working memory: 4-8K tokens |
| Reflexion 2023 | [arxiv.org/abs/2303.11366](https://arxiv.org/abs/2303.11366) | Self-correction: +20-30% |
| Multi-Agent Taxonomy 2025 | [arxiv.org/abs/2503.13657](https://arxiv.org/abs/2503.13657) | 36% silent failures |
| METR 2025 | [arxiv.org/html/2503.14499v1](https://arxiv.org/html/2503.14499v1) | Duration-based error formula |

---

*Document updated: 2026-02-04*
*Research sources: 10+ peer-reviewed papers, 2023-2026*

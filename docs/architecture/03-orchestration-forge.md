# Orchestration: The Forge's Role

> How execution is controlled through policies, recovery strategies, and intelligent model selection.

---

## Why Orchestration Matters

Decomposition gives us smaller steps, but without orchestration:
- Errors compound unchecked across steps
- No budget controls (token/time/cost can explode)
- Recovery is manual ("it failed, now what?")
- Model selection is static (same expensive model for trivial tasks)

Orchestration is the execution policy layer that makes agentic execution reliable, recoverable, and cost-effective.

### Research Foundation

| Finding | Value | Source |
|---------|-------|--------|
| Self-correction improvement | +20-30% on hard tasks | Reflexion 2023 |
| 5-agent voting reliability | 43x improvement | Six Sigma Agent 2026 |
| Silent failure rate | 36% without validation | Multi-Agent Taxonomy 2025 |
| Haiku cost efficiency | 3.7x vs Opus per success | Anthropic 2026 |
| SWE-bench Opus | 80.9% | Anthropic Model Card |
| SWE-bench Sonnet | 64.8% | Anthropic Model Card |
| SWE-bench Haiku | 60.6% | Anthropic Model Card |

**Key insight**: Model selection and recovery strategies are not just optimizations—they're essential for reliable execution. Without them, multi-agent systems fail 41-86.7% of the time.

---

## Current State

Today's Forge has solid foundations:

| Component | Status | Notes |
|-----------|--------|-------|
| Run/Task state machine | ✅ Solid | Clear status transitions |
| Checkpointing | ✅ Implemented | Fire-and-forget async snapshots |
| Human gates | ✅ Implemented | Approval workflow |
| Questions | ✅ Implemented | Blocking levels, priority scoring |
| Guardian observers | ✅ Implemented | Security, Architect, QA, Compliance |
| Recovery service | ✅ Partial | Orphan detection, retry on restart |

**Missing pieces**:
- No execution budgets (token/time/cost)
- Limited recovery (only retry, no rollback/branch/escalate)
- No parallelism control (all ready tasks execute immediately)
- No model selection (static CLI config)
- Confidence captured but unused in control flow

---

## Execution Policies

Every run should have an execution policy that controls how tasks execute.

### Proposed Schema

```typescript
interface ExecutionPolicy {
  // Budget constraints
  budgets: {
    total_token_budget?: number;
    per_task_token_budget?: number;
    total_time_budget_seconds?: number;
    per_task_time_budget_seconds?: number;
    total_cost_budget_usd?: number;
    per_task_cost_budget_usd?: number;
  };

  // Retry control
  retry: {
    max_retries_per_task: number;
    backoff: 'none' | 'linear' | 'exponential';
    backoff_base_seconds?: number;
  };

  // Parallelism
  parallelism: {
    max_concurrent_tasks: number;
    max_concurrent_per_scope?: number;
    prefer_sequential_in_scope: boolean;
  };

  // Replan triggers
  replan: {
    on_cascade_failure: boolean;
    threshold_blocked_tasks?: number;
  };

  // Phase-aware allocation
  phase?: 'mvp' | 'development' | 'production';
}
```

### Recommended Defaults (Research-Backed)

```yaml
execution_policy:
  budgets:
    # From METR: P(success) ≈ (0.5)^(T/50min)
    # Tasks > 50 min have < 50% success rate
    per_task_time_budget_seconds: 300  # 5 min per task (stay well under 50min)

    # Token/cost budgets: set based on plan complexity and language tier
    # Tier D languages (COBOL) may need 15x more time

  retry:
    # Research: diminishing returns after 3 retries without reflection
    max_retries_per_task: 3
    backoff: exponential
    backoff_base_seconds: 30

    # Reflexion-style self-correction: +20-30% improvement
    include_failure_analysis: true  # Critical for improvement

  parallelism:
    max_concurrent_tasks: 5
    prefer_sequential_in_scope: false

  replan:
    on_cascade_failure: true
    threshold_blocked_tasks: 3

  # Silent failure detection (36% of failures are silent)
  validation:
    require_output_validation: true
    detect_silent_failures: true  # 98% detectable with proper validation

  phase: development
```

### Phase-Aware Allocation

Different phases prioritize different trade-offs:

| Phase | Speed Weight | Quality Weight | Model Default | Budget Strictness |
|-------|-------------|----------------|---------------|-------------------|
| **mvp** | 0.8 | 0.2 | Haiku/Sonnet | Loose (iterate fast) |
| **development** | 0.5 | 0.5 | Sonnet | Balanced |
| **production** | 0.2 | 0.8 | Sonnet/Opus | Strict (verify everything) |

---

## Recovery Strategies

When things go wrong, what happens next?

### Current: Retry Only

```
Task fails → Create new attempt → Same prompt, same agent → Hope it works
```

This is insufficient. The same conditions often produce the same failure.

**Research insight**: Reflexion-style self-correction (analyzing failure before retry) improves performance by **+20-30%** on hard reasoning tasks. Simple retry without reflection has diminishing returns after 2-3 attempts.

*Source: [Reflexion](https://arxiv.org/abs/2303.11366)*

### Target: Recovery Ladder

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          RECOVERY STRATEGIES                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. RETRY ──────────────► Same prompt, same agent, with backoff         │
│     │                     Good for: transient errors, rate limits       │
│     │                                                                   │
│     ▼                                                                   │
│  2. REVISE ─────────────► Modified prompt based on failure analysis     │
│     │                     Good for: misunderstood requirements          │
│     │                                                                   │
│     ▼                                                                   │
│  3. ROLLBACK ───────────► Restore to last good checkpoint               │
│     │                     Good for: cascading state corruption          │
│     │                                                                   │
│     ▼                                                                   │
│  4. BRANCH ─────────────► Try alternative approach (different agent/model)
│     │                     Good for: fundamental approach mismatch       │
│     │                                                                   │
│     ▼                                                                   │
│  5. ESCALATE ───────────► Human gate or abort                           │
│                           Good for: unrecoverable errors, ambiguity     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Proposed Schema

```typescript
interface RecoveryStrategy {
  // Primary strategy
  on_failure: 'retry' | 'revise' | 'rollback' | 'branch' | 'escalate' | 'skip';

  // Retry configuration
  retry_config?: {
    max_attempts: number;
    backoff_seconds: number;
    backoff_multiplier?: number;  // For exponential
  };

  // Revise configuration
  revise_config?: {
    prompt_modifier: string;  // Instruction to add
    include_failure_context: boolean;
    max_revisions: number;
  };

  // Rollback configuration
  rollback_config?: {
    strategy: 'task' | 'scope' | 'full_run';
    preserve_artifacts: boolean;
  };

  // Branch configuration
  branch_config?: {
    alternative_model?: string;
    alternative_role?: string;
    alternative_prompt?: string;
  };

  // Escalation configuration
  escalation_config?: {
    escalate_to: 'gate' | 'question' | 'abort';
    message: string;
    urgency: 'low' | 'medium' | 'high' | 'critical';
  };
}
```

### Recovery Flow Example

```typescript
async function handleTaskFailure(task: Task, error: Error): Promise<RecoveryAction> {
  const policy = task.recovery_strategy || getDefaultRecoveryStrategy();
  const attempts = await getAttemptCount(task.task_id);

  // 1. Try retry first (if allowed)
  if (policy.retry_config && attempts < policy.retry_config.max_attempts) {
    const backoff = calculateBackoff(attempts, policy.retry_config);
    return { action: 'retry', delay_ms: backoff * 1000 };
  }

  // 2. Try revise (if configured)
  if (policy.revise_config && attempts < policy.retry_config.max_attempts + policy.revise_config.max_revisions) {
    const revisedPrompt = buildRevisedPrompt(task, error, policy.revise_config);
    return { action: 'revise', prompt: revisedPrompt };
  }

  // 3. Try branch (if configured)
  if (policy.branch_config) {
    return {
      action: 'branch',
      model: policy.branch_config.alternative_model,
      role: policy.branch_config.alternative_role,
    };
  }

  // 4. Escalate
  return {
    action: 'escalate',
    type: policy.escalation_config?.escalate_to || 'gate',
    message: policy.escalation_config?.message || `Task ${task.step_id} failed after ${attempts} attempts`,
  };
}
```

---

## Verification

Not all steps need the same level of verification.

### Risk-Based Verification

```typescript
interface VerificationConfig {
  // Risk classification (affects which checks run)
  risk_level: 'low' | 'medium' | 'high' | 'critical';

  // Quick checks (always run, fast)
  quick_checks: QuickCheck[];

  // Deep checks (run based on risk level)
  deep_checks: DeepCheck[];
  deep_check_threshold: 'low' | 'medium' | 'high';
}

type QuickCheck = 'output_exists' | 'no_errors' | 'format_valid' | 'size_reasonable';
type DeepCheck = 'test_suite' | 'security_scan' | 'human_review' | 'integration_test';
```

### Default Verification Matrix

| Risk Level | Quick Checks | Deep Checks |
|------------|--------------|-------------|
| **low** | output_exists, no_errors | None |
| **medium** | output_exists, no_errors, format_valid | test_suite |
| **high** | All quick checks | test_suite, security_scan |
| **critical** | All quick checks | All deep checks + human_review |

---

## Confidence Handling

Forge captures confidence scores but doesn't use them. This should change.

**Research context**: Silent failures account for 36% of multi-agent system failures (Multi-Agent Taxonomy 2025). Low confidence scores are a leading indicator—98% of silent failures are detectable with proper validation including confidence thresholds.

### Current Flow

```
Agent completes task → Retrospective captures confidence → Stored in DB → Ignored
```

### Target Flow

```
Agent completes task
       │
       ▼
Retrospective captures confidence (0-1)
       │
       ▼
┌──────┴──────┐
│  Check      │
│  threshold  │
└──────┬──────┘
       │
 ┌─────┴─────┐
 │           │
 ▼           ▼
Low (<0.5)  High (≥0.5)
 │           │
 ▼           ▼
Trigger     Continue
action      normally
```

### Proposed Schema

```typescript
interface ConfidencePolicy {
  // Threshold below which action is triggered
  low_confidence_threshold: number;  // e.g., 0.5

  // What to do on low confidence
  on_low_confidence: 'continue' | 'clarify' | 'rerun' | 'escalate';

  // Minimum confidence to pass task (stricter)
  require_confidence_above?: number;

  // Track for learning
  record_confidence_outcomes: boolean;
}
```

### Recommended Defaults

```yaml
confidence_policy:
  low_confidence_threshold: 0.5
  on_low_confidence: clarify  # Ask agent to explain uncertainty
  require_confidence_above: 0.3  # Below this, task fails
  record_confidence_outcomes: true
```

---

## Model Selection Optimizer

This is the most sophisticated knob: dynamically selecting the right model for each task.

### Current State

**Forge has NO model selection logic.**

```typescript
// Current: Static config lookup
{
  cli: "claude",  // No model versioning
  timeout: 300,
  audit: true,
}
```

All tasks use the same model. Expensive for simple tasks, potentially inadequate for complex ones.

### The Operations Research Problem

**Goal**: Select model M for task T that minimizes cost while meeting quality/speed constraints.

```
minimize: cost(M, T)
subject to:
  quality(M, T) >= quality_threshold
  latency(M, T) <= latency_threshold
  capabilities(M) ⊇ requirements(T)
```

This is a **multi-objective optimization** with:
- Competing objectives (cost vs quality vs speed)
- Stochastic outcomes (model performance varies)
- Learning opportunity (outcomes improve selection over time)

### Architecture

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
│                    │  • Track tokens used         │                     │
│                    │  • Track duration            │                     │
│                    │  • Track outcome             │                     │
│                    └──────────────┬───────────────┘                     │
│                                   │                                     │
│                                   ▼                                     │
│                    ┌──────────────────────────────┐                     │
│                    │      FEEDBACK LOOP           │                     │
│                    │  Update performance DB with  │                     │
│                    │  actual outcomes             │                     │
│                    └──────────────────────────────┘                     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Component 1: Model Registry

```typescript
interface ModelProfile {
  model_id: string;           // "claude-3-5-sonnet-20241022"
  display_name: string;       // "Sonnet"
  provider: string;           // "anthropic"

  // Capabilities
  capabilities: ModelCapability[];

  // Limits
  max_context_tokens: number;
  max_output_tokens: number;

  // Cost (per million tokens)
  cost_per_mtok_input: number;
  cost_per_mtok_output: number;

  // Performance profile
  speed_profile: 'fast' | 'balanced' | 'thorough';
  quality_profile: 'basic' | 'standard' | 'premium';

  // Availability
  enabled: boolean;
  rate_limit_rpm?: number;
}

type ModelCapability =
  | 'code_generation'
  | 'code_review'
  | 'reasoning'
  | 'tool_use'
  | 'long_context'
  | 'fast_response'
  | 'creative_writing'
  | 'structured_output';

// Registry (could be config-driven or DB-backed)
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

### Component 2: Task Classification

```typescript
interface TaskClassification {
  // Task identity
  task_type: TaskType;

  // Complexity estimate
  complexity: 'trivial' | 'simple' | 'moderate' | 'complex' | 'very_complex';

  // Requirements
  required_capabilities: ModelCapability[];

  // Context estimation
  estimated_context_tokens: number;
  estimated_output_tokens: number;

  // Constraints
  max_cost_usd?: number;
  max_latency_seconds?: number;
  min_quality_level?: 'basic' | 'standard' | 'premium';

  // Historical identifiers for learning
  step_pattern?: string;  // Normalized pattern like "implement-api-endpoint"
  role_pattern?: string;  // Like "backend:Coder"
}

type TaskType =
  | 'code_generation'
  | 'code_modification'
  | 'code_review'
  | 'testing'
  | 'documentation'
  | 'architecture'
  | 'debugging'
  | 'refactoring'
  | 'deployment'
  | 'analysis';

function classifyTask(step: ForgeStep, context: RunContext): TaskClassification {
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

### Component 3: Performance Database

```sql
-- Aggregated model-task performance
CREATE TABLE model_task_performance (
  performance_id TEXT PRIMARY KEY NOT NULL,

  -- Identifiers
  model_id TEXT NOT NULL,
  task_type TEXT NOT NULL,
  complexity TEXT NOT NULL,
  step_pattern TEXT,
  role_pattern TEXT,

  -- Statistics
  sample_count INTEGER NOT NULL DEFAULT 0,

  -- Success metrics
  success_rate REAL NOT NULL DEFAULT 0.5,
  first_try_success_rate REAL,

  -- Cost metrics
  avg_tokens_input INTEGER,
  avg_tokens_output INTEGER,
  avg_cost_usd REAL,

  -- Speed metrics
  avg_duration_ms INTEGER,
  p50_duration_ms INTEGER,
  p95_duration_ms INTEGER,

  -- Quality metrics (from audits)
  avg_audit_score REAL,

  -- Bayesian priors (for Thompson sampling)
  alpha REAL NOT NULL DEFAULT 1.0,  -- Successes + prior
  beta REAL NOT NULL DEFAULT 1.0,   -- Failures + prior

  last_updated_at TEXT NOT NULL,

  UNIQUE (model_id, task_type, complexity, step_pattern, role_pattern)
);

-- Individual execution records (for detailed analysis)
CREATE TABLE model_executions (
  execution_id TEXT PRIMARY KEY NOT NULL,
  run_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
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
  selection_reason TEXT,  -- "cost_optimized", "quality_required", "exploration"
  alternative_models TEXT,  -- JSON array of considered alternatives

  created_at TEXT NOT NULL,

  FOREIGN KEY (run_id) REFERENCES runs(run_id) ON DELETE CASCADE,
  FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE CASCADE
);
```

### Component 4: Selection Algorithm (Thompson Sampling)

```typescript
interface SelectionConstraints {
  max_cost_usd?: number;
  max_latency_ms?: number;
  min_quality_level?: 'basic' | 'standard' | 'premium';
  required_capabilities?: ModelCapability[];
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
    // 1. Filter by hard constraints
    const eligible = this.filterEligible(classification, constraints);

    if (eligible.length === 0) {
      throw new Error('No eligible models for task requirements');
    }

    // 2. Get performance history
    const performances = await this.getPerformances(eligible, classification);

    // 3. Decide: exploit or explore
    if (Math.random() < this.explorationRate && eligible.length > 1) {
      return this.selectExploration(eligible, performances, classification);
    }

    // 4. Exploit: Thompson sampling
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

      return model.enabled;
    });
  }

  private async selectExploitation(
    eligible: ModelProfile[],
    performances: Map<string, ModelTaskPerformance>,
    classification: TaskClassification,
    constraints: SelectionConstraints
  ): Promise<SelectionResult> {
    // Thompson sampling: sample from Beta distributions
    const samples = eligible.map(model => {
      const perf = performances.get(model.model_id);
      const alpha = perf?.alpha ?? 1;
      const beta = perf?.beta ?? 1;

      // Sample from Beta(alpha, beta)
      const successSample = this.sampleBeta(alpha, beta);

      // Calculate expected cost
      const expectedCost = this.estimateCost(model, classification, perf);

      // Score: balance success rate vs cost
      const costPenalty = constraints.max_cost_usd
        ? Math.max(0, expectedCost / constraints.max_cost_usd - 1)
        : 0;

      const score = successSample * (1 - costPenalty * 0.5);

      return { model, score, successSample, expectedCost, performance: perf };
    });

    samples.sort((a, b) => b.score - a.score);

    const best = samples[0];
    const alternatives = samples.slice(1).map(s => ({
      model_id: s.model.model_id,
      reason_rejected: s.score < best.score
        ? `Lower expected success (${(s.successSample * 100).toFixed(1)}%)`
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
    // Find model with most uncertainty (least samples)
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
      expected_duration_ms: 30000,
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
    // Simplified: use mean. For production, use proper Beta sampling.
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

### Component 5: Learning Loop

```typescript
class PerformanceLearner {
  constructor(private performanceDb: ModelTaskPerformanceRepo) {}

  async recordExecution(execution: ModelExecution): Promise<void> {
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

    const updated = current
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

    // Update Bayesian priors
    const alpha = current.alpha + (success ? 1 : 0);
    const beta = current.beta + (success ? 0 : 1);

    // Update running averages
    const avgTokensInput = this.runningAvg(current.avg_tokens_input, execution.tokens_input, n);
    const avgTokensOutput = this.runningAvg(current.avg_tokens_output, execution.tokens_output, n);
    const avgCostUsd = this.runningAvg(current.avg_cost_usd, execution.cost_usd, n);
    const avgDurationMs = this.runningAvg(current.avg_duration_ms, execution.duration_ms, n);

    return {
      ...current,
      sample_count: n + 1,
      success_rate: alpha / (alpha + beta),
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

### Expected Patterns to Discover

The optimizer should learn patterns like these (not hardcoded):

| Task Type | Optimal Model | Reason (discovered from data) |
|-----------|---------------|------------------------------|
| Simple code changes | Haiku | Fast, cheap, sufficient quality |
| Complex architecture | Opus | Needs deep reasoning |
| Code review | Sonnet | Good balance |
| Documentation | Haiku | Straightforward |
| Debugging | Sonnet/Opus | Depends on complexity |
| Refactoring | Sonnet | Needs context but not max reasoning |

### Recommended Defaults (Research-Backed)

Based on SWE-bench performance and cost analysis:

| Model | SWE-bench | Cost/MTok (in/out) | Cost Efficiency |
|-------|-----------|-------------------|-----------------|
| **Opus** | 80.9% | $15 / $75 | Premium quality |
| **Sonnet** | 64.8% | $3 / $15 | Balanced (default) |
| **Haiku** | 60.6% | $1 / $5 | 3.7x more cost-efficient per success |

```yaml
model_selection:
  default_model: claude-sonnet  # 64.8% SWE-bench, balanced cost
  exploration_rate: 0.10  # 10% exploration for learning

  # Hard rules (before learning kicks in)
  rules:
    # Complexity-based
    - condition: { complexity: trivial }
      model: claude-haiku  # 60.6% sufficient, 3.7x cost efficient
    - condition: { complexity: very_complex, on_critical_path: true }
      model: claude-opus   # 80.9% for critical work

    # Task type based
    - condition: { task_type: documentation }
      model: claude-haiku
    - condition: { task_type: architecture }
      model: claude-opus   # Deep reasoning needed

    # Language tier based (from MultiPL-E research)
    - condition: { language_tier: D }  # COBOL, Fortran, VHDL
      model: claude-opus   # Low-resource languages need premium
    - condition: { language_tier: C }  # OCaml, Ada, Clojure
      model: claude-opus
    - condition: { language_tier: S, complexity: simple }  # Python, TS, JS
      model: claude-haiku  # Well-supported, Haiku sufficient

  # Let learning override over time
  learning_override_after_samples: 10

  # Language/domain time multipliers (budget allocation)
  language_time_multipliers:
    tier_s: 2.5   # Python, TS, JS, Java, C++ (baseline)
    tier_a: 3.5   # Go, Rust, C#, PHP, Ruby
    tier_b: 5.0   # Swift, Kotlin, R, Lua, Haskell
    tier_c: 8.0   # OCaml, Ada, Clojure
    tier_d: 15.0  # COBOL, Fortran, VHDL
```

### Language/Domain Impact on Model Selection

Research shows a 68-point accuracy gap between Python (80%) and COBOL (12%) on HumanEval. This must inform model selection:

| Language Tier | Model Minimum | Extra Verification | Rationale |
|---------------|---------------|-------------------|-----------|
| **Tier S** (Python, TS, JS) | Haiku | Standard | High training data, well understood |
| **Tier A** (Go, Rust, C#) | Sonnet | Code review | Moderate training data |
| **Tier B** (Swift, Kotlin) | Sonnet | Expert review | Limited training data |
| **Tier C** (OCaml, Ada) | Opus | Expert review | Very limited data |
| **Tier D** (COBOL, Fortran) | Opus | **Mandatory human** | Extremely limited data |

*Source: [The Stack v2](https://huggingface.co/datasets/bigcode/the-stack-v2), [MultiPL-E](https://github.com/nuprl/MultiPL-E)*

---

## Ensembling & Voting (Research-Backed)

For critical steps, run multiple agents in parallel and aggregate results.

### Research Foundation

| Configuration | Error Rate Improvement | Source |
|---------------|----------------------|--------|
| 5-agent voting | 43x (5% → 0.116%) | Six Sigma Agent 2026 |
| 13-agent voting | 14,700x (Six Sigma: 3.4 DPMO) | Six Sigma Agent 2026 |
| Atomic decomposition | Million steps, zero errors | Solving Million-Step LLM 2025 |

**Key insight**: Voting only works with atomic, well-specified steps. Compound steps cannot be voted on effectively because outputs aren't comparable.

### Proposed Schema

```typescript
interface EnsembleConfig {
  enabled: boolean;
  parallel_attempts: number;  // Research: 5 agents = 43x improvement

  variant_strategy: 'same_prompt' | 'varied_prompts' | 'different_models';

  aggregation: 'first_success' | 'majority_vote' | 'human_select';

  // When to enable (based on research)
  enable_when: {
    on_critical_path: boolean;      // High-impact steps
    sla_requirement?: number;       // e.g., 0.99 for 99% SLA
    complexity: 'atomic' | 'simple'; // Must be atomic for effective voting
  };
}
```

### When to Ensemble

| Condition | Ensemble | Reason | Research Basis |
|-----------|----------|--------|----------------|
| Step is on critical path | Yes (5 agents) | 43x reliability | Six Sigma Agent |
| SLA > 99% required | Yes (5+ agents) | Mathematical guarantee | Six Sigma Agent |
| Step has failed 2+ times | Yes | Need alternative approaches | — |
| Simple, well-understood step | No | Waste of resources | — |
| **Compound step** | **No** | Cannot compare outputs | Six Sigma Agent |

### Recommended Voting Defaults

```yaml
voting:
  enabled_threshold_sla: 0.99  # Enable voting when SLA > 99%
  default_voting_agents: 5     # 43x reliability improvement
  max_voting_agents: 13        # Six Sigma (3.4 DPMO)

  # Only vote on atomic steps
  require_atomic_steps: true

  # Aggregation strategy
  aggregation: majority_vote
  tie_breaker: highest_confidence
```

---

## Implementation Phases

### Phase 1: Instrumentation (Foundation)

| Task | Effort | Description |
|------|--------|-------------|
| Extend CliConfig with model field | Low | Add `model: string` to config |
| Add token tracking hook | Medium | Intercept API calls for usage |
| Create model_executions table | Low | Store per-task data |
| Log model selection events | Low | Trajectory event |

### Phase 2: Basic Selection

| Task | Effort | Description |
|------|--------|-------------|
| Create ModelRegistry service | Medium | Hardcoded registry |
| Build TaskClassifier | Medium | Heuristic-based |
| Add model_task_performance table | Low | Aggregate stats |
| Wire to run creation | Medium | Classify at start |

### Phase 3: Full Selection Algorithm

| Task | Effort | Description |
|------|--------|-------------|
| Implement ModelSelector | High | Thompson sampling |
| Add selection constraints | Medium | Cost/quality/speed |
| Create selection API | Low | Endpoint for selection |
| Add exploration toggle | Low | Enable/disable |

### Phase 4: Learning Loop

| Task | Effort | Description |
|------|--------|-------------|
| Build PerformanceLearner | Medium | Update from outcomes |
| Add performance dashboard | Medium | UI for visibility |
| Implement decay factor | Low | Weight recent data |
| Add anomaly detection | Medium | Flag unexpected changes |

---

## Open Questions

1. **Cold start**: How to handle tasks with no performance history?
   - Use priors from model quality profiles?
   - Run calibration phase?

2. **Exploration vs exploitation balance**: Fixed rate or decay over time?

3. **Model version changes**: When Anthropic updates models, historical data may be invalid. Reset or gradual phase-in?

4. **User override**: Always allow manual model selection? How to present?

---

---

## Research Sources

| Source | Citation | Key Finding |
|--------|----------|-------------|
| METR 2025 | [arxiv.org/html/2503.14499v1](https://arxiv.org/html/2503.14499v1) | P(success) ≈ (0.5)^(T/50min) |
| Six Sigma Agent 2026 | [arxiv.org/html/2601.22290](https://arxiv.org/html/2601.22290) | 5-agent voting: 43x reliability |
| Reflexion 2023 | [arxiv.org/abs/2303.11366](https://arxiv.org/abs/2303.11366) | Self-correction: +20-30% |
| Multi-Agent Taxonomy 2025 | [arxiv.org/abs/2503.13657](https://arxiv.org/abs/2503.13657) | 36% silent failures |
| The Stack v2 | [huggingface.co/datasets/bigcode/the-stack-v2](https://huggingface.co/datasets/bigcode/the-stack-v2) | Training data distribution |
| MultiPL-E | [github.com/nuprl/MultiPL-E](https://github.com/nuprl/MultiPL-E) | 68-point language gap |
| Anthropic Model Cards | [anthropic.com](https://anthropic.com) | SWE-bench performance |

---

*Document updated: 2026-02-04*
*Research sources: 10+ peer-reviewed papers, 2023-2026*

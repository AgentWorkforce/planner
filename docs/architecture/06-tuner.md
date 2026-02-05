# Tuner: The Adaptive Learning Loop

> Observes execution, learns from outcomes, adjusts knobs.

---

## Scope Boundary: What Tuner Measures (and What It Doesn't)

**Tuner operates on automated, observable signals only.** It does not require human judgment or feedback to function.

### Tuner DOES Measure (Automated/Observable)

| Metric | Source | Description |
|--------|--------|-------------|
| Task success/failure | Task outcome | Did the agent complete without error? |
| Test pass/fail | CI results | Automated test suite results |
| Build success/fail | Build output | Does code compile/bundle? |
| Type check pass/fail | TypeScript compiler | Static analysis results |
| Duration | Timestamps | How long did execution take? |
| Token usage | LLM API | Cost per task |
| Retry count | Task events | How many attempts needed? |
| Error categories | Task failures | Syntax error, timeout, test failure, etc. |
| Predicted vs actual complexity | Plan vs execution | Did our estimates match reality? |
| Replan count | Change requests | How often did plans need structural changes? |

### Tuner Does NOT Measure (Requires Human Judgment)

| Metric | Why Not Tuner's Job | Where It Belongs |
|--------|---------------------|------------------|
| "Was the feature correct?" | Requires understanding user intent | Portfolio / Human review |
| "Is this secure enough?" | Requires domain expertise | **Planner guardrails** (ask before execution) |
| "Does this match requirements?" | Subjective quality judgment | Human review |
| "Should we have used a different approach?" | Architectural opinion | Retrospective / Portfolio |
| "Goal achievement" | Requires user confirmation | Portfolio (if tracked at all) |
| "User satisfaction" | Requires explicit user feedback | Portfolio (optional) |

### The Key Distinction

```
┌─────────────────────────────────────────────────────────────────────────┐
│  PLANNER GUARDRAILS (planning-time, human-in-loop)                      │
│                                                                         │
│  "This API has no authentication - is that intentional?"                │
│  "This plan touches 5 repos - confirm scope?"                           │
│  "No tests specified for critical path - add them?"                     │
│                                                                         │
│  → Catches missing requirements BEFORE execution                        │
│  → Requires human judgment to answer                                    │
│  → See docs/architecture/02-decomposition-planner.md                    │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  TUNER (execution-time, automated feedback loop)                        │
│                                                                         │
│  "Tests failed 3 times on this task type"                               │
│  "Haiku fails 60% on refactor tasks - switch to sonnet"                 │
│  "Duration is 3σ above baseline - drift alert"                          │
│                                                                         │
│  → Observes execution outcomes AFTER the fact                           │
│  → Uses statistical methods, no human judgment                          │
│  → Adjusts knobs automatically within bounds                            │
└─────────────────────────────────────────────────────────────────────────┘
```

**Rule of thumb**: If measuring it requires asking "did we do the right thing?", it's not Tuner's job. Tuner asks "how well did we do the thing we attempted?"

---

## Why a Tuner?

Planner decides **what** to do. Forge does **how**. But who decides:
- Which model to use for this task?
- What the retry limit should be?
- Whether this run is drifting from expected patterns?
- When thresholds need adjustment?

**Tuner** is the meta-layer that:
1. **Observes** - Collects execution outcomes from Forge
2. **Analyzes** - Computes baselines, detects drift
3. **Learns** - Updates model selection via Thompson sampling
4. **Adjusts** - Writes new config values for Forge/Planner

---

## Relationship to Other Layers

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PORTFOLIO                                          │
│                                                                              │
│  Strategic: "What initiatives to pursue?"                                   │
│  Human-driven, planning cadence (days/weeks)                                │
│  CONSUMES insights from Tuner                                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                        reads insights │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CONTROL PLANE (Ops)                                   │
│                                                                              │
│  Operational: "How well are we executing?"                                  │
│  Machine-driven, continuous (seconds/minutes)                               │
│                                                                              │
│  READS outcomes from Forge trajectories                                     │
│  WRITES config to Forge and Planner                                         │
└─────────────────────────────────────────────────────────────────────────────┘
                    │                               │
         writes config                    reads outcomes
                    ▼                               ▼
┌───────────────────────────────┐   ┌─────────────────────────────────────────┐
│          PLANNER              │   │              FORGE                       │
│                               │   │                                          │
│  Reads:                       │   │  Reads:                                  │
│  • complexity_weights         │   │  • model_selection_rules                 │
│  • decomposition_config       │   │  • budget_defaults                       │
│  • language_multipliers       │   │  • retry_limits                          │
│                               │   │  • confidence_thresholds                 │
│                               │   │                                          │
│                               │   │  Emits:                                  │
│                               │   │  • task outcomes (success/fail)          │
│                               │   │  • token/time usage                      │
│                               │   │  • confidence scores                     │
│                               │   │  • model used per task                   │
└───────────────────────────────┘   └─────────────────────────────────────────┘
```

**Key distinction:**
- **Portfolio** = Strategic ("should we do this?") - human-driven
- **Tuner** = Operational ("how well?") - machine-driven
- **Planner/Forge** = Execution - the actual work

---

## Package Structure

**Location**: `packages/tuner/`

```
packages/tuner/
├── src/
│   ├── index.ts                 # Service factory
│   ├── domain/
│   │   ├── config.ts            # ExecutionConfig, PlannerConfig types
│   │   ├── baseline.ts          # Baseline computation types
│   │   ├── drift.ts             # Drift detection types
│   │   └── outcome.ts           # TaskOutcome, RunOutcome types
│   ├── services/
│   │   ├── outcome-collector.ts # Ingests outcomes from Forge
│   │   ├── baseline-service.ts  # Computes/stores baselines
│   │   ├── drift-detector.ts    # Compares current to baseline
│   │   ├── model-selector.ts    # Thompson sampling for model selection
│   │   └── config-writer.ts     # Writes updated config
│   ├── storage/
│   │   ├── interface.ts         # Storage contract
│   │   └── sqlite.ts            # SQLite implementation
│   └── api/
│       ├── routes.ts            # HTTP endpoints
│       └── handlers/
│           ├── config.ts        # GET /config (Forge/Planner read)
│           ├── outcomes.ts      # POST /outcomes (Forge writes)
│           └── insights.ts      # GET /insights (Portfolio reads)
└── package.json
```

---

## Core Interfaces

### Config Types (what Tuner outputs)

```typescript
/**
 * Configuration for Forge execution
 * Tuner writes this; Forge reads it
 */
interface ForgeExecutionConfig {
  // Model selection rules
  model_selection: {
    default_model: 'claude-haiku' | 'claude-sonnet' | 'claude-opus';
    exploration_rate: number;  // 0.0-1.0, for Thompson sampling
    rules: ModelSelectionRule[];
  };

  // Budget defaults
  budgets: {
    per_task_time_seconds: number;
    per_task_token_limit: number;
    per_run_cost_limit_usd: number;
  };

  // Retry configuration
  retry: {
    max_retries_per_task: number;
    backoff: 'linear' | 'exponential';
    backoff_base_seconds: number;
    include_failure_analysis: boolean;
  };

  // Parallelism
  parallelism: {
    max_concurrent_tasks: number;
    prefer_sequential_in_scope: boolean;
  };

  // Confidence thresholds
  confidence: {
    escalation_threshold: number;  // Below this → escalate
    review_threshold: number;      // Below this → extra review
  };

  // Language tier time multipliers
  language_time_multipliers: Record<'tier_s' | 'tier_a' | 'tier_b' | 'tier_c' | 'tier_d', number>;

  // Version tracking
  version: number;
  updated_at: string;
}

interface ModelSelectionRule {
  condition: {
    complexity?: 'trivial' | 'simple' | 'moderate' | 'complex' | 'very_complex';
    task_type?: 'documentation' | 'architecture' | 'implementation' | 'review';
    language_tier?: 'S' | 'A' | 'B' | 'C' | 'D';
    on_critical_path?: boolean;
  };
  model: 'claude-haiku' | 'claude-sonnet' | 'claude-opus';
}

/**
 * Configuration for Planner decomposition
 * Tuner writes this; Planner reads it
 */
interface PlannerConfig {
  // Complexity estimation weights
  complexity_weights: {
    description_tokens: number;
    scope_count: number;
    dependency_count: number;
    ac_count: number;
    keyword_boost: number;
  };

  // Language tier multipliers
  language_complexity_multipliers: Record<'tier_s' | 'tier_a' | 'tier_b' | 'tier_c' | 'tier_d', number>;

  // Decomposition thresholds
  decomposition: {
    max_step_complexity: 'atomic' | 'simple' | 'compound';
    auto_decompose_threshold_tokens: number;
    max_steps_per_plan: number;
    max_depth: number;
  };

  // Version tracking
  version: number;
  updated_at: string;
}
```

### Outcome Types (what Tuner ingests)

```typescript
/**
 * Automated verification results from CI/build pipeline
 * All signals are observable without human judgment
 */
interface VerificationResults {
  tests_passed?: boolean;      // Did test suite pass?
  tests_total?: number;        // Total tests run
  tests_failed_count?: number; // Number of failing tests
  build_passed?: boolean;      // Did build/compile succeed?
  type_check_passed?: boolean; // TypeScript/Flow/etc. type checking
  lint_passed?: boolean;       // Linter (ESLint, etc.)
}

/**
 * Why a task failed (categorized for learning)
 */
type ErrorCategory =
  | 'syntax_error'    // Code syntax issues
  | 'test_failure'    // Tests failed
  | 'type_error'      // Type checking failed
  | 'build_error'     // Build/compile failed
  | 'lint_error'      // Linter errors
  | 'timeout'         // Exceeded time limit
  | 'runtime_error'   // Error during execution
  | 'unknown';        // Uncategorized

/**
 * Acceptance criteria verification result
 * For automated AC checks (file exists, command passes, etc.)
 */
interface ACResult {
  ac_id: string;       // Which AC was checked
  passed: boolean;     // Did it pass?
  evidence?: string;   // Proof (file path, command output, etc.)
}

/**
 * Task execution outcome
 * Forge emits this; Tuner collects it
 */
interface TaskOutcome {
  run_id: string;
  task_id: string;
  step_id: string;

  // What was configured
  model_used: string;
  complexity_estimate: string;
  language_tier?: string;

  // What happened
  outcome: 'success' | 'failure' | 'timeout' | 'cancelled';
  error_category?: ErrorCategory;  // Why it failed (if failure)
  attempts: number;
  duration_seconds: number;
  tokens_used: number;
  cost_usd: number;

  // Automated verification signals (from CI pipeline)
  verification?: VerificationResults;

  // Acceptance criteria results (automated checks only)
  ac_results?: ACResult[];

  // Quality signals
  confidence_score?: number;

  // Metadata
  timestamp: string;
}

/**
 * Aggregate verification summary for a run
 */
interface VerificationSummary {
  tests_passed_count: number;
  tests_failed_count: number;
  builds_passed_count: number;
  builds_failed_count: number;
  ac_met_count: number;
  ac_total_count: number;
}

/**
 * Run completion outcome
 * Forge emits this; Tuner collects it
 */
interface RunOutcome {
  run_id: string;
  plan_id: string;

  // Aggregate metrics
  outcome: 'completed' | 'failed' | 'cancelled';
  tasks_total: number;
  tasks_succeeded: number;
  tasks_failed: number;
  total_duration_seconds: number;
  total_tokens: number;
  total_cost_usd: number;

  // Automated verification summary (aggregate across all tasks)
  verification_summary?: VerificationSummary;

  // Quality signals
  replan_count: number;
  escalation_count: number;

  timestamp: string;
}
```

### Baseline Types

```typescript
/**
 * Baseline for a task pattern
 * Used for drift detection
 */
interface TaskBaseline {
  pattern: string;  // Normalized task pattern (e.g., "implement-api-endpoint")

  // Historical metrics
  mean_duration_seconds: number;
  stddev_duration_seconds: number;
  mean_tokens: number;
  stddev_tokens: number;
  mean_attempts: number;
  success_rate: number;

  // Sample size
  sample_count: number;
  last_updated: string;
}

/**
 * Model performance baseline
 * Used for Thompson sampling
 */
interface ModelBaseline {
  model: string;
  task_type: string;
  complexity: string;

  // Beta distribution parameters (Thompson sampling)
  alpha: number;  // Successes + 1
  beta: number;   // Failures + 1

  // Aggregate metrics
  total_attempts: number;
  success_rate: number;
  mean_cost_per_success: number;

  last_updated: string;
}
```

---

## Services

### 1. OutcomeCollector

Ingests execution outcomes from Forge.

```typescript
class OutcomeCollector {
  constructor(private storage: TunerStorage) {}

  /**
   * Record a task outcome
   * Called by Forge after each task completes
   */
  async recordTaskOutcome(outcome: TaskOutcome): Promise<void> {
    // Store raw outcome
    await this.storage.insertTaskOutcome(outcome);

    // Trigger baseline update (async)
    this.baselineService.updateBaseline(outcome);

    // Trigger model performance update (async)
    this.modelSelector.recordOutcome(outcome);
  }

  /**
   * Record a run outcome
   * Called by Forge after run completes
   */
  async recordRunOutcome(outcome: RunOutcome): Promise<void> {
    await this.storage.insertRunOutcome(outcome);
  }
}
```

### 2. BaselineService

Computes and maintains baselines for drift detection.

```typescript
class BaselineService {
  /**
   * Update baseline from new outcome
   * Uses exponential moving average for responsiveness
   */
  async updateBaseline(outcome: TaskOutcome): Promise<void> {
    const pattern = this.normalizePattern(outcome);
    const existing = await this.storage.getBaseline(pattern);

    if (!existing) {
      // First sample: initialize baseline
      await this.storage.insertBaseline({
        pattern,
        mean_duration_seconds: outcome.duration_seconds,
        stddev_duration_seconds: 0,
        mean_tokens: outcome.tokens_used,
        stddev_tokens: 0,
        mean_attempts: outcome.attempts,
        success_rate: outcome.outcome === 'success' ? 1 : 0,
        sample_count: 1,
        last_updated: new Date().toISOString(),
      });
    } else {
      // Update with exponential moving average
      const alpha = 0.1;  // Smoothing factor
      const updated = this.computeEMA(existing, outcome, alpha);
      await this.storage.updateBaseline(pattern, updated);
    }
  }

  /**
   * Get baseline for a task pattern
   */
  async getBaseline(pattern: string): Promise<TaskBaseline | null> {
    return this.storage.getBaseline(pattern);
  }
}
```

### 3. DriftDetector

Compares current execution to baselines.

```typescript
interface DriftAlert {
  type: 'duration' | 'tokens' | 'success_rate' | 'attempts';
  pattern: string;
  current_value: number;
  baseline_value: number;
  stddev: number;
  deviation_sigmas: number;  // How many σ from baseline
  severity: 'warning' | 'critical';
  timestamp: string;
}

class DriftDetector {
  private readonly WARNING_THRESHOLD = 2;   // 2σ
  private readonly CRITICAL_THRESHOLD = 3;  // 3σ

  /**
   * Check if outcome drifts from baseline
   */
  async checkDrift(outcome: TaskOutcome): Promise<DriftAlert[]> {
    const pattern = this.normalizePattern(outcome);
    const baseline = await this.baselineService.getBaseline(pattern);

    if (!baseline || baseline.sample_count < 10) {
      return [];  // Not enough data
    }

    const alerts: DriftAlert[] = [];

    // Check duration drift
    const durationDeviation = (outcome.duration_seconds - baseline.mean_duration_seconds)
      / baseline.stddev_duration_seconds;

    if (Math.abs(durationDeviation) >= this.WARNING_THRESHOLD) {
      alerts.push({
        type: 'duration',
        pattern,
        current_value: outcome.duration_seconds,
        baseline_value: baseline.mean_duration_seconds,
        stddev: baseline.stddev_duration_seconds,
        deviation_sigmas: durationDeviation,
        severity: Math.abs(durationDeviation) >= this.CRITICAL_THRESHOLD ? 'critical' : 'warning',
        timestamp: new Date().toISOString(),
      });
    }

    // Check token drift
    // ... similar logic

    return alerts;
  }
}
```

### 4. ModelSelector (Thompson Sampling)

Learns optimal model selection over time.

```typescript
class ModelSelector {
  /**
   * Select model using Thompson sampling
   * Balances exploration (try different models) vs exploitation (use best known)
   */
  async selectModel(
    taskType: string,
    complexity: string,
    languageTier?: string
  ): Promise<string> {
    // Check hard rules first (from config)
    const hardRule = this.config.model_selection.rules.find(r =>
      this.matchesCondition(r.condition, { taskType, complexity, languageTier })
    );
    if (hardRule) {
      return hardRule.model;
    }

    // Exploration: random selection with probability exploration_rate
    if (Math.random() < this.config.model_selection.exploration_rate) {
      return this.randomModel();
    }

    // Exploitation: Thompson sampling
    const candidates = ['claude-haiku', 'claude-sonnet', 'claude-opus'];
    const samples = await Promise.all(
      candidates.map(async model => {
        const baseline = await this.storage.getModelBaseline(model, taskType, complexity);
        if (!baseline) {
          return { model, sample: 0.5 };  // Uninformative prior
        }
        // Sample from Beta distribution
        const sample = this.sampleBeta(baseline.alpha, baseline.beta);
        return { model, sample };
      })
    );

    // Return model with highest sampled success rate
    samples.sort((a, b) => b.sample - a.sample);
    return samples[0].model;
  }

  /**
   * Record outcome for learning
   */
  async recordOutcome(outcome: TaskOutcome): Promise<void> {
    const baseline = await this.storage.getModelBaseline(
      outcome.model_used,
      this.inferTaskType(outcome),
      outcome.complexity_estimate
    );

    const success = outcome.outcome === 'success';

    if (!baseline) {
      // Initialize with Beta(1,1) prior (uniform)
      await this.storage.insertModelBaseline({
        model: outcome.model_used,
        task_type: this.inferTaskType(outcome),
        complexity: outcome.complexity_estimate,
        alpha: success ? 2 : 1,  // +1 success or +0
        beta: success ? 1 : 2,   // +0 or +1 failure
        total_attempts: 1,
        success_rate: success ? 1 : 0,
        mean_cost_per_success: success ? outcome.cost_usd : 0,
        last_updated: new Date().toISOString(),
      });
    } else {
      // Update Beta distribution parameters
      await this.storage.updateModelBaseline(
        outcome.model_used,
        this.inferTaskType(outcome),
        outcome.complexity_estimate,
        {
          alpha: baseline.alpha + (success ? 1 : 0),
          beta: baseline.beta + (success ? 0 : 1),
          total_attempts: baseline.total_attempts + 1,
          success_rate: (baseline.success_rate * baseline.total_attempts + (success ? 1 : 0))
            / (baseline.total_attempts + 1),
          mean_cost_per_success: success
            ? (baseline.mean_cost_per_success * baseline.total_attempts + outcome.cost_usd)
              / (baseline.total_attempts + 1)
            : baseline.mean_cost_per_success,
          last_updated: new Date().toISOString(),
        }
      );
    }
  }

  /**
   * Sample from Beta distribution
   * Used for Thompson sampling
   */
  private sampleBeta(alpha: number, beta: number): number {
    // Using Gamma distribution sampling trick
    const x = this.sampleGamma(alpha, 1);
    const y = this.sampleGamma(beta, 1);
    return x / (x + y);
  }
}
```

### 5. ConfigWriter

Generates updated config from learned parameters.

```typescript
class ConfigWriter {
  /**
   * Generate ForgeExecutionConfig from current learned state
   */
  async generateForgeConfig(): Promise<ForgeExecutionConfig> {
    const modelRules = await this.generateModelRules();
    const budgets = await this.computeOptimalBudgets();

    return {
      model_selection: {
        default_model: 'claude-sonnet',
        exploration_rate: this.computeExplorationRate(),
        rules: modelRules,
      },
      budgets,
      retry: {
        max_retries_per_task: 3,
        backoff: 'exponential',
        backoff_base_seconds: 30,
        include_failure_analysis: true,
      },
      parallelism: {
        max_concurrent_tasks: 5,
        prefer_sequential_in_scope: false,
      },
      confidence: {
        escalation_threshold: 0.5,
        review_threshold: 0.7,
      },
      language_time_multipliers: {
        tier_s: 2.5,
        tier_a: 3.5,
        tier_b: 5.0,
        tier_c: 8.0,
        tier_d: 15.0,
      },
      version: await this.getNextVersion(),
      updated_at: new Date().toISOString(),
    };
  }

  /**
   * Decay exploration rate as we collect more data
   */
  private computeExplorationRate(): number {
    const totalSamples = await this.storage.getTotalOutcomeCount();
    // Start at 10%, decay to 2% as samples grow
    return Math.max(0.02, 0.10 * Math.exp(-totalSamples / 1000));
  }
}
```

---

## Storage Schema

```sql
-- Task outcomes (raw data from Forge)
CREATE TABLE task_outcomes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  step_id TEXT NOT NULL,
  model_used TEXT NOT NULL,
  complexity_estimate TEXT,
  language_tier TEXT,
  outcome TEXT NOT NULL,  -- success, failure, timeout, cancelled
  error_category TEXT,    -- syntax_error, test_failure, type_error, build_error, etc.
  attempts INTEGER NOT NULL,
  duration_seconds REAL NOT NULL,
  tokens_used INTEGER NOT NULL,
  cost_usd REAL NOT NULL,
  confidence_score REAL,
  -- Automated verification signals
  tests_passed INTEGER,       -- 1/0/NULL
  tests_total INTEGER,        -- Number of tests run
  tests_failed_count INTEGER, -- Number of failing tests
  build_passed INTEGER,       -- 1/0/NULL
  type_check_passed INTEGER,  -- 1/0/NULL
  lint_passed INTEGER,        -- 1/0/NULL
  -- Acceptance criteria results (stored as JSON array)
  ac_results TEXT,            -- JSON: [{ ac_id, passed, evidence }]
  timestamp TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Run outcomes (aggregate data)
CREATE TABLE run_outcomes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL UNIQUE,
  plan_id TEXT NOT NULL,
  outcome TEXT NOT NULL,
  tasks_total INTEGER NOT NULL,
  tasks_succeeded INTEGER NOT NULL,
  tasks_failed INTEGER NOT NULL,
  total_duration_seconds REAL NOT NULL,
  total_tokens INTEGER NOT NULL,
  total_cost_usd REAL NOT NULL,
  replan_count INTEGER DEFAULT 0,
  escalation_count INTEGER DEFAULT 0,
  -- Verification summary (aggregate)
  tests_passed_count INTEGER DEFAULT 0,
  tests_failed_count INTEGER DEFAULT 0,
  builds_passed_count INTEGER DEFAULT 0,
  builds_failed_count INTEGER DEFAULT 0,
  ac_met_count INTEGER DEFAULT 0,
  ac_total_count INTEGER DEFAULT 0,
  timestamp TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Task baselines (for drift detection)
CREATE TABLE task_baselines (
  pattern TEXT PRIMARY KEY,
  mean_duration_seconds REAL NOT NULL,
  stddev_duration_seconds REAL NOT NULL,
  mean_tokens REAL NOT NULL,
  stddev_tokens REAL NOT NULL,
  mean_attempts REAL NOT NULL,
  success_rate REAL NOT NULL,
  verification_pass_rate REAL,  -- Rate of tasks with all verifications passing
  sample_count INTEGER NOT NULL,
  last_updated TEXT NOT NULL
);

-- Model baselines (for Thompson sampling)
CREATE TABLE model_baselines (
  model TEXT NOT NULL,
  task_type TEXT NOT NULL,
  complexity TEXT NOT NULL,
  alpha REAL NOT NULL,  -- Beta distribution param
  beta REAL NOT NULL,   -- Beta distribution param
  total_attempts INTEGER NOT NULL,
  success_rate REAL NOT NULL,
  mean_cost_per_success REAL NOT NULL,
  last_updated TEXT NOT NULL,
  PRIMARY KEY (model, task_type, complexity)
);

-- Drift alerts (history)
CREATE TABLE drift_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  pattern TEXT NOT NULL,
  current_value REAL NOT NULL,
  baseline_value REAL NOT NULL,
  stddev REAL NOT NULL,
  deviation_sigmas REAL NOT NULL,
  severity TEXT NOT NULL,
  acknowledged INTEGER DEFAULT 0,
  acknowledged_by TEXT,
  acknowledged_at TEXT,
  timestamp TEXT NOT NULL
);

-- Config versions (audit trail)
CREATE TABLE config_versions (
  version INTEGER PRIMARY KEY,
  forge_config TEXT NOT NULL,  -- JSON
  planner_config TEXT NOT NULL,  -- JSON
  generated_at TEXT NOT NULL,
  notes TEXT
);

-- Indexes
CREATE INDEX idx_task_outcomes_run ON task_outcomes(run_id);
CREATE INDEX idx_task_outcomes_timestamp ON task_outcomes(timestamp);
CREATE INDEX idx_drift_alerts_severity ON drift_alerts(severity, acknowledged);
```

---

## API Endpoints

### Config Endpoints (Forge/Planner read)

```
GET /api/tuner/config/forge
  → ForgeExecutionConfig

GET /api/tuner/config/planner
  → PlannerConfig

GET /api/tuner/config/version
  → { forge_version: number, planner_version: number }
```

### Outcome Endpoints (Forge writes)

```
POST /api/tuner/outcomes/task
  Body: TaskOutcome
  → { received: true }

POST /api/tuner/outcomes/run
  Body: RunOutcome
  → { received: true }
```

### Insight Endpoints (Portfolio reads)

```
GET /api/tuner/insights/summary
  → {
      total_runs: number,
      success_rate: number,
      avg_cost_per_run: number,
      drift_alerts_active: number,
      model_distribution: { model: string, percentage: number }[]
    }

GET /api/tuner/insights/drift
  ?severity=warning|critical
  ?acknowledged=true|false
  → DriftAlert[]

GET /api/tuner/insights/model-performance
  → ModelBaseline[]

POST /api/tuner/insights/drift/:id/acknowledge
  Body: { acknowledged_by: string }
  → { success: true }
```

---

## Integration Points

### Forge Integration

Forge needs to:

1. **Read config on startup and periodically**
```typescript
// In Forge initialization
const controlPlane = new TunerClient(config.control_plane_url);
let executionConfig = await controlPlane.getForgeConfig();

// Periodic refresh (every 5 min)
setInterval(async () => {
  executionConfig = await controlPlane.getForgeConfig();
}, 5 * 60 * 1000);
```

2. **Emit outcomes after task/run completion**
```typescript
// After task completes
await controlPlane.recordTaskOutcome({
  run_id,
  task_id,
  step_id,
  model_used: task.model,
  complexity_estimate: task.complexity,
  language_tier: task.language_tier,
  outcome: task.status === 'completed' ? 'success' : 'failure',
  attempts: task.attempt_count,
  duration_seconds: (task.completed_at - task.started_at) / 1000,
  tokens_used: task.tokens_used,
  cost_usd: task.cost_usd,
  confidence_score: task.retrospective?.confidence,
  audit_passed: task.audit_result?.passed,
  timestamp: new Date().toISOString(),
});
```

### Planner Integration

Planner needs to:

1. **Read config for decomposition**
```typescript
// When generating steps
const config = await controlPlane.getPlannerConfig();
const adjustedComplexity = baseComplexity * config.language_complexity_multipliers[tier];
```

---

## Recommended Defaults

```yaml
# Initial ForgeExecutionConfig
model_selection:
  default_model: claude-sonnet
  exploration_rate: 0.10
  rules:
    - condition: { complexity: trivial }
      model: claude-haiku
    - condition: { complexity: very_complex, on_critical_path: true }
      model: claude-opus
    - condition: { task_type: documentation }
      model: claude-haiku
    - condition: { task_type: architecture }
      model: claude-opus
    - condition: { language_tier: D }
      model: claude-opus
    - condition: { language_tier: C }
      model: claude-opus

budgets:
  per_task_time_seconds: 300
  per_task_token_limit: 50000
  per_run_cost_limit_usd: 10.00

retry:
  max_retries_per_task: 3
  backoff: exponential
  backoff_base_seconds: 30
  include_failure_analysis: true

parallelism:
  max_concurrent_tasks: 5
  prefer_sequential_in_scope: false

confidence:
  escalation_threshold: 0.5
  review_threshold: 0.7

language_time_multipliers:
  tier_s: 2.5
  tier_a: 3.5
  tier_b: 5.0
  tier_c: 8.0
  tier_d: 15.0
```

---

## Implementation Phases

### Phase 1: Foundation
- Create package structure
- Define types (config, outcomes, baselines)
- Storage schema and SQLite implementation
- Basic API endpoints (config read, outcome write)

### Phase 2: Config Distribution
- Forge integration (read config, emit outcomes)
- Planner integration (read config)
- Config versioning

### Phase 3: Learning
- Baseline computation service
- Drift detection service
- Thompson sampling for model selection
- Exploration rate decay

### Phase 4: Insights
- Portfolio-facing API
- Drift alert acknowledgment workflow
- Model performance dashboard data

---

## Open Questions

1. **Config refresh frequency**: How often should Forge/Planner poll for config updates? 5 min? Push notification?

2. **Baseline cold start**: What defaults to use before enough data is collected?

3. **Multi-tenancy**: Should baselines be per-organization or global?

4. **Human override**: Can Portfolio manually adjust knobs, bypassing learning?

---

*Document created: 2026-02-04*

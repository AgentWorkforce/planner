# System Boundaries: What Goes Where

> Mapping Planner, Forge, and the Tuner - what's LLM vs deterministic

---

## The Three Layers

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CONTROL PLANE                                      │
│                                                                              │
│  Monitors outcomes, adjusts knobs, learns from execution                    │
│  "The thing that watches everything and tweaks parameters"                  │
│                                                                              │
│  Examples: Model selection learning, threshold tuning, drift detection      │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │ observes & adjusts
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  ┌──────────────────────────┐      ┌──────────────────────────────────┐    │
│  │        PLANNER           │      │            FORGE                  │    │
│  │                          │      │                                   │    │
│  │  Intent → Plan           │─────▶│  Plan → Execution                 │    │
│  │                          │      │                                   │    │
│  │  "What should we do?"    │      │  "Do it, track it, recover"       │    │
│  └──────────────────────────┘      └──────────────────────────────────┘    │
│                                                                              │
│                        EXECUTION LAYER                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Planner: What It Does

### LLM-Driven (Reasoning Required)

| Capability | Why LLM? |
|------------|----------|
| **Intent understanding** | "Add authentication" could mean OAuth, JWT, sessions... |
| **Scope detection** | Which repos/domains are affected? |
| **Step generation** | Break goal into actionable steps |
| **Dependency inference** | "Frontend login page" depends on "Backend auth endpoints" |
| **Acceptance criteria** | What does "done" mean for this step? |
| **Complexity assessment** | Is this step atomic or compound? |
| **Language/domain detection** | What tier is this codebase? |

### Deterministic (Code Enforced)

| Capability | Why Deterministic? |
|------------|-------------------|
| **Schema validation** | PlanVersion must conform to structure |
| **Version numbering** | Monotonic, no gaps |
| **Status transitions** | draft → approved → published (no skipping) |
| **Immutability after approval** | Once approved, plan cannot change |
| **Step limits** | Max 15-20 steps per plan (enforced) |
| **Depth limits** | Max 3 levels of sub-plans (enforced) |

### Boundary Question: Complexity Scoring

```
Is this step "atomic" or "compound"?

OPTION A: LLM decides
  → Prompt: "Rate this step's complexity 1-5"
  → Problem: Inconsistent, no enforcement

OPTION B: Deterministic formula
  → score = tokens + (scopes × 10) + (deps × 5) + keywords
  → Problem: Misses nuance, can be gamed

OPTION C: Hybrid ✓
  → Deterministic formula calculates INITIAL score
  → LLM can ADJUST within bounds (±20%)
  → Final score must pass deterministic thresholds
```

**Planner uses OPTION C** - deterministic guardrails with LLM flexibility.

---

## Forge: What It Does

### LLM-Driven (Agent Execution)

| Capability | Why LLM? |
|------------|----------|
| **Task execution** | Write code, make decisions |
| **Retrospective** | "What did I do? Confidence?" |
| **Question generation** | "I'm blocked, need clarification" |
| **Handoff context** | Summarize work for next agent |

### Deterministic (Code Enforced)

| Capability | Why Deterministic? |
|------------|-------------------|
| **State machine** | pending → assigned → in_progress → completed/failed |
| **Budget enforcement** | Hard cap on tokens/time/cost per task |
| **Retry logic** | Max 3 retries, exponential backoff |
| **Model routing** | Rules-based: if complexity=trivial → Haiku |
| **Confidence thresholds** | If confidence < 0.5 → escalate |
| **Parallelism limits** | Max 5 concurrent tasks |
| **Timeout enforcement** | Kill task after budget exceeded |
| **Dependency resolution** | Task can't start until deps complete |

### Boundary Question: Recovery Strategy

```
Task failed. What now?

OPTION A: LLM decides recovery
  → Prompt: "Task failed with error X. What should we do?"
  → Problem: Expensive, inconsistent, can loop forever

OPTION B: Deterministic ladder ✓
  → Attempt 1-3: Retry with backoff
  → Attempt 4: Revise (include failure analysis)
  → Attempt 5: Escalate (different model or human)
  → Final: Gate (block and alert)

OPTION C: LLM within deterministic bounds
  → Ladder is fixed, but LLM generates "failure analysis"
  → LLM writes revised prompt, but ladder controls flow
```

**Forge uses OPTION B with LLM content** - deterministic flow, LLM fills in content.

---

## Tuner: The Meta-Layer

The Tuner is **outside both Planner and Forge**. It:
- Observes execution outcomes across runs
- Adjusts parameters (the "knobs")
- Learns from patterns
- Doesn't execute tasks itself

### What It Monitors

| Signal | Source | Updates |
|--------|--------|---------|
| Task success/failure rates | Forge trajectories | Model selection rules |
| Token usage per task type | Forge metrics | Budget defaults |
| Confidence score accuracy | Forge retrospectives | Confidence thresholds |
| Complexity estimate accuracy | Planner → Forge outcomes | Complexity formula weights |
| Retry effectiveness | Forge attempts | Retry limits, backoff params |
| Language tier performance | Forge by language | Tier multipliers |

### What It Adjusts (The Knobs)

```yaml
# These are the "knobs" that Tuner tweaks

model_selection:
  default_model: sonnet          # Can shift to haiku if outcomes support
  complexity_trivial_model: haiku
  complexity_critical_model: opus
  exploration_rate: 0.10         # Decrease as learning stabilizes

budgets:
  per_task_time_seconds: 300     # Adjust based on actual durations
  per_task_token_limit: 50000    # Adjust based on actual usage

confidence:
  escalation_threshold: 0.5      # Adjust based on false positive rate

retry:
  max_attempts: 3                # Could increase if retries are effective
  backoff_base_seconds: 30       # Adjust based on transient error patterns

complexity:
  formula_weights:               # Adjust based on prediction accuracy
    description_tokens: 0.3
    scope_count: 0.2
    dependency_count: 0.15
    language_multiplier: 0.35
```

### How Tuner Works

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CONTROL PLANE LOOP                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. OBSERVE                                                                  │
│     └── Collect execution outcomes (success, failure, duration, tokens)     │
│     └── Compare predicted vs actual (complexity, model performance)         │
│                                                                              │
│  2. ANALYZE                                                                  │
│     └── Statistical analysis (mean, variance, drift detection)              │
│     └── Pattern recognition (which tasks fail? which models succeed?)       │
│     └── This can be LLM-assisted for pattern synthesis                      │
│                                                                              │
│  3. ADJUST                                                                   │
│     └── Update knob values (deterministic: Thompson sampling, etc.)         │
│     └── Persist new defaults                                                │
│     └── Optionally: human review for significant changes                    │
│                                                                              │
│  4. REPEAT                                                                   │
│     └── Continuous learning loop                                            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## The Full Picture

```
                              ┌─────────────────────────┐
                              │     CONTROL PLANE       │
                              │                         │
                              │  • Drift detection      │
                              │  • Model learning       │
                              │  • Threshold tuning     │
                              │  • Baseline updates     │
                              │                         │
                              │  Mostly DETERMINISTIC   │
                              │  (stats, algorithms)    │
                              │  Some LLM for patterns  │
                              └───────────┬─────────────┘
                                          │
                        reads outcomes    │    writes knobs
                        ┌─────────────────┴─────────────────┐
                        │                                   │
                        ▼                                   ▼
┌───────────────────────────────────┐   ┌───────────────────────────────────┐
│            PLANNER                │   │            FORGE                   │
│                                   │   │                                    │
│  INPUT: Intent/Request            │   │  INPUT: Approved Plan              │
│  OUTPUT: Approved Plan            │   │  OUTPUT: Artifacts + Trajectories  │
│                                   │   │                                    │
│  ┌─────────────────────────────┐  │   │  ┌──────────────────────────────┐  │
│  │      LLM-DRIVEN             │  │   │  │       LLM-DRIVEN             │  │
│  │                             │  │   │  │                              │  │
│  │  • Intent understanding     │  │   │  │  • Task execution (agents)   │  │
│  │  • Step generation          │  │   │  │  • Retrospective capture     │  │
│  │  • Dependency inference     │  │   │  │  • Question generation       │  │
│  │  • Complexity assessment    │  │   │  │  • Handoff context           │  │
│  │  • AC writing               │  │   │  │                              │  │
│  └─────────────────────────────┘  │   │  └──────────────────────────────┘  │
│                                   │   │                                    │
│  ┌─────────────────────────────┐  │   │  ┌──────────────────────────────┐  │
│  │      DETERMINISTIC          │  │   │  │       DETERMINISTIC          │  │
│  │                             │  │   │  │                              │  │
│  │  • Schema validation        │  │   │  │  • State machine             │  │
│  │  • Version control          │  │   │  │  • Budget enforcement        │  │
│  │  • Status transitions       │  │   │  │  • Retry logic               │  │
│  │  • Immutability rules       │  │   │  │  • Model routing rules       │  │
│  │  • Step/depth limits        │  │   │  │  • Confidence thresholds     │  │
│  │  • Complexity formula       │  │   │  │  • Parallelism limits        │  │
│  │    (with LLM adjustment)    │  │   │  │  • Timeout enforcement       │  │
│  └─────────────────────────────┘  │   │  │  • Dependency resolution     │  │
│                                   │   │  └──────────────────────────────┘  │
└─────────────────┬─────────────────┘   └─────────────────┬──────────────────┘
                  │                                       │
                  │         Approved Plan                 │
                  └───────────────────────────────────────┘
```

---

## Decision Framework: LLM vs Deterministic

When deciding where something goes:

### Use LLM When:

| Condition | Example |
|-----------|---------|
| **Requires understanding context** | "What does this user want?" |
| **Output varies by situation** | "How should we decompose this task?" |
| **Needs synthesis** | "Summarize what happened for handoff" |
| **Human-like judgment** | "Is this acceptance criterion met?" |
| **Creative/generative** | "Write the code to implement X" |

### Use Deterministic When:

| Condition | Example |
|-----------|---------|
| **Must be consistent** | "Max 3 retries per task" |
| **Safety/compliance** | "Budget cannot exceed $X" |
| **State management** | "Task status: pending → in_progress" |
| **Mathematical/statistical** | "Thompson sampling for model selection" |
| **Schema/structure** | "Plan must have steps array" |
| **Timing/sequencing** | "Exponential backoff: 30s, 60s, 120s" |

### Hybrid Pattern (Recommended)

```
DETERMINISTIC GUARDRAILS + LLM CONTENT

Example: Retry with failure analysis

1. DETERMINISTIC: Decide to retry (attempt < max_retries)
2. DETERMINISTIC: Calculate backoff (exponential formula)
3. LLM: Generate failure analysis ("What went wrong?")
4. LLM: Revise prompt with analysis
5. DETERMINISTIC: Execute retry, track outcome
```

This pattern gives you:
- **Predictability** from deterministic flow
- **Intelligence** from LLM content
- **Safety** from enforced limits

---

## Where Does OR Fit?

"OR" (Orchestration Reasoning) is actually **distributed across all three layers**:

| Layer | OR Responsibility | LLM vs Deterministic |
|-------|-------------------|---------------------|
| **Planner** | "How should we decompose this?" | LLM with deterministic limits |
| **Forge** | "Which model for this task?" | Deterministic rules (from Tuner) |
| **Forge** | "What's the recovery strategy?" | Deterministic ladder |
| **Tuner** | "Should we adjust thresholds?" | Deterministic stats + optional LLM patterns |

**Key insight**: There's no single "OR" component. Orchestration reasoning is:
- **Strategic** (in Planner) - LLM-driven
- **Tactical** (in Forge) - Deterministic with LLM content
- **Meta** (in Tuner) - Deterministic learning with optional LLM insight

---

## Implementation Implications

### Planner Needs:

```typescript
// LLM-driven (via prompts)
interface PlannerLLM {
  understandIntent(request: string): Promise<Intent>;
  generateSteps(intent: Intent, context: Context): Promise<Step[]>;
  inferDependencies(steps: Step[]): Promise<Dependency[]>;
  assessComplexity(step: Step): Promise<ComplexityAdjustment>;
}

// Deterministic (code)
interface PlannerDeterministic {
  validateSchema(plan: PlanVersion): ValidationResult;
  enforceStepLimits(steps: Step[]): Step[];
  calculateComplexityScore(step: Step): number;
  transitionStatus(plan: PlanVersion, newStatus: Status): PlanVersion;
}
```

### Forge Needs:

```typescript
// LLM-driven (via agents)
interface ForgeLLM {
  executeTask(task: Task, context: TrajectoryContext): Promise<TaskResult>;
  generateRetrospective(task: Task): Promise<Retrospective>;
  generateHandoff(task: Task): Promise<HandoffContext>;
}

// Deterministic (code)
interface ForgeDeterministic {
  stateMachine: TaskStateMachine;
  budgetEnforcer: BudgetEnforcer;
  modelRouter: ModelRouter;          // Rules from Tuner
  retryPolicy: RetryPolicy;          // Ladder, not LLM
  confidenceChecker: ConfidenceChecker;
  parallelismLimiter: ParallelismLimiter;
}
```

### Tuner Needs:

```typescript
// Mostly deterministic
interface Tuner {
  // Observation
  collectOutcomes(runId: string): ExecutionOutcome[];

  // Analysis (deterministic stats)
  calculateBaselines(outcomes: Outcome[]): Baseline[];
  detectDrift(current: Metric, baseline: Baseline): DriftAlert | null;

  // Learning (deterministic algorithms)
  thompsonSamplingUpdate(model: Model, outcome: Outcome): void;
  updateThreshold(metric: string, newValue: number): void;

  // Optional: LLM for pattern synthesis
  synthesizePatterns?(outcomes: Outcome[]): PatternInsight[];
}
```

---

## Open Questions

1. **Tuner location**: Separate service? Part of Forge? Part of a "Platform" layer?

2. **Human override**: Can humans bypass deterministic rules? Which ones?

3. **Learning speed**: How quickly should Tuner adjust knobs? Too fast = instability, too slow = missed optimization.

4. **LLM in Tuner**: Is it worth using LLM to synthesize patterns, or is pure statistics sufficient?

---

*Document created: 2026-02-04*

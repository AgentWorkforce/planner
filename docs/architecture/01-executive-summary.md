# Executive Summary: Agentic Execution Architecture

> Based on Anthropic's research on incoherence in long reasoning chains.
> Reference: [The Hot Mess of AI](https://alignment.anthropic.com/2026/hot-mess-of-ai/)

---

## The Problem

As agentic systems take on longer, more complex tasks, they face a fundamental challenge: **incoherence compounds**. A small drift in reasoning at step 3 can cascade into a completely wrong outcome by step 30. Without architectural guardrails, agent performance degrades non-linearly with task complexity.

This isn't a model problem—it's an architecture problem. Better models reduce variance but don't eliminate it. The solution is building systems that **expect variance and manage it systematically**.

---

## Research Foundation

Our architecture is grounded in peer-reviewed research from 2024-2026. Key findings:

### Error Propagation (METR 2025, Anthropic 2026)

```
P(success) ≈ (0.5)^(T/50min)
```

- Frontier agents succeed **50% on 50-minute tasks**, **25% on 100-minute tasks**
- Errors are **duration-based, not step-based** — longer reasoning = more incoherence
- On hard tasks, **larger models become LESS coherent** (incoherence dominates, not bias)

*Source: [METR 2025](https://arxiv.org/html/2503.14499v1), [Hot Mess of AI](https://arxiv.org/html/2601.23045)*

### Decomposition Benefits (Six Sigma Agent 2026)

- 5-agent consensus voting: **43x reliability improvement** (5% error → 0.116%)
- 13-agent voting achieves Six Sigma: **3.4 DPMO** (14,700x improvement)
- Atomic decomposition solved **million-step tasks with zero errors**

*Source: [Six Sigma Agent](https://arxiv.org/html/2601.22290), [Million-Step LLM](https://arxiv.org/html/2511.09030v1)*

### Context Utilization (Lost in the Middle, 2023-2024)

- **40-60% performance drop** when relevant info is in context middle vs boundaries
- Effective context: **65-75%** of advertised max actually works reliably
- Optimal working memory: **4-8K tokens** (agents learn to consolidate)

*Source: [Lost in the Middle](https://aclanthology.org/2024.tacl-1.9/), [MEM1](https://arxiv.org/html/2506.15841v2)*

### Recovery Effectiveness (Reflexion, Multi-Agent Taxonomy 2025)

- Reflexion self-correction: **+20-30%** on hard reasoning tasks
- Multi-agent failure rates in production: **41-86.7%** (requires structured design)
- Silent failures: **36%** of multi-agent failures (98% detectable with validation)

*Source: [Reflexion](https://arxiv.org/abs/2303.11366), [Multi-Agent Failure Taxonomy](https://arxiv.org/abs/2503.13657)*

### Language & Domain Familiarity (The Stack v2, MultiPL-E)

| Tier | Languages | HumanEval | Time Multiplier |
|------|-----------|-----------|-----------------|
| **S** | Python, TypeScript, JavaScript, Java, C++ | 70-85% | 2.5x |
| **A** | Go, Rust, C#, PHP, Ruby | 55-70% | 3.5x |
| **B** | Swift, Kotlin, R, Lua, Haskell | 35-55% | 5x |
| **C** | OCaml, Ada, Clojure | 18-35% | 8x |
| **D** | COBOL, Fortran, VHDL | 5-15% | 12-20x |

- **68-point performance gap** between Python (80%) and COBOL (12%)
- Training data is root cause: Python has 100+ GB in The Stack, COBOL has <1 GB
- Context injection recovers **20-40%** of accuracy gap for underrepresented languages

*Source: [The Stack v2](https://huggingface.co/datasets/bigcode/the-stack-v2), [MultiPL-E](https://github.com/nuprl/MultiPL-E)*

---

## The DOT Framework

Three interlocking patterns that compound when combined:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           DOT FRAMEWORK                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  DECOMPOSITION          ORCHESTRATION           TRAJECTORIES            │
│  (Planner)              (Forge)                 (Both)                  │
│                                                                         │
│  Break large tasks      Execute with            Capture + use           │
│  into smaller,          budgets, gates,         execution history       │
│  well-specified         recovery policies       for reasoning           │
│  chunks                                                                 │
│                                                                         │
│  Research: 43x          Research: +20-30%       Research: 40-60%        │
│  reliability with       with self-correction    drop if info in         │
│  5-agent voting         (Reflexion)             middle of context       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

| Pattern | Without It | With It |
|---------|-----------|---------|
| **Decomposition** | 50% success at 50min, 25% at 100min | 43x reliability with atomic steps + voting |
| **Orchestration** | 41-86.7% failure rate unstructured | +20-30% with structured recovery |
| **Trajectories** | 40-60% lost context in middle | Boundary placement preserves retrieval |

**Key Insight**: These are durable architectural patterns regardless of model improvements. Even perfect models benefit from structure.

---

## System Architecture: Four-Layer Design

Our architecture separates concerns across four distinct layers, each with clear boundaries between LLM reasoning and deterministic control:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             PORTFOLIO                                        │
│                        (Strategic Governance)                                │
│                                                                             │
│   LLM: Priority reasoning, resource allocation strategy                     │
│   Deterministic: Budget enforcement, approval state machine                 │
│                                                                             │
│   Cadence: Days/weeks  •  Human-driven  •  "What should we pursue?"        │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │ initiatives, budgets
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CONTROL PLANE                                      │
│                         (Operational Learning)                               │
│                                                                             │
│   Deterministic ONLY: Observes outcomes, adjusts knobs, detects drift       │
│                                                                             │
│   Cadence: Continuous  •  Machine-driven  •  "What's working?"             │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │ config updates
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
┌─────────────────────────────┐   ┌─────────────────────────────────────────┐
│          PLANNER            │   │                FORGE                     │
│      (Decomposition)        │   │           (Orchestration)                │
│                             │   │                                         │
│  LLM: Understanding intent, │   │  LLM: Task execution, reasoning         │
│       structuring plans     │   │  Deterministic: State machine,          │
│  Deterministic: Versioning, │   │       budgets, gates, trajectory        │
│       DAG validation        │   │       capture                           │
│                             │   │                                         │
│  "What needs to happen?"    │   │  "Execute with guardrails"              │
└─────────────┬───────────────┘   └──────────────────┬──────────────────────┘
              │ plan_ref                             │ outcomes
              └────────────────────┬─────────────────┘
                                   │
                                   ▼
                          [Execution Loop]
                     Planner produces plans →
                     Forge executes with policies →
                     Tuner learns from outcomes →
                     Config flows back to both
```

### Layer Responsibilities

| Layer | DOT Role | LLM-Driven | Deterministic | Key Principle |
|-------|----------|------------|---------------|---------------|
| **Portfolio** | Meta | Priority reasoning | Budget caps, approval gates | Allocate, prioritize, gate |
| **Tuner** | Learning | — | Thompson sampling, drift detection | Observe outcomes, tune knobs |
| **Planner** | Decomposition | Intent→structure | Versioning, validation | Specify contracts, estimate complexity |
| **Forge** | Orchestration | Task execution | State machine, budgets | Execute with guardrails, capture everything |

### Tuner: The Learning Loop

The Tuner is the key addition—a pure-deterministic layer that:

1. **Observes outcomes** from Forge (success/fail, tokens, time, cost)
2. **Builds baselines** for tasks by complexity, language, model
3. **Detects drift** when performance degrades (mean ± 2σ)
4. **Selects models** via Thompson sampling (learns what works)
5. **Writes config** that flows to Planner and Forge

```typescript
// Example: Thompson sampling model selection
interface ModelArm {
  model: 'haiku' | 'sonnet' | 'opus';
  successes: number;  // Beta(α, β) distribution
  failures: number;
}

// For each task: sample from each model's Beta distribution
// Pick the model with highest sampled success probability
// Update counts based on outcome → learns over time
```

**Why separate?**
- Portfolio is strategic (human-driven, days/weeks)
- Tuner is operational (machine-driven, continuous)
- Clear separation: Forge enforces rules, Tuner computes optimal values

### Data Flow

```
Portfolio
    │
    │  1. Initiatives, budgets, priorities
    ▼
Tuner ◄────────────────────────────┐
    │                                       │
    │  2. ForgeExecutionConfig              │
    │     (model rules, budgets, retries)   │
    ▼                                       │
Planner ──────────► Forge ──────────────────┘
         plan_ref          3. TaskOutcome
                              (per task: model, tokens, time, outcome)
```

**Modularity**: Each layer operates independently via contracts. Planner can accept manual plans. Forge can execute any conforming plan. Tuner learns from any conforming outcome data. This enables phased development and component isolation.

---

## What Changes

### Current State (Audit Summary)

**Forge (packages/forge-core)**
- ✅ State machine with proper transitions (pending → running → completed/failed)
- ✅ Trajectory capture (34 event types): decisions, questions, tool calls, errors
- ✅ Checkpointing with SQLite-backed persistence
- ✅ Human gates with question workflow
- ✅ Agent spawning via relay
- ❌ No execution budgets (time/tokens/cost)
- ❌ No model selection (hardcoded "claude")
- ❌ No retry limits or backoff
- ❌ No parallelism controls
- ❌ Agents can't query trajectory (captured but not used)

**Planner (packages/planner)**
- ✅ 41+ API endpoints fully working
- ✅ Plan versioning with draft/approved/published states
- ✅ DAG validation and dependency management
- ✅ Change request workflow from Forge
- ✅ Acceptance criteria tracking
- ❌ No complexity estimation
- ❌ No language/domain tier detection
- ❌ No sub-plan decomposition (field exists but unused)

**Tuner**
- ❌ Does not exist yet (new package needed)

### Target State

| Capability | Current | Target | Research Basis |
|------------|---------|--------|----------------|
| **Decomposition** | Flat step arrays | Hierarchical sub-plans, complexity + language estimation | 43x improvement with atomic steps |
| **Execution Budgets** | Timeout only | Token/cost/time tracking and limits | Duration-based error formula |
| **Recovery** | Retry only | Retry → Revise → Rollback → Escalate | +20-30% from Reflexion |
| **Model Selection** | Hardcoded | Data-driven selection with Thompson sampling | 3.7x cost efficiency Haiku vs Opus |
| **Trajectory Use** | Captured, stored | Injected into agent prompts (4-8K budget) | 40-60% loss if misplaced |
| **Language/Domain** | Not considered | Tier-based multipliers, context injection | 68-point gap Python→COBOL |
| **Drift Detection** | None | Baseline comparison, alerts | 36% silent failures need detection |
| **Tuner** | None | Outcome collection, Thompson sampling, config versioning | Continuous learning loop |

---

## Research-Backed Defaults

These defaults are grounded in research. Over time, optimal settings should emerge organically from execution data.

### Model Selection (SWE-Bench, Anthropic Model Cards)

```yaml
model_selection:
  # Default: Sonnet (64.8% SWE-bench, $18/MTok)
  default_model: claude-sonnet

  # Upgrade to Opus (80.9% SWE-bench, $30/MTok) when:
  upgrade_to_opus_when:
    - complexity: very_complex
    - task_type: architecture
    - on_critical_path: true
    - language_tier: C or D  # Low-resource languages need premium

  # Use Haiku (60.6% SWE-bench, $6/MTok) when:
  # Haiku is 3.7x more cost-efficient per successful task
  use_haiku_when:
    - complexity: trivial
    - task_type: documentation
    - language_tier: S  # Well-supported languages

  # 10% exploration for learning
  exploration_rate: 0.10
```

### Decomposition (METR, Six Sigma Agent)

```yaml
decomposition:
  # Error formula: P(success) ≈ (0.5)^(T/50min)
  # At 15 steps average, atomic decomposition enables voting

  max_steps_without_voting: 15
  voting_threshold_sla: 0.99  # Enable voting above 99% SLA requirement

  # 5-agent voting: 43x reliability improvement
  default_voting_agents: 5

  # Language/domain multipliers affect complexity
  language_multipliers:
    tier_s: 1.0   # Python, TS, JS
    tier_a: 1.4   # Go, Rust
    tier_b: 2.0   # Swift, Kotlin
    tier_c: 3.2   # OCaml, Ada
    tier_d: 5.0   # COBOL, Fortran
```

### Context Injection (Lost in the Middle, MEM1)

```yaml
trajectory_injection:
  enabled: true

  # Total context budget: 12K tokens (safe practical limit)
  # Effective context is 65-75% of max
  total_budget_tokens: 12000

  # Working memory (trajectory): 4-8K optimal
  working_memory_budget: 6000

  # Position matters: 40-60% drop in middle
  position_strategy:
    critical_info: boundaries  # Start/end
    supporting_context: middle  # Safe for verbose content

  inject_on_task_start:
    include_run_summary: true
    include_recent_decisions: 5  # Last 5
    include_predecessor_handoff: true

  inject_on_retry:
    include_previous_attempt: true
    include_failure_analysis: true  # +20-30% from Reflexion
```

### Recovery (Reflexion, Multi-Agent Taxonomy)

```yaml
recovery:
  # Retry: 3x max (research shows diminishing returns)
  max_retries_per_task: 3
  retry_backoff: exponential
  backoff_base_seconds: 30

  # Self-correction: +20-30% on hard tasks
  enable_reflexion: true
  reflexion_threshold: moderate  # Apply to moderate+ complexity

  # Voting for critical tasks: 43x reliability
  enable_voting:
    when: on_critical_path
    agents: 3-5

  # Escalation threshold: When error cost > 3-10x intervention cost
  escalation_threshold_multiplier: 5

  # Recovery ladder
  sequence:
    - retry (transient errors only)
    - revise (include failure analysis)
    - branch (try different model)
    - escalate (human gate)
```

### Language/Domain Adjustment (The Stack v2, MultiPL-E)

```yaml
language_domain:
  # Tier-based adjustments
  tiers:
    S:  # Python, TS, JS, Java, C++
      accuracy_estimate: 0.75
      time_multiplier: 2.5
      model_minimum: haiku
      extra_verification: false

    A:  # Go, Rust, C#, PHP, Ruby
      accuracy_estimate: 0.62
      time_multiplier: 3.5
      model_minimum: sonnet
      extra_verification: code_review

    B:  # Swift, Kotlin, R, Lua, Haskell
      accuracy_estimate: 0.45
      time_multiplier: 5.0
      model_minimum: sonnet
      extra_verification: expert_review

    C:  # OCaml, Ada, Clojure
      accuracy_estimate: 0.26
      time_multiplier: 8.0
      model_minimum: opus
      extra_verification: expert_review
      decomposition: required

    D:  # COBOL, Fortran, VHDL
      accuracy_estimate: 0.10
      time_multiplier: 15.0
      model_minimum: opus
      extra_verification: mandatory_human
      decomposition: required
      context_injection: maximum  # Recovers 20-40%
```

---

## Implementation Phases

### Phase 1: Foundation (Forge Hardening)
**Goal**: Add deterministic guardrails to Forge

- Add ExecutionPolicy to Run entity (budgets, limits)
- Add per-task timeout enforcement
- Add retry limits with exponential backoff (3x max)
- Add parallelism controls (max concurrent tasks)
- Wire confidence capture to control flow
- Add model parameter to task execution (remove hardcoded "claude")

### Phase 2: Tuner Bootstrap
**Goal**: Create Tuner package with outcome collection

- Create `packages/tuner/` package structure
- Implement OutcomeCollector service
- Build TaskOutcome storage schema
- Add /config/forge endpoint (Forge reads config)
- Add /outcomes endpoint (Forge writes outcomes)
- Initial ForgeExecutionConfig with static defaults

### Phase 3: Trajectory Integration
**Goal**: Make captured trajectories usable

- Build TrajectoryContextBuilder (4-8K working memory budget)
- Add query_run_state MCP tool for agents
- Implement position-aware context injection (boundaries for critical info)
- Add Reflexion-style self-correction (+20-30%)
- Inject predecessor handoff on task start

### Phase 4: Learning Loop
**Goal**: Tuner learns from outcomes

- Build BaselineService for per-complexity/language/model baselines
- Implement DriftDetector (mean ± 2σ thresholds)
- Add ModelSelector with Thompson sampling
- Track language/domain performance
- Build feedback loop to Planner (change requests)

### Phase 5: Planner Enhancement
**Goal**: Smarter decomposition based on Tuner data

- Add complexity estimation to steps
- Add language/domain tier detection
- Implement tier-based time multipliers
- Add sub-plan decomposition (activate unused field)
- Surface Tuner drift alerts in planning

### Phase 6: Advanced Reliability
**Goal**: Research-backed reliability patterns

- Add voting for critical paths (5-agent = 43x)
- Silent failure detection (36% of failures)
- Configurable trajectory granularity
- Handoff context generation
- Phase-aware budget allocation

---

## Deep Dive Documents

This executive summary provides the "why" and research foundation. Detailed specifications are in companion documents:

1. **[Decomposition (Planner)](./02-decomposition-planner.md)** — How plans break work into steps, language/domain factors
2. **[Orchestration (Forge)](./03-orchestration-forge.md)** — How execution is controlled, model selection, recovery
3. **[Trajectories](./04-trajectories.md)** — How we capture and use execution history
4. **[System Boundaries](./05-system-boundaries.md)** — LLM vs deterministic boundaries, layer responsibilities
5. **[Tuner](./06-tuner.md)** — Outcome collection, Thompson sampling, drift detection, config management

---

## Key Numbers to Remember

| Metric | Value | Source |
|--------|-------|--------|
| Success at 50min task | 50% | METR 2025 |
| 5-agent voting improvement | 43x | Six Sigma Agent 2026 |
| Reflexion improvement | +20-30% | Reflexion 2023 |
| Context middle performance drop | 40-60% | Lost in Middle 2024 |
| Optimal working memory | 4-8K tokens | MEM1 2025 |
| Python vs COBOL gap | 68 points | MultiPL-E |
| Haiku cost efficiency | 3.7x vs Opus | Anthropic 2026 |
| Silent failure rate | 36% | Multi-Agent Taxonomy 2025 |
| Thompson sampling exploration | 10% | Bandit theory standard |
| Drift detection threshold | mean ± 2σ | Statistical process control |

---

## Summary: The Vision

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│   Portfolio decides WHAT to pursue                                      │
│        ↓                                                                │
│   Tuner learns WHAT'S WORKING (Thompson sampling, drift)        │
│        ↓                                                                │
│   Planner decomposes HOW to do it (complexity, language tiers)          │
│        ↓                                                                │
│   Forge executes WITH GUARDRAILS (budgets, retries, gates)              │
│        ↓                                                                │
│   Trajectories capture EVERYTHING (34 event types)                      │
│        ↓                                                                │
│   Outcomes feed back to Tuner → continuous improvement          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Key insight**: LLMs handle understanding and reasoning. Deterministic code handles state machines, budgets, and limits. The Tuner sits between—pure deterministic, but learning optimal values from outcome data.

---

*Document updated: 2026-02-04*
*Research sources: 25+ peer-reviewed papers, 2023-2026*

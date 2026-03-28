# Towards a Science of Scaling Agent Systems

**Source**: https://arxiv.org/abs/2512.08296
**Date reviewed**: 2026-03-08

## Summary

Establishes quantitative scaling principles for multi-agent LLM systems across 180 configurations. Tests five coordination topologies (single-agent, independent, centralized, decentralized, hybrid) across four benchmarks with three LLM families.

## Key Findings

### 1. Tool-Coordination Trade-off
Tool-heavy tasks suffer disproportionately from multi-agent overhead under fixed computational budgets. Splitting tool-intensive work across agents introduces coordination cost that outweighs parallelism gains.

### 2. Capability Saturation (~45% threshold)
Multi-agent coordination shows diminishing or negative returns once single-agent baselines exceed ~45% accuracy on a task. Below this threshold, multi-agent can help. Above it, a single stronger agent is better.

### 3. Error Amplification by Topology
- Independent agents: 17.2x error amplification
- Centralized coordination: 4.4x error amplification
- Centralized (DAG-based, dependency-aware) dramatically reduces cascading failures.

### 4. Sequential Reasoning Degradation
All multi-agent variants degraded 39-70% on sequential reasoning tasks. Decomposing inherently sequential reasoning chains into parallel sub-agents always hurts.

### 5. Task-Topology Matching
- Centralized coordination: +80.8% on parallelizable tasks
- Decentralized coordination: +9.2% on web navigation (vs +0.2% centralized)
- Sequential tasks: all multi-agent variants negative

### 6. Predictive Model
Framework predicted optimal coordination strategy for 87% of held-out configurations. Generalizes to unseen frontier models (GPT-5.2: MAE=0.071). Uses coordination metrics: agent count, topology type, model capability, task properties.

## Relevance to Plannr Architecture

### Validates
- DAG-based centralized execution in forge-next (centralized > independent by 4x on error amplification)
- ReconciliationLoop for proactive health checks (centralized error detection critical)
- Dependency-aware step ordering (sequential steps must stay sequential)

### Implemented (2026-03-08)

**1. Complexity-aware model selection** (`packages/forge-next/src/model-selector.ts`)
- Steps with `complexity_score >= 75` (very_complex) escalate to opus — stronger model for hard tasks
- Steps with `complexity_score < 15` (trivial) downgrade to haiku — save cost on simple work
- Keywords still take priority (explicit signal > derived score)
- Score flows from planner's `complexity_estimate.score` through server.ts fetchPlan bridge

**2. Adaptive concurrency** (`packages/forge-next/src/compiler.ts` → `inferMaxConcurrency()`)
- When user doesn't set `max_concurrent_tasks`, compiler infers from plan profile:
  - `depDensity >= 0.5` → cap at 2 (tightly coupled, sequential reasoning penalty)
  - `avgComplexity >= 60` → cap at 2 (complex, error amplification risk)
  - `avgComplexity >= 40` → cap at 3 (moderate)
  - Otherwise → 5 (simple/independent, maximize throughput)
- Explicit `execution_policy.max_concurrent_tasks` always overrides inference

### Not yet implemented
| Finding | Component | What's needed |
|---------|-----------|---------------|
| Tool-coordination trade-off | Planner decomposition | Add `task_type` classification (tool-heavy vs reasoning-heavy) to complexity estimator |
| Sequential reasoning detection | Planner AI decomposition | Auto-detect reasoning chains during plan authoring, prevent parallelization |
| Predictive coordination model | Compiler | Full task-type classification needed; the paper's R²=0.524 model maps task properties → optimal topology |

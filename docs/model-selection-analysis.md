# Model Selection Analysis: Cost-Benefit Tradeoffs

**Document:** Supplement to model-performance-baselines.md
**Date:** February 2026
**Purpose:** Help select optimal models for different agentic system use cases

---

## 1. Cost-Accuracy Pareto Frontier

### Input Cost vs SWE-bench Accuracy (Real-world coding)

```
80%  ▲
     │                        Opus 4.5 ●
     │                        (80.9%, $5)
     │
70%  │
     │         Sonnet 4.5 ●  Gemini 3 + agent ●
     │         (64.8%, $3)    (77.4%, ~$1.5*)
     │
60%  │
     │     Haiku 4.5 ●        Gemini 2.5 ●
     │     (60.6%, $1)        (65%, ~$1.25)
     │
50%  │ GPT-4o ●
     │ (50%, $5)
     └─────────────────────────────────
      $1    $2    $3    $4    $5    $6

* Approximate for agentic system with tools
```

### Pareto-Optimal Choices

**If minimizing cost:** Haiku 4.5 ($1/MTok input, 60.6%)
**If balancing:** Sonnet 4.5 ($3/MTok input, 64.8%) or Gemini ($1.25, 65% solo)
**If maximizing accuracy:** Opus 4.5 ($5/MTok input, 80.9%)

---

## 2. Speed vs Accuracy Trade-off

### Latency Profile (Time to First Token)

```
Fastest ─────────────────────────────────
        GPT-4o mini (0.63s)
        Haiku 4.5 (0.64s)
        GPT-4o (0.41s) ★ Fastest

Mid-range ───────────────────────────────
        Gemini (est. 1.0s)
        GPT-5.2 (est. 1.0s)
        Sonnet 4.5 (2.0s)

Slowest ──────────────────────────────────
        Opus 4.5 (est. 2.5s)
        o1-preview (22.0s) ⚠ Reasoning overhead
```

### When Latency Matters

- **Streaming interactive systems:** Use Haiku 4.5 or GPT-4o (0.4-0.6s TTFT)
- **Non-interactive batch:** Opus 4.5 latency is acceptable; prioritize accuracy
- **Real-time agentic loops:** Prefer Sonnet 4.5 (2s) over Opus (2.5s) due to cost difference

---

## 3. Context Window Advantage Analysis

### Problem Size vs Model Choice

```
Codebase Analysis Scenario:

Small codebase (< 50K tokens)
├─ Haiku 4.5 ✓ (200K context sufficient)
├─ Sonnet 4.5 ✓ (200K context sufficient)
└─ Opus 4.5 ✓ (200K context sufficient)

Large codebase (50K - 150K tokens)
├─ Haiku 4.5 ✓ (200K context sufficient)
├─ Sonnet 4.5 ✓ (200K context sufficient)
├─ Sonnet 4.5 (1M beta) ✓✓ (good headroom)
├─ Opus 4.5 ~ (tight fit, may truncate)
├─ GPT-4o ✗ (128K often insufficient)
└─ Gemini ✓✓ (1M context, ideal)

Massive codebase (> 200K tokens)
├─ Haiku 4.5 ✗ (truncation likely)
├─ Sonnet 4.5 (1M beta) ✓ (if available)
├─ Opus 4.5 ✗ (truncation likely)
├─ GPT-4o ✗ (insufficient)
└─ Gemini ✓✓ (1M native, handles easily)
```

### Cost Impact of Context Usage

**Example: Analyzing 100K token codebase**

| Model | Standard Context | Extra Cost | Notes |
|-------|------------------|------------|-------|
| Haiku 4.5 | 200K (over quota) | Truncation | Need model upgrade |
| Sonnet 4.5 | 1M beta | +$3/MTok for tokens >200K | ~$0.60 extra |
| Opus 4.5 | 200K (over quota) | Truncation | Need model upgrade |
| Gemini | 1M native | $0 extra | Handles natively |

**Recommendation:** For codebases >100K tokens, **Gemini or Sonnet 4.5 (1M beta) significantly reduce friction**.

---

## 4. Cost-per-Task Breakdown

### Scenario: Typical SWE-bench Task (~500K tokens avg)

| Model | Input Cost | Output Cost | Total/Task | Success Rate | Cost/Success | Efficiency |
|-------|-----------|-------------|----------|--------------|--------------|-----------|
| Haiku 4.5 | $0.50 | $2.50 | $3.00 | 60.6% | $4.95 | ✓✓ Best |
| Sonnet 4.5 | $1.50 | $7.50 | $9.00 | 64.8% | $13.89 | ✓ Good |
| Opus 4.5 | $2.50 | $12.50 | $15.00 | 80.9% | $18.54 | ✗ Expensive |
| GPT-4o | $2.50 | $7.50 | $10.00 | 50% | $20.00 | ✗ Poor |

**Interpretation:**
- For high-volume tasks, **Haiku 4.5 is 3.7x cheaper per success** than Opus 4.5
- Cost-of-failure matters in agentic systems: 60% success with Haiku requires retries, mitigating cost advantage
- **Sonnet 4.5 is the sweet spot:** 4.8% lower success than Opus but 40% cheaper

---

### Scenario: Large-Scale Deployment (1M tasks/month)

| Model | Monthly Cost (1M tasks, 500K tokens avg) | Success Rate | Successful Tasks | Cost/Successful |
|-------|------------------------------------------|--------------|-----------------|-----------------|
| Haiku 4.5 | $3,000 | 60.6% | 606K | $4.95 |
| Sonnet 4.5 | $9,000 | 64.8% | 648K | $13.89 |
| Opus 4.5 | $15,000 | 80.9% | 809K | $18.54 |

**Cost-benefit analysis:**
- **Haiku 4.5:** Cheapest but requires 394K retries (60.6% → 100% success)
- **Opus 4.5:** Requires 191K retries (80.9% → 100% success) at higher per-task cost
- **Break-even:** Opus becomes cheaper if retry cost < $6.59/task (input + output to retry)

---

## 5. Model for Different Agentic Workloads

### Workload Matrix

| Workload Type | Volume | Accuracy Required | Recommendation | Rationale |
|--------------|--------|------------------|-----------------|-----------|
| Simple tasks (e.g., template application) | High | 60-70% | Haiku 4.5 | Cost dominates; low risk |
| Medium-complexity workflow (e.g., bug fix) | Medium | 70-80% | Sonnet 4.5 | Balance of cost/accuracy |
| Complex multi-step (e.g., feature add) | Low | >80% | Opus 4.5 | Accuracy critical; volume low |
| Large codebase analysis | Variable | 70% | Gemini or Sonnet (1M) | Context window essential |
| Interactive, streaming (chatbot, IDE) | Medium | 75% | Haiku 4.5 or Sonnet 4.5 | Latency < 1s preferred |
| Real-time code completion | High | 70% | Haiku 4.5 | Must be <500ms |

---

## 6. Failure Mode Analysis

### Accuracy Implications (SWE-bench pass rates)

**Example:** Deployment with 1000 tasks

| Model | Success | Failure Rate | Implied Action |
|-------|---------|--------------|-----------------|
| Haiku 4.5 | 606 | 394 (39.4%) | ~40% require human review/retry |
| Sonnet 4.5 | 648 | 352 (35.2%) | ~35% require intervention |
| Opus 4.5 | 809 | 191 (19.1%) | ~19% require intervention |

**Cost of failure:**
- Human review: ~$10-50/task
- Automated retry (with Opus): ~$15/task
- Cascading failures: Tasks blocked by upstream failures

**Strategic implication:** Lower-accuracy models (Haiku, Sonnet) are only economical if failures can be:
1. Automatically retried (idempotent operations)
2. Escalated for human review at acceptable cost
3. Tolerated (e.g., low-stakes suggestions)

---

## 7. Reasoning Capability Comparison

### GPQA Diamond (Graduate-level expertise)

Used as proxy for deep reasoning in complex planning tasks.

```
Reasoning Strength

92.6% │ Gemini 3 Pro ██████████ Excellent
       │
85.4% │ GPT-5 (medium) ████████ Strong
       │
81.7% │ Claude Sonnet 4.5 ████████ Strong
       │
75% ├──────────────────────────────────
       │
65.0% │ Claude 3.5 Sonnet ██████ Good
       │
60% ├──────────────────────────────────
       │
50% └─ Baseline (random guessing ~25%)
```

### Implication for Planner v1

**For plan validation & dependency inference:**
- **Use Sonnet 4.5 (81.7%)** for most plans
- **Use Opus 4.5 (likely >85%)** for complex multi-scope initiatives
- **Consider Gemini (92.6%)** if handling highly complex cross-domain dependencies

---

## 8. Extended Thinking ROI

### Cost of Reasoning Mode

**Claude Extended Thinking Cost:**
- Base request: Input cost = I, Output cost = O
- With extended thinking: Input cost ≈ 1.5I (thinking tokens counted as input)
- Effective cost multiplier: 1.5-2.0x

**Example: Sonnet 4.5**
- Normal: $3 input + $15 output = $18/MTok
- Extended: $4.50 input + $15 output = $19.50/MTok (8% increase)

### When Extended Thinking is Worth It

✓ **Use extended thinking for:**
- Complex multi-step planning decisions (Plan DAG construction)
- High-stakes approval reviews (accuracy > cost)
- Dependency inference in large systems (error cost high)

✗ **Skip for:**
- Template-based tasks (straightforward execution)
- Simple text elaboration (few decisions)
- High-volume batch operations (cost-sensitive)

---

## 9. Multi-Model Strategy (Recommended)

### Tiered Approach for Planner

```
                     ┌─────────────────────────┐
                     │  User Request / Intake   │
                     └────────────┬─────────────┘
                                  │
                     ┌────────────▼─────────────┐
                     │  Complexity Assessment   │
                     │  (Haiku quick-classify)  │
                     └────┬────────┬────────────┘
                          │        │
                          ▼        ▼
                    Simple    Complex
                     │            │
         ┌───────────▼──┐      ┌──▼──────────────┐
         │ Haiku 4.5    │      │ Sonnet 4.5      │
         │ (template)   │      │ (structured)    │
         │ $1/$5 cost   │      │ $3/$15 cost     │
         └──────┬───────┘      └────┬────────────┘
                │                    │
                │              ┌─────▼─────┐
                │              │ Complex?  │
                │              └─┬───────┬─┘
                │                │       │
                │              Yes      No
                │                │       │
                │          ┌─────▼─┐  Success
                │          │Opus4.5│
                │          │80.9%  │
                │          └───────┘
                │
         ┌──────▼────────────────────────┐
         │   Plan Approved / Published    │
         │   (immutable)                  │
         └───────────────────────────────┘
```

### Cost Structure

- **Layer 1 (Classification):** Haiku 4.5 - ~$0.10/request
- **Layer 2 (Generation):** Sonnet 4.5 - ~$5-20/plan
- **Layer 3 (Validation):** Opus 4.5 - ~$15-50/critical plan

**Monthly estimate (10K plans):**
- 9000 simple plans (Haiku): $1,000
- 900 complex plans (Sonnet): $4,500
- 100 critical plans (Opus): $1,500
- **Total:** $7,000/month

---

## 10. Risk Assessment by Model

### Alignment & Safety Risk

| Model | Extended Thinking | Fine-tuning | Known Issues | Risk Level |
|-------|-------------------|-------------|--------------|-----------|
| Claude Haiku 4.5 | Yes | Limited public info | None major | ✓ Low |
| Claude Sonnet 4.5 | Yes | Limited public info | None major | ✓ Low |
| Claude Opus 4.5 | Yes | Limited public info | None major | ✓ Low |
| GPT-4o | No | Fine-tunable | Occasional hallucinations | ✓ Low |
| Gemini 3 Pro | Yes (thinking) | Limited | Early-stage, less tested | ⚠ Medium |
| o1-preview | Yes (built-in) | No | Resource intensive | ⚠ Medium |

### Reliability Risk

| Model | Uptime SLA | Outage History | Support | Risk |
|-------|-----------|----------------|---------|------|
| Claude API | 99.9% | Rare | 24/7 support | ✓ Low |
| OpenAI API | 99.9% | Occasional | Community-driven | ✓ Low |
| Google Vertex | 99.99% | Rare | 24/7 enterprise support | ✓ Very Low |

---

## 11. Recommendation Summary

### For Planner v1 (MVP - Zagreb)

**Primary Model: Claude Sonnet 4.5**
- 64.8% SWE-bench (sufficient for structured planning)
- $3/$15 pricing (acceptable for non-real-time)
- 1M context (beta) enables large PlanVersion handling
- Extended thinking available for complex reasoning

**Secondary Models:**
- Haiku 4.5 for lightweight tasks (step elaboration)
- Opus 4.5 for critical validations (approval gating)

**Cost estimate (first year):**
- 500 plans/month × 12 months = 6000 plans
- Avg 50K tokens/plan = 300M tokens
- Sonnet: 300M × $3/MTok input + 300M × $15/MTok output = $5.4M/year
- **With Haiku for 30%:** (210M Sonnet + 90M Haiku) = $3.6M/year

---

### For Production (Agentic Coding)

**If accuracy > cost:** Use Claude Opus 4.5 (80.9%)
**If cost > accuracy:** Use Claude Haiku 4.5 with retry logic (60.6%)
**If context > everything:** Use Gemini 3 Pro (1M tokens)

**Fallback strategy:**
- Try Sonnet 4.5 first (balanced)
- If failure, retry with Opus 4.5
- Track failure patterns for next iteration

---

## 12. Monitoring Recommendations

### Key Metrics to Track

```
Monthly:
├─ Cost per plan generated (target: $5-15)
├─ Plan generation latency (target: < 60s)
├─ Approval rate (target: > 90%)
└─ Human review rate (target: < 10%)

Quarterly:
├─ Cost efficiency vs benchmark (track vs SWE-bench)
├─ Context usage distribution (% of models at >150K tokens)
├─ Error rates by plan complexity
└─ Model performance drift
```

### Decision Points

- If **cost/plan > $20:** Shift to Haiku 4.5 where possible
- If **approval rate < 85%:** Increase Opus 4.5 usage for validation
- If **context > 150K tokens trending:** Prepare Gemini fallback
- If **latency > 60s:** Consider Haiku 4.5 for initial draft

---

**End of Analysis**

**Next Review:** Q2 2026 (GPT-5, Claude 4, new Gemini versions likely)

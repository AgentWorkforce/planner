# Hierarchical Agents & Context Optimization - Quick Reference

**For practitioners**: Key metrics, decision trees, and implementation checklists.

---

## Decision Trees

### "Should we cache this plan?"

```
Is it a common request pattern?
├─ YES → Extract template after approval
├─ NO → Skip caching overhead
└─ MAYBE → Monitor hit rate after 10 similar plans

Scope of plan?
├─ Single repo → Cache hit rate likely 60-70%
├─ Multi-repo → Cache hit rate likely 40-50%
└─ Novel/research → Cache hit rate <30%, consider skip
```

### "Which agent tier for this step?"

```
Does step have 4+ acceptance criteria?
├─ YES → Use Tier 3 (Expensive)
└─ NO → Continue...

Does step affect architecture?
├─ YES → Use Tier 3 (Expensive)
└─ NO → Continue...

Is this a classification/formatting task?
├─ YES → Use Tier 1 (Cheap), escalate if fails
└─ NO → Use Tier 2 (Medium)
```

### "How much context to keep?"

```
Is plan actively being edited?
├─ YES → Keep full context (all versions)
└─ NO → Archive to summaries

Plan version count?
├─ < 5 → Keep all full context (small)
├─ 5-15 → Keep recent 3 full, archive rest
└─ > 15 → Keep active + recent 3, heavily archive

Plan size (steps)?
├─ < 10 → No compression needed
├─ 10-30 → Progressive summarization
└─ > 30 → Aggressive summarization
```

---

## Metric Benchmarks

### What's "Good"?

| Metric | Excellent | Good | Acceptable |
|--------|-----------|------|------------|
| Cache hit rate | 70%+ | 60-70% | 40-60% |
| Plan approval rate | 95%+ | 85-95% | 75-85% |
| Cascade escalation rate | < 5% | 5-10% | 10-20% |
| Token savings (compressed) | 70-80% | 50-70% | 30-50% |
| Adapted plan quality (meet criteria) | 98%+ | 95-98% | 90-95% |

### Cost Targets

| Scenario | Baseline | Optimized | Savings |
|----------|----------|-----------|---------|
| Single plan (no caching) | $1.00 | $0.50 | 50% (reuse) |
| Large plan (hierarchical memory) | $1.00 | $0.30 | 70% (compression) |
| Step execution (cascade routing) | $1.00 | $0.15 | 85% (smart routing) |
| **All three combined** | $1.00 | $0.08 | **92%** |

---

## Implementation Checklist

### Phase 1: Aggregation Nodes (2-3 days)
- [ ] Add `type: 'aggregation'` to Step schema
- [ ] Add `input_step_ids: string[]` field
- [ ] Add `merge_strategy: 'union' | 'intersection' | 'synthesis'` field
- [ ] Update orchestrator to handle aggregation steps
- [ ] Test with sample plan containing aggregation
- [ ] Monitor: step type distribution, redundancy elimination

### Phase 2a: Plan Caching (3-5 days)
- [ ] Create PlanTemplate schema
- [ ] Implement `extractTemplate()` function
- [ ] Create template storage (database table or Redis)
- [ ] Implement `extractIntent()` (cheap model)
- [ ] Implement `extractScope()` (cheap model)
- [ ] Implement `adaptTemplate()` (cheap model)
- [ ] Add cache lookup to plan creation flow
- [ ] Test: hit/miss scenarios
- [ ] Monitor: hit rate, quality of adapted plans

### Phase 2b: Hierarchical Memory (2-3 days)
- [ ] Create SessionMemory schema (active/recent/archived)
- [ ] Implement memory manager with tier separation
- [ ] Add summarization for recent history
- [ ] Add high-level summaries for archived versions
- [ ] Integrate into PlannerLead context building
- [ ] Test: session size reduction over time
- [ ] Monitor: token usage per session, memory accuracy

### Phase 3a: Cascade Routing (4-5 days)
- [ ] Define complexity scoring for steps
- [ ] Create `routeStep()` function
- [ ] Implement tier classification (Tier 1/2/3)
- [ ] Add fallback mechanism (escalation)
- [ ] Update orchestrator to respect routing
- [ ] Test: routing accuracy, escalation handling
- [ ] Monitor: cost per step, escalation rate

### Phase 3b: Speculative Execution (5-7 days)
- [ ] Implement `propose_next()` (cheap agent)
- [ ] Implement `prepare_environment()` (async)
- [ ] Implement `validate()` (expensive agent)
- [ ] Add orchestrator loop for speculative flow
- [ ] Test: latency improvements, validation accuracy
- [ ] Monitor: speculation success rate, latency reduction

---

## Common Pitfalls & Fixes

| Pitfall | Symptom | Fix |
|---------|---------|-----|
| **Template too specific** | Cache hit rate < 30% | Use higher-level intent extraction |
| **Semantic caching (not keyword)** | False hit matches, adapted plan quality drops | Switch to exact keyword matching |
| **Memory not role-specific** | Confusion between planner/executor context | Separate session memory by agent role |
| **Aggressive compression** | Adapted plans missing key details | Keep tail summaries longer; compress older only |
| **Routing too conservative** | No cost savings achieved | Shift more steps to Tier 1; monitor escalation |
| **Routing too aggressive** | Escalation rate > 15%, defeating cost savings | Revert to Tier 2 for borderline steps |

---

## Data Structures Reference

### PlanTemplate
```typescript
{
  template_id: "uuid",
  intent: "Add feature" | "Fix bug" | "Refactor" | ...,
  scope: "backend" | "frontend" | "infrastructure" | ...,
  steps: [
    { title, description },
    ...
  ],
  dependencies_pattern: [
    { source: "title", target: "title" },
    ...
  ],
  created_from_plan_id: "uuid",
  usage_count: 42,
}
```

### SessionMemory
```typescript
{
  active_plan: PlanVersion,  // Full context
  recent_history: [
    { version, timestamp, changes_summary, tokens_used },
    ...
  ],
  archived_summaries: [
    { version_range: "1-5", timeline_summary, tokens_used },
    ...
  ],
}
```

### StepExecution (Cascade Routing)
```typescript
{
  step_id: "uuid",
  assigned_tier: "tier1" | "tier2" | "tier3",
  fallback_tiers: ["tier2", "tier3"],
  attempts: [
    { tier, result: "success" | "escalate" | "fail" },
    ...
  ],
  final_result: "...",
  total_cost: 0.15,  // dollars
}
```

---

## Measurements & Dashboards

### Weekly Tracking
```
Cost Metrics:
- Total tokens used this week
- Average tokens per plan
- Cache hit rate (%)
- Average cost per step

Quality Metrics:
- Plans approved on first submission (%)
- Acceptance criteria met rate (%)
- User satisfaction (if tracked)

Performance:
- Average planning time (minutes)
- Average orchestration time per step
- P95 latency (wall clock)
```

### Monthly Review
```
- Cost trend ($ per plan, $ per step)
- Template inventory (count, hit rate)
- Routing distribution (% Tier 1/2/3)
- Escalation rate (% tier-up events)
- Quality stability (approval rate variance)
```

---

## Research Papers - Quick Lookup

| Topic | Key Paper | Key Metric | Implementation |
|-------|-----------|-----------|----------------|
| **Graph of Thoughts** | Besta et al. (2024) | 31% cost reduction vs. ToT | Aggregation nodes |
| **Plan Caching** | Shi et al. (2025) | 46-50% cost savings | Template extraction + matching |
| **Hierarchical Memory** | H-MEM (2025) | 5x retrieval speed | Multi-layer storage |
| **Cascade Routing** | DeKoninck et al. (2024) | 85% cost reduction | Tier classification + fallback |
| **Context Compression** | 2025 Survey | 70-94% token savings | Selective + summarization |
| **Speculative Execution** | Ye et al. (2025) | 20-40% latency reduction | Async propose/validate |
| **Agentic Memory** | AgeMem (2026) | 23% accuracy improvement | Unified memory interface |

---

## ROI Calculation (Example)

### Current State
- 100 planning tasks/month
- $15/task (expensive model, full context)
- **Total cost: $1,500/month**

### After Phase 2a (Plan Caching)
- Cache hit rate: 60%
- Cost per hit: $0.50 (cheap model)
- Cost per miss: $15 (expensive)
- **New cost**: (60 × $0.50) + (40 × $15) = $630/month
- **Savings**: $870/month (58%)

### After Phase 2b (Hierarchical Memory)
- Reduce context per planning task by 70%
- Cost per hit: $0.35 (70% reduction from $0.50)
- Cost per miss: $4.50 (70% reduction from $15)
- **New cost**: (60 × $0.35) + (40 × $4.50) = $201/month
- **Savings**: $1,299/month (87%)

### After Phase 3a (Cascade Routing)
- 50% Tier 1 ($0.15/task)
- 40% Tier 2 ($3/task)
- 10% Tier 3 ($15/task)
- **New cost**: (50 × $0.15) + (40 × $3) + (10 × $15) = $165/month
- **Savings**: $1,335/month (89%)

**Total ROI**: 89% cost reduction + quality maintained + latency improved.

---

## Next Steps

1. **Pick one phase** to implement first (recommend: Phase 2a - caching)
2. **Set up metrics dashboard** for your chosen phase
3. **Implement & measure** for 1-2 weeks
4. **Review results** against benchmarks above
5. **Proceed to next phase** or iterate on current

Good luck! 🚀


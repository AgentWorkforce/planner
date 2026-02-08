# DOT Framework Optimization Roadmap

**Aligns with**: Research findings from hierarchical agents (2024-2026) and context optimization patterns

---

## Three-Phase Implementation Strategy

All three phases can be pursued in parallel; each delivers independent value.

---

## Phase 1: Decomposition - Graph of Thoughts Implementation

**Timeline**: MVP (implement now if structure already exists)
**Cost Savings**: 15-31% per plan + quality improvement

### 1.1 Add Aggregation Step Type

**Current state**: Steps are atomic (one worker, one output).

**Change**: Support aggregation nodes that merge multiple inputs.

```typescript
interface PlanStep {
  step_id: string;
  type: 'atomic' | 'aggregation';
  title: string;
  description?: string;

  // Common fields
  dependencies: string[];
  owner_role?: string;
  acceptance_criteria?: AcceptanceCriterion[];

  // Aggregation-specific
  input_step_ids?: string[];  // which steps to merge
  merge_strategy?: 'union' | 'intersection' | 'synthesis';
}
```

### 1.2 Examples

**Pattern: Design review phase**
```
├─ Step 1 (atomic): "Backend API design" → output: design_doc_backend
├─ Step 2 (atomic): "Frontend architecture" → output: design_doc_frontend
│
└─ Step 3 (aggregation): "Consolidate design"
   ├─ inputs: [design_doc_backend, design_doc_frontend]
   ├─ merge_strategy: "synthesis"
   └─ output: unified_design_doc
```

**Cost benefit**: Instead of separate review for backend + frontend, one "consolidate design" step synthesizes both. Single review pass vs. two.

### 1.3 Orchestrator Changes

When executing aggregation step:
1. Wait for all input steps to complete
2. Pass all outputs to aggregation handler
3. Merge according to strategy
4. Proceed to dependents

### 1.4 Tracking & Metrics

- Track step type distribution (% aggregation vs. atomic)
- Measure reduction in total step count (redundancy elimination)
- Compare plan size before/after aggregation introduction

---

## Phase 2: Context Optimization - Hierarchical Memory + Plan Caching

**Timeline**: Next iteration (high ROI, moderate implementation)
**Cost Savings**: 46-50% (caching) + 50-70% (context on large plans)

### 2.1 Implement Plan Template Extraction

**Goal**: Reuse plans across similar requests.

**Pipeline**:

```
1. After Plan Approved:
   ├─ Extract high-level intent (e.g., "Add authentication")
   ├─ Identify scope context (e.g., "backend service")
   ├─ Store template (goals, generic steps, dependencies)
   └─ Remove instance-specific context

2. On New Request:
   ├─ Extract intent + scope
   ├─ Lookup template (exact match on intent+scope)
   ├─ Adapt template to new context (cheap model)
   └─ Return adapted plan

3. On Cache Miss:
   └─ Generate plan from scratch (expensive model)
   └─ Extract template for future use
```

**Implementation**:

```typescript
interface PlanTemplate {
  template_id: string;
  intent: string;  // "Add feature", "Fix bug", "Refactor"
  scope: string;   // "backend", "frontend", "infrastructure"

  // Generic step structure
  steps: Array<{
    title: string;
    description: string;
    // No instance-specific context
  }>;

  dependencies_pattern: Array<{
    source: string;  // title, not ID
    target: string;
  }>;

  created_from_plan_id: string;
  usage_count: number;
}

interface CacheStats {
  total_cache_hits: number;
  total_cache_misses: number;
  hit_rate: number;  // should trend to 60-70% over time
  avg_cost_saved_per_hit: number;
}
```

**Metrics to track**:
- Template creation rate (1 new template per X plans)
- Cache hit rate (target: 60-70% on mature codebase)
- Cost per cached plan vs. fresh plan (target: 50% savings)

### 2.2 Hierarchical Memory for PlannerLead

**Goal**: Reduce token consumption as session grows.

**Structure**:

```
Session Memory (current session)
├─ Active: Full PlanVersion, all step details (current edit)
├─ Recent: Full diffs (last 3 versions)
└─ Archive: High-level summaries (older versions)
```

**Implementation**:

```typescript
interface SessionMemory {
  // Current working plan (full detail)
  active_plan: PlanVersion;

  // Recent edits (compressed)
  recent_history: Array<{
    version: number;
    timestamp: string;
    changes_summary: string;  // "Added 3 steps, removed 1"
    tokens_used: number;
  }>;

  // Old versions (high-level only)
  archived_summaries: Array<{
    version_range: "1-5" | "6-10" | ...;
    timeline_summary: string;  // Key decisions over range
    tokens_used: number;
  }>;
}
```

**Cost model**:
- Active plan: Full context (~2000 tokens for medium plan)
- Recent 3 versions: ~500 tokens each = 1500 total
- Archived 7 version groups: ~100 tokens each = 700 total
- **Total**: ~4700 tokens vs. 2000 tokens × 10 versions = 20000 (76% savings)

### 2.3 Metrics & Tracking

- Token usage per edit session (should decrease as session grows)
- Template cache hit rate (target: 60%+)
- Quality of adapted plans (acceptance criteria met rate)

---

## Phase 3: Orchestration - Cascade Routing + Speculative Execution

**Timeline**: Polish (moderate complexity, handles edge cases)
**Cost Savings**: 35-85% (routing) + latency -20-40% (speculative)

### 3.1 Cascade Model for Step Execution

**Goal**: Route steps to appropriate agent tier; escalate on failure.

**Three-tier model**:

```
Tier 1 (Cheap): GPT-4o-mini (~$0.15 per 1M tokens)
├─ Classification tasks ("Is this a bug or feature request?")
├─ Formatting ("Convert to markdown")
└─ Simple routing ("Which scope?")

Tier 2 (Medium): Claude 3.5 Sonnet (~$3 per 1M tokens)
├─ Code generation
├─ Design decisions
├─ Step decomposition

Tier 3 (Expensive): Claude Opus (~$15 per 1M tokens)
├─ Architecture decisions
├─ Approval validation
├─ Complex synthesis
```

**Routing logic**:

```typescript
function routeStep(step: PlanStep): AgentTier {
  // Complexity signals
  const signals = {
    has_custom_criteria: step.acceptance_criteria?.length > 3,
    involves_architecture: step.title.includes('architecture') ||
                          step.title.includes('design'),
    requires_approval: step.gate?.type === 'human_approval',
    multi_scope: step.scope?.split(',').length > 1,
  };

  const score = Object.values(signals).filter(Boolean).length;

  if (score >= 3) return 'tier3-expensive';
  if (score >= 1) return 'tier2-medium';
  return 'tier1-cheap';
}
```

**Fallback on failure**:
- Tier 1 result unsatisfactory? → Escalate to Tier 2
- Tier 2 result unsatisfactory? → Escalate to Tier 3
- Tier 3 handles edge cases, not retry loop

**Cost model**:
- 70% of steps routed to Tier 1 (cost: $0.15 / 1M)
- 25% to Tier 2 (cost: $3 / 1M)
- 5% to Tier 3 (cost: $15 / 1M)
- **Effective cost**: (0.7 × 0.15) + (0.25 × 3) + (0.05 × 15) = 1.23 / 1M
- **Baseline (all Tier 3)**: $15 / 1M
- **Savings**: 92% 🎯

### 3.2 Speculative Execution for Orchestrator

**Goal**: Reduce orchestrator latency during step execution.

**Pattern**:

```
while (true) {
  // Execute current step
  current_result = execute(current_step, expensive_agent);

  // Speculatively propose next steps
  next_candidates = propose_next(current_step, cheap_agent);

  // While expensive agent validates result...
  prepare_environment(next_candidates);  // async

  // When ready, validate proposals
  for each next in next_candidates:
    if (validate(next, expensive_agent)):
      return next;

  // Fallback
  current_step = select_fallback(next_candidates);
}
```

**Latency improvement**: Reduces wall-clock time by overlapping propose + validate phases.

**Cost**: Neutral (extra cheap calls offset by avoiding redundant expensive calls).

### 3.3 Metrics & Tracking

- Route distribution (% per tier)
- Escalation rate (tier 1 → 2, tier 2 → 3)
- Effective cost per step
- Latency reduction from speculation

---

## Phase 4 (Future): Hybrid Everything

**Estimated**: 6+ months out
**Potential savings**: 88-97% total

Combine all three phases:
1. DAG with aggregation (GoT)
2. Template caching + hierarchical memory (Context)
3. Cascade routing + speculation (Orchestration)

---

## Implementation Priority Matrix

| Phase | Effort | ROI | Implementation |
|-------|--------|-----|----------------|
| 1. Aggregation nodes | Low | Medium (15-31%) | Add step type, orchestrator handler |
| 2a. Plan caching | Medium | High (46-50%) | Extract templates, cache lookup |
| 2b. Hierarchical memory | Low | High (50-70% on large plans) | Session memory manager |
| 3a. Cascade routing | Medium | High (35-85%) | Router + tier classification |
| 3b. Speculative exec | High | Medium (latency only) | Async proposal system |

**Recommended sequence**:
1. Start: Plan caching (high ROI, moderate work)
2. Parallel: Aggregation nodes (low work)
3. Then: Hierarchical memory (low work, synergizes with caching)
4. Finally: Cascade routing (requires mature data on step complexity)

---

## Success Metrics (Tracking Dashboard)

### Cost Metrics
- Token usage per plan (trend down)
- Cost per step execution (trend down)
- Cost per completed plan (trend down)
- Cache hit rate (trend to 60%+)

### Quality Metrics
- Acceptance criteria met rate (maintain >95%)
- Plan approval rate (maintain >90%)
- Rework/version rate (monitor for change)

### Performance Metrics
- Planning latency (wall-clock time)
- Orchestration latency (step execution time)
- Memory usage (session size in tokens)

### Adoption Metrics
- Template reuse rate (% of new plans from cache)
- Aggregation node adoption (% of plans using)
- Cascade routing escalation rate (% reaching tier 2/3)

---

## Risk Mitigation

### Risk 1: Quality Degradation from Cheap Models
**Mitigation**:
- Start cascade routing with conservative routing (use tier 2 for more steps initially)
- Monitor acceptance criteria met rate closely
- Escalation fallback (tier 1 fail → tier 2)

### Risk 2: Template Cache Misses (False Positives)
**Mitigation**:
- Use exact keyword matching (not semantic similarity)
- Manual template curation initially
- Deprecate low-hit-rate templates

### Risk 3: Memory Corruption from Hierarchical Compression
**Mitigation**:
- Preserve full history in cold storage
- Periodic validation of compressed summaries
- Audit trail of compression decisions

---

## Integration with Existing Architecture

### Decomposition + PlanVersion
PlanVersion.steps already supports dependencies. Adding aggregation is additive:
```typescript
step.type?: 'atomic' | 'aggregation'  // backward compatible
step.input_step_ids?: string[]  // only for aggregation
```

### Orchestration + Run/Task Model
Run model maps steps → agents. Cascade routing adds:
```typescript
interface StepExecution {
  step_id: string;
  assigned_tier: 'tier1' | 'tier2' | 'tier3';
  fallback_tiers: Tier[];  // escalation path
}
```

### Trajectories + Session Memory
Session memory becomes observable event stream:
```typescript
event: 'memory.compressed' | 'memory.archived' | 'cache.hit' | 'cache.miss'
```

---

## Concrete First Implementation: Plan Caching

**Start here** (high ROI, minimal risk).

### Week 1-2: Template Extraction
```typescript
function extractTemplate(plan: PlanVersion): PlanTemplate {
  return {
    template_id: uuid(),
    intent: extractIntent(plan.summary.goal),
    scope: determinePrimaryScope(plan.steps),
    steps: plan.steps.map(s => ({
      title: s.title,
      description: s.description,
      // no ID, no instance-specific data
    })),
    dependencies_pattern: plan.steps.map(s => ({
      source: s.title,
      target: dep.title for dep in s.dependencies
    })),
    created_from_plan_id: plan.plan_id,
    usage_count: 0,
  };
}
```

### Week 2-3: Cache & Lookup
```typescript
async function planForRequest(request: string): Promise<PlanVersion> {
  const intent = await extractIntent(request, cheap_model);
  const scope = await extractScope(request, cheap_model);

  const template = cache.lookup(intent, scope);

  if (template) {
    // Cache hit
    return await adaptTemplate(template, request, cheap_model);
  }

  // Cache miss
  return await createPlanFromScratch(request, expensive_model);
}
```

### Week 3-4: Metrics & Tuning
- Track hit rate
- Monitor adapted plan quality
- Adjust template retention policy

**Expected outcome**: 30-40% cost reduction within a month on similar requests.


# Decomposition: The Planner's Role

> How plans break work into steps that reduce variance and enable verification.

---

## Why Decomposition Matters

Long-running agent tasks suffer from compounding variance. Research quantifies this precisely:

```
P(success) ≈ (0.5)^(T/50min)
```

**Frontier agents succeed 50% of the time on 50-minute tasks, 25% on 100-minute tasks.** (METR 2025)

Decomposition is the antidote:

- **Smaller steps = lower variance per step** — Atomic tasks enable voting (43x reliability with 5 agents)
- **Explicit contracts = clearer success criteria** — Reduces ambiguity errors
- **Verification points = catch errors early** — 36% of failures are silent without validation
- **Hierarchical structure = manage complexity at scale** — Million-step tasks solved with zero errors

### Research Foundation

| Finding | Value | Source |
|---------|-------|--------|
| Error formula | P(success) ≈ (0.5)^(T/50min) | METR 2025 |
| 5-agent voting improvement | 43x reliability | Six Sigma Agent 2026 |
| Million-step completion | Zero errors | Solving Million-Step LLM 2025 |
| Incoherence on hard tasks | Scale makes it worse | Hot Mess of AI 2026 |

---

## Current State

Today's implementation:

- **Plans are flat**: `ForgeStep[]` arrays with no nesting
- **`sub_plan_id` exists but is unused**: The field is in Planner types but Forge doesn't execute sub-plans
- **No complexity estimation**: All steps treated equally
- **Acceptance criteria are free-form text**: No structured input/output contracts

This works for simple plans but doesn't scale to complex, multi-scope work.

---

## When to Decompose

Not all steps need decomposition. The Planner should assess three factors:

### 1. Novelty

| Signal | Decomposition Need |
|--------|-------------------|
| Team has done this exact pattern before | Low — use proven approach |
| Similar patterns exist | Medium — verify transferability |
| Completely new domain/technology | High — break into learning steps |

**Example**: "Add OAuth endpoint" in a codebase that already has OAuth → Low decomposition. "Add OAuth endpoint" in a greenfield project → High decomposition (research, design, implement, test).

### 2. Complexity

| Signal | Decomposition Need |
|--------|-------------------|
| Single clear action | Low — atomic step |
| Multiple coordinated changes | Medium — explicit substeps |
| Architectural impact, many unknowns | High — hierarchical sub-plan |

**Complexity Estimation Heuristics**:
- Token estimate > 50K likely output → Consider decomposition
- Dependencies on 3+ other steps → Consider sequencing substeps
- Touches 3+ repos/scopes → Likely needs sub-plan per scope

### 3. Verification Cost

| Signal | Decomposition Need |
|--------|-------------------|
| Easy to verify (tests exist, quick check) | Low — verify at end |
| Expensive verification (manual QA, integration tests) | Medium — checkpoint substeps |
| Critical/irreversible (production deploy, data migration) | High — gate every substep |

### 4. Language & Domain Familiarity (NEW)

**Research finding**: LLM performance varies dramatically by programming language due to training data distribution. Python has 100+ GB in The Stack v2; COBOL has <1 GB. This creates a **68-point accuracy gap** (80% vs 12%).

| Language Tier | Languages | HumanEval | Decomposition Impact |
|---------------|-----------|-----------|---------------------|
| **Tier S** | Python, TypeScript, JavaScript, Java, C++ | 70-85% | Standard decomposition |
| **Tier A** | Go, Rust, C#, PHP, Ruby | 55-70% | +40% more granular |
| **Tier B** | Swift, Kotlin, R, Lua, Haskell | 35-55% | +100% more granular |
| **Tier C** | OCaml, Ada, Clojure | 18-35% | Mandatory sub-plans |
| **Tier D** | COBOL, Fortran, VHDL | 5-15% | Mandatory sub-plans + human gates |

**Domain familiarity also matters:**

| Domain | LLM Familiarity | Decomposition Adjustment |
|--------|-----------------|-------------------------|
| Web development (React, Django) | High | Standard |
| Mobile (iOS, Android) | Medium-High | +25% more granular |
| Backend services | High | Standard |
| Embedded systems | Low | +100% more granular |
| Legacy mainframe | Very Low | Mandatory human oversight |
| Industrial control | Very Low | Mandatory human oversight |

*Source: [The Stack v2](https://huggingface.co/datasets/bigcode/the-stack-v2), [MultiPL-E](https://github.com/nuprl/MultiPL-E)*

---

## Decomposition Depth Control

### Proposed Schema

```typescript
interface DecompositionConfig {
  // Maximum step complexity before auto-decomposition
  max_step_complexity: 'atomic' | 'simple' | 'compound';

  // Token estimate threshold that triggers decomposition
  auto_decompose_threshold: number;

  // Whether sub-plans are allowed
  allow_sub_plans: boolean;

  // Maximum nesting depth (prevent infinite recursion)
  max_depth: number;
}
```

### Step Complexity Levels

| Level | Description | Token Estimate | Typical Decomposition |
|-------|-------------|----------------|----------------------|
| **atomic** | Single, verifiable action | < 10K | None — enables voting |
| **simple** | Small sequence, clear outcome | 10-50K | Optional substeps |
| **compound** | Multi-part, requires coordination | > 50K | Sub-plan required |

**Research note**: Atomic steps are critical for reliability. With 5-agent voting on atomic steps, error rates drop from 5% to 0.116% (43x improvement). Compound steps cannot be voted on effectively.

### Recommended Defaults (Research-Backed)

```yaml
decomposition_config:
  max_step_complexity: simple
  auto_decompose_threshold: 50000  # tokens

  # From METR: P(success) = 0.5 at 50min
  # 15 atomic steps ≈ 50min, so decompose above this
  max_steps_before_decomposition: 15

  allow_sub_plans: true
  max_depth: 3  # Prevent deep nesting

  # Language tier multipliers (from MultiPL-E research)
  language_complexity_multipliers:
    tier_s: 1.0   # Python, TS, JS, Java, C++
    tier_a: 1.4   # Go, Rust, C#
    tier_b: 2.0   # Swift, Kotlin, R
    tier_c: 3.2   # OCaml, Ada
    tier_d: 5.0   # COBOL, Fortran
```

---

## Sub-Plans: Hierarchical Execution

When a step is too complex for a single agent pass, it becomes a sub-plan.

### Structure

```typescript
interface ForgeStep {
  step_id: string;
  title: string;
  description?: string;
  owner_role?: string;
  dependencies: string[];
  acceptance_criteria?: AcceptanceCriterion[];
  gate?: Gate;

  // NEW: Sub-plan reference
  sub_plan_id?: string;  // If present, this step expands to another plan
  decomposition_trigger?: 'complexity' | 'novelty' | 'verification' | 'manual';
}

// When executed, Forge:
// 1. Detects sub_plan_id is present
// 2. Fetches the sub-plan
// 3. Creates a nested Run for the sub-plan
// 4. Parent step completes when sub-plan completes
```

### Visualization

```
Plan: "Build User Authentication"
├── Step 1: Design auth architecture (atomic)
├── Step 2: Implement backend ──► Sub-Plan: "Backend Auth"
│   ├── 2.1: Add user model
│   ├── 2.2: Add OAuth endpoints
│   ├── 2.3: Add session middleware
│   └── 2.4: Add tests
├── Step 3: Implement frontend ──► Sub-Plan: "Frontend Auth"
│   ├── 3.1: Add login page
│   ├── 3.2: Add protected routes
│   └── 3.3: Add state management
└── Step 4: Integration testing (atomic)
```

### Progress Rollup

Parent plan sees aggregate status:

```typescript
interface StepStatus {
  step_id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';

  // For sub-plan steps
  sub_run_id?: string;
  sub_run_progress?: {
    total_tasks: number;
    completed_tasks: number;
    failed_tasks: number;
    percent_complete: number;
  };
}
```

---

## Task Contracts

Clear input/output contracts reduce ambiguity and enable verification.

### Current Problem

```typescript
// Today: Free-form text, no structure
acceptance_criteria: [
  { id: "ac1", description: "Tests pass", type: "test" }
]
// Agent must guess: What tests? Where? What counts as "pass"?
```

### Proposed Schema

```typescript
interface TaskContract {
  // What this step needs to execute
  inputs: ContractInput[];

  // What this step must produce
  outputs: ContractOutput[];

  // When this step is "done"
  done_definition: DoneDefinition;
}

interface ContractInput {
  name: string;
  type: 'artifact' | 'context' | 'parameter';
  source: string;  // Step ID that produces this, or "plan" for plan-level
  required: boolean;
  description?: string;
}

interface ContractOutput {
  name: string;
  type: ArtifactType;  // 'file', 'directory', 'schema', 'config', etc.
  path?: string;  // Expected location
  validation: 'exists' | 'schema' | 'test' | 'human';
  schema_ref?: string;  // For schema validation
}

interface DoneDefinition {
  all_outputs_present: boolean;
  acceptance_criteria_pass: boolean;
  custom_check?: string;  // Script/command to run
}
```

### Example

```typescript
const step = {
  step_id: "implement-user-model",
  title: "Implement User data model",
  contract: {
    inputs: [
      {
        name: "schema_design",
        type: "artifact",
        source: "design-auth-architecture",
        required: true,
        description: "ERD or schema description from design step"
      }
    ],
    outputs: [
      {
        name: "user_model",
        type: "file",
        path: "src/models/user.ts",
        validation: "exists"
      },
      {
        name: "user_migration",
        type: "file",
        path: "migrations/*_create_users.sql",
        validation: "exists"
      },
      {
        name: "model_tests",
        type: "file",
        path: "src/models/__tests__/user.test.ts",
        validation: "test"
      }
    ],
    done_definition: {
      all_outputs_present: true,
      acceptance_criteria_pass: true,
      custom_check: "npm run test -- --grep 'User model'"
    }
  }
};
```

### Benefits

1. **Agents get context**: Clear inputs mean agents don't guess what they need
2. **Verification is automatic**: Outputs can be checked programmatically
3. **Dependencies are explicit**: Source references create implicit dependency graph
4. **Debugging is easier**: When something fails, contracts show exactly what was missing

---

## Complexity Estimation

To decide when to decompose, we need to estimate step complexity before execution. **Language and domain are critical factors** — a "simple" task in COBOL is 5x harder than the same task in Python.

### Estimation Signals

| Signal | How to Estimate | Complexity Contribution |
|--------|-----------------|------------------------|
| **Description length** | Token count | Linear |
| **Scope count** | Repos/domains mentioned | Multiplicative |
| **Dependency count** | Dependencies array length | Additive |
| **Acceptance criteria count** | AC array length | Additive |
| **Keywords** | "integrate", "migrate", "refactor" | Weight boost |
| **Historical** | Similar step patterns | From execution baselines |
| **Language tier** | Detect from repo/step | **Multiplicative (1.0-5.0x)** |
| **Domain familiarity** | Web/mobile/embedded/legacy | **Additive (0-30 points)** |

### Proposed Estimator

```typescript
interface ComplexityEstimate {
  level: 'trivial' | 'simple' | 'moderate' | 'complex' | 'very_complex';
  score: number;  // 0-100
  confidence: number;  // 0-1
  signals: {
    description_tokens: number;
    scope_count: number;
    dependency_count: number;
    ac_count: number;
    keyword_boost: number;
    historical_avg?: number;
  };
  recommendation: 'proceed' | 'consider_decomposition' | 'require_decomposition';
}

function estimateComplexity(step: ForgeStep, history?: ExecutionBaseline[]): ComplexityEstimate {
  const descTokens = estimateTokens(step.description || '');
  const scopeCount = extractScopes(step).length || 1;
  const depCount = step.dependencies?.length || 0;
  const acCount = step.acceptance_criteria?.length || 0;

  // Keyword analysis
  const complexKeywords = ['integrate', 'migrate', 'refactor', 'redesign', 'overhaul'];
  const keywordBoost = complexKeywords.some(k =>
    step.title.toLowerCase().includes(k) ||
    step.description?.toLowerCase().includes(k)
  ) ? 20 : 0;

  // Historical lookup (if available)
  const pattern = normalizeStepPattern(step.title);
  const historical = history?.find(h => h.step_pattern === pattern);
  const historicalAvg = historical?.avg_complexity_score;

  // Calculate score
  let score = 0;
  score += Math.min(descTokens / 500, 30);  // Max 30 from description
  score += scopeCount * 10;  // 10 per scope
  score += depCount * 5;  // 5 per dependency
  score += acCount * 3;  // 3 per AC
  score += keywordBoost;

  if (historicalAvg !== undefined) {
    score = (score + historicalAvg) / 2;  // Blend with history
  }

  // Map to level
  const level =
    score < 15 ? 'trivial' :
    score < 30 ? 'simple' :
    score < 50 ? 'moderate' :
    score < 75 ? 'complex' : 'very_complex';

  // Recommendation
  const recommendation =
    score < 30 ? 'proceed' :
    score < 60 ? 'consider_decomposition' : 'require_decomposition';

  return {
    level,
    score,
    confidence: historical ? 0.8 : 0.5,
    signals: {
      description_tokens: descTokens,
      scope_count: scopeCount,
      dependency_count: depCount,
      ac_count: acCount,
      keyword_boost: keywordBoost,
      historical_avg: historicalAvg,
    },
    recommendation,
  };
}
```

---

## Planner Workflow Integration

### Plan Creation Flow

```
1. Human/AI provides intent
              │
              ▼
2. Generate initial steps
              │
              ▼
3. For each step:
   ├── Estimate complexity
   ├── If > threshold:
   │   ├── Generate sub-plan
   │   └── Link via sub_plan_id
   └── Generate task contract
              │
              ▼
4. Validate dependency graph
              │
              ▼
5. Human review + approval
              │
              ▼
6. Publish to Forge
```

### Planner → Forge Contract Extension

```typescript
// Extended ForgePlan
interface ForgePlan {
  plan_id: string;
  version: number;
  goal: string;
  steps: ForgeStep[];

  // NEW: Decomposition metadata
  decomposition_config?: DecompositionConfig;

  // NEW: Execution hints
  execution_policy?: ExecutionPolicy;  // See Orchestration doc
}

// Extended ForgeStep
interface ForgeStep {
  // ... existing fields ...

  // NEW: Decomposition
  sub_plan_id?: string;
  complexity_estimate?: ComplexityEstimate;

  // NEW: Contract
  contract?: TaskContract;

  // NEW: Execution hints
  execution_hints?: ExecutionHints;
}

interface ExecutionHints {
  // Agent fit hints
  complexity_estimate?: 'trivial' | 'simple' | 'moderate' | 'complex' | 'very_complex';
  skill_requirements?: string[];

  // Time hints
  max_duration_minutes?: number;

  // Decomposition hints (if Forge should auto-decompose)
  decomposable?: boolean;
  suggested_substeps?: { name: string; description: string; }[];
}
```

---

## Recommended Limits

Based on cognitive load and practical execution:

| Limit | Value | Rationale |
|-------|-------|-----------|
| **Steps per plan** | 15-20 max | Human reviewability |
| **Steps per scope** | 10-15 max | Scope coherence |
| **Nesting depth** | 3 levels max | Navigation sanity |
| **Dependencies per step** | 5 max | Avoids bottlenecks |
| **ACs per step** | 5 max | Focus on essentials |

If a plan exceeds these, it's a signal to decompose differently (more sub-plans, larger atomic units, etc.).

---

## Planning-Time Guardrails

**Guardrails catch missing requirements and risky decisions BEFORE execution.** This is Planner's responsibility, not Tuner's.

### Why Guardrails Belong in Planner

Tuner observes execution outcomes (tests pass/fail, duration, cost). But some problems can't be detected through execution:

- **Missing security** — A task can "succeed" while producing insecure code
- **Incomplete scope** — An API endpoint works, but we forgot error handling
- **Architectural mistakes** — Code compiles, but violates team patterns

These require **judgment at planning time**, not measurement after the fact.

### Proposed Guardrail Categories

| Category | Example Checks | User Prompt |
|----------|---------------|-------------|
| **Security** | API with no auth, DB with no encryption, secrets in code | "This API has no authentication specified - intentional?" |
| **Testing** | No test steps for critical path, no integration tests | "No tests specified for user auth - add them?" |
| **Scope** | Touches 5+ repos, affects production data, external API changes | "This plan touches 5 repos - confirm scope?" |
| **Compliance** | PII handling, audit logging, data retention | "This handles user data but has no GDPR considerations - review?" |
| **Dependencies** | Major version upgrades, deprecated APIs, breaking changes | "This upgrades React 17→19 - confirm breaking change handling?" |

### Guardrail Implementation (Future)

```typescript
interface PlanGuardrail {
  id: string;
  category: 'security' | 'testing' | 'scope' | 'compliance' | 'dependencies';
  severity: 'warning' | 'blocking';

  // Condition to check (returns true if guardrail triggered)
  check: (plan: ForgePlan) => boolean;

  // Human-readable prompt
  prompt: string;

  // Suggested remediation
  suggestion?: string;
}

interface GuardrailResult {
  triggered: PlanGuardrail[];
  blocking: boolean;  // Any blocking guardrails?
  requiresHumanReview: boolean;
}
```

### Guardrail vs Tuner: The Boundary

```
BEFORE EXECUTION (Planner Guardrails)
├── "You're building an API without auth - confirm?"
├── "No test coverage for payment flow - add it?"
└── "This affects production database - gate approval?"

AFTER EXECUTION (Tuner Metrics)
├── "Tests passed/failed"
├── "Build succeeded/failed"
├── "Duration was 2x expected"
└── "Model X failed 40% on this task type"
```

**Key insight**: Guardrails ask "should we do this?" Tuner asks "how well did we do it?"

### Implementation Status

- [ ] Define guardrail schema
- [ ] Implement security guardrails (no auth, secrets detection)
- [ ] Implement testing guardrails (coverage requirements)
- [ ] Implement scope guardrails (repo count, blast radius)
- [ ] Wire into plan approval workflow
- [ ] CLI for listing/configuring guardrails

*This is a separate epic from Tuner. Guardrails will be tracked in a future feature file.*

---

## Open Questions

1. **Who triggers decomposition?**
   - Planner (during plan creation)?
   - Forge (at execution time if complexity discovered)?
   - Both (Planner suggests, Forge can override)?

2. **How do we handle decomposition failures?**
   - Sub-plan creation fails → Fallback to single complex step?
   - Sub-plan execution fails → Retry whole sub-plan or individual steps?

3. **Contract enforcement strictness?**
   - Soft (warn on missing outputs)?
   - Hard (fail task if contract violated)?
   - Configurable per step?

4. **Learning from decomposition outcomes?**
   - Track: "This step pattern succeeded as atomic" vs "needed decomposition"
   - Feed back to complexity estimator

---

## Implementation Phases

### Phase 1: Contracts (Foundation)
- Add TaskContract schema
- Validate contracts at plan creation
- Surface missing inputs at task start
- Check output existence at task completion

### Phase 2: Complexity Estimation
- Build complexity estimator
- Add estimation to plan creation workflow
- Surface recommendations in Planner UI

### Phase 3: Sub-Plans
- Implement sub_plan_id execution in Forge
- Build nested Run management
- Add progress rollup for parent steps

### Phase 4: Learning
- Collect execution outcomes per complexity level
- Build baseline library
- Auto-tune decomposition thresholds

---

*Document generated: 2026-02-04*

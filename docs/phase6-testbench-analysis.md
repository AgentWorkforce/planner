# Phase 6 Analysis: Testbench Hardening

Date: 2026-02-05
Status: ANALYSIS COMPLETE

## Overview

The testbench package (`packages/testbench/`) provides an end-to-end testing framework for the Planner, Forge, and Tuner subsystems. This analysis covers four hardening areas for Phase 6.

---

## 6.1: Type Imports from Planner Package

### Current State

**Testbench defines local type duplicates:**

1. `/packages/testbench/src/clients/planner.ts` (lines 1-31):
   - `CreatePlanResult`
   - `PlanVersionResult` (with nested Step types)
   - `PlanStep`
   - All manually typed, matching planner domain shape

2. `/packages/testbench/src/runner/types.ts` (lines 17-29):
   - `IdeationMetricsSchema` with `ideation_mode: z.enum(['synthetic', 'ai'])`
   - `RunResultSchema` with flat metrics

**Planner exports available:**

`/packages/planner/src/domain/index.ts` exports (lines 32-36):
```typescript
export { StepSchema, createStep, validateStepDag } from './step.js';
export type { Step, CreateStepOptions } from './step.js';

export { PlanSchema, PlanVersionSchema, createPlan, createPlanVersion } from './plan.js';
export type { Plan, PlanVersion } from './plan.js';
```

**Issue:** Testbench has no dependency on planner in `package.json` (line 17-20). Types must be synced manually, creating type drift risk.

### Type Mapping Analysis

| Testbench Type | Planner Equivalent | Status |
|---|---|---|
| `PlanStep` | `Step` | Match (can import from planner) |
| `PlanVersionResult` | `PlanVersion` | Similar (planner has `Plan` and `PlanVersion`) |
| `CreatePlanResult` | No direct match | Need custom type (plan_id + version) |
| `IdeationMetrics.ideation_mode` | Not in planner | Testbench-specific (stays local) |

**Key Finding:** Testbench clients define step/plan shapes to match planner API responses. These should import `Step` type from planner domain, but `PlanVersionResult` is client-specific (API response wrapper).

### What Needs to Change

1. **Add `@plannr/planner` as dependency in testbench `package.json`**
   - Line 19: Add `"@plannr/planner": "workspace:*"`
   - Enables imports from planner domain

2. **Import `Step` type in `clients/planner.ts`**
   - Replace local `PlanStep` interface with imported `Step`
   - Update references in `runner/runner.ts` where `PlanStep` is used
   - Simplify: `type PlanStep = Step` or use `Step` directly

3. **Keep `PlanVersionResult` local** (in `clients/planner.ts`)
   - This is a response wrapper, not a domain type
   - Maps between API response shape and what runner expects
   - Future: If orchestrator standardizes response format, could move to planner

4. **Accept that `IdeationMetrics.ideation_mode` stays local**
   - This is testbench-specific instrumentation
   - Ideation doesn't export mode types currently
   - Testbench owns this type

### Files Affected

- `/packages/testbench/package.json` (add dependency)
- `/packages/testbench/src/clients/planner.ts` (import `Step`)
- `/packages/testbench/src/runner/runner.ts` (use imported `Step`)
- No changes needed to scenarios or runner types (ideation_mode is testbench-owned)

---

## 6.2: Mode Naming — Unify Synthetic/AI Terminology

### Current State

**Inconsistent naming across three contexts:**

1. **Planning mode** (`scenario.planning_mode`):
   - `/packages/testbench/src/scenarios/schema.ts` line 69: `z.enum(['synthetic', 'ai'])`
   - `/packages/testbench/src/runner/runner.ts` lines 99, 108: Used as `scenario.planning_mode === 'ai'`
   - Controls whether PlannerLead generates steps (`ai`) or hardcoded test steps are used (`synthetic`)

2. **Ideation mode** (`ideationConfig.mode`):
   - `/packages/testbench/src/scenarios/schema.ts` line 46: `z.enum(['synthetic', 'ai'])`
   - `/packages/testbench/src/runner/runner.ts` lines 233, 254: Used as `ideationConfig.mode === 'synthetic'` / `'ai'`
   - Controls whether ideation uses test data (`synthetic`) or real agents (`ai`)
   - Stored in `IdeationMetrics.ideation_mode` (line 294)

3. **CLI execution mode** (`--mock` flag):
   - `/packages/testbench/src/cli.ts` lines 34, 63, 65, 72: Boolean flag `opts.mock`
   - Controls entire executor (MockExecutor vs ScenarioRunner)
   - Independent of planning_mode and ideation mode

**Problem:** Terms are conflated:
- `synthetic` = test data / mocked behavior (in planning_mode and ideation_mode)
- `ai` = real agent behavior (in planning_mode and ideation_mode)
- `mock` = entire executor mode (different concern, CLI-level)

**Clarity issue:** Code mixing concerns:
- Planning mode affects step generation strategy
- Ideation mode affects understanding collection strategy
- CLI mock mode affects whether external services are called

### Naming Recommendation

Rename for clarity at each level:

1. **Planning mode** → `planning_strategy` (better describes what it controls)
   - `'hardcoded'` instead of `'synthetic'` (clearer: steps are hardcoded test data)
   - `'ai'` stays (PlannerLead generates via AI)

2. **Ideation mode** → `ideation_strategy` (better describes ideation behavior)
   - `'preconfigured'` instead of `'synthetic'` (clearer: understanding is pre-configured from scenario)
   - `'ai'` stays (agents generate understanding)

3. **CLI `--mock` flag** → keep as-is (CLI-level concern, different from strategy)
   - BUT: Document that `--mock` is orthogonal to `planning_mode` and `ideation.mode`
   - When `--mock` is used, entire executor is mocked (no strategy distinction matters)

**Rationale:**
- `hardcoded` is specific (steps hardcoded in test data)
- `preconfigured` is specific (understanding preconfigured in scenario config)
- `synthetic` is vague (could mean many things)
- Both `hardcoded` and `preconfigured` are testbench-specific terms that don't bleed into planner/ideation domains

### Files Affected

Schema and enum definitions:
- `/packages/testbench/src/scenarios/schema.ts` (lines 46, 69)
  - `IdeationConfigSchema`: line 46, rename field and enum
  - `ScenarioSchema`: line 69, rename field and enum

Usage in runner:
- `/packages/testbench/src/runner/runner.ts` (lines 99-113, 233, 254, 294)
  - Line 93 comment: update phrasing
  - Line 99 condition: update string comparison
  - Line 108 condition: update string comparison
  - Line 232-234 comment: update phrasing
  - Line 233 condition: update string comparison
  - Line 253-254 comment: update phrasing
  - Line 254 condition: update string comparison
  - Line 294: update field name and value

Usage in mock executor:
- `/packages/testbench/src/runner/mock.ts` (line 57)
  - Line 57: update field name and value assignment

Usage in console reporter:
- `/packages/testbench/src/reporting/console.ts` (line 33)
  - Line 33: update variable name and display text (display as `mode` to user, internal is `strategy`)

### Migration Path

1. Rename enum values in schema.ts
2. Update all references in runner.ts
3. Update mock.ts
4. Update console.ts reporting
5. Update any scenario YAML/JSON files to use new names (if tests exist)
6. Add deprecation note in PR that old `synthetic`/`ai` terms are renamed

---

## 6.3: Retry Logic for HTTP Clients

### Current State

**Four HTTP clients with no retry logic:**

1. **`/packages/testbench/src/clients/planner.ts`** (lines 44-155):
   - `updatePlanSteps()`: fetch without retry
   - `createPlan()`: fetch without retry
   - `getPlanVersion()`: fetch without retry
   - `submitPlan()`: fetch without retry
   - `approvePlan()`: fetch without retry
   - `publishPlan()`: fetch without retry
   - `getLatestVersion()`: fetch without retry
   - `waitForSteps()`: has polling loop (90s timeout, 3s interval) but NO retry on individual failures
     - Line 145-151: Will throw immediately if fetch fails

2. **`/packages/testbench/src/clients/forge.ts`** (lines 44-102):
   - `createRun()`: fetch without retry
   - `getRun()`: fetch without retry
   - `pollUntilComplete()`: has polling (2s interval, 30min timeout) but NO retry on individual failures
     - Line 90-98: Will break immediately if fetch fails mid-poll

3. **`/packages/testbench/src/clients/ideation.ts`** (lines 42-173):
   - 10+ endpoints (createSession, addMessage, updateUnderstanding, createBlock, curateBlock, sendToPlanner, etc.)
   - None have retry logic
   - `isAvailable()` has timeout but no retry (line 164-171)
   - `waitForUnderstanding()` has polling (120s timeout, 3s interval) but no retry on fetch failure

4. **`/packages/testbench/src/clients/tuner.ts`** (lines 18-37):
   - `getOutcomes()`: fetch without retry (line 18-27)
   - `isAvailable()`: fetch with timeout but no retry (line 29-36)

### Network Failure Points

**High risk (critical path, likely to fail):**
- Planner `waitForSteps()` (line 146): polling for AI-generated steps, network glitch breaks entire run
- Forge `pollUntilComplete()` (line 91): polling for run status, network glitch breaks entire run
- Ideation `waitForUnderstanding()` (line 153): polling for specialist understanding, network glitch breaks entire run

**Medium risk (one-off operations, less likely but possible):**
- Plan creation/approval/publish (planner)
- Run creation (forge)
- Session/message operations (ideation)

**Low risk (best-effort, already has fallback):**
- Tuner `getOutcomes()` (line 160-167 in runner): wrapped in try-catch with fallback to forge metrics

### Retry Strategy Recommendation

Implement exponential backoff retry utility + apply to polling and one-shot calls:

**Utility function pattern:**
```typescript
async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  retryConfig?: { maxRetries: number; baseDelayMs: number; maxDelayMs: number }
): Promise<Response> {
  // Retry logic: exponential backoff, max 3 retries, 100ms -> 400ms delays
  // Only retry on network errors or 5xx, not 4xx
}
```

**Where to implement:**
- Create `/packages/testbench/src/util/fetch-retry.ts`
- Export `fetchWithRetry` function
- All clients import and use instead of native fetch

**Retry config per context:**
- Polling endpoints (waitForSteps, pollUntilComplete, waitForUnderstanding):
  - `maxRetries: 3`, `baseDelayMs: 200`, `maxDelayMs: 2000`
  - Individual fetch failure doesn't kill the poll loop
  - Poll loop itself has timeout/deadline

- One-shot endpoints (createPlan, approvePlan, createSession, etc.):
  - `maxRetries: 2`, `baseDelayMs: 100`, `maxDelayMs: 500`
  - Brief retries only, fail fast if service is down

- Health checks (isAvailable):
  - `maxRetries: 1`, `baseDelayMs: 500`, `maxDelayMs: 500`
  - Single retry only for availability checks

**Files to create:**
- `/packages/testbench/src/util/fetch-retry.ts` (new)

**Files to modify:**
- `/packages/testbench/src/clients/planner.ts` (use fetchWithRetry in all fetch calls)
- `/packages/testbench/src/clients/forge.ts` (use fetchWithRetry in all fetch calls)
- `/packages/testbench/src/clients/ideation.ts` (use fetchWithRetry in all fetch calls)
- `/packages/testbench/src/clients/tuner.ts` (use fetchWithRetry in getOutcomes and isAvailable)

### Implementation Notes

- Do NOT retry on network timeout (these have explicit timeout config)
- DO retry on connection refused, ECONNRESET, temporary 5xx
- DO NOT retry on permanent failures (4xx except 429, service unreachable)
- Retry should be transparent to caller (throw same error after exhausting retries)
- Add debug logging so test runs can show "retried after network glitch" messages

---

## 6.4: Metrics Accuracy Improvements

### Current State

**Metrics are collected but with inaccuracy issues:**

1. **`/packages/testbench/src/metrics/collector.ts`** (lines 32-74):
   - `getAggregate()` collects: total_runs, success_count, failure_count, success_rate, times, costs, tokens, complexity_accuracy
   - Mostly correct BUT complexity_accuracy calculation has issues (see below)

2. **`/packages/testbench/src/metrics/accuracy.ts`** (lines 9-41):
   - `calculateComplexityAccuracy()`: Pearson correlation between `estimated_complexity` and `actual_time_seconds`
   - **Issue 1 (line 12):** Filters to `r.estimated_complexity > 0` but estimated_complexity can legitimately be 0 for trivial tasks
   - **Issue 2 (line 18):** Returns `null` if `pairs.length < 2`, but doesn't log why (silent failure)
   - **Issue 3 (line 15):** Uses `actual_time_seconds` but this includes workspace setup overhead, not just step execution
   - **Issue 4:** No context about whether this is correlation or accuracy — correlation ≠ accuracy

3. **`/packages/testbench/src/runner/runner.ts`** (lines 116-121):
   - Collects `estimated_complexity` as average of steps' complexity_estimate.score (lines 117-120)
   - **Issue 1:** Some steps may not have complexity_estimate (line 117), calculates average only from non-undefined steps
   - **Issue 2:** No handling for empty steps array (though tested, edge case risk)
   - **Issue 3:** Doesn't capture "step count affects complexity" — should steps be weighted by step_count?

4. **`/packages/testbench/src/reporting/console.ts`** (lines 53-57):
   - Reports `metrics.complexity_accuracy` with color coding (line 54-56)
   - Misleading label: "Accuracy" for Pearson correlation (-1 to 1 scale)
   - No explanation of what the metric means

### Metrics Issues Summary

| Issue | Location | Impact | Fix |
|---|---|---|---|
| `estimated_complexity > 0` filter | accuracy.ts:12 | Excludes valid zero-complexity steps | Change to `>= 0` |
| Silent null return | accuracy.ts:18 | No visibility into why metric is null | Log reason or document |
| Workspace overhead in actual_time | runner.ts:170 | Inflates actual time, skews correlation | Measure step execution only, not workspace |
| No complexity weighting | runner.ts:116-121 | Equal weight to each step, ignores count | Weight by step_count or use sum |
| Misleading label | console.ts:55-56 | User reads "accuracy" but it's correlation | Rename to "complexity_correlation" |
| No baseline context | console.ts:55-56 | No explanation of what 0.7+ means | Add comment explaining scale |

### Recommended Improvements

**6.4.1: Fix complexity accuracy calculation**

```typescript
// In accuracy.ts
function calculateComplexityAccuracy(results: RunResult[]): number | null {
  // Include steps with 0 complexity (trivial tasks)
  const pairs = results
    .filter((r) => r.estimated_complexity !== undefined && r.plan_step_count !== undefined)
    .filter((r) => r.plan_step_count! > 0)  // Only if we have steps
    .map((r) => ({
      x: r.estimated_complexity!,
      y: r.actual_time_seconds,
    }));

  if (pairs.length < 2) {
    console.warn(`[Metrics] Complexity accuracy: insufficient data (${pairs.length} samples)`);
    return null;
  }
  // ... rest of Pearson calculation
}
```

**6.4.2: Separate setup time from execution time**

In `runner/runner.ts`:
- Track setup time separately (workspace creation, plan creation, approval)
- Track execution time (forge run only)
- Correlate estimated_complexity against execution_time_seconds, not total_time_seconds

```typescript
// In RunResult schema (runner/types.ts), add:
setup_time_seconds?: number;
execution_time_seconds?: number;
// Keep actual_time_seconds = setup + execution for backward compatibility
```

**6.4.3: Consider step complexity weighting**

Instead of averaging step complexities equally:
```typescript
// Current (equal weight):
avgComplexity = steps.reduce((sum, s) => sum + s.complexity, 0) / steps.length;

// Better (weight by importance or normalize):
// Option A: Use max complexity instead of mean (plan is as complex as hardest step)
// Option B: Weight by estimated effort per step
totalComplexity = steps.reduce((sum, s) => sum + (s.complexity_estimate?.score ?? 0), 0);
```

**6.4.4: Improve metric labels and reporting**

In `reporting/console.ts`:
```typescript
// Line 54-56: Change label and add context
const acc = metrics.complexity_accuracy;
if (acc !== null) {
  const accColor = acc > 0.5 ? GREEN : acc > 0 ? YELLOW : RED;
  console.log(`  Correlation: ${accColor}${acc.toFixed(3)}${RESET} (complexity vs time; r in [-1,1])`);
} else {
  console.log(`  Correlation: N/A (insufficient data)`);
}
```

**6.4.5: Add missing metrics**

Track these for better insights:
- `success_by_difficulty`: breakdown of pass/fail by scenario difficulty
- `token_efficiency`: tokens_per_step, tokens_per_minute
- `cost_per_step`: average cost per step, cost per scenario
- `step_count_impact`: average time per step (time / step_count)

Collector could track these in `getAggregate()` if they're useful.

### Files to Modify

- `/packages/testbench/src/metrics/accuracy.ts` (fix filter, add logging, refactor)
- `/packages/testbench/src/runner/types.ts` (add setup_time_seconds, execution_time_seconds fields)
- `/packages/testbench/src/runner/runner.ts` (calculate setup vs execution time)
- `/packages/testbench/src/reporting/console.ts` (improve labels, add null handling)
- `/packages/testbench/src/metrics/collector.ts` (optional: add new breakdown metrics)

---

## Summary Table: What Needs to Change

| Phase | Area | Category | Key Changes | Files |
|---|---|---|---|---|
| 6.1 | Type Imports | Schema | Import `Step` from planner; add @plannr/planner dependency | testbench/package.json, clients/planner.ts, runner/runner.ts |
| 6.2 | Mode Naming | Enum/Constants | Rename `synthetic→hardcoded`, `ai→ai`; clarify `planning_mode→planning_strategy`, `ideation.mode→ideation_strategy` | scenarios/schema.ts, runner/runner.ts, mock.ts, reporting/console.ts |
| 6.3 | Retry Logic | Utility + Client Updates | Create `util/fetch-retry.ts`; use in all clients | clients/planner.ts, clients/forge.ts, clients/ideation.ts, clients/tuner.ts |
| 6.4 | Metrics Accuracy | Calculation + Reporting | Fix complexity filter; separate setup/execution time; improve labels | metrics/accuracy.ts, metrics/collector.ts, runner/types.ts, runner/runner.ts, reporting/console.ts |

---

## Interdependencies

- **6.1 → 6.2**: Type imports don't affect mode naming (independent)
- **6.2 → Everything**: Renamed enums affect runner, mock, console reporting (must coordinate)
- **6.3 → All clients**: Retry logic wraps existing fetch calls (safe, non-breaking)
- **6.4 → Metrics only**: Accuracy changes are isolated to metrics + reporting (safe)

**Implementation order:** 6.1 → 6.2 → 6.3 → 6.4 (each builds on earlier work but logically independent)

---

## Acceptance Criteria

- [ ] Testbench imports `Step` type from planner package
- [ ] All planning_mode/ideation_mode strings renamed to new values
- [ ] All HTTP clients use fetchWithRetry for network calls
- [ ] Complexity accuracy calculation filters correctly on >= 0
- [ ] Metrics reporter labels correlation metric accurately
- [ ] Setup vs execution time is tracked separately

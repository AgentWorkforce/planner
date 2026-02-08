# Phase 4: Planner Quality Signal Implementation

## Overview

Implemented quality signal emission from the planner package when an ideation-sourced plan is approved. This closes the feedback loop between ideation sessions and the tuner's learning system.

## Implementation

### 1. Quality Signal Module (`packages/planner/src/tuner/quality-signal.ts`)

Created a new module to build and emit `PlanQualitySignal` when plans are approved.

**Key features:**
- Only emits for ideation-sourced plans (checks `source.type === 'ideation'`)
- Fire-and-forget pattern - never blocks approval workflow
- Graceful degradation when Tuner is disabled/unavailable
- Gathers quality metrics from plan data:
  - Question count (from `questions` table)
  - Version count (from `versions` table)
  - Improvement count (from `improvements` table)
  - Block count (from `understanding._blocks.blocks[]`)
  - Time to approval (from plan creation to approval)

**Signal structure:**
```typescript
{
  plan_id: string;
  plan_version: number;
  session_id: string;      // Links back to ideation session
  question_count: number;
  version_count: number;
  improvements_made: number;
  block_count: number;
  time_to_approval_ms: number;
  source: 'production' | 'test' | 'training';
  timestamp: string;
}
```

### 2. Workflow Integration (`packages/planner/src/storage/sqlite/workflow.ts`)

Modified `approveVersion()` to emit quality signal:
- Fetches plan data (including source)
- Calls `emitPlanQualitySignal()` with plan metadata
- Fire-and-forget - errors are logged but don't fail approval

### 3. API Endpoint

Signal is submitted to: `POST /api/tuner/outcomes/plan-quality`

The tuner package's outcome collector handles this endpoint (already implemented in Phase 1).

### 4. Testing (`packages/planner/src/tuner/quality-signal.test.ts`)

Comprehensive test coverage:
- ✅ Emits signal for ideation-sourced plans
- ✅ Skips non-ideation plans
- ✅ Counts questions, versions, improvements correctly
- ✅ Extracts block count from understanding

All tests passing (4/4).

## Data Flow

```
Ideation Session
      ↓
   Creates Plan (with source: { type: 'ideation', session_id: '...' })
      ↓
   User reviews and approves
      ↓
   approveVersion() called
      ↓
   emitPlanQualitySignal() (fire-and-forget)
      ↓
   POST /api/tuner/outcomes/plan-quality
      ↓
   Tuner stores signal, links to ideation session
      ↓
   Future: Used to tune ideation baseline configuration
```

## Key Design Decisions

### 1. Fire-and-Forget Pattern

Quality signal emission never blocks the approval workflow:
- Uses `void` to discard promise (no awaiting)
- Catches and logs errors internally
- 5-second timeout on HTTP request

### 2. Source Type Check

Only emit for ideation-sourced plans:
```typescript
if (planData.source.type !== 'ideation' || !planData.source.session_id) {
  console.log(`[quality-signal] Skipping non-ideation plan ${planData.plan_id}`);
  return;
}
```

### 3. Block Count Extraction

Blocks are stored in understanding under `_blocks.blocks[]`:
```typescript
const understanding = JSON.parse(versionRow.understanding_json);
blockCount = understanding._blocks?.blocks?.length ?? 0;
```

This matches the ideation package's storage format (see `packages/ideation/src/api/handlers.ts`).

### 4. Graceful Degradation

If Tuner is disabled (no `TUNER_URL` env var), the signal is skipped with a log message. This allows planner to work independently.

## Integration Points

### With Tuner Package

- Imports `PlanQualitySignalSchema` locally (duplicated to avoid cross-package dependency)
- Submits to tuner's outcome collector API
- Tuner stores signal in `plan_quality_signals` table

### With Ideation Package

- Reads block count from understanding structure
- Links back to ideation session via `session_id`

## Files Modified

1. **New**: `packages/planner/src/tuner/quality-signal.ts` (169 lines)
2. **New**: `packages/planner/src/tuner/quality-signal.test.ts` (192 lines)
3. **Modified**: `packages/planner/src/storage/sqlite/workflow.ts` (+14 lines)
4. **Modified**: `packages/planner/src/tuner/index.ts` (+2 lines)

## Testing

Run tests:
```bash
npm test -- quality-signal
```

All 4 tests passing:
- `should emit signal for ideation-sourced plans`
- `should skip non-ideation plans`
- `should count questions, versions, and improvements correctly`
- `should extract block count from understanding`

## Next Steps

Phase 4 is complete. The quality signal is now emitted when ideation-sourced plans are approved.

Next:
- Phase 5: Review Phase 3+4 integration work (Task #105)
- Phase 6: Full PR review - typecheck, tests, cross-package consistency (Task #106)

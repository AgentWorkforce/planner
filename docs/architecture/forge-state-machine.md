# Forge-Next State Machine Specification

Formal state transition definitions for forge-next runs and steps.

## Run States

```
pending ──start──► running ──complete──► completed
                     │
                     ├──fail──────────► failed
                     │
                     ├──cancel────────► cancelled
                     │
                     └──pause──► paused ──resume──► running
```

| State | Description |
|-------|-------------|
| `pending` | Run created, workflow not yet started |
| `running` | Workflow executing (relay runner active) |
| `paused` | Halted by gate checkpoint (awaiting human approval) |
| `completed` | All steps finished successfully |
| `failed` | One or more steps failed after exhausting retries |
| `cancelled` | Aborted by user action or reconciliation loop |

### Run Transitions

| From | To | Trigger |
|------|----|---------|
| `pending` | `running` | `run:started` — relay runner begins execution |
| `running` | `completed` | `run:completed` — all steps reached terminal state |
| `running` | `failed` | `run:failed` — unrecoverable step failure |
| `running` | `cancelled` | `run:cancelled` — user abort or reconciliation abort (plan retracted) |
| `running` | `paused` | Gate pending — GateManager pauses runner on gated step completion |
| `paused` | `running` | Gate approved — GateManager unpauses runner |
| `paused` | `cancelled` | Gate rejected — GateManager aborts runner |

### Run Invariants

1. A run cannot be `completed` if any step is still `started` (in-progress).
2. A run cannot be `completed` if any step is `failed` — it transitions to `failed` instead.
3. A `cancelled` run is terminal — it cannot be resumed.
4. `paused` state only occurs due to gate checkpoints, never due to step retries.

## Step States

```
pending ──start──► started ──complete──► completed
                     │
                     ├──fail──► failed ──retry──► retrying ──start──► started
                     │                    │
                     │                    └──(retries exhausted)──► failed (terminal)
                     │
                     └──skip──► skipped
```

| State | Description |
|-------|-------------|
| `pending` | Step queued, dependencies not yet satisfied |
| `started` | Agent spawned, work in progress |
| `completed` | Step finished, acceptance criteria met (or not scored) |
| `failed` | Step failed; may be retried or terminal |
| `retrying` | Transient — retry context written, next attempt about to start |
| `skipped` | Step skipped (manual skip override, upstream failure, or deterministic skip) |

### Step Transitions

| From | To | Trigger | Side Effects |
|------|----|---------|-------------- |
| `pending` | `started` | `step:started` — DAG dependencies satisfied, agent spawned | RunMonitor starts timing |
| `started` | `completed` | `step:completed` — agent reports success | Score computed, cost tracked, journal persisted |
| `started` | `failed` | `step:failed` — agent reports failure | Error recorded, attempt counter incremented |
| `failed` | `retrying` | `step:retrying` — retries remaining | Retry context file written to `.forge/retry-context/{stepName}.md` |
| `retrying` | `started` | `step:started` — retry attempt begins | Same as initial start |
| `failed` | (terminal) | Retries exhausted | `step:retries-exhausted` emitted, run may fail |
| `pending` | `skipped` | `step:skipped` — skip override or upstream failure | No agent spawned |
| `started` | `skipped` | `step:force-released` — manual intervention | Step forcefully terminated |

### Step Invariants

1. A step can only be `started` if all dependencies are `completed` or `skipped`.
2. `retrying` is a transient state — it immediately transitions to `started`.
3. `skipped` and `completed` are terminal — no further transitions.
4. `failed` is terminal only when `attempt >= max_retries + 1`.

## Hook Steps (`:pre` / `:post`)

Hook steps are deterministic (shell command) steps injected by the compiler from `step.hooks.before_run` and `step.hooks.after_run`. They follow the same state machine as regular steps but with key differences:

| Property | Hook Steps | Agent Steps |
|----------|-----------|-------------|
| Type | `deterministic` (shell command) | `worktree` (agent task) |
| LLM cost | $0 | Varies by model |
| Retries | Follow parent step config | Independent config |
| Journal | Command output only | Full agent reasoning |

### DAG Wiring

```
dependencies ──► step_id:pre ──► step_id ──► step_id:post ──► downstream
```

- `:pre` inherits the original step's dependencies
- The main step depends on `:pre` (if present)
- `:post` depends on the main step
- Downstream steps depend on `:post` (if present) instead of the main step

## Reconciliation Events

The `ReconciliationLoop` emits events that can trigger state transitions:

| Event | Condition | Action |
|-------|-----------|--------|
| `reconciliation:plan-retracted` | Plan status changed from `published` | Run aborted → `cancelled` |
| `reconciliation:stall-detected` | No step progress for 5+ minutes | Warning emitted (no state change) |
| `reconciliation:version-drift` | Newer plan version published | Info emitted (no state change, once per run) |

## Retry Context Flow

```
step:failed ──► RunMonitor writes .forge/retry-context/{step}.md
             ──► step:retrying
             ──► step:started (new attempt)
             ──► Agent reads retry context file
             ──► Agent adjusts approach based on prior failures
```

The retry context file accumulates across attempts, giving each retry the full failure history.

## Gate Flow

```
step:completed (gated step) ──► GateManager creates Gate record
                             ──► Runner paused
                             ──► Run status → paused
                             ──► gate:pending emitted

User approves  ──► Runner unpaused ──► Run status → running
User rejects   ──► Runner aborted  ──► Run status → cancelled
```

## Recovery Rules

| Scenario | Behavior |
|----------|----------|
| Server crash during run | Run remains in `running` state in DB; no auto-recovery (manual re-run required) |
| Relay connection lost | Relay SDK handles reconnection; steps in progress continue |
| Step timeout | Treated as step failure, triggers retry if attempts remain |
| Plan retracted during run | Reconciliation loop detects and aborts (→ `cancelled`) |

## Cross-Reference

- **RunStatusSchema**: `packages/forge-next/src/types.ts` — Zod enum defining valid run states
- **WorkflowEvent**: `@agent-relay/sdk/workflows` — relay SDK event types that drive transitions
- **RunMonitor**: `packages/forge-next/src/run-monitor.ts` — step timing, cost, stall detection, retry context
- **GateManager**: `packages/forge-next/src/gate-manager.ts` — gate lifecycle and runner pause/resume
- **ReconciliationLoop**: `packages/forge-next/src/reconciliation.ts` — periodic health checks
- **Compiler**: `packages/forge-next/src/compiler.ts` — generates workflow DAG including hook steps

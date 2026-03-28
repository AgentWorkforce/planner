# Cultivate: Forge & Planner Operations Guide

Operational reference for the cultivate package — how to drive the planner-forge pipeline programmatically, and patterns learned from monitoring agent-relay, forge, and agents during development.

---

## Part 1: Planner-Forge Pipeline

### The Full Lifecycle

```
PLANNER                          FORGE                           RELAY
───────                          ─────                           ─────
Draft (working)
  │
  ▼ submit
Draft (submitted)
  │
  ▼ approve
Approved (locked)
  │
  ▼ publish
Published ──── plan_ref ────→ POST /runs
                              Create Run + Tasks
                              scheduleReadyTasks()
                                │
                                ▼
                              PREP analysis ──────────→ Spawn PREP agent
                              dispatchTask() ─────────→ Spawn worker agent
                              checkCompletions()
                              TASK_POST gate ──────────→ Spawn verifier
                              ...repeat per tier...
                              finalizeRun()
                              RUN_POST + AC_AUDIT
                              Merge worktree → branch
```

### Step 1: Create and Populate a Plan

```
POST /api/plans
Body: { goal: "...", context: "..." }
→ Returns: { plan: { plan_id, latest_version: 1, status: "draft" } }
```

Add steps to the plan:

```
POST /api/plans/:plan_id/versions/:version/steps
Body: {
  title: "Add OAuth endpoints",
  description: "...",
  scope: "packages/server",
  owner_role: "backend:Coder",
  dependencies: [],
  acceptance_criteria: [
    { id: "ac-1", description: "OAuth routes respond to /auth/*", type: "test" }
  ]
}
```

Steps form a DAG via `dependencies: [step_id, ...]`. The orchestrator respects this ordering through dependency tiers.

### Step 2: Submit for Review

```
POST /api/plans/:plan_id/versions/:version/submit
→ Returns: { version: PlanVersion }  (submitted_at now set)
```

This is a coordination signal — the plan is ready for review. Status stays `draft`.

### Step 3: Approve

```
POST /api/plans/:plan_id/versions/:version/approve
Body: { approver: "cultivate" }
→ Returns: { version: PlanVersion }  (status: "approved")
```

**Preconditions:**
- Version must be `draft` with `submitted_at` set
- All `sub_plan_id` references must point to existing plans
- Missing sub-plans cause a hard 400 error

**After approval:** The version is **locked and immutable**. Any changes require creating a new version.

### Step 4: Publish

```
POST /api/plans/:plan_id/versions/:version/publish
→ Returns: {
    version: PlanVersion,
    plan_ref: "plan_id:version",
    dot_summary: { complexity, ... }
  }
```

**Preconditions:**
- Version must be `approved`
- All referenced sub-plans must be `published` (hard block)

**Output:** `plan_ref` is the stable identifier forge uses to fetch the plan.

### Step 5: Create a Forge Run

```
POST /api/forge/runs
Body: {
  plan_id: "...",
  plan_version: 2,
  workspace_path: "/path/to/repo"   // optional — uses worktree if omitted
}
→ Returns: { run_id, status: "running", tasks_count: N }
```

Forge will:
1. Fetch the published plan via `PlannerClient`
2. Transform `PlanVersion` → `ForgePlan` (maps roles to CLIs, scopes to repos)
3. Create `Run` + `Task` entities in forge.db
4. Start the execution loop asynchronously

Alternatively, pass an inline plan (skips planner fetch):

```
POST /api/forge/runs
Body: {
  plan: { steps: [...], summary: {...} },
  workspace_path: "/path/to/repo"
}
```

### Step 6: Monitor Run Progress

**SSE stream:**

```
GET /api/forge/runs/:run_id/events
Accept: text/event-stream
```

Events emitted:
- `run_status_changed` — started, completed, failed, paused, cancelled
- `task_status_changed` — started, completed, failed, blocked, queued, retrying
- `gate_reached` — human approval needed
- `agent_progress` — agent activity updates
- `question_added` — agent needs user input
- `ac_audit_complete` — acceptance criteria audit done
- `heartbeat` — every 30s, keeps connection alive

Supports `Last-Event-ID` header for reconnection — missed events are replayed.

**Polling alternative:**

```
GET /api/forge/runs/:run_id
→ Returns: { run, tasks: [...] }
```

### Step 7: Handle Gates

If a task requires human approval (gate):

```
POST /api/forge/runs/:run_id/gates/:gate_id/approve
Body: { decision: "approve", feedback: "..." }
```

Or reject:

```
POST /api/forge/runs/:run_id/gates/:gate_id/reject
Body: { decision: "reject", reason: "..." }
```

Gates are also created by the recovery system when a task exhausts retries and escalates.

### Step 8: Handle Change Requests

When forge discovers a plan is inadequate during execution:

```
POST /api/plans/:plan_id/change-requests
Body: {
  run_id: "...",
  reason: "Missing step for database migration",
  suggested_changes: [
    { type: "add_step", step: { title: "Run migration", ... } }
  ]
}
```

This creates a **new draft version** — never mutates the approved one. The new version goes through the full submit → approve → publish cycle.

### Programmatic Approval via MCP

For automated pipelines, plans can be approved via MCP tools (used by agents):

```
Tool: approve_plan { plan_id: "..." }
→ Approves latest draft version (must be submitted, must have ≥1 step)

Tool: publish_plan { plan_id: "..." }
→ Publishes latest approved version, returns plan_ref
```

### Quality Gates in Execution

Forge runs five quality phases. Cultivate should understand what each does:

| Phase | When | Blocking | Model | What |
|-------|------|----------|-------|------|
| PREP | New dependency tier starts | No (advisory) | Sonnet | Analyzes scope, existing patterns, scope boundaries |
| TASK | Agent executes work | Yes | Per-task config | Agent works in worktree, commits with `[forge:taskId]` |
| TASK_POST | After task completion | Yes (conditional) | Haiku | Quick code review, AC check, scope violation check |
| RUN_POST | All tasks done | No (advisory) | Haiku | PR-level integration review of combined changeset |
| AC_AUDIT | Final phase | No (advisory) | Sonnet | Feature-level acceptance criteria verification |

TASK_POST failures classify severity:
- `fix_issues` — agent retries with failure context, fixes on top of existing work
- `clean_restart` — agent reverts and starts fresh

The retry ladder: Revise (attempt 1-2) → Retry (attempt 3) → Escalate to gate → Skip.

### Execution Policy

Runs execute under configurable policies:

```json
{
  "budgets": {
    "total_cost_limit_usd": 5.0,
    "per_task_time_seconds": 300,
    "per_task_cost_limit_usd": 1.0
  },
  "retry": {
    "max_retries_per_task": 3,
    "recovery_strategy": "reflexion"
  },
  "parallelism": {
    "max_concurrent_tasks": 3,
    "per_scope_exclusive": true
  },
  "quality": {
    "prep_enabled": true,
    "task_post_enabled": true,
    "run_post_enabled": true,
    "run_post_ac_audit": true
  }
}
```

`per_scope_exclusive: true` means tasks in the same scope run sequentially (avoids git conflicts within a scope).

### Worktree Management

Forge creates isolated git worktrees per run at `.forge-worktrees/{runId}`. Agents work in the worktree, not the main checkout. On finalization:

1. Auto-commit any uncommitted work
2. Merge worktree commits back to base branch
3. Delete worktree

Git history is preserved per task — commits tagged with `[forge:{taskId}]`.

---

## Part 2: Monitoring & Operational Patterns

What we've learned from running forge and agent-relay in production, the issues encountered, and how they were fixed.

### Relay Daemon Health

**Problem: CPU spiral from agent accumulation (HIGH-10)**

The relay daemon maintains an `agents.json` registry. When agents exit without being deregistered, the registry grows unboundedly. At ~50+ stale agents, the daemon's SQLite queries slow down, CPU spikes to 100%, and message delivery latency goes from ~5ms to >500ms.

**Root cause:** Forge was spawning agents via relay but never calling `releaseAgent()` or cleaning up the registry on agent exit.

**Fix:** Two-layer cleanup:
1. **Pre-spawn cleanup** — before spawning a new agent with the same name, attempt graceful release (2s timeout), then force-remove from registry
2. **Exit callback deregistration** — when PID monitor detects agent exit, immediately remove from relay registry

**Monitoring pattern:** Watch relay daemon CPU usage. If it stays above 20% idle, check `agents.json` size. Run `agent-relay agents list` to see registered count.

### Cascading Failure vs Circular Dependencies (HIGH-1)

**Problem:** When a task fails, dependent tasks can never run. The orchestrator was incorrectly identifying this as a "circular dependency" and stalling the entire run.

**Root cause:** The stall detector treated all "pending tasks with no ready tasks" as circular dependencies. It didn't distinguish between tasks blocked by failed upstream dependencies (cascading failure) and tasks blocked by unresolvable circular deps.

**Fix:** Compute the transitive closure of failed tasks. For each pending task, check if all its dependencies are either completed or transitively blocked by a failure. If so, it's cascading — mark it failed with a clear message (`"Blocked: upstream task X failed"`). Only flag circular dependency if pending tasks exist that are NOT transitively blocked.

**Monitoring pattern:** In the SSE event stream, watch for `task_status_changed` events with status `failed` and check the error message. "Blocked: upstream task" = cascading (expected when a task fails). "Circular dependency detected" = real structural problem in the plan's dependency graph.

### Quality Gate Timeouts (CRITICAL)

**Problem:** TASK_POST quality gates were timing out at 100%, causing every task to fail verification even when the work was correct.

**Root cause:** The analysis tool was passing results via stdout, but the subprocess was buffering output. Large responses got truncated or never arrived.

**Fix:** Switched to file-based result passing. The analysis agent writes its JSON result to a temp file, and the orchestrator reads the file. Eliminated stdout buffering entirely.

**Monitoring pattern:** If TASK_POST consistently fails with timeout errors (not quality issues), the problem is likely in the result delivery mechanism, not the code quality. Check `task_post_timeout_ms` configuration — default is 120s, which should be sufficient for Haiku-based reviews.

### Agent Commit Discipline

**Problem (MED-11):** Agents weren't committing their work in worktrees, so TASK_POST had nothing to review and finalization had nothing to merge.

**Root cause:** Agent prompts used `git add -A` which sometimes staged unexpected files (node_modules, lock files), causing commit failures. Other times agents simply forgot to commit.

**Fix:**
1. Agent prompts now specify targeted staging (`git add <specific-files>`) instead of `git add -A`
2. `ensureWorkCommitted()` in the orchestrator auto-commits any uncommitted work before TASK_POST runs
3. Finalization does a final sweep for uncommitted changes

**Monitoring pattern:** After a task completes, check the worktree's git log. If `ensureWorkCommitted()` had to auto-commit, the agent prompt may need better commit instructions.

### Lazy Channel Joining

**Problem:** Relay agents were joining every plan channel on startup, flooding the daemon with channel subscriptions and causing message routing overhead.

**Fix:** Channels are now joined lazily — agents only join a channel when they first need to send or receive messages on it. The server tracks which channels are active and joins/leaves as needed.

**Monitoring pattern:** Check `agent-relay channels list` — the number of active channel subscriptions should roughly match the number of active runs, not grow unboundedly.

### Worktree Lifecycle

**Problem:** Worktrees weren't being cleaned up after run completion, and finalization wasn't merging commits back to the base branch.

**Fix:** Full worktree lifecycle:
1. Create on run start (`.forge-worktrees/{runId}`)
2. Agents commit within worktree
3. On finalization: merge commits back to base branch via cherry-pick
4. Delete worktree after merge
5. Guard against operating on `main`/`master` directly

**Monitoring pattern:** Check `.forge-worktrees/` directory. Stale worktrees from failed runs that weren't cleaned up should be manually deleted. `git worktree list` shows all active worktrees.

### Run Recovery on Restart

**Problem:** If the server crashes or restarts while runs are active, orphan agents continue running but the orchestrator loses track of them.

**Fix:** `RecoveryService.recoverRunningRuns()` runs once on startup:
1. Finds all runs with status `running` or `paused`
2. Compares expected agents (from DB) vs actual running agents (from relay)
3. Terminates orphans (30s grace period)
4. Retries tasks from missing agents

**Monitoring pattern:** Check server startup logs for `RecoveryLog` output — it reports `runsRecovered`, `orphansTerminated`, `tasksRetried`.

### Health Monitoring

The forge health monitor tracks agent heartbeats and detects stuck agents:

- **Stuck threshold:** 5 minutes without heartbeat (configurable via `FORGE_AGENT_STUCK_THRESHOLD`)
- **Check interval:** 60 seconds
- **Task timeout:** 5 minutes per task by default (from `ExecutionPolicy.budgets.per_task_time_seconds`)

When a stuck agent is detected, the orchestrator:
1. Signals graceful shutdown
2. Marks the task as failed with timeout outcome
3. Applies retry ladder (may retry if retries remain)

### What to Watch

**Real-time (SSE):**
- Run status transitions — healthy runs progress through `running` → `completed`
- Task failures with retry — check if retries are succeeding or burning budget
- Gate events — human approval needed, someone needs to respond
- Agent progress — heartbeats confirm agents are alive

**Periodic checks:**
- Relay daemon CPU (should be <5% idle)
- Agent registry size (`agent-relay agents list`)
- Worktree directory (stale worktrees from crashed runs)
- forge.db size (trajectory events accumulate)

**Post-run:**
- Check the run document for PREP, TASK_POST, RUN_POST, AC_AUDIT results
- Review git log in worktree (or merged branch) for task commits
- Compare actual changes against plan's acceptance criteria

### Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `FORGE_MODE` | auto (real if relay connected) | `real` = spawn agents, `test` = mock |
| `FORGE_AGENT_STUCK_THRESHOLD` | 300000 (5 min) | Ms before agent marked stuck |
| `MULL_TRIGGERS_ENABLED` | true | Auto-extract knowledge from forge events |
| `MULL_MEMORY_DIR` | ./memory | Where mull writes topic files |
| `ANTHROPIC_API_KEY` | (none) | Required for LLM synthesis and agent spawning |

### Common Failure Modes

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| All tasks timeout | Agent spawning broken or relay disconnected | Check relay connection, `FORGE_MODE` |
| Tasks complete but TASK_POST fails | Quality gate too strict or timeout too short | Check `task_post_timeout_ms`, review gate prompt |
| Run stuck with pending tasks | Cascading failure from one task | Check failed tasks, fix root cause, retry run |
| Agents not committing | Prompt issue or git config | Check worktree git status, agent prompt |
| Worktree merge conflicts | Parallel tasks modified same files | Enable `per_scope_exclusive` parallelism |
| Relay CPU high | Agent registry bloat | Kill stale agents, restart daemon |
| 0 nuggets from mull | Cursors mark sessions processed | Clear `.mull/cursors/` or use `--force` |

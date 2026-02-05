# Testbench: How to Add Scenarios

## What Testbench Does

Testbench is an E2E test harness that exercises the full pipeline:

```
Create plan → Generate steps → Approve → Publish → Forge run → Agent spawn (relay) → Agent executes → Verify output
```

It lives in `packages/testbench/`. Scenarios are JSON files in `packages/testbench/scenarios/`.

## Key Files

| File | Purpose |
|------|---------|
| `packages/testbench/scenarios/*.json` | Scenario definitions (what to test) |
| `packages/testbench/src/scenarios/schema.ts` | Zod schema for scenario JSON |
| `packages/testbench/src/runner/runner.ts` | `ScenarioRunner.run()` — orchestrates the full pipeline |
| `packages/testbench/src/clients/planner.ts` | `PlannerClient` — talks to planner API |
| `packages/testbench/src/clients/forge.ts` | `ForgeClient` — talks to forge API |
| `packages/testbench/src/clients/tuner.ts` | `TunerClient` — collects metrics |
| `packages/testbench/src/verification/` | Verification logic (runs commands, checks output) |
| `packages/testbench/src/cli.ts` | CLI entry point |

## How to Run

```bash
cd packages/testbench

# Run a specific scenario
npx tsx src/cli.ts run hello-cli --timeout 5

# Run all scenarios
npx tsx src/cli.ts run --timeout 10
```

**Prerequisites:** Backend on port 3001, tuner on port 4002, relay daemon running.

## Scenario Schema

```json
{
  "id": "unique-id",
  "name": "Human-readable name",
  "difficulty": "trivial | simple | moderate | complex",
  "planning_mode": "synthetic | ai",
  "goal": "What the agent should accomplish",
  "expected": {
    "language_tier": "s | a | b | c | d",
    "complexity_level": "trivial | simple | moderate | complex",
    "step_count": { "min": 1, "max": 5 },
    "time_minutes": { "min": 2, "max": 15 }
  },
  "verification": {
    "type": "script",
    "commands": ["node index.js Alice"],
    "expect_output": "Hello, Alice!",
    "expect_exit_code": 0,
    "timeout_seconds": 30
  },
  "tags": ["optional", "tags"]
}
```

### Two Planning Modes

- **`synthetic`** (default): Testbench generates 1-2 hardcoded steps ("Implement solution" + "Verify implementation"). Fast, deterministic, good for testing forge execution.
- **`ai`**: PlannerLead generates steps via LLM using the `add_step` tool. Tests the full AI planning path. Slower (waits up to 90s for steps).

## How the Runner Works (simplified)

```
1. Create workspace in /tmp/testbench/{scenario-id}-{random}/
2. POST /api/plans with { goal } → creates plan
3. If synthetic: generate hardcoded steps, PUT to plan
   If ai: wait for PlannerLead to call add_step (polls GET /api/plans/:id)
4. Submit → Approve → Publish the plan version
5. POST /api/forge/runs with the plan → creates forge run
6. Poll GET /api/forge/runs/:id until completed/failed
7. Run verification commands in the workspace directory
8. Collect metrics from tuner
9. Return RunResult with success/failure + metrics
```

## Creating a New Scenario

1. Create a JSON file in `packages/testbench/scenarios/` matching the schema above
2. The `goal` field is what gets sent to PlannerLead (ai mode) or becomes the step description (synthetic mode)
3. The `verification` block runs commands in the agent's workspace directory after the forge run completes
4. `expect_output` does a substring match against stdout

### Tips

- Put explicit filenames in the `goal` — agents sometimes pick their own names
- Verification `commands` run in the workspace root, so paths should be relative
- For `ai` mode, `expected.step_count` should be a wide range since PlannerLead's output varies
- Keep `difficulty: "trivial"` for quick iteration; complex scenarios cost more and take longer
- The workspace is a fresh empty directory — agents start from scratch

## Existing Scenarios

| Scenario | Mode | What it tests |
|----------|------|---------------|
| `hello-cli.json` | synthetic | Basic forge agent execution (2 steps with dependency) |
| `hello-cli-ai.json` | ai | PlannerLead step generation + forge agent execution |

## Architecture Context

The testbench sits alongside three services:

- **Planner** (port 3001): Plan CRUD, PlannerLead AI, approval workflow
- **Forge** (port 3001, same server): Run creation, task orchestration, agent spawning via relay
- **Tuner** (port 4002): Metrics collection, outcome tracking

Agents are spawned via the relay daemon as Claude CLI processes. They report completion by calling `POST /api/forge/mcp/tools/call` with `report_complete`.

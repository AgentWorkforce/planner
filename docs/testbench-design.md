# Testbench: End-to-End Pipeline Testing

## Overview

A testbench for automated end-to-end testing of the Planner → Forge → Tuner pipeline. Runs predefined scenarios multiple times to:

1. Verify all components work together
2. Train Tuner with real execution data
3. Measure complexity estimation accuracy
4. Track system reliability over time

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         TESTBENCH                               │
├─────────────────────────────────────────────────────────────────┤
│  Scenarios: [fizzbuzz, tic-tac-toe, todo-cli, rest-api, ...]   │
│  Config: iterations, timeout, workspace, auto-approve           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  For each scenario × iteration:                                 │
│    1. Create isolated workspace (temp directory)                │
│    2. POST goal to Planner → get plan with complexity estimates │
│    3. Auto-approve and publish plan                             │
│    4. Create Forge run from plan_ref                            │
│    5. Execute run (Forge spawns Claude agents)                  │
│    6. Verify success criteria (code runs, tests pass)           │
│    7. Collect outcomes from Tuner                               │
│    8. Record metrics (time, tokens, cost, accuracy)             │
│    9. Cleanup workspace                                         │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  Output:                                                        │
│    - Per-scenario results (pass/fail, metrics)                  │
│    - Aggregate statistics across iterations                     │
│    - Tuner learning curves (accuracy over time)                 │
│    - Complexity estimate accuracy report                        │
└─────────────────────────────────────────────────────────────────┘
```

## Pipeline Flow

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   PLANNER   │─────▶│    FORGE    │─────▶│    TUNER    │
│             │      │             │      │             │
│ • Creates   │      │ • Reads     │      │ • Collects  │
│   plan      │      │   config    │      │   outcomes  │
│ • Estimates │      │ • Executes  │      │ • Updates   │
│   complexity│      │   tasks     │      │   baselines │
│ • Detects   │      │ • Emits     │      │ • Detects   │
│   language  │      │   outcomes  │      │   drift     │
└─────────────┘      └─────────────┘      └─────────────┘
       ▲                                        │
       └────────────────────────────────────────┘
              Tuner config feedback loop
```

## Scenario Definition

Each scenario defines:
- **Goal**: Natural language description for Planner
- **Expected characteristics**: Language tier, complexity level, step count
- **Verification method**: How to check if the result works
- **Success criteria**: What constitutes a pass

### Example: Tic-Tac-Toe

```typescript
{
  id: 'tic-tac-toe',
  name: 'Tic Tac Toe CLI',
  difficulty: 'simple',

  goal: 'Build a CLI that allows a user to play tic-tac-toe against themselves. Show the board after each move, detect wins/draws, allow restart.',

  expected: {
    language_tier: 's',           // TypeScript
    complexity_level: 'simple',   // 20-30 score
    step_count: { min: 3, max: 8 },
    time_minutes: { min: 5, max: 20 },
  },

  verification: {
    type: 'script',
    commands: [
      'npm install',
      'npm run build',
      'echo "1\n5\n2\n6\n3" | node dist/index.js'  // X wins
    ],
    expect_output: /X wins|Player 1 wins/i,
    expect_exit_code: 0,
  },
}
```

## Scenario Library

### Trivial (baseline - should always pass)

| ID | Goal | Verification |
|----|------|--------------|
| `fizzbuzz` | Print FizzBuzz from 1 to 100 | Output contains "Fizz", "Buzz", "FizzBuzz" |
| `hello-cli` | CLI that greets user by name from arg | `node index.js Alice` → "Hello, Alice!" |

### Simple

| ID | Goal | Verification |
|----|------|--------------|
| `tic-tac-toe` | Self-play tic-tac-toe CLI | Win detection works |
| `todo-cli` | Add/list/complete/delete todos | CRUD operations work |
| `calculator` | Calculator CLI with +,-,*,/ and tests | `npm test` passes |

### Moderate

| ID | Goal | Verification |
|----|------|--------------|
| `rest-api` | CRUD REST API for notes with SQLite | HTTP tests pass |
| `file-watcher` | Watch directory, log changes | Detects file changes |
| `markdown-parser` | Parse markdown to HTML | Sample files convert correctly |

### Complex (stretch goals)

| ID | Goal | Verification |
|----|------|--------------|
| `chat-server` | WebSocket chat with rooms | Multi-client test |
| `git-stats` | CLI that shows git repo statistics | Works on real repo |

## Metrics Collected

### Per-Run Metrics

| Metric | Source | Purpose |
|--------|--------|---------|
| `success` | Verification | Did it work? |
| `plan_step_count` | Planner | Plan size |
| `estimated_complexity` | Planner | Predicted difficulty |
| `estimated_time` | Planner | Predicted duration |
| `actual_time_seconds` | Forge | Real duration |
| `actual_tokens` | Forge | Token consumption |
| `actual_cost_usd` | Forge | Dollar cost |
| `tasks_succeeded` | Forge | Task success count |
| `tasks_failed` | Forge | Task failure count |
| `retries_used` | Forge | Recovery attempts |
| `model_used` | Forge | Which model(s) |

### Aggregate Metrics

| Metric | Calculation | Purpose |
|--------|-------------|---------|
| `success_rate` | passed / total | Overall reliability |
| `complexity_accuracy` | correlation(estimated, actual) | Estimation quality |
| `mean_cost` | avg(cost_usd) | Cost efficiency |
| `p95_time` | percentile(time, 95) | Worst-case duration |
| `learning_curve` | accuracy over iterations | Tuner improvement |

## Training Mode

For Tuner training, run scenarios multiple times:

```bash
# Run 10 iterations of simple scenarios
testbench train --scenarios trivial,simple --iterations 10

# Run overnight training
testbench train --scenarios all --iterations 100 --output results/overnight.json
```

Training mode:
1. Runs each scenario N times
2. Tracks Tuner baseline updates between iterations
3. Measures if accuracy improves over time
4. Generates learning curve visualization

## Verification Strategies

### 1. Script Verification
Run commands, check output/exit code:
```typescript
{
  type: 'script',
  commands: ['npm run build', 'node dist/index.js'],
  expect_output: /expected pattern/,
  expect_exit_code: 0,
}
```

### 2. Test Verification
Run test suite:
```typescript
{
  type: 'test',
  command: 'npm test',
  expect_exit_code: 0,
}
```

### 3. HTTP Verification
Test API endpoints:
```typescript
{
  type: 'http',
  setup: 'npm start &',
  requests: [
    { method: 'POST', url: '/notes', body: { title: 'Test' }, expect_status: 201 },
    { method: 'GET', url: '/notes', expect_body: /Test/ },
  ],
}
```

### 4. File Verification
Check file contents:
```typescript
{
  type: 'files',
  checks: [
    { path: 'dist/index.js', exists: true },
    { path: 'output.txt', contains: 'expected content' },
  ],
}
```

## CLI Interface

```bash
# Run single scenario
testbench run tic-tac-toe

# Run scenario category
testbench run --category simple

# Run all scenarios once
testbench run --all

# Training mode (multiple iterations)
testbench train --iterations 10 --scenarios simple,moderate

# View results
testbench report results/latest.json

# Compare runs
testbench compare results/before.json results/after.json
```

## Configuration

```typescript
// testbench.config.ts
export default {
  // Service URLs
  planner_url: process.env.PLANNER_URL || 'http://localhost:3001',
  forge_url: process.env.FORGE_URL || 'http://localhost:3002',
  tuner_url: process.env.TUNER_URL || 'http://localhost:4002',

  // Execution settings
  workspace_base: '/tmp/testbench',
  default_timeout_minutes: 30,
  auto_approve_plans: true,
  cleanup_on_success: true,
  cleanup_on_failure: false,  // Keep failed workspaces for debugging

  // Parallel execution
  max_parallel: 1,  // Start sequential, can increase later

  // Output
  results_dir: './results',
  save_artifacts: true,  // Keep generated code
}
```

## Success Criteria for Testbench Itself

1. **Reliability**: Can run 100+ iterations without crashing
2. **Isolation**: Each run is independent, no cross-contamination
3. **Metrics**: Captures all relevant data for analysis
4. **Reporting**: Clear pass/fail with actionable details
5. **Automation**: No human intervention required for training loops

## Open Questions

1. **Agent mocking**: For faster iteration, should we have a "mock mode" that doesn't actually spawn Claude agents but simulates execution?

2. **Baseline enforcement**: Should trivial scenarios (fizzbuzz) be required to pass before running others?

3. **Failure analysis**: When a scenario fails, how much debugging info do we capture? Full agent transcripts?

4. **Cost limits**: Should there be a per-scenario or per-run cost cap to prevent runaway spending?

5. **Regression detection**: Should we track historical pass rates and alert on regression?

## Implementation Phases

### Phase 1: MVP
- Scenario runner with isolated workspaces
- Script verification only
- CLI for single scenario execution
- Basic JSON results output

### Phase 2: Training Mode
- Multi-iteration execution
- Metrics collection and aggregation
- Learning curve tracking
- Simple report generation

### Phase 3: Full Suite
- All verification strategies (HTTP, files, tests)
- Parallel execution
- Comparison tooling
- Historical tracking

### Phase 4: Integration
- CI/CD integration
- Scheduled nightly runs
- Regression alerting
- Dashboard visualization

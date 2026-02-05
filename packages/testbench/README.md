# @plannr/testbench

End-to-end pipeline testbench for the Planner, Forge, and Tuner stack. Runs predefined scenarios to verify integration, train Tuner with execution data, and measure complexity estimation accuracy.

## Commands

```bash
# Run a single scenario
testbench run fizzbuzz

# Run all scenarios of a difficulty
testbench run --category trivial

# Run all scenarios
testbench run --all

# Mock mode (no external services needed)
testbench run fizzbuzz --mock

# Save results to file
testbench run --all --mock --output results/latest.json

# Training mode (multiple iterations)
testbench train --iterations 10 --mock
testbench train --iterations 5 --category simple --output results/training.json

# View saved results
testbench report results/latest.json
```

## Configuration

Create `testbench.config.json` in your working directory:

```json
{
  "planner_url": "http://localhost:3001",
  "forge_url": "http://localhost:3002",
  "tuner_url": "http://localhost:4002",
  "workspace_base": "/tmp/testbench",
  "default_timeout_minutes": 30,
  "auto_approve_plans": true,
  "cleanup_on_success": true,
  "cleanup_on_failure": false,
  "results_dir": "./results"
}
```

Environment variables override config file values:

| Variable | Config field |
|----------|-------------|
| `PLANNER_URL` | `planner_url` |
| `FORGE_URL` | `forge_url` |
| `TUNER_URL` | `tuner_url` |
| `TESTBENCH_TIMEOUT` | `default_timeout_minutes` |
| `TESTBENCH_WORKSPACE` | `workspace_base` |
| `TESTBENCH_RESULTS_DIR` | `results_dir` |

## Mock vs Real Mode

**Mock mode** (`--mock`): Generates synthetic results without calling external services. Fast, free, good for testing the testbench itself.

**Real mode** (default): Calls Planner API to create plans, Forge to execute, and Tuner to collect outcomes. Requires all services running. Costs money when agents are spawned.

## Creating Scenarios

Add JSON files to the `scenarios/` directory:

```json
{
  "id": "my-scenario",
  "name": "My Scenario",
  "difficulty": "simple",
  "goal": "Create a CLI that does X, Y, Z",
  "expected": {
    "language_tier": "s",
    "complexity_level": "simple",
    "step_count": { "min": 2, "max": 6 },
    "time_minutes": { "min": 3, "max": 15 }
  },
  "verification": {
    "type": "script",
    "commands": ["node index.js"],
    "expect_output": "expected pattern",
    "expect_exit_code": 0
  }
}
```

### Verification types

- **script**: Run shell commands, check output patterns and exit codes
- **test**: Run `npm test` (or custom command), check exit code
- **http**: Start server, send HTTP requests, check responses (future)
- **file**: Check file existence and contents (future)

## Starter Scenarios

| ID | Difficulty | Description |
|----|-----------|-------------|
| `fizzbuzz` | trivial | Print FizzBuzz 1-100 |
| `hello-cli` | trivial | Greet user by name |
| `tic-tac-toe` | simple | Self-play CLI game |
| `todo-cli` | simple | CRUD todo list |
| `calculator` | moderate | Calculator with tests |

## Development

```bash
npm install
npm run build
npm test
```

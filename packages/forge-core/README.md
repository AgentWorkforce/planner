# @plannr/forge-core

Plan execution and orchestration engine. Compiles immutable plans into executable runs, spawns agents for tasks, tracks progress, and handles retries/failures.

## Architecture

Forge is the "do" layer: it consumes approved plans from Planner and executes them using agent workers.

**Key concepts:**

- **Run**: A stateful execution instance of a plan (one plan can have multiple runs)
- **Task**: A single executable unit of work derived from a plan step
- **Orchestrator**: Schedules and dispatches tasks based on dependencies and agent availability
- **Gate**: A human approval checkpoint between tasks
- **Question**: Agent request for human input (blocking or non-blocking)
- **Checkpoint**: Snapshot of run state for recovery/rollback
- **Trajectory**: Immutable audit log of all run events (decisions, progress, tool calls)
- **Guardian**: Monitoring service that watches for run health issues

## Execution Modes

Forge supports three execution modes:

| Mode | Purpose | Agent Spawning |
|------|---------|----------------|
| `test` | Mock execution for testing | Simulated (no real agents) |
| `training` | Generate training data for Tuner | Simulated (fast, controlled) |
| `real` | Production execution | Spawns real agents via agent-relay |

Set via `FORGE_MODE` env var or config.

## Integration

Mount as an Express plugin:

```typescript
import { createForgeService } from '@plannr/forge-core';

const forge = createForgeService({
  dbPath: './forge.db',
  tunerUrl: 'http://localhost:4002', // Optional: enables outcome reporting
  mode: 'real',
  spawnTask: async (task) => {
    // Your agent spawning logic (e.g., via relay)
  },
  terminateAgent: async (agentId) => {
    // Your agent cleanup logic
  },
  forgeConfigPath: './forge.config.yaml', // Optional: role/scope mapping
});

await forge.initialize();
app.use('/api/forge', forge.router);

// Shutdown
forge.shutdown();
```

## API Endpoints

### Runs
```
POST   /runs                        # Create run from plan
GET    /runs/:id                    # Get run details
GET    /runs/:id/tasks              # List tasks
POST   /runs/:id/start              # Start execution
POST   /runs/:id/pause              # Pause execution
POST   /runs/:id/resume             # Resume paused run
POST   /runs/:id/cancel             # Cancel run
```

### Tasks
```
GET    /tasks/:id                   # Get task details
POST   /tasks/:id/retry             # Retry failed task
```

### Gates & Questions
```
GET    /runs/:id/gates              # List gates
POST   /gates/:id/approve           # Approve gate
POST   /gates/:id/reject            # Reject gate
GET    /runs/:id/questions          # List questions
POST   /questions/:id/answer        # Answer question
```

### Trajectory
```
GET    /runs/:id/trajectory         # Full event log
GET    /tasks/:id/trajectory        # Task-specific events
```

## MCP Tools

Forge provides MCP tools for agents to self-report progress:

- `report_progress`: Update task status with progress percentage
- `report_complete`: Mark task as completed
- `report_blocked`: Signal a blocker (dependency, resource, etc.)
- `request_human_input`: Ask a question (blocking or advisory)
- `record_decision`: Log a decision for audit trail
- `report_audit_result`: Submit audit findings (e.g., from design system validation)

## CLI

```bash
forge run create <plan-id>           # Create run from plan
forge run start <run-id>             # Start execution
forge run status <run-id>            # Show run status
forge question answer <q-id> <text>  # Answer question
forge gate approve <gate-id>         # Approve gate
forge trajectory <run-id>            # Show event log
```

## Exports

### Domain Types
- `Run`, `Task`, `Gate`, `Question`, `Checkpoint`, `TrajectoryEvent`
- `RunStatus`, `TaskStatus`, `GateStatus`, `QuestionStatus`

### Storage
- `ForgeStorage`, `createForgeStorage`

### Services
- `createRunService`, `createOrchestrator`, `createTestExecutor`
- `TrajectoryCapture`

### MCP
- `createForgeMCPServer`

### API
- `createForgeRouter`

## Development

```bash
npm run build      # Compile TypeScript
npm run typecheck  # Type checking only
```

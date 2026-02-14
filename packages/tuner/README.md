# tuner

Adaptive learning loop for model selection and execution optimization. Consumes execution outcomes from Forge, Planner, and Ideation to generate optimized configurations.

## Purpose

Tuner learns from real execution data to answer:

- Which model (Haiku, Sonnet, Opus) should handle this task?
- How long will this task take?
- What complexity estimation weights should Planner use?
- What retry/timeout settings should Forge use?

It implements a continuous improvement cycle: observe outcomes → detect drift → generate new baseline configs → deploy.

## Architecture

**Key concepts:**

- **Outcome**: A completed task/run with actual duration, cost, success/failure
- **Baseline**: Reference configuration snapshot (model selection rules, budgets, weights)
- **Drift**: Detected divergence between baseline predictions and actual outcomes
- **Config Generation**: Produces `ForgeExecutionConfig`, `PlannerConfig`, `IdeationConfig` from learned data

**Integration points:**

- **Forge** → sends task/run outcomes after execution
- **Planner** → sends plan quality signals (was complexity estimate accurate?)
- **Ideation** → sends session outcomes (specialist spawn decisions, handoff readiness)

## Service Integration

```typescript
import { createTunerServices } from 'tuner';

const tuner = createTunerServices({
  dbPath: './tuner.db',
});

app.use('/api/tuner', tuner.router);

// Shutdown
tuner.shutdown();
```

## API Endpoints

### Outcomes (data ingestion)
```
POST   /outcomes/task               # Submit task outcome from Forge
POST   /outcomes/run                # Submit run outcome from Forge
POST   /outcomes/plan               # Submit plan quality signal from Planner
POST   /outcomes/session            # Submit session outcome from Ideation
```

### Configuration (config generation)
```
GET    /config/forge                # Get latest ForgeExecutionConfig
GET    /config/planner              # Get latest PlannerConfig
GET    /config/ideation             # Get latest IdeationConfig
GET    /baselines/:id               # Get specific baseline snapshot
```

### Insights (analytics)
```
GET    /insights/model-performance  # Model accuracy/cost analysis
GET    /insights/drift              # Detected drift events
GET    /insights/complexity         # Complexity estimation accuracy
```

## TunerClient

For Forge/Planner/Ideation to integrate with Tuner:

```typescript
import { createTunerClient } from 'tuner';

const tuner = createTunerClient({ baseUrl: 'http://localhost:4002' });

// Submit outcome
await tuner.submitTaskOutcome({
  task_id: '...',
  duration_seconds: 120,
  tokens_used: 5000,
  model_used: 'claude-sonnet',
  success: true,
});

// Get config
const config = await tuner.getForgeConfig();
console.log(config.model_selection.default_model); // 'claude-sonnet'
```

## CLI

```bash
tuner baseline create              # Create baseline snapshot
tuner config generate              # Generate new configs from outcomes
tuner drift detect                 # Check for drift
tuner insights model-performance   # Show model stats
```

## Configuration Strategy

Tuner generates three config types:

### ForgeExecutionConfig
- Model selection rules (complexity → model mapping)
- Budget limits (time, tokens, cost)
- Retry policies (max retries, backoff)
- Parallelism settings

### PlannerConfig
- Complexity estimation weights
- Language tier multipliers
- Auto-decomposition thresholds
- Max steps/depth limits

### IdeationConfig
- Interviewer model selection
- Specialist spawn thresholds
- Confidence calibration
- Readiness advisory rules

## Drift Detection

Tuner monitors for:

- **Model performance drift**: Haiku starts failing on tasks it used to handle
- **Estimation drift**: Planner's complexity estimates become inaccurate
- **Cost drift**: Execution costs increase beyond baseline
- **Time drift**: Tasks take significantly longer than predicted

When drift is detected, Tuner flags it and can trigger config regeneration.

## Exports

### Domain Types
- `ForgeExecutionConfig`, `PlannerConfig`, `IdeationConfig`
- `TaskOutcome`, `RunOutcome`, `Baseline`, `DriftEvent`

### Client
- `TunerClient`, `createTunerClient`

### Services
- `createTunerServices` (service factory)

### Integrations
- `ForgeIntegration`, `PlannerIntegration`, `IdeationIntegration`

## Development

```bash
npm run build      # Compile TypeScript
npm run start      # Run standalone server
npm test           # Run tests
npm run typecheck  # Type checking only
```

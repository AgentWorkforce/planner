# Planner Core

Plan authoring and versioning engine for the agentic system.

## What This Is

The **Planner** layer accepts any expression of intent (vague idea to detailed spec), refines it through AI conversation, and produces versioned, immutable plans for orchestrator consumption. It handles the "what should happen" — not the execution.

## Core Concepts

### Domain Model

- **Plan**: Top-level container with metadata (`plan_id`, `initiative_id`, `title`)
- **PlanVersion**: Immutable snapshot of a plan at a point in time (versioned, status-based lifecycle)
- **Step**: Individual work item with dependencies, acceptance criteria, and optional sub-plans
- **Understanding**: AI-generated analysis of confidence, observations, and ambiguities
- **Context**: Role-based context and domain specifications

### Lifecycle States

```
draft → submitted → approved → published
```

- `draft`: Editable (working or submitted for review)
- `approved`: Locked, immutable
- `published`: Released to orchestrator for execution

### DOT Framework

Dynamic Orchestration & Tuning provides adaptive model selection based on task characteristics:

- **Complexity Estimation**: Scores tasks on scale (0-100) with level mapping (trivial/simple/moderate/complex/expert)
- **Language Tier Detection**: Maps languages to tiers (A-E) with multipliers for resource allocation
- **Task Contracts**: Input/output schemas with validation rules
- **Decomposition Config**: Limits for step count, depth, and auto-decomposition thresholds

## API Routes

All routes mounted at `/api` when used as a plugin:

```
GET    /plans                                    # List plans with filters
POST   /plans                                    # Create new plan
GET    /plans/:id                                # Get plan with latest version
GET    /plans/:id/versions                       # List all versions
GET    /plans/:id/versions/:version              # Get specific version
POST   /plans/:id/versions/:version/submit       # Submit for review
POST   /plans/:id/versions/:version/approve      # Approve and lock
POST   /plans/:id/versions/:version/publish      # Publish for execution
PATCH  /plans/:id                                # Update plan metadata
DELETE /plans/:id                                # Delete plan
```

Additional endpoints: questions, comments, diffs, attentions, change requests.

## Key Exports

### Plugin Interface

```typescript
import { createPlannerService } from 'planner-core';

const planner = createPlannerService({ dbPath: './planner.db' });
await planner.initialize();
app.use('/api', planner.router);

// Access storage for relay services
const storage = planner.getStorage();

// Access Tuner client for DOT framework
const tuner = planner.getTunerClient();
```

### Domain Models

```typescript
import {
  Plan, PlanVersion, Step,
  createPlan, createPlanVersion, createStep
} from 'planner-core';
```

### Storage Layer

```typescript
import { SqliteStorage } from 'planner-core';

const storage = new SqliteStorage('./planner.db');
const plans = storage.listPlans();
```

### DOT Services

```typescript
import {
  ComplexityEstimatorService,
  LanguageTierDetector,
  ContractValidator,
  PlannerLimitsEnforcer,
} from 'planner-core';
```

## Configuration

Environment variables:

- `TUNER_URL`: Enable Tuner integration for DOT framework config (default: disabled)
- `ANTHROPIC_API_KEY`: Required for AI-assisted planning features

## Development

```bash
npm run build      # Compile TypeScript
npm test           # Run test suite
npm run typecheck  # Type checking only
```

## Design Principles

1. **Immutability After Approval**: Approved versions cannot change; create new version instead
2. **Structured Over Freeform**: Plans have schema, steps have IDs, dependencies are explicit
3. **Human-in-the-Loop**: Gates and approval workflows are first-class
4. **Multi-Scope Default**: Real work crosses repos/teams/domains

## References

- [Architecture Docs](../../docs/architecture.md)
- [DOT Framework](../../docs/dot-framework.md)
- [CLAUDE.md](../../CLAUDE.md) - Project patterns and conventions

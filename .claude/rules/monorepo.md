# Monorepo Structure

## Package Inventory

### Backend Packages

| Package | Path | Purpose |
|---------|------|---------|
| `planner` | `packages/planner/` | Core plan authoring, versioning, storage |
| `server` | `packages/server/` | Meta-server mounting all plugins, relay integration |
| `ideation` | `packages/ideation/` | Brainstorming, interviewer agents, nugget crystallization |
| `forge-core` | `packages/forge-core/` | Orchestration engine, task spawning, result handling |
| `tuner` | `packages/tuner/` | Adaptive learning, config generation, drift detection |
| `testbench` | `packages/testbench/` | End-to-end pipeline testing, scenario runners |

### Frontend Packages

| Package | Path | Port | Purpose |
|---------|------|------|---------|
| `planner-ui` | `packages/planner-ui/` | 3000 | Plan authoring UI |
| `ideation-ui` | `packages/ideation-ui/` | 3002 | Brainstorming sessions UI |
| `forge-ui` | `packages/forge-ui/` | 3003 | Orchestration monitoring UI |

### Shared Packages

| Package | Path | Purpose |
|---------|------|---------|
| `shared-ui` | `packages/shared-ui/` | Design system, shared components, theme preset |
| `storage-base` | `packages/storage-base/` | SQLite storage abstraction base class |
| `errors` | `packages/errors/` | Centralized error types (HttpError, NotFoundError, BadRequestError, etc.) |

## Architecture

- `server` is the meta-server that mounts planner, ideation, and forge as Express plugins
- Each domain has its own SQLite database: `planner.db`, `ideation.db`, `forge.db`
- Shared packages provide common abstractions used by all domain packages
- Frontend apps each extend `@plannr/shared-ui/theme/tailwind-preset.cjs`

## Workspace Commands

```bash
# Backend
npm run start -w server              # Start backend (port 3001)

# Frontend apps
npm run dev -w planner-ui            # Start planner frontend (port 3000)
npm run dev -w ideation-ui           # Start ideation frontend (port 3002)
npm run dev -w forge-ui              # Start forge frontend (port 3003)

# Testing
npm test                             # Run all tests
npm test -w planner                  # Run tests for specific package

# Development environment
scripts/dev.sh                       # Start all services together
```

## Port Assignments

| Port | Service | Type |
|------|---------|------|
| 3000 | planner-ui | Vite |
| 3001 | server | Express |
| 3002 | ideation-ui | Vite |
| 3003 | forge-ui | Vite |
| 4002 | tuner | Express |

All frontend apps proxy `/api` → `localhost:3001`

## Package Dependency Flow

```
planner-ui ──→ shared-ui
ideation-ui ─→ shared-ui
forge-ui ────→ shared-ui

server ──────→ planner, ideation, forge-core

planner ─────→ storage-base, errors
ideation ────→ storage-base, errors
forge-core ──→ storage-base, errors
tuner ───────→ storage-base, errors
testbench ───→ storage-base, errors
```

## Cross-Package Rules

### Imports
- Use package names: `import { X } from '@plannr/shared-ui'`
- Never use relative paths across package boundaries
- Shared types belong in the package that owns the domain

### Backend Packages
- Export Express router factory: `createRouter(storage)` or similar
- Initialize own storage with migrations
- Return router for server to mount

### Frontend Packages
- Extend `@plannr/shared-ui/theme/tailwind-preset.cjs`
- Add Vite config with proxy to `:3001`
- Use shared UI components from `@plannr/shared-ui`

### Adding New Packages
1. Create package directory in `packages/`
2. Add `package.json` with `@plannr/` scope
3. Add to root `tsconfig.json` references
4. Add to workspace commands if needed

## Plugin Architecture

Each backend domain exports a router factory:

```typescript
// packages/planner/src/routes.ts
export function createRouter(storage: PlanStorage): Router {
  const router = express.Router();
  // ... routes
  return router;
}
```

Server mounts them:

```typescript
// packages/server/src/index.ts
import { createRouter as createPlannerRouter } from '@plannr/planner';

app.use('/api/plans', createPlannerRouter(planStorage));
```

Each domain initializes its own storage with migrations.

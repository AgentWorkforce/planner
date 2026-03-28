# Development Environment

## dev.sh Script

The `dev.sh` script manages the full development environment with PID tracking and graceful shutdown:
- Agent-relay daemon (`agent-relay up --dashboard`)
- Backend server on port 3001 (`npm run start -w server`)
- Planner UI on port 3000 (Vite)
- Ideation UI on port 3002 (Vite)
- Forge UI on port 3003 (Vite)
- Tuner service on port 4002

**Backend startup**: `npm run start -w server` runs `tsx packages/server/src/server.ts`. Do NOT use `npm run dev` recursively—causes infinite loops.

## Testing

- **Framework**: Vitest (matches relay stack)
- **Playwright**: 1.58.1 available for E2E testing
- **Backend tests**: `vitest.config.ts` at root, covers packages/planner, server, ideation
- **Frontend tests**: Per-package Vitest + jsdom + React Testing Library
- **Test databases**: In-memory SQLite (`:memory:`) for isolation
- **Commands**:
  - `npm test` (all packages)
  - `npm test -w planner` (specific package)
- **Mocking**: Use `vi.mock()` to isolate unit/integration tests
- **tsconfig.json**: Exclude test files (`.test.ts`) from build output; Vitest handles transpilation separately
- **Kill hanging tests**: Terminate test runner process if it hangs or doesn't exit

## Path Aliases & Imports

- **Consistent casing**: macOS is case-insensitive but case-preserving. Use consistent casing for path aliases to avoid issues on Linux CI or case-sensitive filesystems.
  ```typescript
  // Pick one convention and stick to it
  import { Button } from '@/components/ui/button';  // lowercase (recommended)
  import { Button } from '@/components/ui/Button';  // PascalCase
  // Don't mix both in the same codebase
  ```
- **tsconfig paths**: Ensure `paths` in `tsconfig.json` match actual directory structure casing

## API Design

- **Framework**: Express 5.2.1 (not v4)
- **Routes**: Multi-domain structure
  - `/api/plans/*` - Planner domain
  - `/api/ideation/sessions/*` - Ideation domain
  - `/api/forge/runs/*` - Forge domain
- **Validation**: Use Zod schemas per domain (`CreatePlanRequestSchema`, `ListPlansQuerySchema`, etc.)
- **Type exports**: Export TypeScript types from Zod schemas for consistency
- **Response format**: `{ data: T }` or `{ plans: T[] }` with typed generics
- **Error handling**: Use `@plannr/errors` package for structured error types
- **Middleware stack**:
  1. CORS
  2. JSON parser
  3. Timeout
  4. Plan channel middleware
  5. QA channel middleware
  6. Routes
  7. Error handler
- **Plan updates**: Plan-level attributes (`initiative_id`) should be independently updateable; don't block on version status for non-version fields

## Migrations

- **Idempotency**: Migration scripts must be safe to re-run
- **Deterministic UUIDs**: For stable identifiers, use `uuid5` based on feature IDs rather than `crypto.randomUUID()` to avoid duplicate data on re-runs
- **Conflict resolution**: Use `INSERT OR REPLACE` logic when appropriate

## Environment Variables

```bash
# Server
PORT=3001                      # HTTP server port

# Databases
DB_PATH=./planner.db           # Planner database path
IDEATION_DB_PATH=./ideation.db # Ideation database path
FORGE_DB_PATH=./forge.db       # Forge database path

# AI & Integration (optional)
ANTHROPIC_API_KEY              # Enables AI mode (mock if missing)
TUNER_URL                      # Enables tuner integration

# Execution mode
FORGE_MODE=test|real           # Execution mode (default: based on relay connection)
```

**Configuration via .env**: Standard practice for sensitive values

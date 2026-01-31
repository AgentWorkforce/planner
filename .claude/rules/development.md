# Development Environment

## dev.sh Script

The `dev.sh` script manages the development environment:
- Starts/stops agent-relay daemon
- Backend API (using `tsx watch` for hot-reload)
- Frontend (Vite)

**Backend startup**: Use `npm run start` (which runs `tsx src/server.ts`), not `npm run dev` recursively—this causes infinite loops.

## Testing

- **Framework**: Vitest (matches relay stack)
- **Mocking**: Use `vi.mock()` to isolate unit/integration tests
- **tsconfig.json**: Exclude test files (`.test.ts`) from build output; Vitest handles transpilation separately
- **Kill hanging tests**: Terminate test runner process if it hangs or doesn't exit

## API Design

- **Validation**: Use Zod schemas (`CreatePlanRequestSchema`, `ListPlansQuerySchema`) for request/query validation
- **Type exports**: Export TypeScript types from Zod schemas for consistency
- **Plan updates**: Plan-level attributes (`initiative_id`) should be independently updateable; don't block on version status for non-version fields
- **Error types**: Use `ApiError` for specific error handling

## Migrations

- **Idempotency**: Migration scripts must be safe to re-run
- **Deterministic UUIDs**: For stable identifiers, use `uuid5` based on feature IDs rather than `crypto.randomUUID()` to avoid duplicate data on re-runs
- **Conflict resolution**: Use `INSERT OR REPLACE` logic when appropriate

## Environment Variables

- **ANTHROPIC_API_KEY**: Controls whether PlannerLead runs in real AI mode or mock mode
- **Configuration via .env**: Standard practice for sensitive values

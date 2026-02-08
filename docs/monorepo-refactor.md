# Monorepo Refactor Plan

> Analysis date: 2026-02-05
> Branch: `jahala/initial-planner`
> Codebase: ~196K lines (152K code), 10 packages, 3 domains

---

## Current State

### Package Map

| Package | Type | LOC (approx) | Purpose |
|---------|------|--------------|---------|
| `planner` | Backend | ~5K | Plan authoring, versioning, workflow (draft → approved → published) |
| `ideation` | Backend | ~3K | Brainstorming sessions, specialist agents, understanding extraction |
| `forge-core` | Backend | ~6K | Execution engine: DAG walking, agent spawning, budget, health monitoring |
| `server` | Backend | ~8K | Meta-server mounting planner/ideation/forge + relay integration |
| `tuner` | Backend | ~2K | Adaptive learning loop, metrics collection |
| `testbench` | CLI Tool | ~3K | E2E pipeline testing (Planner → Forge → Tuner) |
| `planner-ui` | Frontend | ~44K | Plan editor, swimlane view, initiatives, pipeline |
| `ideation-ui` | Frontend | ~15K | Brainstorming UI with physics-based visualization |
| `forge-ui` | Frontend | ~12K | Execution monitoring, task status, agent tracking |
| `shared-ui` | Library | ~5K | Shared components, tokens, icons, Tailwind preset |

### Architecture (what's good)

- Clean plugin pattern: each domain (planner, ideation, forge) owns its storage, API routes, and domain logic
- Minimal cross-package coupling (only 1 explicit `file:` dependency: `ideation-ui` → `shared-ui`)
- Type-safe domain models with Zod validation throughout
- JSONB columns for LLM consumption (plans stored as self-contained JSON documents)
- Relay integration is gracefully optional (mock mode when daemon unavailable)
- SSE for real-time plan updates, WebSocket for agent messaging
- Graceful degradation: server starts and works even without relay/orchestrator

---

## Phase 1: Monorepo Foundation

### 1.1 Add npm Workspaces

**Problem:** No workspace configuration. Cross-package references use `--prefix` flags in scripts. Dependencies duplicated in each package.json. No hoisting.

**Direction:**
- Add `"workspaces"` field to root `package.json` pointing to `packages/*`
- Rename root package from `planner-core` to `@plannr/monorepo` (currently collides with `packages/planner` which is also `planner-core`)
- Replace `file:../shared-ui` reference in `ideation-ui` with `workspace:*` protocol
- Remove `--prefix` flags from root scripts; use workspace commands instead (`npm run -w packages/planner build`)
- Run `npm install` once to hoist shared dependencies

**Note on Turbo:** Turbo would add build caching and parallel task orchestration on top of npm workspaces. Evaluate after workspaces are stable — it's additive, not a prerequisite.

### 1.2 Unify TypeScript Configuration

**Problem:** Three different strictness profiles exist across packages:

| Strictness | Packages | Missing Flags |
|------------|----------|---------------|
| High | planner, ideation, shared-ui | (baseline) |
| Medium | server, forge-core, tuner, testbench | `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noUncheckedIndexedAccess`, `resolveJsonModule` |
| Frontend | planner-ui, ideation-ui, forge-ui | Different target/module (expected), but also missing strict flags |

Root `tsconfig.json` only references 3 of 10 packages, breaking cross-project type checking.

**Direction:**
- Create `tsconfig.base.json` at root with the strictest shared settings:
  ```
  strict: true
  noImplicitReturns: true
  noFallthroughCasesInSwitch: true
  noUncheckedIndexedAccess: true
  resolveJsonModule: true
  skipLibCheck: true
  ```
- Create `tsconfig.node.json` extending base with `module: "NodeNext"`, `target: "ES2022"`
- Create `tsconfig.vite.json` extending base with `module: "ESNext"`, `target: "ES2020"`, `moduleResolution: "bundler"`, `noEmit: true`
- Each package extends the appropriate base
- Update root `tsconfig.json` references to include all 10 packages

### 1.3 Add ESLint + Prettier

**Problem:** No linting or formatting configured anywhere in 152K lines of code. Style drift is already visible (inconsistent import ordering, mixed semicolon usage in some files).

**Direction:**
- Root-level ESLint flat config (`eslint.config.js`) with TypeScript and React plugins
- Root-level `.prettierrc` with consistent settings
- Per-package overrides only where truly needed (e.g., frontend vs backend rules)
- Add `lint` and `format` scripts to root package.json
- Don't try to fix all existing violations at once — add `// eslint-disable` comments for existing issues and fix incrementally

### 1.4 Normalize Vite Configs

**Problem:** Inconsistency across three frontend packages:

| Setting | planner-ui | ideation-ui | forge-ui |
|---------|-----------|-------------|----------|
| `/ws/*` proxy target | `http://localhost:3001` | `ws://localhost:3001` | `ws://localhost:3001` |
| SSE buffering config | No | Yes | No |
| `changeOrigin` on WS | Yes | No | No |

Functionally, `http://` + `ws: true` works (Vite's http-proxy handles the upgrade), but it's inconsistent. The SSE buffering config in ideation-ui is likely needed in planner-ui too (plan events use SSE).

**Direction:**
- Standardize all WebSocket proxies to use `ws://` target for clarity
- Add SSE buffering prevention (`x-accel-buffering: no`) to planner-ui's proxy config for `/api` (plan events endpoint)
- Remove `changeOrigin` from WebSocket proxies (not meaningful for WS upgrades)
- Consider extracting shared proxy config to a `vite.shared.ts` if configs continue to diverge

### 1.5 Fix Dependency Version Drift

**Problem:** Minor version mismatches across packages:

| Dependency | Versions Found |
|------------|---------------|
| `tsx` | ^4.21.0 (planner, ideation) vs ^4.19.0 (server) |
| `cors` | ^2.8.6 (planner, ideation) vs ^2.8.5 (server) |
| `@radix-ui/react-toggle` | ^1.1.10 (planner-ui) vs ^1.1.2 (ideation-ui) |
| `@radix-ui/react-toggle-group` | ^1.1.11 (planner-ui) vs ^1.1.2 (ideation-ui) |

**Direction:**
- After npm workspaces are enabled, hoisting will resolve most of this
- Audit remaining mismatches and align to latest versions
- Consider a root-level `overrides` field in package.json for critical shared deps

---

## Phase 2: Eliminate Duplication

### 2.1 Extract `@plannr/storage-base`

**Problem:** Four independent SQLite storage implementations with no shared base:

| Package | File | Lines | Patterns Repeated |
|---------|------|-------|-------------------|
| planner | `src/storage/sqlite.ts` | 1,830 | WAL init, JSONB helpers, transactions, migration runner |
| forge-core | `src/storage/sqlite.ts` | 2,059 | Same patterns, different entities |
| ideation | `src/storage/sqlite.ts` | 528 | Same patterns, simpler |
| tuner | `src/storage/sqlite.ts` | 669 | Same patterns, simpler |

Each one independently configures WAL mode, sets up `better-sqlite3`, implements transaction helpers, handles JSONB column serialization/deserialization, and runs migrations.

**Direction:**
- New package `packages/storage-base` (or add to an existing `@plannr/common` package)
- Shared base class providing:
  - Database initialization (WAL mode, foreign keys, journal settings)
  - Transaction wrapper (`transaction<T>(fn: () => T): T`)
  - JSONB serialization helpers (`toJsonb()`, `fromJsonb()`)
  - Migration runner with idempotency checks
  - Common query patterns (paginated list, count, exists)
- Each domain storage extends the base and adds only domain-specific queries
- Estimated reduction: ~1,500-2,000 lines of duplicated boilerplate

### 2.2 Extract `@plannr/errors`

**Problem:** Three different error handling approaches:
- Planner: `HttpError` class + Express error middleware (`middleware.ts`, 88 lines)
- Forge-core: Scattered try/catch with ad-hoc error responses
- Ideation: Yet another error style

No shared error types means each package invents its own status codes, error shapes, and validation error formatting.

**Direction:**
- New package `packages/errors` (or part of `@plannr/common`)
- Shared types: `HttpError`, `ValidationError`, `NotFoundError`, `ConflictError`
- Single Express error middleware that all backends mount
- Consistent error response shape:
  ```typescript
  { error: string; code: string; details?: unknown; status: number }
  ```
- ZodError formatting utility (already exists in planner, extract and share)

### 2.3 Make `planner-ui` Consume `shared-ui`

**Problem:** `ideation-ui` imports from `@plannr/shared-ui` but `planner-ui` does not. Both packages independently depend on the same Radix UI components (Dialog, Select, Toggle, ToggleGroup, etc.) and define similar base components.

**Direction:**
- Audit components in `planner-ui/src/components/ui/` against `shared-ui` exports
- Replace duplicates with `@plannr/shared-ui` imports
- Move any planner-ui components that are truly generic to shared-ui
- Add `@plannr/shared-ui` as workspace dependency to planner-ui's package.json
- Do the same audit for `forge-ui`

### 2.4 Deduplicate Tailwind Configuration

**Problem:** Three nearly identical `tailwind.config.cjs` files (4-5KB each). `shared-ui` already exports a Tailwind preset (`tailwind.preset.cjs`) but planner-ui and forge-ui don't use it.

**Direction:**
- Move the full theme definition (colors, spacing, animations, custom scales) into `shared-ui/tailwind.preset.cjs`
- Each frontend's `tailwind.config.cjs` becomes minimal: just the preset import + content paths
- CSS variables stay in each app's `globals.css` (they define the actual color values that the preset references)

### 2.5 Consolidate User ID Management

**Problem:** Two separate implementations of anonymous user ID creation:
- `packages/planner-ui/src/contexts/RelayContext.tsx` line ~29: `getOrCreateAnonymousUserId()`
- `packages/planner-ui/src/api/client.ts` line ~84: `getOrCreateUserId()`

Both use `sessionStorage` with different key names and slightly different logic.

**Direction:**
- Single `getUserId()` function in `src/lib/identity.ts` (or similar)
- Both RelayContext and API client import from same source
- Consistent storage key

### 2.6 Consolidate localStorage Keys

**Problem:** Storage keys are scattered across the codebase with no registry:

| Key | Used In |
|-----|---------|
| `planner-chat-{planId}` | useAIChat |
| `relay_anonymous_user_id` | RelayContext + client.ts |
| `planner-sidebar-collapsed` | PlanEditorPage |
| `planner_last_channel` | MessagingSidebar |
| `planner-messaging-sidebar-collapsed` | Layout |

Mix of kebab-case, snake_case, and inconsistent prefixing.

**Direction:**
- Create `src/config/storage-keys.ts` with all keys as constants
- Consistent naming convention: `plannr:{feature}:{key}`
- Optional: typed wrapper around localStorage (`getItem<T>`, `setItem<T>`)

---

## Phase 3: Break Up God Files

### 3.1 Split Storage Implementations

**Problem:** Single files with 1,800-2,000+ lines containing all storage methods for a domain.

**Direction for `packages/planner/src/storage/`:**

Current:
```
storage/
├── interface.ts    (180 lines - contract, fine as-is)
└── sqlite.ts       (1,830 lines - everything)
```

Target:
```
storage/
├── interface.ts         (contract)
├── sqlite/
│   ├── index.ts         (SqliteStorage class, delegates to partials)
│   ├── plans.ts         (plan CRUD methods)
│   ├── versions.ts      (version management, step DAG)
│   ├── workflow.ts      (submit, approve, publish)
│   ├── comments.ts      (comments, threading)
│   ├── questions.ts     (question queue)
│   ├── change-requests.ts
│   ├── trajectory.ts    (decision events)
│   └── organizations.ts (orgs, initiatives)
```

Each file exports methods that get mixed into the main class (or use a composition pattern where the class delegates to sub-services).

Apply same pattern to `forge-core/src/storage/sqlite.ts` (2,059 lines).

### 3.2 Split MCP Tools

**Problem:** `packages/server/src/mcp/tools/index.ts` — 1,457 lines containing 40+ tool definitions with inline business logic.

**Direction:**
```
mcp/tools/
├── index.ts          (registry: imports and exports tool array)
├── plan-tools.ts     (plan CRUD tools)
├── version-tools.ts  (version management tools)
├── workflow-tools.ts (submit, approve, publish tools)
├── step-tools.ts     (step editing tools)
├── comment-tools.ts  (comment tools)
└── query-tools.ts    (search, list, filter tools)
```

Each file exports an array of tool definitions. Index file concatenates them.

### 3.3 Split Planner Lead Tools

**Problem:** `packages/server/src/relay/planner-lead-tools.ts` — 1,051 lines, 40+ tool implementations.

**Direction:** Same approach as MCP tools. Group by concern, extract to separate files.

### 3.4 Break Up PlanEditorPage

**Problem:** `packages/planner-ui/src/pages/PlanEditorPage.tsx` — 29KB, 18+ state variables managed at page level, prop-drilled 3+ levels deep.

**Direction:**
- Create `PlanEditorContext` (or multiple contexts) to hold:
  - Step selection state: `expandedStepId`, `selectedStep`, `hoveredStepId`
  - Panel state: `activePanel`, `commentStepId`, `showChat`
  - Plan data: `plan`, `version`, `steps`, `refetch`
- Extract sub-pages/panels into their own files:
  - `StepPanel.tsx` (step list + editor)
  - `CommentPanel.tsx` (comment thread)
  - `ChatPanel.tsx` (AI chat)
- PlanEditorPage becomes a layout shell that provides context and arranges panels

### 3.5 Split Oversized Components

| Component | Lines | Split Into |
|-----------|-------|------------|
| `StepEditor.tsx` | 594 | `StepEditor`, `OwnerRoleSelector`, `StepSpecPicker`, `DependencySelector` |
| `SwimlaneView.tsx` | 557 | `SwimlaneView`, `SwimlaneHeader`, `ScopeColumn` |
| `ChatBubble.tsx` | 516 | `ChatBubble`, `QuestionAnswerForm`, `ChatMessageContent` |
| `ChannelMessageList.tsx` | 310 | `ChannelMessageList`, `MessageItem`, `MessageFormatter` |

---

## Phase 4: Backend Hardening

### 4.1 Add Feature Flags for Relay/Orchestrator

**Problem:** Server starts in mock mode when relay is unavailable, but some features silently degrade. Frontend shows "AI assist" checkbox even when no agents will spawn. No explicit capability checking.

**Direction:**
- API endpoint: `GET /api/capabilities` returning:
  ```json
  { "relay": true|false, "orchestrator": true|false, "ai": true|false }
  ```
- Frontend checks capabilities on load and disables unavailable features
- Backend guards relay-dependent operations with explicit checks rather than silent no-ops

### 4.2 Wire Orchestrator TODOs

**Problem:** Multiple incomplete integrations in `forge-core/src/services/orchestrator.ts`:
- `"TODO: get actual model from tracker"`
- `"TODO: wire to actual RunService counters"`
- `"TODO: from plan"`

**Direction:** Audit all TODO comments in forge-core, categorize as:
- Blocking (affects correctness) — fix now
- Enhancement (affects metrics quality) — track in backlog
- Dead (no longer relevant) — remove

### 4.3 Add Timeout Middleware

**Problem:** No request timeout handling in Express handlers. If a storage query or external call hangs, the request hangs indefinitely.

**Direction:**
- Add Express middleware with configurable per-route timeouts
- Default: 30 seconds for API routes, 5 minutes for long-polling/SSE
- Return 504 Gateway Timeout with clear error message

### 4.4 PlannerLead Recovery

**Problem:** PlannerLead is a persistent relay service. If it crashes, no new planning agents spawn. Recovery mechanism is unclear.

**Direction:**
- Add health check for PlannerLead (heartbeat or process monitoring)
- Auto-restart on crash with backoff
- Log clear error context when PlannerLead fails to spawn agents
- Consider making PlannerLead stateless enough to restart without losing in-progress work

---

## Phase 5: Frontend Hardening

### 5.1 Fill Missing Error/Loading States

**Problem:** Multiple TODO comments for missing error handling:

| File | Issue |
|------|-------|
| `ContextTab.tsx` (lines 168, 195, 224) | `// TODO: Show error toast` |
| `InitiativeTabs.tsx` (line 85) | `// TODO: Open New Initiative modal` |
| `comments.ts` (lines 55, 70) | `// TODO: Get user from auth context` (hardcoded 'User') |
| `PlanEditorPage.tsx` (line 777) | `// TODO: Get currentUser from auth context` |

**Direction:**
- Create a shared toast/notification system (or use an existing one from shared-ui)
- Audit all `// TODO` comments in frontend packages
- Add loading skeletons for: InitiativeDetailPage plan list, ChannelMessageList, DM channel creation
- Replace hardcoded user identity with the stub hook (`useCurrentUser()`) consistently

### 5.2 Remove Dead Code

| File | Issue |
|------|-------|
| `toggle-group.example.tsx` | Example file, no imports reference it |
| `ChatBubble.usage.md` | Documentation file in src/ |

**Direction:** Move examples/docs to a `docs/` or `stories/` directory, or remove if unused.

---

## Phase 6: Testbench Hardening

### 6.1 Import Types from Planner Package

**Problem:** Testbench redefines `PlanStep` and `PlanVersionResult` interfaces instead of importing from planner. Creates a parallel type system that can drift.

**Direction:**
- With npm workspaces enabled, testbench can depend on `planner` package directly
- Import `Step`, `PlanVersion` types from `@plannr/planner-core` (or however the planner package exports its types)
- Remove local type redefinitions
- Any testbench-specific extensions should use `Pick`/`Omit`/`Extend` on the source types

### 6.2 Reconsider Synthetic vs AI Mode

**Problem:** Default "synthetic" planning mode bypasses PlannerLead entirely, replacing real AI plan generation with hardcoded 2-step dummy plans. This means the testbench's "E2E" claim is misleading — it's really "Synthetic Planner → Forge → Tuner".

**Direction:**
- Rename modes for clarity: `synthetic` → `mock-planner`, `ai` → `full-pipeline`
- Document when each mode is appropriate:
  - `mock-planner`: Fast smoke tests, CI, verifying Forge/Tuner in isolation
  - `full-pipeline`: Real E2E validation, requires relay + PlannerLead running
- Consider making `full-pipeline` the default when relay is available

### 6.3 Add Retry Logic

**Problem:** No retry logic anywhere. Transient network errors fail immediately. PlannerLead timeout (90s) is hardcoded with no backoff.

**Direction:**
- Add configurable retry with exponential backoff for HTTP clients (PlannerClient, ForgeClient, TunerClient)
- Make PlannerLead wait timeout configurable via testbench config
- Add circuit breaker pattern: after N consecutive failures, skip remaining scenarios with clear error

### 6.4 Improve Metrics Accuracy

**Problem:**
- `estimated_complexity` averaged across all steps — doesn't reflect total plan complexity
- Correlation calculation mixes all scenarios — hides per-difficulty accuracy
- "80% success rate" in mock mode is arbitrary, no connection to reality
- Learning curve has no statistical significance testing

**Direction:**
- Group correlation by difficulty level (trivial, simple, moderate, complex)
- Track success/failure reasons separately (Forge failure vs verification failure)
- Add confidence intervals to learning curve metrics
- Make mock mode success rate configurable and documented as synthetic

---

## Phase 7: Architecture Improvements (Deferred)

These are worth tracking but not urgent:

### 7.1 Soft Deletes
Currently hard deletion. No recovery path if a plan or initiative is accidentally deleted. Add `deleted_at` column, filter by default, expose "trash" view.

### 7.2 Audit Trail
Plans have `created_at`/`updated_at` but no change tracking beyond version diffs. For compliance and debugging, consider an append-only events table.

### 7.3 SSE for Execution Status
Frontend polls Forge for execution status on demand. Push model (SSE) would be more responsive and reduce unnecessary requests.

### 7.4 Vitest Workspace Config
Tests are fragmented across packages with separate configs. A Vitest workspace config would enable unified test running, coverage aggregation, and parallel execution across packages.

---

## Known Non-Issues

### WebSocket Proxy Protocol (`http://` vs `ws://`)

`planner-ui` uses `http://localhost:3001` with `ws: true` for the `/ws/relay` proxy, while `ideation-ui` and `forge-ui` use `ws://localhost:3001`. Both work because Vite's http-proxy handles WebSocket upgrades regardless of the target protocol when `ws: true` is set. This is a consistency issue, not a functional bug. Standardizing to `ws://` is recommended for clarity (covered in Phase 1.4).

### React Strict Mode Double-Mount

React strict mode double-mounts components in development, which can cause duplicate WebSocket connections. This is handled by cleanup functions in `useRelayConnection()` and proper `useEffect` teardown. Not a proxy configuration issue.

---

## Execution Notes

- Phases 1-2 are foundational — they reduce friction for everything else
- Phase 3 (god files) can be done incrementally, one file at a time
- Phases 4-6 are independent of each other and can be parallelized
- Phase 7 is deferred/backlog
- No CI/CD pipeline is planned at this stage — validation is manual

# Ideation Package Tasks Export

**Epic:** ideation-package
**Total Tasks:** 80 (#83-#162)
**Generated:** 2026-02-01

---

## Feature 1: ideation-domain (Tasks #83-#95)

### Task #83: [PRE] Analyze before ideation-domain
- **Status:** pending
- **Blocked by:** (none)
- **Blocks:** #84
- **Description:**
```
Feature: ideation-domain
File: docs/flow/features/ideation-domain.json

DO:
1. Run /cost and report the ACTUAL percentage. If > 50%, run /compact first
2. Read the feature file to understand goal and acceptance criteria
3. Check packages/ideation/ directory structure (if exists) or plan new structure
4. Review planner-core domain model patterns for consistency
5. Identify risks or blockers before implementing

Key decisions from feature file:
- Freeform Understanding schema: Record<string, Record<string, unknown>>
- No fixed GuardianRole enum - specialists are dynamic
- Sessions stay active after sending to planner
- Transcript is user + assistant only (specialists never appear in chat)

You MUST state the actual context percentage. DO NOT proceed until you've reported it.
```

---

### Task #84: [IMPL] Define minimal enums and primitive types (dom001)
- **Status:** pending
- **Blocked by:** #83
- **Blocks:** #85, #86, #88
- **Description:**
```
Feature: ideation-domain
Step: dom001 - Define minimal enums and primitive types
File: docs/flow/features/ideation-domain.json

DO: Implement this step per its acceptance_criteria in the feature file.

Acceptance criteria:
- SessionStatus = z.enum(['active', 'abandoned'])
- TranscriptRole = z.enum(['user', 'assistant'])
- No GuardianRole enum - specialists are dynamic
- No Confidence enum - agents define their own confidence representation

Location: packages/ideation/src/domain/types.ts
```

---

### Task #85: [IMPL] Define freeform Understanding schema (dom002)
- **Status:** pending
- **Blocked by:** #84
- **Blocks:** #87, #89, #90
- **Description:**
```
Feature: ideation-domain
Step: dom002 - Define freeform Understanding schema
File: docs/flow/features/ideation-domain.json

DO: Implement this step per its acceptance_criteria in the feature file.

Acceptance criteria:
- Understanding = z.record(z.string(), z.record(z.string(), z.unknown()))
- Keys are specialist names (e.g., 'Architect', 'DataModeller', or any other)
- Values are freeform objects - structure defined by agent prompts, not schema

Location: packages/ideation/src/domain/understanding.ts
```

---

### Task #86: [IMPL] Define TranscriptMessage schema (dom003)
- **Status:** pending
- **Blocked by:** #84
- **Blocks:** #89
- **Description:**
```
Feature: ideation-domain
Step: dom003 - Define TranscriptMessage schema
File: docs/flow/features/ideation-domain.json

DO: Implement this step per its acceptance_criteria in the feature file.

Acceptance criteria:
- TranscriptMessage = { id: string, role: TranscriptRole, content: string, timestamp: string }

Location: packages/ideation/src/domain/transcript.ts
```

---

### Task #87: [IMPL] Define PlannerSend schema (dom004)
- **Status:** pending
- **Blocked by:** #85
- **Blocks:** #89
- **Description:**
```
Feature: ideation-domain
Step: dom004 - Define PlannerSend schema
File: docs/flow/features/ideation-domain.json

DO: Implement this step per its acceptance_criteria in the feature file.

Acceptance criteria:
- PlannerSendPayload = { goal: string, context?: string, source: { type: 'ideation', session_id: string }, understanding: Understanding, initiative_id?: string }
- PlannerSendResult = { plan_id: string, plan_version: number }
- PlannerSend = { sent_at: string, payload: PlannerSendPayload, result: PlannerSendResult }

Location: packages/ideation/src/domain/planner-send.ts
```

---

### Task #88: [IMPL] Define ActiveSpecialist schema (dom005)
- **Status:** pending
- **Blocked by:** #84
- **Blocks:** #89
- **Description:**
```
Feature: ideation-domain
Step: dom005 - Define ActiveSpecialist schema
File: docs/flow/features/ideation-domain.json

DO: Implement this step per its acceptance_criteria in the feature file.

Acceptance criteria:
- ActiveSpecialist = { name: string, agent_id: string, spawned_at: string, role_hint?: string }
- name is the specialist identifier used in Understanding keys
- role_hint is optional description of specialist focus (for UI display)

Location: packages/ideation/src/domain/active-specialist.ts
```

---

### Task #89: [IMPL] Define Session schema (dom006)
- **Status:** pending
- **Blocked by:** #85, #86, #87, #88
- **Blocks:** #91
- **Description:**
```
Feature: ideation-domain
Step: dom006 - Define Session schema
File: docs/flow/features/ideation-domain.json

DO: Implement this step per its acceptance_criteria in the feature file.

Acceptance criteria:
- Session = { id, status, initiative_id?, source: { type: 'human', initial_intent }, transcript[], understanding, active_specialists[], planner_sends[], created_at, updated_at }

Location: packages/ideation/src/domain/session.ts
```

---

### Task #90: [IMPL] Define aggregate confidence computation (dom007)
- **Status:** pending
- **Blocked by:** #85
- **Blocks:** #91
- **Description:**
```
Feature: ideation-domain
Step: dom007 - Define aggregate confidence computation
File: docs/flow/features/ideation-domain.json

DO: Implement this step per its acceptance_criteria in the feature file.

Acceptance criteria:
- computeAggregateConfidence(understanding) returns 0-100 score
- Looks for 'confidence' key in each specialist's observations (freeform)
- Maps string values: 'exploring'->25, 'forming'->50, 'confident'->90 (convention)
- Returns average of all specialists, or 0 if none have reported

Location: packages/ideation/src/domain/confidence.ts
```

---

### Task #91: [IMPL] Export types and create index (dom008)
- **Status:** pending
- **Blocked by:** #89, #90
- **Blocks:** #92
- **Description:**
```
Feature: ideation-domain
Step: dom008 - Export types and create index
File: docs/flow/features/ideation-domain.json

DO: Implement this step per its acceptance_criteria in the feature file.

Acceptance criteria:
- packages/ideation/src/domain/index.ts exports all schemas and inferred types
- Types: Session, Understanding, TranscriptMessage, PlannerSend, ActiveSpecialist, etc.

Location: packages/ideation/src/domain/index.ts
```

---

### Task #92: [POST] Review ideation-domain changes
- **Status:** pending
- **Blocked by:** #91
- **Blocks:** #93
- **Description:**
```
Feature: ideation-domain
File: docs/flow/features/ideation-domain.json

DO: Review this code as if it were a PR from another developer.

1. Re-read ALL code written or modified for this feature (packages/ideation/src/domain/*.ts)
2. Look for:
   - Bugs, logic errors, off-by-one mistakes
   - Missing edge cases or error handling
   - Inconsistent patterns vs existing codebase (planner-core)
   - Security issues (injection, auth, data exposure)
   - Performance concerns (N+1 queries, unnecessary loops)
   - Code that could be clearer or simpler
3. Make fixes and improvements - do not just note them

Be critical. If you would not approve this PR, fix it before marking complete.
```

---

### Task #93: [VERIFY] Check ideation-domain criteria
- **Status:** pending
- **Blocked by:** #92
- **Blocks:** #94
- **Description:**
```
Feature: ideation-domain
File: docs/flow/features/ideation-domain.json

DO:
1. Read the feature's acceptance_criteria from the file
2. For EACH criterion: confirm it is met (not assumed)
3. Run relevant tests (typecheck: npm run typecheck in packages/ideation)
4. If any criterion is NOT met, fix it before marking complete

List each criterion and its status in your response:
- ac1: Session entity has all required fields
- ac2: Session status enum: 'active' | 'abandoned'
- ac3: Understanding is freeform: Record<string, Record<string, unknown>>
- ac4: Each specialist's observations structure is freeform
- ac5: active_specialists[] tracks currently spawned specialist agent IDs
- ac6: Confidence is agent-reported, not schema-enforced
- ac7: Transcript message has: id, role, content, timestamp
- ac8: PlannerSend captures: sent_at, payload, result
- ac9: planner_sends[] is append-only history
- ac10: Minimal Zod schemas - validate structure, not content
- ac11: TypeScript types are exported
```

---

### Task #94: [DOC] Document ideation-domain completion
- **Status:** pending
- **Blocked by:** #93
- **Blocks:** #95
- **Description:**
```
Feature: ideation-domain
File: docs/flow/features/ideation-domain.json

DO:
1. Compare what you built to the plan_implementation.steps
2. If implementation diverged from plan, run /flow change-request
3. Update feature status if complete

Mark complete only if implementation matches plan (or change request filed).
```

---

### Task #95: [CHECKPOINT] Context check after ideation-domain
- **Status:** pending
- **Blocked by:** #94
- **Blocks:** #96
- **Description:**
```
Feature: ideation-domain complete.

DO:
1. Run /cost and report the ACTUAL percentage shown
2. If > 50%, run /compact before marking complete
3. Confirm domain model is solid foundation for storage layer
4. Mark complete only after reporting the actual number

You MUST state the actual context percentage. "Context is fine" without a number = task NOT complete.
```

---

## Feature 2: ideation-storage (Tasks #96-#109)

### Task #96: [PRE] Analyze before ideation-storage
- **Status:** pending
- **Blocked by:** #95
- **Blocks:** #97
- **Description:**
```
Feature: ideation-storage
File: docs/flow/features/ideation-storage.json

DO:
1. Run /cost and report the ACTUAL percentage. If > 50%, run /compact first
2. Read the feature file to understand goal and acceptance criteria
3. Review planner-core storage patterns (src/storage/) for consistency
4. Verify ideation-domain types are complete and exported
5. Identify risks or blockers before implementing

Key patterns from feature file:
- JSONB for transcript, understanding, active_specialists, planner_sends
- Per-specialist updates without overwriting others
- Append operations for transcript and planner_sends

You MUST state the actual context percentage. DO NOT proceed until you've reported it.
```

---

### Task #97: [IMPL] Define IdeationStorage interface (sto001)
- **Status:** pending
- **Blocked by:** #96
- **Blocks:** #98
- **Description:**
```
Feature: ideation-storage
Step: sto001 - Define IdeationStorage interface
File: docs/flow/features/ideation-storage.json

DO: Implement this step per its acceptance_criteria in the feature file.

Acceptance criteria:
- createSession(source, initiative_id?) -> Session
- getSession(id) -> Session | null
- listSessions(filter?: { status?, initiative_id? }) -> Session[]
- updateSessionStatus(id, status) -> Session
- appendTranscript(id, message: TranscriptMessage) -> Session
- updateUnderstanding(id, specialistName: string, observations: Record<string, unknown>) -> Session
- addActiveSpecialist(id, specialist: ActiveSpecialist) -> Session
- removeActiveSpecialist(id, specialistName: string) -> Session
- appendPlannerSend(id, send: PlannerSend) -> Session

Location: packages/ideation/src/storage/interface.ts
```

---

### Task #98: [IMPL] Create SQLite schema and initialization (sto002)
- **Status:** pending
- **Blocked by:** #97
- **Blocks:** #99
- **Description:**
```
Feature: ideation-storage
Step: sto002 - Create SQLite schema and initialization
File: docs/flow/features/ideation-storage.json

DO: Implement this step per its acceptance_criteria in the feature file.

Acceptance criteria:
- Sessions table: id TEXT PK, status TEXT, initiative_id TEXT, source TEXT (JSON), transcript TEXT (JSON), understanding TEXT (JSON), active_specialists TEXT (JSON), planner_sends TEXT (JSON), created_at TEXT, updated_at TEXT
- Index on status, initiative_id for filtering
- initDatabase(db) function creates tables if not exist

Location: packages/ideation/src/storage/sqlite.ts
```

---

### Task #99: [IMPL] Implement session CRUD operations (sto003)
- **Status:** pending
- **Blocked by:** #98
- **Blocks:** #100, #101, #102, #103
- **Description:**
```
Feature: ideation-storage
Step: sto003 - Implement session CRUD operations
File: docs/flow/features/ideation-storage.json

DO: Implement this step per its acceptance_criteria in the feature file.

Acceptance criteria:
- createSession generates UUID, initializes empty transcript/understanding/active_specialists, sets status='active'
- getSession returns null if not found
- listSessions accepts optional status and initiative_id filters, returns sorted by updated_at DESC
- updateSessionStatus updates status and updated_at timestamp

Location: packages/ideation/src/storage/sqlite.ts
```

---

### Task #100: [IMPL] Implement transcript append operation (sto004)
- **Status:** pending
- **Blocked by:** #99
- **Blocks:** #104
- **Description:**
```
Feature: ideation-storage
Step: sto004 - Implement transcript append operation
File: docs/flow/features/ideation-storage.json

DO: Implement this step per its acceptance_criteria in the feature file.

Acceptance criteria:
- Uses SQLite JSON functions to append to transcript array
- Updates updated_at timestamp
- Returns updated Session

Location: packages/ideation/src/storage/sqlite.ts
```

---

### Task #101: [IMPL] Implement understanding update operation (sto005)
- **Status:** pending
- **Blocked by:** #99
- **Blocks:** #104
- **Description:**
```
Feature: ideation-storage
Step: sto005 - Implement understanding update operation
File: docs/flow/features/ideation-storage.json

DO: Implement this step per its acceptance_criteria in the feature file.

Acceptance criteria:
- Uses SQLite JSON functions to set specific specialist key in understanding object
- Key is specialistName (any string), value is freeform Record<string, unknown>
- Does not overwrite other specialists' observations
- Updates updated_at timestamp
- Returns updated Session

Location: packages/ideation/src/storage/sqlite.ts
```

---

### Task #102: [IMPL] Implement active specialists operations (sto005b)
- **Status:** pending
- **Blocked by:** #99
- **Blocks:** #104
- **Description:**
```
Feature: ideation-storage
Step: sto005b - Implement active specialists operations
File: docs/flow/features/ideation-storage.json

DO: Implement this step per its acceptance_criteria in the feature file.

Acceptance criteria:
- addActiveSpecialist appends to active_specialists array
- removeActiveSpecialist filters out specialist by name
- Both update updated_at timestamp
- Returns updated Session

Location: packages/ideation/src/storage/sqlite.ts
```

---

### Task #103: [IMPL] Implement planner send append operation (sto006)
- **Status:** pending
- **Blocked by:** #99
- **Blocks:** #104
- **Description:**
```
Feature: ideation-storage
Step: sto006 - Implement planner send append operation
File: docs/flow/features/ideation-storage.json

DO: Implement this step per its acceptance_criteria in the feature file.

Acceptance criteria:
- appendPlannerSend(id, send: PlannerSend) appends to planner_sends array
- Uses SQLite JSON functions to append to array
- Updates updated_at timestamp
- Returns updated Session

Location: packages/ideation/src/storage/sqlite.ts
```

---

### Task #104: [IMPL] Write storage tests (sto007)
- **Status:** pending
- **Blocked by:** #100, #101, #102, #103
- **Blocks:** #105
- **Description:**
```
Feature: ideation-storage
Step: sto007 - Write storage tests
File: docs/flow/features/ideation-storage.json

DO: Implement this step per its acceptance_criteria in the feature file.

Acceptance criteria:
- Test session CRUD lifecycle
- Test transcript append preserves existing messages
- Test understanding update merges per-specialist (freeform key)
- Test listSessions with status and initiative_id filters
- Test planner send append preserves history and captures full payload
- Test active_specialists add/remove operations

Location: packages/ideation/src/storage/sqlite.test.ts
```

---

### Task #105: [IMPL] Export storage module (sto008)
- **Status:** pending
- **Blocked by:** #104
- **Blocks:** #106
- **Description:**
```
Feature: ideation-storage
Step: sto008 - Export storage module
File: docs/flow/features/ideation-storage.json

DO: Implement this step per its acceptance_criteria in the feature file.

Acceptance criteria:
- Exports IdeationStorage interface and SQLiteIdeationStorage class

Location: packages/ideation/src/storage/index.ts
```

---

### Task #106: [POST] Review ideation-storage changes
- **Status:** pending
- **Blocked by:** #105
- **Blocks:** #107
- **Description:**
```
Feature: ideation-storage
File: docs/flow/features/ideation-storage.json

DO: Review this code as if it were a PR from another developer.

1. Re-read ALL code written or modified for this feature (packages/ideation/src/storage/*.ts)
2. Look for:
   - Bugs, logic errors, off-by-one mistakes
   - Missing edge cases or error handling
   - Inconsistent patterns vs existing codebase (planner-core storage)
   - Security issues (SQL injection, data exposure)
   - Performance concerns (N+1 queries, inefficient JSON operations)
   - Code that could be clearer or simpler
3. Make fixes and improvements - do not just note them

Be critical. If you would not approve this PR, fix it before marking complete.
```

---

### Task #107: [VERIFY] Check ideation-storage criteria
- **Status:** pending
- **Blocked by:** #106
- **Blocks:** #108
- **Description:**
```
Feature: ideation-storage
File: docs/flow/features/ideation-storage.json

DO:
1. Read the feature's acceptance_criteria from the file
2. For EACH criterion: confirm it is met (not assumed)
3. Run tests: npm test in packages/ideation
4. If any criterion is NOT met, fix it before marking complete

List each criterion and its status in your response:
- ac1: Sessions table stores all fields as JSONB where appropriate
- ac2: IdeationStorage interface defines CRUD operations
- ac3: SQLiteIdeationStorage implements the interface
- ac4: Database initialization creates tables if not exists
- ac5: Transcript can be appended without replacing entire session
- ac6: Understanding can be updated per-specialist without overwriting others
- ac7: active_specialists can be appended/updated for lazy spawning tracking
- ac8: planner_sends can be appended with full payload snapshot
- ac9: Sessions can be queried by status and initiative_id
```

---

### Task #108: [DOC] Document ideation-storage completion
- **Status:** pending
- **Blocked by:** #107
- **Blocks:** #109
- **Description:**
```
Feature: ideation-storage
File: docs/flow/features/ideation-storage.json

DO:
1. Compare what you built to the plan_implementation.steps
2. If implementation diverged from plan, run /flow change-request
3. Update feature status if complete

Mark complete only if implementation matches plan (or change request filed).
```

---

### Task #109: [CHECKPOINT] Context check after ideation-storage
- **Status:** pending
- **Blocked by:** #108
- **Blocks:** #110
- **Description:**
```
Feature: ideation-storage complete.

DO:
1. Run /cost and report the ACTUAL percentage shown
2. If > 50%, run /compact before marking complete
3. Confirm storage layer is solid foundation for API layer
4. Mark complete only after reporting the actual number

You MUST state the actual context percentage. "Context is fine" without a number = task NOT complete.
```

---

## Feature 3: ideation-api (Tasks #110-#123)

### Task #110: [PRE] Analyze before ideation-api
- **Status:** pending
- **Blocked by:** #109
- **Blocks:** #111
- **Description:**
```
Feature: ideation-api
File: docs/flow/features/ideation-api.json

DO:
1. Run /cost and report the ACTUAL percentage. If > 50%, run /compact first
2. Read the feature file to understand goal and acceptance criteria
3. Review planner-core API patterns (src/api/) for consistency
4. Verify ideation-storage is complete and tested
5. Identify risks or blockers before implementing

Key patterns from feature file:
- All routes under /api/ideation prefix
- SSE endpoint for real-time updates
- Zod validation on all endpoints
- Cross-scope contract with planner-core for send-to-planner

You MUST state the actual context percentage. DO NOT proceed until you've reported it.
```

---

### Task #111: [IMPL] Define API request/response schemas (api001)
- **Status:** pending
- **Blocked by:** #110
- **Blocks:** #112
- **Description:**
```
Feature: ideation-api
Step: api001 - Define API request/response schemas
File: docs/flow/features/ideation-api.json

DO: Implement this step per its acceptance_criteria in the feature file.

Acceptance criteria:
- CreateSessionRequest = { initial_intent: string, initiative_id?: string }
- ListSessionsQuery = { status?: SessionStatus, initiative_id?: string }
- AppendMessageRequest = { role: TranscriptRole, content: string }
- UpdateUnderstandingRequest = z.record(z.string(), z.unknown()) - freeform observations
- SendToPlannerRequest = { goal?: string, context?: string } (optional overrides)
- All response types match domain entities

Location: packages/ideation/src/api/schemas.ts
```

---

### Task #112: [IMPL] Implement session CRUD endpoints (api002)
- **Status:** pending
- **Blocked by:** #111
- **Blocks:** #113, #115
- **Description:**
```
Feature: ideation-api
Step: api002 - Implement session CRUD endpoints
File: docs/flow/features/ideation-api.json

DO: Implement this step per its acceptance_criteria in the feature file.

Acceptance criteria:
- POST /sessions returns { id, status, initiative_id?, source, transcript: [], understanding: {}, planner_sends: [], created_at, updated_at }
- GET /sessions returns Session[] sorted by updated_at DESC
- GET /sessions/:id returns full Session or 404
- POST /sessions/:id/abandon updates status to 'abandoned', returns updated Session

Location: packages/ideation/src/api/handlers.ts
```

---

### Task #113: [IMPL] Implement message and understanding endpoints (api003)
- **Status:** pending
- **Blocked by:** #112
- **Blocks:** #114, #116
- **Description:**
```
Feature: ideation-api
Step: api003 - Implement message and understanding endpoints
File: docs/flow/features/ideation-api.json

DO: Implement this step per its acceptance_criteria in the feature file.

Acceptance criteria:
- POST /sessions/:id/messages appends message with auto-generated id and timestamp
- PUT /sessions/:id/understanding/:specialist accepts any specialist name (no enum validation)
- PUT /sessions/:id/understanding/:specialist accepts freeform observations Record<string, unknown>
- Both return updated Session

Location: packages/ideation/src/api/handlers.ts
```

---

### Task #114: [IMPL] Implement send-to-planner endpoint (api004)
- **Status:** pending
- **Blocked by:** #113
- **Blocks:** (none)
- **Description:**
```
Feature: ideation-api
Step: api004 - Implement send-to-planner endpoint
File: docs/flow/features/ideation-api.json

DO: Implement this step per its acceptance_criteria in the feature file.

Acceptance criteria:
- POST /sessions/:id/send-to-planner works on active sessions
- If planner_sends is empty: creates new plan via planner-core API
- If planner_sends has entries: creates new plan version with updated understanding
- Goal defaults to initial_intent, can be overridden in request
- Appends PlannerSend to session.planner_sends (full payload snapshot)
- Returns { session, plan_id, plan_version, plan_channel }

Cross-scope contract with planner-core:
- POST /api/plans accepts: { goal, context?, source: { type: 'ideation', session_id }, understanding?, initiative_id? }
- Returns: { id, ... }

Location: packages/ideation/src/api/handlers.ts
```

---

### Task #115: [IMPL] Implement confidence endpoint (api005)
- **Status:** pending
- **Blocked by:** #112
- **Blocks:** (none)
- **Description:**
```
Feature: ideation-api
Step: api005 - Implement confidence endpoint
File: docs/flow/features/ideation-api.json

DO: Implement this step per its acceptance_criteria in the feature file.

Acceptance criteria:
- GET /sessions/:id/confidence returns { score: 0-100, breakdown: { Architect: 'confident', ... } }
- Score is computed from computeAggregateConfidence(understanding)
- Breakdown shows each specialist's confidence level

Location: packages/ideation/src/api/handlers.ts
```

---

### Task #116: [IMPL] Implement SSE events endpoint (api006)
- **Status:** pending
- **Blocked by:** #113
- **Blocks:** #117
- **Description:**
```
Feature: ideation-api
Step: api006 - Implement SSE events endpoint
File: docs/flow/features/ideation-api.json

DO: Implement this step per its acceptance_criteria in the feature file.

Acceptance criteria:
- GET /sessions/:id/events returns SSE stream
- Events: transcript_updated, understanding_updated, status_changed, confidence_changed
- Event format: { event: string, data: { session_id, ...changes } }
- Connection kept alive with heartbeat

Location: packages/ideation/src/api/sse.ts
```

---

### Task #117: [IMPL] Create event emitter for session changes (api007)
- **Status:** pending
- **Blocked by:** #116
- **Blocks:** #118
- **Description:**
```
Feature: ideation-api
Step: api007 - Create event emitter for session changes
File: docs/flow/features/ideation-api.json

DO: Implement this step per its acceptance_criteria in the feature file.

Acceptance criteria:
- IdeationEvents extends EventEmitter
- Events: 'transcript', 'understanding', 'status', 'confidence'
- API handlers emit events after successful operations
- SSE endpoint subscribes to events for specific session_id

Location: packages/ideation/src/api/events.ts
```

---

### Task #118: [IMPL] Wire up routes and middleware (api008)
- **Status:** pending
- **Blocked by:** #117
- **Blocks:** #119
- **Description:**
```
Feature: ideation-api
Step: api008 - Wire up routes and middleware
File: docs/flow/features/ideation-api.json

DO: Implement this step per its acceptance_criteria in the feature file.

Acceptance criteria:
- All routes under /api/ideation prefix
- JSON body parsing middleware applied
- Error handling middleware converts ApiError to JSON response

Location: packages/ideation/src/api/routes.ts
```

---

### Task #119: [IMPL] Write API tests (api009)
- **Status:** pending
- **Blocked by:** #118
- **Blocks:** #120
- **Description:**
```
Feature: ideation-api
Step: api009 - Write API tests
File: docs/flow/features/ideation-api.json

DO: Implement this step per its acceptance_criteria in the feature file.

Acceptance criteria:
- Test session creation and listing with filters
- Test message append and understanding update
- Test send-to-planner (mock planner-core)
- Test send-to-planner updates existing plan
- Test confidence endpoint
- Test SSE connection and events
- Test error cases (404, validation)

Location: packages/ideation/src/api/routes.test.ts
```

---

### Task #120: [POST] Review ideation-api changes
- **Status:** pending
- **Blocked by:** #119
- **Blocks:** #121
- **Description:**
```
Feature: ideation-api
File: docs/flow/features/ideation-api.json

DO: Review this code as if it were a PR from another developer.

1. Re-read ALL code written or modified for this feature (packages/ideation/src/api/*.ts)
2. Look for:
   - Bugs, logic errors, off-by-one mistakes
   - Missing edge cases or error handling
   - Inconsistent patterns vs existing codebase (planner-core API)
   - Security issues (injection, auth, data exposure)
   - Performance concerns
   - Code that could be clearer or simpler
3. Make fixes and improvements - do not just note them

Be critical. If you would not approve this PR, fix it before marking complete.
```

---

### Task #121: [VERIFY] Check ideation-api criteria
- **Status:** pending
- **Blocked by:** #120
- **Blocks:** #122
- **Description:**
```
Feature: ideation-api
File: docs/flow/features/ideation-api.json

DO:
1. Read the feature's acceptance_criteria from the file
2. For EACH criterion: confirm it is met (not assumed)
3. Run tests: npm test in packages/ideation
4. If any criterion is NOT met, fix it before marking complete

List each criterion and its status in your response:
- ac1: POST /api/ideation/sessions creates a new session
- ac2: GET /api/ideation/sessions lists sessions with filters
- ac3: GET /api/ideation/sessions/:id returns session details
- ac4: POST /api/ideation/sessions/:id/messages appends message
- ac5: PUT /api/ideation/sessions/:id/understanding/:specialist updates observations
- ac6: POST /api/ideation/sessions/:id/send-to-planner creates/updates plan
- ac7: POST /api/ideation/sessions/:id/abandon marks session as abandoned
- ac8: GET /api/ideation/sessions/:id/events SSE endpoint
- ac9: GET /api/ideation/sessions/:id/confidence returns aggregate confidence
- ac10: All endpoints validate input with Zod schemas
- ac11: Error responses follow existing API patterns
```

---

### Task #122: [DOC] Document ideation-api completion
- **Status:** pending
- **Blocked by:** #121
- **Blocks:** #123
- **Description:**
```
Feature: ideation-api
File: docs/flow/features/ideation-api.json

DO:
1. Compare what you built to the plan_implementation.steps
2. If implementation diverged from plan, run /flow change-request
3. Update feature status if complete

Mark complete only if implementation matches plan (or change request filed).
```

---

### Task #123: [CHECKPOINT] Context check after ideation-api
- **Status:** pending
- **Blocked by:** #122
- **Blocks:** #124
- **Description:**
```
Feature: ideation-api complete.

DO:
1. Run /cost and report the ACTUAL percentage shown
2. If > 50%, run /compact before marking complete
3. Confirm API layer is solid foundation for Interviewer agent
4. Mark complete only after reporting the actual number

You MUST state the actual context percentage. "Context is fine" without a number = task NOT complete.
```

---

## Feature 4: ideation-lead (Tasks #124-#140)

### Task #124: [PRE] Analyze before ideation-lead
- **Status:** pending
- **Blocked by:** #123
- **Blocks:** #125
- **Description:**
```
Feature: ideation-lead
File: docs/flow/features/ideation-lead.json

DO:
1. Run /cost and report the ACTUAL percentage. If > 50%, run /compact first
2. Read the feature file to understand goal and acceptance criteria
3. Review PlannerLead implementation (src/agents/planner-lead.ts) for patterns
4. Verify ideation-api is complete and tested
5. Identify risks or blockers before implementing

Key decisions from feature file:
- Lazy specialist spawning (on-demand, not all at start)
- Never reveal specialists to user - pure 1:1 facilitated conversation
- Freeform specialist types - not limited to predefined 5
- Interviewer receives questions from specialists and weaves them naturally

You MUST state the actual context percentage. DO NOT proceed until you've reported it.
```

---

### Task #125: [IMPL] Create Interviewer config and constants (int001)
- **Status:** pending
- **Blocked by:** #124
- **Blocks:** #126, #127, #130
- **Description:**
```
Feature: ideation-lead
Step: int001 - Create Interviewer config and constants
File: docs/flow/features/ideation-lead.json

DO: Implement this step per its acceptance_criteria in the feature file.

Acceptance criteria:
- INTERVIEWER_CONFIG = { name: 'Interviewer', displayName: 'Brainstorming Facilitator', role: 'interviewer' }
- IDEATION_CHANNEL = '#ideation'
- sessionChannelId(sessionId) = `#ideation-${sessionId.slice(0,8)}`

Location: packages/ideation/src/agents/interviewer/config.ts
```

---

### Task #126: [IMPL] Create Interviewer system prompt (int002)
- **Status:** pending
- **Blocked by:** #125
- **Blocks:** (none)
- **Description:**
```
Feature: ideation-lead
Step: int002 - Create Interviewer system prompt
File: docs/flow/features/ideation-lead.json

DO: Implement this step per its acceptance_criteria in the feature file.

Acceptance criteria:
- Prompt emphasizes: facilitation over direction, clarifying questions, drawing out requirements
- Prompt includes context about available specialists and when to surface their insights
- Prompt instructs: don't dominate, let human lead, ask 'what else?'
- getInterviewerPrompt({ sessionId, channelId }) returns contextual system prompt

Location: packages/ideation/src/agents/interviewer/prompt.ts
```

---

### Task #127: [IMPL] Define Interviewer tools (int003)
- **Status:** pending
- **Blocked by:** #125
- **Blocks:** #128
- **Description:**
```
Feature: ideation-lead
Step: int003 - Define Interviewer tools
File: docs/flow/features/ideation-lead.json

DO: Implement this step per its acceptance_criteria in the feature file.

Acceptance criteria:
- start_session: { initial_intent: string } -> creates session, returns session_id (NO auto-spawn)
- read_session: { session_id: string } -> returns session with transcript and understanding
- add_message: { session_id, role, content } -> appends message to transcript
- update_understanding: { session_id, specialist_name: string, observations: Record<string, unknown> } -> updates specialist observations (freeform)
- send_to_planner: { session_id, goal?, context? } -> creates/updates plan from session understanding
- spawn_specialist: { session_id, name: string, focus: string, prompt_context?: string } -> spawns single specialist on-demand

Location: packages/ideation/src/agents/interviewer/tools.ts
```

---

### Task #128: [IMPL] Implement tool execution (int004)
- **Status:** pending
- **Blocked by:** #127
- **Blocks:** #129
- **Description:**
```
Feature: ideation-lead
Step: int004 - Implement tool execution
File: docs/flow/features/ideation-lead.json

DO: Implement this step per its acceptance_criteria in the feature file.

Acceptance criteria:
- executeTool(name, input, storage) dispatches to correct handler
- Returns ToolResult = { success: boolean, data?: unknown, error?: string }
- getMockToolResult(name, input) returns canned responses for mock mode

Location: packages/ideation/src/agents/interviewer/tool-executor.ts
```

---

### Task #129: [IMPL] Create lazy specialist spawning logic (int005)
- **Status:** pending
- **Blocked by:** #128
- **Blocks:** (none)
- **Description:**
```
Feature: ideation-lead
Step: int005 - Create lazy specialist spawning logic
File: docs/flow/features/ideation-lead.json

DO: Implement this step per its acceptance_criteria in the feature file.

Acceptance criteria:
- spawnSpecialist(sessionId, name, focus, promptContext?) spawns single specialist on-demand
- Specialist name can be any string (not limited to fixed roles)
- Focus describes what expertise this specialist provides
- Specialist is spawned via Relay spawn() with session context and focus
- Specialist joins the session channel automatically
- Returns ActiveSpecialist { name, agent_id, spawned_at, role_hint }
- Session.active_specialists[] is updated with new specialist

Location: packages/ideation/src/agents/interviewer/spawner.ts
```

---

### Task #130: [IMPL] Implement conversation history (int006)
- **Status:** pending
- **Blocked by:** #125
- **Blocks:** #131
- **Description:**
```
Feature: ideation-lead
Step: int006 - Implement conversation history
File: docs/flow/features/ideation-lead.json

DO: Implement this step per its acceptance_criteria in the feature file.

Acceptance criteria:
- addMessage(channelId, role, content) adds to history
- getHistory(channelId) returns ConversationMessage[]
- History is in-memory (persisted via session transcript in DB)

Location: packages/ideation/src/agents/interviewer/history.ts
```

---

### Task #131: [IMPL] Implement specialist input queue (int007)
- **Status:** pending
- **Blocked by:** #130
- **Blocks:** #132
- **Description:**
```
Feature: ideation-lead
Step: int007 - Implement specialist input queue
File: docs/flow/features/ideation-lead.json

DO: Implement this step per its acceptance_criteria in the feature file.

Acceptance criteria:
- SpecialistInput = { specialist_name: string, type: 'question' | 'observation' | 'concern', content: string, priority: number }
- queueSpecialistInput(sessionId, input) adds to queue
- getNextInput(sessionId) returns highest priority input
- Interviewer weaves specialist input into its own questions (never attributes to specialist)

Location: packages/ideation/src/agents/interviewer/input-queue.ts
```

---

### Task #132: [IMPL] Create Interviewer service (int008)
- **Status:** pending
- **Blocked by:** #131
- **Blocks:** #133
- **Description:**
```
Feature: ideation-lead
Step: int008 - Create Interviewer service
File: docs/flow/features/ideation-lead.json

DO: Implement this step per its acceptance_criteria in the feature file.

Acceptance criteria:
- initInterviewer(storage) registers message handler via onMessage()
- stopInterviewer() unsubscribes and cleans up
- isInterviewerActive() returns boolean
- Service emits agent status events (joined, working, idle)

Location: packages/ideation/src/agents/interviewer/service.ts
```

---

### Task #133: [IMPL] Implement message handling (int009)
- **Status:** pending
- **Blocked by:** #132
- **Blocks:** #134
- **Description:**
```
Feature: ideation-lead
Step: int009 - Implement message handling
File: docs/flow/features/ideation-lead.json

DO: Implement this step per its acceptance_criteria in the feature file.

Acceptance criteria:
- shouldHandleMessage() filters for #ideation and #ideation-* channels
- handleMessage() checks specialist queue, generates response with tools
- Messages from specialists are parsed and queued, not responded to directly
- Response sent via sendChannelMessage()

Location: packages/ideation/src/agents/interviewer/handler.ts
```

---

### Task #134: [IMPL] Implement LLM response generation (int010)
- **Status:** pending
- **Blocked by:** #133
- **Blocks:** #135
- **Description:**
```
Feature: ideation-lead
Step: int010 - Implement LLM response generation
File: docs/flow/features/ideation-lead.json

DO: Implement this step per its acceptance_criteria in the feature file.

Acceptance criteria:
- generateResponse(channelId, message, sessionId) calls Anthropic API
- Handles tool_use responses in loop until text response
- Falls back to generateMockResponse() when no API key
- Updates agent status to 'working' during generation

Location: packages/ideation/src/agents/interviewer/llm.ts
```

---

### Task #135: [IMPL] Implement session announcement (int011)
- **Status:** pending
- **Blocked by:** #134
- **Blocks:** #136
- **Description:**
```
Feature: ideation-lead
Step: int011 - Implement session announcement
File: docs/flow/features/ideation-lead.json

DO: Implement this step per its acceptance_criteria in the feature file.

Acceptance criteria:
- notifyNewSession(sessionId, initialIntent) sends welcome message
- Welcome introduces Interviewer and explains process
- Asks first clarifying question based on intent

Location: packages/ideation/src/agents/interviewer/announcer.ts
```

---

### Task #136: [IMPL] Write Interviewer tests (int012)
- **Status:** pending
- **Blocked by:** #135
- **Blocks:** #137
- **Description:**
```
Feature: ideation-lead
Step: int012 - Write Interviewer tests
File: docs/flow/features/ideation-lead.json

DO: Implement this step per its acceptance_criteria in the feature file.

Acceptance criteria:
- Test tool execution
- Test message filtering
- Test specialist input queue
- Test mock mode responses
- Test session announcement

Location: packages/ideation/src/agents/interviewer/interviewer.test.ts
```

---

### Task #137: [POST] Review ideation-lead changes
- **Status:** pending
- **Blocked by:** #136
- **Blocks:** #138
- **Description:**
```
Feature: ideation-lead
File: docs/flow/features/ideation-lead.json

DO: Review this code as if it were a PR from another developer.

1. Re-read ALL code written or modified for this feature (packages/ideation/src/agents/interviewer/*.ts)
2. Look for:
   - Bugs, logic errors, off-by-one mistakes
   - Missing edge cases or error handling
   - Inconsistent patterns vs PlannerLead implementation
   - Security issues
   - Performance concerns
   - Code that could be clearer or simpler
3. Make fixes and improvements - do not just note them

Be critical. If you would not approve this PR, fix it before marking complete.
```

---

### Task #138: [VERIFY] Check ideation-lead criteria
- **Status:** pending
- **Blocked by:** #137
- **Blocks:** #139
- **Description:**
```
Feature: ideation-lead
File: docs/flow/features/ideation-lead.json

DO:
1. Read the feature's acceptance_criteria from the file
2. For EACH criterion: confirm it is met (not assumed)
3. Run tests: npm test in packages/ideation
4. If any criterion is NOT met, fix it before marking complete

List each criterion and its status:
- ac1: Interviewer runs as persistent service using RelayClient
- ac2: Listens on #ideation and #ideation-{session_id} channels
- ac3: Uses Anthropic API with mock mode fallback
- ac4: Maintains conversation history per session
- ac5: Has all required tools
- ac6: Spawns specialists LAZILY on-demand
- ac7: NEVER reveals specialists to user
- ac8: Receives and weaves specialist questions naturally
- ac9: Facilitates without dominating
- ac10: System prompt defines facilitator personality
- ac11: Mock mode provides canned responses
```

---

### Task #139: [DOC] Document ideation-lead completion
- **Status:** pending
- **Blocked by:** #138
- **Blocks:** #140
- **Description:**
```
Feature: ideation-lead
File: docs/flow/features/ideation-lead.json

DO:
1. Compare what you built to the plan_implementation.steps
2. If implementation diverged from plan, run /flow change-request
3. Update feature status if complete

Mark complete only if implementation matches plan (or change request filed).
```

---

### Task #140: [CHECKPOINT] Context check after ideation-lead
- **Status:** pending
- **Blocked by:** #139
- **Blocks:** #141
- **Description:**
```
Feature: ideation-lead complete.

DO:
1. Run /cost and report the ACTUAL percentage shown
2. If > 50%, run /compact before marking complete
3. Confirm Interviewer agent is ready to spawn specialists
4. Mark complete only after reporting the actual number

You MUST state the actual context percentage. "Context is fine" without a number = task NOT complete.
```

---

## Feature 5: ideation-specialists (Tasks #141-#150)

### Task #141: [PRE] Analyze before ideation-specialists
- **Status:** pending
- **Blocked by:** #140
- **Blocks:** #142, #143
- **Description:**
```
Feature: ideation-specialists
File: docs/flow/features/ideation-specialists.json

DO:
1. Run /cost and report the ACTUAL percentage. If > 50%, run /compact first
2. Read the feature file to understand goal and acceptance criteria
3. Verify Interviewer spawning logic (int005) is complete
4. Review specialist input queue (int007) integration points
5. Identify risks or blockers before implementing

Key decisions from feature file:
- Lazy spawning by Interviewer
- Freeform observations (intelligence in prompts, not schemas)
- Invisible to user - Interviewer presents insights as its own
- Prompt templates as suggestions, not fixed roles

You MUST state the actual context percentage. DO NOT proceed until you've reported it.
```

---

### Task #142: [IMPL] Create specialist prompt templates (spc001)
- **Status:** pending
- **Blocked by:** #141
- **Blocks:** #145
- **Description:**
```
Feature: ideation-specialists
Step: spc001 - Create specialist prompt templates
File: docs/flow/features/ideation-specialists.json

DO: Implement this step per its acceptance_criteria in the feature file.

Acceptance criteria:
- SPECIALIST_TEMPLATES: Map<string, { displayName, focus, basePrompt }>
- Templates for: Architect (system design), DataModeller (schemas), Designer (UX), QA (testing), Security
- Templates are suggestions - Interviewer can spawn custom specialists with inline prompts
- getSpecialistPrompt(name, focus, customContext?) builds complete prompt

Location: packages/ideation/src/agents/specialists/templates.ts
```

---

### Task #143: [IMPL] Define specialist MCP tools (spc002)
- **Status:** pending
- **Blocked by:** #141
- **Blocks:** #144
- **Description:**
```
Feature: ideation-specialists
Step: spc002 - Define specialist MCP tools
File: docs/flow/features/ideation-specialists.json

DO: Implement this step per its acceptance_criteria in the feature file.

Acceptance criteria:
- update_observations: { session_id, observations: Record<string, unknown> } -> freeform observations
- read_understanding: { session_id } -> returns all specialists' observations
- queue_insight: { session_id, type: 'question'|'observation'|'concern', content, priority } -> queues for Interviewer
- Observations structure is NOT validated - intelligence lives in prompts

Location: packages/ideation/src/agents/specialists/tools.ts
```

---

### Task #144: [IMPL] Implement specialist tool execution (spc003)
- **Status:** pending
- **Blocked by:** #143
- **Blocks:** #146
- **Description:**
```
Feature: ideation-specialists
Step: spc003 - Implement specialist tool execution
File: docs/flow/features/ideation-specialists.json

DO: Implement this step per its acceptance_criteria in the feature file.

Acceptance criteria:
- executeSpecialistTool(specialistName, toolName, input, storage) dispatches to handler
- update_observations calls storage.updateUnderstanding(sessionId, specialistName, observations)
- read_understanding calls storage.getSession() and returns full understanding
- queue_insight calls queueSpecialistInput() from Interviewer module

Location: packages/ideation/src/agents/specialists/tool-executor.ts
```

---

### Task #145: [IMPL] Implement specialist release (spc004)
- **Status:** pending
- **Blocked by:** #142
- **Blocks:** #146
- **Description:**
```
Feature: ideation-specialists
Step: spc004 - Implement specialist release
File: docs/flow/features/ideation-specialists.json

DO: Implement this step per its acceptance_criteria in the feature file.

Acceptance criteria:
- releaseSpecialists(sessionId) releases all spawned specialists for session
- Reads session.active_specialists[] to find agent IDs
- Uses Relay release() for each agent
- Called when session status changes to 'abandoned'

Location: packages/ideation/src/agents/specialists/lifecycle.ts
```

---

### Task #146: [IMPL] Write specialist tests (spc005)
- **Status:** pending
- **Blocked by:** #144, #145
- **Blocks:** #147
- **Description:**
```
Feature: ideation-specialists
Step: spc005 - Write specialist tests
File: docs/flow/features/ideation-specialists.json

DO: Implement this step per its acceptance_criteria in the feature file.

Acceptance criteria:
- Test prompt template generation
- Test tool execution with freeform observations (mock storage)
- Test release lifecycle
- Test custom specialist spawning (non-template)

Location: packages/ideation/src/agents/specialists/specialists.test.ts
```

---

### Task #147: [POST] Review ideation-specialists changes
- **Status:** pending
- **Blocked by:** #146
- **Blocks:** #148
- **Description:**
```
Feature: ideation-specialists
File: docs/flow/features/ideation-specialists.json

DO: Review this code as if it were a PR from another developer.

1. Re-read ALL code written or modified for this feature (packages/ideation/src/agents/specialists/*.ts)
2. Look for:
   - Bugs, logic errors, off-by-one mistakes
   - Missing edge cases or error handling
   - Integration issues with Interviewer module
   - Security issues
   - Performance concerns
   - Code that could be clearer or simpler
3. Make fixes and improvements - do not just note them

Be critical. If you would not approve this PR, fix it before marking complete.
```

---

### Task #148: [VERIFY] Check ideation-specialists criteria
- **Status:** pending
- **Blocked by:** #147
- **Blocks:** #149
- **Description:**
```
Feature: ideation-specialists
File: docs/flow/features/ideation-specialists.json

DO:
1. Read the feature's acceptance_criteria from the file
2. For EACH criterion: confirm it is met (not assumed)
3. Run tests: npm test in packages/ideation
4. If any criterion is NOT met, fix it before marking complete

List each criterion and its status:
- ac1: Prompt templates for common specialist types
- ac2: Specialists spawned LAZILY by Interviewer
- ac3: Specialists join session channel via Relay
- ac4: Specialists use update_observations MCP tool with freeform Record
- ac5: Observations structure defined by prompt, not schema
- ac6: Specialists can read other specialists' observations
- ac7: Specialists queue insights for Interviewer (never speak to user)
- ac8: Interviewer spawns specialists with custom focus/prompt
- ac9: Specialists are released when session is abandoned
```

---

### Task #149: [DOC] Document ideation-specialists completion
- **Status:** pending
- **Blocked by:** #148
- **Blocks:** #150
- **Description:**
```
Feature: ideation-specialists
File: docs/flow/features/ideation-specialists.json

DO:
1. Compare what you built to the plan_implementation.steps
2. If implementation diverged from plan, run /flow change-request
3. Update feature status if complete

Mark complete only if implementation matches plan (or change request filed).
```

---

### Task #150: [CHECKPOINT] Context check after ideation-specialists
- **Status:** pending
- **Blocked by:** #149
- **Blocks:** #151
- **Description:**
```
Feature: ideation-specialists complete.

DO:
1. Run /cost and report the ACTUAL percentage shown
2. If > 50%, run /compact before marking complete
3. Confirm specialists integrate properly with Interviewer
4. Mark complete only after reporting the actual number

You MUST state the actual context percentage. "Context is fine" without a number = task NOT complete.
```

---

## Feature 6: ideation-planner-handoff (Tasks #151-#162)

### Task #151: [PRE] Analyze before ideation-planner-handoff
- **Status:** pending
- **Blocked by:** #150
- **Blocks:** #152
- **Description:**
```
Feature: ideation-planner-handoff
File: docs/flow/features/ideation-planner-handoff.json

DO:
1. Run /cost and report the ACTUAL percentage. If > 50%, run /compact first
2. Read the feature file to understand goal and acceptance criteria
3. Review planner-core Plan entity and API (src/domain, src/api)
4. Verify ideation-lead and ideation-specialists are complete
5. Identify risks or blockers before implementing

Key patterns from feature file:
- Cross-scope: ideation-core -> planner-core
- Plan.source = { type: 'ideation', session_id }
- PlanVersion.understanding = freeform
- Sessions stay active - can continue ideating after sending

You MUST state the actual context percentage. DO NOT proceed until you've reported it.
```

---

### Task #152: [IMPL] Extend planner-core Plan schema for source (hnd001)
- **Status:** pending
- **Blocked by:** #151
- **Blocks:** #153
- **Description:**
```
Feature: ideation-planner-handoff
Step: hnd001 - Extend planner-core Plan schema for source
File: docs/flow/features/ideation-planner-handoff.json

DO: Implement this step per its acceptance_criteria in the feature file.

Acceptance criteria:
- Plan.source = { type: 'manual' | 'ideation' | 'intake', session_id?: string, signal_id?: string }
- source field stored in plans table (JSONB)
- Existing plans default to source.type = 'manual'

Location: src/domain/plan.ts, src/storage/sqlite.ts
```

---

### Task #153: [IMPL] Extend planner-core Plan schema for understanding (hnd002)
- **Status:** pending
- **Blocked by:** #152
- **Blocks:** #154
- **Description:**
```
Feature: ideation-planner-handoff
Step: hnd002 - Extend planner-core Plan schema for understanding
File: docs/flow/features/ideation-planner-handoff.json

DO: Implement this step per its acceptance_criteria in the feature file.

Acceptance criteria:
- PlanVersion.understanding = Record<string, Record<string, unknown>> (freeform)
- understanding field stored in plan_versions table (JSONB)
- Existing versions default to empty understanding {}

Note: This may already exist from schema-enrichment epic - verify and extend if needed.

Location: src/domain/version.ts, src/storage/sqlite.ts
```

---

### Task #154: [IMPL] Update POST /api/plans to accept source and understanding (hnd003)
- **Status:** pending
- **Blocked by:** #153
- **Blocks:** #155
- **Description:**
```
Feature: ideation-planner-handoff
Step: hnd003 - Update POST /api/plans to accept source and understanding
File: docs/flow/features/ideation-planner-handoff.json

DO: Implement this step per its acceptance_criteria in the feature file.

Acceptance criteria:
- CreatePlanRequest accepts optional source object
- CreatePlanRequest accepts optional understanding object
- Both are passed through to storage.createPlan()
- Returns full Plan including source and understanding

Location: src/api/handlers.ts, src/api/schemas.ts
```

---

### Task #155: [IMPL] Implement send-to-planner endpoint in ideation-core (hnd004)
- **Status:** pending
- **Blocked by:** #154
- **Blocks:** #156, #157
- **Description:**
```
Feature: ideation-planner-handoff
Step: hnd004 - Implement send-to-planner endpoint in ideation-core
File: docs/flow/features/ideation-planner-handoff.json

DO: Implement this step per its acceptance_criteria in the feature file.

Acceptance criteria:
- Works on active sessions
- If planner_sends is empty: creates new plan via planner-core API
- If planner_sends has entries: creates new plan version with updated understanding
- Appends PlannerSend to session.planner_sends (full payload snapshot)
- Returns { session, plan_id, plan_version, plan_channel, is_update }

Location: packages/ideation/src/api/handlers.ts
```

---

### Task #156: [IMPL] Add send_to_planner tool to Interviewer (hnd005)
- **Status:** pending
- **Blocked by:** #155
- **Blocks:** #158
- **Description:**
```
Feature: ideation-planner-handoff
Step: hnd005 - Add send_to_planner tool to Interviewer
File: docs/flow/features/ideation-planner-handoff.json

DO: Implement this step per its acceptance_criteria in the feature file.

Acceptance criteria:
- send_to_planner: { session_id, goal?, context? } -> calls send-to-planner endpoint
- Returns { success, plan_id, plan_channel, is_update } on success
- Interviewer can suggest sending when confidence is high

Location: packages/ideation/src/agents/interviewer/tools.ts, tool-executor.ts
```

---

### Task #157: [IMPL] Notify PlannerLead of plan from ideation (hnd006)
- **Status:** pending
- **Blocked by:** #155
- **Blocks:** #158
- **Description:**
```
Feature: ideation-planner-handoff
Step: hnd006 - Notify PlannerLead of plan from ideation
File: docs/flow/features/ideation-planner-handoff.json

DO: Implement this step per its acceptance_criteria in the feature file.

Acceptance criteria:
- After successful send, message plan channel
- Message includes: plan_id, session_id, is_update flag, goal
- PlannerLead picks up message and welcomes/acknowledges the update

Location: packages/ideation/src/api/handlers.ts or packages/ideation/src/agents/interviewer/tool-executor.ts
```

---

### Task #158: [IMPL] Write handoff integration tests (hnd007)
- **Status:** pending
- **Blocked by:** #156, #157
- **Blocks:** #159
- **Description:**
```
Feature: ideation-planner-handoff
Step: hnd007 - Write handoff integration tests
File: docs/flow/features/ideation-planner-handoff.json

DO: Implement this step per its acceptance_criteria in the feature file.

Acceptance criteria:
- Test first send creates plan
- Test subsequent sends update plan
- Test understanding is preserved in plan
- Test source is correctly set
- Test session stays active after send

Location: packages/ideation/src/api/handoff.test.ts
```

---

### Task #159: [POST] Review ideation-planner-handoff changes
- **Status:** pending
- **Blocked by:** #158
- **Blocks:** #160
- **Description:**
```
Feature: ideation-planner-handoff
File: docs/flow/features/ideation-planner-handoff.json

DO: Review this code as if it were a PR from another developer.

1. Re-read ALL code written or modified for this feature (both packages/ideation and src/ planner-core changes)
2. Look for:
   - Bugs, logic errors, off-by-one mistakes
   - Missing edge cases or error handling
   - Cross-scope integration issues
   - Security issues
   - Performance concerns
   - Code that could be clearer or simpler
3. Make fixes and improvements - do not just note them

Be critical. If you would not approve this PR, fix it before marking complete.
```

---

### Task #160: [VERIFY] Check ideation-planner-handoff criteria
- **Status:** pending
- **Blocked by:** #159
- **Blocks:** #161
- **Description:**
```
Feature: ideation-planner-handoff
File: docs/flow/features/ideation-planner-handoff.json

DO:
1. Read the feature's acceptance_criteria from the file
2. For EACH criterion: confirm it is met (not assumed)
3. Run tests in both packages/ideation and planner-core
4. If any criterion is NOT met, fix it before marking complete

List each criterion and its status:
- ac1: Session can be sent to Planner via API endpoint
- ac2: Plan inherits: goal, context, understanding
- ac3: Plan has source.type = 'ideation' and source.session_id
- ac4: Session stores full PlannerSend snapshot in planner_sends[]
- ac5: Subsequent sends append to planner_sends[], update the plan
- ac6: Session stays active - user can continue ideating
- ac7: Interviewer can use send_to_planner tool
- ac8: PlannerLead is notified when plan is created/updated from ideation
```

---

### Task #161: [DOC] Document ideation-planner-handoff completion
- **Status:** pending
- **Blocked by:** #160
- **Blocks:** #162
- **Description:**
```
Feature: ideation-planner-handoff
File: docs/flow/features/ideation-planner-handoff.json

DO:
1. Compare what you built to the plan_implementation.steps
2. If implementation diverged from plan, run /flow change-request
3. Update feature status if complete

Mark complete only if implementation matches plan (or change request filed).
```

---

### Task #162: [CHECKPOINT] Context check after ideation-planner-handoff
- **Status:** pending
- **Blocked by:** #161
- **Blocks:** (none)
- **Description:**
```
Feature: ideation-planner-handoff complete. This completes the ideation-package backend epic.

DO:
1. Run /cost and report the ACTUAL percentage shown
2. If > 50%, run /compact before marking complete
3. Confirm ideation -> planner handoff works end-to-end
4. Suggest running /flow audit on the ideation-package epic
5. Mark complete only after reporting the actual number

You MUST state the actual context percentage. "Context is fine" without a number = task NOT complete.
```

---

## Dependency Graph

```
ideation-domain (#83-#95)
    └── ideation-storage (#96-#109)
        └── ideation-api (#110-#123)
            └── ideation-lead (#124-#140)
                └── ideation-specialists (#141-#150)
                    └── ideation-planner-handoff (#151-#162)
```

## Task Type Legend

- **[PRE]**: Pre-implementation analysis - understand scope before coding
- **[IMPL]**: Implementation task - write the code
- **[POST]**: Post-implementation review - PR-style code review
- **[VERIFY]**: Verify acceptance criteria are met
- **[DOC]**: Document completion, check for plan divergence
- **[CHECKPOINT]**: Context/cost check, potential compaction point

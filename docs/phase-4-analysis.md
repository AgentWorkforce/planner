# Phase 4 Analysis: Backend Hardening

## Executive Summary

This analysis examines four key areas for Phase 4 implementation:
- **4.1**: Capabilities endpoint and feature flags
- **4.2**: Forge-core TODO audit and wiring
- **4.3**: Request timeout middleware
- **4.4**: PlannerLead health check and recovery

All findings and recommendations are detailed below with file paths and line numbers for reference.

---

## 4.1: Capabilities Endpoint and Feature Flags

### Current State

**Relay Health Check (Existing)**
- File: `/Users/flysikring/conductor/workspaces/plannr/auckland/packages/server/src/api/handlers/health.ts`
- Endpoint: `GET /api/health/relay`
- Returns: `RelayHealthResponse` with status (`connected` | `disconnected` | `error` | `standalone`)
- Current use: Detects relay daemon connection status only

**Server Health Endpoint (Missing)**
- No general server health check endpoint exists at `/api/health` or `/api/status`
- Each subsystem (planner, forge, ideation) has isolated health info

### What Capabilities Endpoint Should Include

A comprehensive capabilities endpoint should expose:

1. **Relay Status**
   - Current mode: `'connected'` | `'disconnected'` | `'mock'`
   - Socket path being used
   - Reconnection state (if applicable)

2. **AI/LLM Availability**
   - Whether Anthropic API key is configured (`hasApiKey()` exists in `/packages/server/src/relay/anthropic-config.ts`)
   - Model availability (Claude Opus 4.5)
   - PlannerLead operational status

3. **Service Health**
   - Planner service: ready/degraded/unavailable
   - Ideation service: ready/degraded/unavailable
   - Forge service: ready/degraded/unavailable (health check at `/api/forge/health` exists)

4. **Feature Flags**
   - Real agent spawning enabled (tied to relay + forge mode)
   - Plan execution enabled (forge mode)
   - Multi-scope planning enabled
   - Change request workflow enabled

5. **Configuration State**
   - Execution mode (`'real'` | `'test'`)
   - Database paths
   - Feature limitations (if in mock/test mode)

### Recommended Endpoint Structure

**Location**: Server package (`/packages/server/src/api/handlers/capabilities.ts`)

**Endpoint**: `GET /api/capabilities`

**Response Schema**:
```typescript
interface CapabilitiesResponse {
  server_version?: string;
  uptime_seconds?: number;

  relay: {
    status: 'connected' | 'disconnected' | 'mock';
    socket_path: string;
    reconnecting: boolean;
  };

  ai: {
    available: boolean;
    model?: string; // 'claude-opus-4-5', etc.
    planner_lead_active: boolean;
  };

  services: {
    planner: 'ready' | 'degraded' | 'unavailable';
    ideation: 'ready' | 'degraded' | 'unavailable';
    forge: 'ready' | 'degraded' | 'unavailable';
  };

  features: {
    real_agents_enabled: boolean;     // relay + forge('real')
    plan_execution_enabled: boolean;   // forge available
    multi_scope_planning: boolean;     // always true
    change_requests: boolean;          // always true
  };

  execution_mode: 'real' | 'test';
  limitations?: string[];              // e.g., ["AI unavailable", "agent spawning disabled"]
}
```

### Implementation Steps

1. Create handler in `/packages/server/src/api/handlers/capabilities.ts`
   - Query relay mode via `getRelayMode()`, `getConnectionState()`
   - Check AI availability via `hasApiKey()` from anthropic-config
   - Query PlannerLead status via `isPlannerLeadActive()`
   - Aggregate service health from each subsystem

2. Register route in `/packages/server/src/api/routes.ts`
   - Add: `router.get('/capabilities', capabilityHandlers.list);`

3. Update server startup logs to mention the endpoint

4. **Feature flags** can be added later via a separate feature flags service or config file

### What Feature Flags Should Control

- **Planner AI responses**: Disable AI suggestions in UI when `hasApiKey()` is false
- **Plan execution**: Disable "Publish and Execute" button when forge isn't ready
- **Agent spawning**: Only allow real agent spawning when relay is connected
- **Change requests**: Always enabled (doesn't require AI)

---

## 4.2: Forge-Core TODO Audit

### All TODOs Found

**File**: `/Users/flysikring/conductor/workspaces/plannr/auckland/packages/forge-core/src/services/orchestrator.ts`

#### TODO #1 (Line 355)
```typescript
model_id: 'sonnet', // TODO: get actual model from tracker
```
- **Severity**: MODERATE
- **Context**: Task completion handling, emitting metrics
- **Issue**: Hardcoded model name instead of tracking which model the agent actually used
- **Wiring**: Need to pass model ID from agent tracker or task metadata
- **Recommendation**: WIRE UP - Important for accurate metrics and cost tracking

#### TODO #2 (Line 374)
```typescript
model_used: 'sonnet', // TODO: actual model (forge-agent-metrics)
```
- **Severity**: MODERATE
- **Context**: Task outcome emission to tuner
- **Issue**: Same as TODO #1 - hardcoded model
- **Recommendation**: WIRE UP - Use same solution as TODO #1

#### TODO #3 (Line 375)
```typescript
complexity_estimate: 'simple', // TODO: from plan
```
- **Severity**: MODERATE
- **Context**: Task outcome metrics
- **Issue**: Complexity should come from the plan's step complexity estimate
- **Wiring**: Need access to plan version step details; pass via task context
- **Recommendation**: WIRE UP - Required for meaningful tuner feedback

#### TODO #4 (Line 409)
```typescript
'Task execution failed', // TODO: get actual error from agent
```
- **Severity**: MODERATE
- **Context**: Task failure handling
- **Issue**: Generic error message instead of actual agent error
- **Wiring**: Agent must report error reason; pass via exit code or message
- **Recommendation**: WIRE UP - Critical for debugging failed tasks

#### TODO #5 (Line 418)
```typescript
model_used: 'sonnet', // TODO: actual model (forge-agent-metrics)
```
- **Severity**: MODERATE
- **Context**: Task failure outcome emission
- **Issue**: Duplicate of TODO #2
- **Recommendation**: WIRE UP - Same solution as TODO #1 & #2

#### TODO #6 (Line 419)
```typescript
complexity_estimate: 'simple', // TODO: from plan
```
- **Severity**: MODERATE
- **Context**: Task failure outcome metrics
- **Issue**: Duplicate of TODO #3
- **Recommendation**: WIRE UP - Same solution as TODO #3

#### TODO #7 (Line 472)
```typescript
replan_count: 0,       // TODO: wire to actual RunService counters (forge-replan-escalation-tracking)
escalation_count: 0,   // TODO: wire to actual RunService counters (forge-replan-escalation-tracking)
```
- **Severity**: LOW
- **Context**: Run completion metrics
- **Issue**: Not tracking replan/escalation attempts
- **Wiring**: RunService tracks these via `handleTaskFailure()` calls
- **Recommendation**: DEFER - Nice-to-have for v2, doesn't block execution

#### TODO #8 (Line 516)
```typescript
replan_count: 0,       // TODO: wire to actual RunService counters (forge-replan-escalation-tracking)
escalation_count: 0,   // TODO: wire to actual RunService counters (forge-replan-escalation-tracking)
```
- **Severity**: LOW
- **Context**: Run failure metrics
- **Issue**: Duplicate of TODO #7
- **Recommendation**: DEFER - Part of same escalation tracking feature

**File**: `/Users/flysikring/conductor/workspaces/plannr/auckland/packages/server/src/relay/forge-spawner.ts`

#### TODO #9 (Line 162)
```typescript
// TODO: Add planId when available in SpawnTaskOptions (for channel join + MCP context)
```
- **Severity**: LOW
- **Context**: Forge task spawning
- **Issue**: Spawned agents don't automatically join plan channels or get MCP context
- **Wiring**: SpawnTaskOptions interface would need `planId` field; then agent auto-joins
- **Recommendation**: DEFER - v2 feature for better agent UX

**File**: `/Users/flysikring/conductor/workspaces/plannr/auckland/packages/forge-core/src/services/guardian-templates.ts`

#### Line 280
```typescript
/\/\/\s*TODO|\/\/\s*FIXME|\/\/\s*HACK/gi,
```
- **Note**: This is a regex pattern in QualityRegression gate template, NOT a TODO itself
- This detects TODO/FIXME/HACK in code being reviewed

### Summary of Recommendations

**WIRE UP (Phase 4)**:
- TODO #1, #2, #5: Get actual model from agent tracking
- TODO #3, #6: Get complexity estimate from plan step
- TODO #4: Capture actual error message from agent failure

**DEFER (Phase 5+)**:
- TODO #7, #8: Replan/escalation counting (requires RunService enhancements)
- TODO #9: planId in SpawnTaskOptions (UX improvement)

---

## 4.3: Request Timeout Middleware

### Current State

**Middleware Architecture**:
- Central error handler exists: `/packages/errors/src/index.ts`
- Exports: `HttpError`, `errorHandler` middleware
- Status codes: 404, 400, 422, 409, 500 only
- No timeout-specific handling

**Per-Service Middleware**:

**Planner** (`/packages/planner/src/api/middleware.ts`):
- File is just re-exports from `@plannr/errors`
- No timeout logic

**Forge-core** (`/packages/forge-core/src/api/app.ts`):
- Lines 56-68: Has `requestLogger` middleware
- No timeout handling

**Server** (`/packages/server/src/server.ts`):
- Line 83: `app.use(express.json())`
- Line 87-95: Applies middleware in order
- Line 155: `app.use(errorHandler)`
- No timeout middleware

### What Timeout Middleware Should Do

1. **Request-level timeout**
   - Abort requests that take longer than threshold
   - Return 408 Request Timeout (or 504 Gateway Timeout for long-running)
   - Properly clean up resources (database connections, file handles)

2. **Context-aware timeouts**
   - Different timeouts for different endpoints:
     - Quick synchronous calls: 5-10 seconds
     - AI generation: 30-60 seconds
     - Plan execution: 5+ minutes (background task)
     - File uploads: 2-5 minutes

3. **Timeout error handling**
   - Emit error event (for logging/trajectory)
   - Transition run/task to failed state if timeout during execution
   - Don't leave incomplete database transactions

### Recommended Timeout Strategy

**Location**: `/packages/server/src/middleware/timeout.ts` (new file)

**Implementation approach**:
```typescript
// Global timeout middleware (express-timeout-handler or custom)
app.use(timeout('30s')); // Default: 30 seconds
app.use(timeoutHandler);  // Convert timeout to proper response

// Endpoint-specific overrides
app.post('/plans/:id/versions/:version/publish',
  timeout('5m'),  // Plan execution can take long
  workflowHandlers.publish
);

app.post('/mcp/tools/call',
  timeout('2m'),  // MCP calls (AI) need time
  mcpHandlers.callTool
);
```

**Timeout values by category**:
- Metadata operations (list, get): 5-10s
- Creation/updates: 10-15s
- AI operations (chat, suggestions): 60s
- Plan publishing (triggers background execution): 10s (execution itself is async)
- SSE endpoints: 5m (streaming)
- File operations: 2-5m

### What Not To Do

- Don't use `req.setTimeout()` alone - it's TCP-level, not HTTP-level
- Don't timeout SSE endpoints (they stream indefinitely)
- Don't timeout background job endpoints that return immediately
- Don't lose database state on timeout (proper cleanup needed)

### Implementation Steps

1. Choose timeout library:
   - `http-server-timeout` (simple, built-in)
   - `express-timeout-handler` (higher-level)
   - Custom middleware (most control)

2. Create `/packages/server/src/middleware/timeout.ts`
   - Global timeout (30s default)
   - Handlers for timeout events
   - Cleanup on timeout (disconnect, transaction rollback)

3. Wire into server startup (`/packages/server/src/server.ts`)
   - Add before route handlers
   - Add endpoint-specific overrides for known long-runners

4. Test timeout behavior:
   - Verify cleanup happens
   - Verify proper error response (408 vs 504)
   - Verify SSE endpoints not affected

5. Add timeout to error handler
   - New error type: `TimeoutError extends HttpError`
   - Status: 408 Request Timeout or 504 Gateway Timeout

### Suggested Error Class

```typescript
// In @plannr/errors
export class TimeoutError extends HttpError {
  constructor(resource: string = 'Request') {
    super(408, `${resource} timeout`);
    this.name = 'TimeoutError';
  }
}
```

---

## 4.4: PlannerLead Health Check and Recovery

### Current State of PlannerLead

**File**: `/Users/flysikring/conductor/workspaces/plannr/auckland/packages/server/src/relay/planner-lead.ts`

**Initialization** (Lines 314-349):
- Runs `initPlannerLead(storage)` on server startup
- Registers message handler via `onMessage()`
- Subscribes to state changes via `onStateChange()`
- Sets `initialized = true` when ready
- Announces startup when relay is ready

**Message Handling** (Lines 218-290):
- Routes incoming messages to handlers
- Validates channel membership
- Emits working/idle/error states via `emitAgentStatusUpdate()`
- No timeout handling on individual message processing
- No circuit breaker pattern

**State Management**:
- Module-level variables: `initialized`, `storage`, `unsubscribeMessage`, `agentId`
- Global `pendingQuestions` map for trajectory tracking
- No internal health monitoring

**Potential Failure Points**:

1. **Relay disconnection** (Line 296-308)
   - `announceStartup()` checks `isConnected()` before announcing
   - Handles reconnection via `onStateChange('READY')` handler
   - No heartbeat to detect stale connections

2. **API call failures** (Line 122-185)
   - Anthropic API errors caught in try-catch
   - Falls back to mock response on failure
   - No retry logic
   - No circuit breaker on repeated failures

3. **Tool execution failures** (Line 139-152)
   - Tool errors logged but not systematically tracked
   - No rate limiting on tool calls
   - No timeout per tool execution

4. **Message handler errors** (Line 53-58 in client.ts)
   - Caught but only logged
   - Message may be silently dropped

5. **Initialization failures**
   - No graceful degradation if storage is unavailable
   - No periodic re-initialization attempt

### What Health Check Should Monitor

1. **Connectivity**
   - Is relay connected? (via `getConnectionState()`)
   - Is Anthropic API accessible? (via `hasApiKey()`)
   - Can we reach storage? (via storage.listPlans() test call)

2. **Performance**
   - Average message response time
   - Last successful message timestamp
   - Message queue depth (if implementing queue)

3. **Operational Health**
   - Is `initialized === true`?
   - Are there pending questions stuck > 1 hour?
   - Any recent errors? (last N error timestamps)

4. **Resource Usage**
   - Conversation history size per channel (memory leak check)
   - Pending questions count
   - Active message handlers

### Recommended Recovery Mechanisms

1. **Auto-reconnection**
   - Already implemented via `onStateChange()` handlers
   - Re-announce and re-join channels on reconnection
   - No manual intervention needed

2. **Graceful degradation**
   - When Anthropic unavailable: continue with mock responses (already done)
   - When storage unavailable: can't read plans, but can still respond
   - When relay unavailable: no channels available, but mock mode works

3. **Stuck conversation detection**
   - If conversation history grows >100KB per channel, trim old messages
   - If pending question > 24 hours, auto-dismiss

4. **Circuit breaker pattern**
   - If Anthropic API fails N times in row, temporarily disable AI
   - Reset after timeout or manual intervention

5. **Periodic health pulse**
   - Every 5 minutes, validate storage reachability
   - Log health metrics to trajectory

### Health Check Endpoint

**Location**: `/packages/server/src/api/handlers/health.ts` (extend existing)

**Addition to existing file** (after `relayHealth` handler):
```typescript
// Add to healthHandlers object:
plannerLeadHealth: async (_req: Request, res: Response): Promise<void> => {
  const response = {
    status: isPlannerLeadActive() ? 'active' : 'inactive',
    initialized: isPlannerLeadActive(),
    relay_connected: isConnected(),
    ai_available: hasApiKey(),
    message_handlers: getMessageHandlerCount(),
    pending_questions: getPendingQuestionsCount(),
    last_activity: getLastActivityTimestamp(),
    conversation_history_size: getTotalHistorySize(),
  };
  res.json(response);
};
```

**Route addition** (in `/packages/server/src/api/routes.ts`):
```typescript
router.get('/health/planner-lead', healthHandlers.plannerLeadHealth);
```

### Implementation Steps

1. Create health monitoring module (`/packages/server/src/relay/planner-lead-health.ts`)
   - Track last activity timestamp
   - Track API failure count and reset timer
   - Monitor conversation history sizes
   - Detect stuck pending questions

2. Extend PlannerLead exports
   - `getHealthStatus()` - returns full health object
   - `getLastActivityTimestamp()` - for health endpoint
   - `resetAPIFailureCounter()` - for recovery attempts

3. Add health check to capabilities endpoint
   - Include PlannerLead status in `/api/capabilities`

4. Add periodic health pulse (optional for v1)
   - Every 5 minutes, test storage reachability
   - Every 10 minutes, log metrics to trajectory

5. Implement stuck question cleanup (optional for v1)
   - Auto-dismiss questions > 24 hours old
   - Log dismissal to trajectory

6. Circuit breaker for repeated API failures (optional for v1)
   - After 5 consecutive failures, disable AI
   - Try reconnection every 30 seconds
   - Re-enable when successful

### Key Files to Modify

- `/packages/server/src/relay/planner-lead.ts` - Add monitoring exports
- `/packages/server/src/api/handlers/health.ts` - Add planner-lead-health handler
- `/packages/server/src/api/routes.ts` - Register planner-lead-health route
- `/packages/server/src/relay/planner-lead-health.ts` - NEW: monitoring module
- `/packages/server/src/server.ts` - Log health status on startup (optional)

### What Recovery Should NOT Do

- Don't restart the entire planner-lead service (expensive, disruptive)
- Don't timeout individual message handling (too aggressive)
- Don't clear conversation history on minor errors
- Don't require manual intervention for common issues
- Don't spam error logs on transient failures

---

## Integration Points Across Four Tasks

### Task Dependencies

**4.1 (Capabilities)** → Consumes outputs from:
- 4.2: Forge TODO status (affects feature flags)
- 4.4: PlannerLead health (affects AI capability reporting)

**4.2 (Forge TODOs)** → Required before:
- 4.1: To accurately report what's wired vs. not

**4.3 (Timeouts)** → Applies to all:
- Affects 4.1 capabilities endpoint
- Affects 4.4 planner-lead message processing

**4.4 (PlannerLead Health)** → Used by:
- 4.1: Capabilities endpoint
- 4.3: Timeout middleware (if message processing times out)

### Recommended Execution Order

1. **First**: 4.2 (Forge TODOs) - fixes metrics/error tracking in core execution
2. **Second**: 4.3 (Timeouts) - protects all endpoints, quick to implement
3. **Third**: 4.1 (Capabilities) - consumes state from 4.2
4. **Fourth**: 4.4 (PlannerLead Health) - integrates with 4.1

Or in parallel (2 agents):
- Agent A: 4.2 + 4.1 (metrics, capabilities)
- Agent B: 4.3 + 4.4 (infrastructure, health)

---

## Summary Table

| Task | Type | Complexity | WIRED | DEFER | Key Files |
|------|------|-----------|-------|-------|-----------|
| 4.1 | Feature | MEDIUM | Schema + handler | Feature flags | `/packages/server/src/api/handlers/capabilities.ts` (new) |
| 4.2 | Audit | MEDIUM | 6 TODOs | 2 TODOs | `/packages/forge-core/src/services/orchestrator.ts` |
| 4.3 | Infra | MEDIUM | Timeout MW | Endpoint overrides | `/packages/server/src/middleware/timeout.ts` (new) |
| 4.4 | Observability | MEDIUM | Health endpoint | Circuit breaker | `/packages/server/src/relay/planner-lead-health.ts` (new) |

---

## Questions for Implementation

1. **4.1**: Should feature flags be persisted in database or just computed from runtime state?
2. **4.2**: How should model ID be tracked? Add to `AgentTracker` or extract from task metadata?
3. **4.3**: Use `express-timeout-handler` library or custom middleware?
4. **4.4**: Should PlannerLead auto-heal or require monitoring/alerting?


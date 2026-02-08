# PRE Analysis: Tend Unified Interviewer

## Task #152 - Analysis Before Implementation

### Architecture Overview

The codebase uses a **monolithic backend structure** under `/src`, not separate packages as implied by the feature documentation. Key directories:
- `/src/relay/` - Relay client integration, agent services
- `/src/domain/` - Domain entities (Plan, Step, Project, etc.)
- `/src/storage/` - SQLite storage layer
- `/src/api/` - Express API handlers

### Existing Services to Merge

#### 1. PlannerLead Service (`/src/relay/planner-lead.ts`)
- **Pattern**: Persistent RelayClient service (NOT spawn-based)
- **Location**: Initialized in `server.ts` via `initPlannerLead(storage)`
- **Channels**: `#planner` + `#plan-{id}` channels
- **Tools**: 11 tools in `planner-lead-tools.ts`:
  - `read_plan`, `list_plans`, `add_step`, `edit_step`, `delete_step`
  - `set_dependencies`, `add_acceptance_criterion`, `ask_user_question`
  - `spawn_agent`, `release_agent`, `list_agents`
- **Conversation History**: Managed per channel in `conversation-history.ts`
- **Anthropic Integration**: Tool calling with `@anthropic-ai/sdk`
- **Agent Status**: Emits presence events via `agent-status.ts`

#### 2. Ideation InterviewerService (Missing)
**Issue**: The feature doc references `packages/ideation/src/interviewer/service.ts` (~965 lines, 7 tools), but this doesn't exist in the current codebase.

**Analysis**:
- `packages/ideation/` only contains `dist/` directory (no source)
- Similar pattern: ideation may have been a separate service that was deprecated/removed
- Tools mentioned in feature doc:
  - `spawn_specialist`, `read_blocks`, `update_understanding`, `update_synthesis`

**Decision**: Since ideation source doesn't exist, we'll create the unified service based solely on the PlannerLead pattern + new tool definitions from the feature spec.

### Project Entity Structure

From `/src/storage/interface.ts`:

```typescript
interface Project {
  id: string;
  name: string;
  owner_id: string | null;
  initiative_id: string | null;
  session_id: string | null;  // Links to ideation session
  plan_id: string | null;      // Links to plan
  run_id: string | null;        // Links to forge run
  config: Record<string, unknown> | null;
  current_focus: Record<string, unknown> | null;  // For context enrichment
  created_at: string;
  updated_at: string;
}
```

The `Project` entity is the unifying concept that links ideation → planning → execution phases.

### Channel Migration Strategy

**Current**:
- PlannerLead listens on: `#planner`, `#plan-{planId}`
- (Ideation would have listened on: `#ideation-{sessionId}`)

**Target** (per feature spec):
- TendInterviewerService listens on: `#project-{projectId}`

**Migration Path**:
1. Create TendInterviewerService listening on `#project-{id}` channels
2. Keep PlannerLead running for backward compatibility (existing plans)
3. Eventually deprecate PlannerLead once all plans are migrated to projects

### Tool Set Inventory

#### From PlannerLead (Existing)
```typescript
// Planner tools
- read_plan
- list_plans
- add_step
- edit_step
- delete_step
- set_dependencies
- add_acceptance_criterion

// Interaction tools
- ask_user_question
- spawn_agent
- release_agent
- list_agents
```

#### From Feature Spec (New)
```typescript
// Ideation tools (to be created)
- spawn_specialist    // From ideation domain
- read_blocks         // From ideation domain
- update_understanding
- update_synthesis

// Bridge tools (to be created)
- graduate_blocks     // POST /api/projects/:id/graduate
- start_execution     // POST /api/forge/runs

// Interaction tools (copy from PlannerLead)
- ask_user_question
- spawn_agent
- release_agent
```

### Implementation Location

Based on existing patterns:

| Component | Location | Notes |
|-----------|----------|-------|
| Service | `/src/relay/tend-interviewer.ts` | Main service file (similar to planner-lead.ts) |
| Tools | `/src/relay/tend-interviewer-tools.ts` | Tool definitions + handlers |
| Prompt | `/src/relay/tend-interviewer-prompt.ts` | System prompt template |
| Init | `/src/server.ts` | Add `initTendInterviewer(storage)` |

### Tool Categories

Following the feature spec structure:

```typescript
// /src/relay/tend-interviewer-tools/
├── index.ts              // Merged exports
├── ideation-tools.ts     // spawn_specialist, read_blocks, update_understanding, update_synthesis
├── planner-tools.ts      // read_plan, add_step, edit_step (adapted from planner-lead-tools.ts)
├── bridge-tools.ts       // graduate_blocks, start_execution
└── interaction-tools.ts  // ask_user_question, spawn_agent, release_agent (copied from planner-lead)
```

### Context Focus Enrichment

From Project entity:
```typescript
current_focus: {
  focus_type: 'step' | 'scope' | 'block';
  focus_id: string;
} | null
```

When user's `current_focus` changes, the next AI invocation includes:
- For `step` focus: step title, status, AC, dependencies, agent status, recent events
- For `scope` focus: scope summary, progress, active steps
- For `block` focus: block content, curated status, specialist insights

### Forge SSE Subscription

From feature spec:
- Subscribe to `GET /api/forge/runs/:id/events` SSE stream
- Buffer non-blocking events: `step_progress`, `agent_spawned`, `pr_created`
- Immediate invocation for blocking events: `agent_needs_input`, `gate_reached`
- Trickle logic: AI decides what to surface based on prompt rules (not code filtering)

**Implementation**: Create hook similar to existing event listeners (check `/src/events/` for patterns)

### Conversation History Unification

Current PlannerLead pattern:
- Per-channel history in `conversation-history.ts`
- Messages stored with role (user/assistant/system)

Target unified pattern:
- One history per project (not per channel)
- Stored in `project_messages` table
- Tagged with:
  - `channel_id`: 'main' or 'agent-{agentId}'
  - `role`: user/assistant/system
  - `metadata`: { block_refs, step_refs, attention_level }

### Dependencies for Implementation

From `/src/storage/interface.ts`, verify if these tables/methods exist:
- ✅ `Project` table - exists
- ✅ `storage.getProject(id)` - exists
- ✅ `storage.listProjects(filter)` - exists
- ❓ `project_messages` table - need to check migrations
- ❓ `storage.getProjectMessages(projectId)` - need to implement

### Frontend Integration Point

From `/packages/tend/` (frontend package):
- WebSocket proxy at `/ws/relay`
- Context: `/packages/tend/src/contexts/`
- Hooks pattern similar to existing `useRelayConnection`, `useProjectEvents`

**New hook needed**: `useForgeEvents` for SSE subscription to forge events (per task uni07)

### Open Questions

1. **Ideation domain missing**: Should we create stub ideation tools or skip them for MVP?
   - **Recommendation**: Create stub/mock implementations for now, mark as TODO for when ideation domain is re-added

2. **Migration strategy**: How to handle existing plans not linked to projects?
   - **Recommendation**: Keep PlannerLead running in parallel, gradually migrate plans to projects

3. **Database changes**: Need `project_messages` table migration?
   - **Action**: Check existing migrations, create if missing

4. **Channel membership**: Does relay require explicit `joinChannel('#project-{id}')`?
   - **Action**: Check `channels.ts` for pattern (yes, based on PlannerLead)

### Implementation Order

Based on feature spec steps, adjusted for actual codebase:

1. **uni01**: Create TendInterviewerService shell
   - Location: `/src/relay/tend-interviewer.ts`
   - Copy structure from `planner-lead.ts`
   - Listen on `#project-{id}` channels

2. **uni02**: Merge ideation tool set (STUBS)
   - Location: `/src/relay/tend-interviewer-tools/ideation-tools.ts`
   - Create stub implementations (return mock data for now)

3. **uni03**: Merge planner tool set
   - Location: `/src/relay/tend-interviewer-tools/planner-tools.ts`
   - Adapt from `planner-lead-tools.ts`
   - Read from `project.plan_id` instead of accepting `plan_id` param

4. **uni04**: Add bridge tools
   - Location: `/src/relay/tend-interviewer-tools/bridge-tools.ts`
   - `graduate_blocks`: POST `/api/projects/:id/graduate`
   - `start_execution`: POST `/api/forge/runs`

5. **uni05**: Add interaction tools
   - Location: `/src/relay/tend-interviewer-tools/interaction-tools.ts`
   - Copy from `planner-lead-tools.ts`: ask_user_question, spawn_agent, release_agent

6. **uni06**: Implement context focus enrichment
   - Read `project.current_focus` on each invocation
   - Enrich system prompt with focused entity details

7. **uni07**: Implement forge SSE subscription
   - Create `/packages/tend/src/hooks/useForgeEvents.ts` (FRONTEND)
   - Backend: Buffer events, trigger immediate invocation for blocking events

8. **uni08**: Write system prompt template
   - Location: `/src/relay/tend-interviewer-prompt.ts`
   - Structure: project state, pending events, specialist insights, current_focus, rules

9. **uni09**: Unify conversation history
   - Create `project_messages` table migration (if missing)
   - Implement `storage.getProjectMessages(projectId)`
   - Tag messages with channel_id, metadata

### Risk Assessment

- **Low Risk**: Tool structure (well-defined pattern from PlannerLead)
- **Medium Risk**: Ideation domain missing (stub for now, may need rework)
- **High Risk**: Forge SSE subscription (new pattern, trickle logic in prompt)

### Success Criteria

Per acceptance criteria from feature spec:
- ✅ TendInterviewerService created as persistent RelayClient
- ✅ Listens on `#project-{projectId}` channels
- ✅ Tool set includes ideation, planner, bridge, interaction tools
- ✅ One conversation history per project
- ✅ Context focus enrichment working
- ✅ Forge SSE subscription active
- ✅ System prompt follows spec structure
- ✅ AI maintains one voice (never reveals specialists/agents)

### Next Steps

1. Mark task #152 as completed (PRE analysis done)
2. Begin implementation with task #153 (uni01 - service shell)
3. Create tools in parallel (uni02-uni05)
4. Implement advanced features (uni06-uni09)

---

**Analysis completed**: 2026-02-07
**Analyst**: Backend System Architect

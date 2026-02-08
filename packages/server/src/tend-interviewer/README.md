# Tend Interviewer Service

THIN wrapper around the ideation InterviewerService that adds phase-aware tool routing.

## Architecture

This is **NOT** a rewrite of the interviewer. The real interviewer exists at `packages/ideation/src/interviewer/service.ts` with full Anthropic SDK integration, tool calling, specialist spawning, etc.

This wrapper:
1. Delegates core conversation to the ideation interviewer
2. Extends the tool set with planning + forging tools based on project phase
3. Enriches the system prompt with project context and current focus
4. Subscribes to forge SSE events for the trickle layer

## Implementation Status

### ✅ uni01: TendInterviewerService shell
Created service structure with phase detection and context enrichment.

### ✅ uni02: Ideation tool set merged
Tool definitions copied from ideation package (spawn_specialist, read_blocks, update_understanding, update_synthesis).

### ✅ uni03: Planner tool set merged
Tool definitions for planning phase (create_step, update_step, add_dependency, suggest_scope).

### ✅ uni04: Bridge tools added
Cross-phase tools (graduate_project, get_project_status, update_focus).

### ✅ uni05: Interaction tools added
User input tools (ask_question, present_choices, request_approval).

### ✅ uni06: Context focus enrichment
Reads `project.current_focus` and enriches system prompt with focused entity details.

### ⏳ uni07: Forge SSE subscription (trickle layer)
TODO: Subscribe to forge SSE events, buffer non-blocking events, trigger immediate invocation for blocking events.

### ✅ uni08: System prompt template
Created phase-aware prompt (ideation → planning → forging).

### ⏳ uni09: Unify conversation history
TODO: Implement unified history per project (not per channel).

## Files

```
packages/server/src/tend-interviewer/
├── service.ts                 # Main service (wrapper around ideation interviewer)
├── prompt.ts                  # Phase-aware system prompt
├── tools/
│   ├── index.ts               # Merged tool exports
│   ├── ideation-tools.ts      # spawn_specialist, read_blocks, etc.
│   ├── planner-tools.ts       # create_step, update_step, etc.
│   ├── bridge-tools.ts        # graduate_project, get_project_status, etc.
│   ├── interaction-tools.ts   # ask_question, present_choices, etc.
│   └── executor.ts            # Tool execution routing
└── README.md                  # This file
```

## Usage

```typescript
import { initTendInterviewer, tendInterviewer } from './tend-interviewer/service.js';

// Initialize with dependencies
initTendInterviewer({
  ideationStorage,
  plannerStorage,
  forgeStorage,
  projectStorage,
});

// Process a message
const response = await tendInterviewer.processMessage(
  projectId,
  sessionId,
  userMessage
);
```

## Integration Points

### With Ideation Package
- Delegates to `InterviewerService.handleMessage()` for core conversation
- Reuses ideation tool definitions
- Extends with phase-aware tools

### With Planner Package
- Calls planner API for step manipulation
- Reads plan context for focus enrichment

### With Forge Package
- Subscribes to SSE events for trickle layer
- Calls forge API for execution control

### With Project Entity
- Reads project state to determine phase
- Updates `current_focus` for context enrichment
- Links session → plan → run

## TODO

1. **Wire up real ideation interviewer** - currently using placeholder
2. **Implement forge SSE subscription** - uni07
3. **Implement unified conversation history** - uni09
4. **Complete tool executors** - many tools return "not yet implemented"
5. **Add relay integration** - for specialist spawning
6. **Add question queue integration** - for interaction tools

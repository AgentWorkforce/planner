# Specialist Tools Access Problem - Analysis & Solutions

**Date**: 2026-02-04
**Issue**: Spawned specialist agents don't have access to their MCP tools (create_block, update_block, list_blocks)

## Problem Statement

When `spawner.ts` spawns a Claude agent with `cli: 'claude'`, the agent receives a prompt that DESCRIBES the specialist tools but the tools are NOT actually registered in the agent's runtime. The specialist agents need to create blocks in the session, but they have no mechanism to do so.

## Current Architecture

### Existing API Endpoints

The ideation package **already has HTTP endpoints** for block operations:

```
POST   /api/ideation/sessions/:id/blocks          - Create block
PATCH  /api/ideation/sessions/:id/blocks/:blockId - Update block
GET    /api/ideation/sessions/:id/blocks          - List blocks
DELETE /api/ideation/sessions/:id/blocks/:blockId - Delete block
POST   /api/ideation/sessions/:id/blocks/:blockId/curate - Curate block
```

**Location**: `packages/ideation/src/api/routes.ts` (lines 88-122)
**Handlers**: `packages/ideation/src/api/handlers.ts` (lines 446-613)

### Current Tool Infrastructure

1. **Tool Definitions**: `packages/ideation/src/specialists/tools.ts`
   - Defines MCP tool schemas: `create_block`, `update_block`, `list_blocks`
   - These are Anthropic.Tool[] definitions for Claude's structured outputs

2. **Tool Executor**: `packages/ideation/src/specialists/tool-executor.ts`
   - `executeSpecialistTool()` function processes tool calls
   - Directly calls storage layer (IdeationStorage)
   - Used by the Interviewer agent running in the backend

3. **Spawner**: `packages/ideation/src/relay/spawner.ts`
   - Spawns specialist agents via `spawnAgent({ cli: 'claude', task: prompt })`
   - Prompt describes tools in natural language but doesn't register them
   - Specialists are spawned as **separate Claude CLI processes**

### Why Current Approach Doesn't Work

The spawned specialists are **isolated Claude instances**. They have:
- Their own MCP server connections (separate from parent process)
- No access to the parent's storage layer
- No way to call `executeSpecialistTool()` from the parent process

The prompt tells them about tools they can't actually use.

## Solution Options

### Option 1: HTTP API Calls (RECOMMENDED)

**Approach**: Specialists use curl/fetch to call existing HTTP endpoints

**Pros**:
- Endpoints already exist - minimal backend work
- Clean separation of concerns
- Works with any agent spawning mechanism
- Easy to debug (HTTP logs)
- Aligns with architecture principle: "API contracts for inter-service communication"

**Cons**:
- Specialists need to know the API URL (environment variable)
- Requires HTTP client in agent environment (curl is standard)
- Slightly more verbose than MCP tools

**Implementation**:
1. Add `IDEATION_API_URL` to environment variables (default: `http://localhost:3001`)
2. Update specialist prompt in `spawner.ts` to provide:
   - API base URL from environment
   - Example curl commands for each operation
   - Session ID from context
3. Specialists construct HTTP requests directly

**Example prompt addition**:
```markdown
## API Access

You can create/update blocks via HTTP:

API Base: ${process.env.IDEATION_API_URL || 'http://localhost:3001'}
Session ID: ${sessionId}

### Create Block
curl -X POST ${API_URL}/api/ideation/sessions/${sessionId}/blocks \
  -H "Content-Type: application/json" \
  -d '{
    "type": "feature",
    "title": "OAuth2 Authentication",
    "keyword": "Auth",
    "emoji": "🔐",
    "content": "## Overview\n...",
    "confidence": 70,
    "specialist": "${name}"
  }'

### Update Block
curl -X PATCH ${API_URL}/api/ideation/sessions/${sessionId}/blocks/{blockId} \
  -H "Content-Type: application/json" \
  -d '{ "confidence": 80, "content": "..." }'

### List Blocks
curl ${API_URL}/api/ideation/sessions/${sessionId}/blocks
```

### Option 2: MCP Server for Specialists

**Approach**: Create dedicated MCP server that spawned agents can connect to

**Pros**:
- Maintains tool-based interface (cleaner for Claude)
- Type-safe tool schemas
- Reuses existing tool definitions

**Cons**:
- Significant engineering effort (new MCP server)
- Need to manage MCP server lifecycle
- Specialists must be spawned with MCP server connection
- More complex debugging
- Requires MCP configuration in spawned agent environment

**Implementation**:
1. Create `packages/ideation/src/mcp/server.ts`
2. Register `create_block`, `update_block`, `list_blocks` tools
3. Tool handlers call existing `executeSpecialistTool()`
4. Start MCP server alongside ideation server
5. Update spawner to pass MCP server URL to spawned agents
6. Spawned agents auto-connect to MCP server

### Option 3: Relay-Based Tool Invocation

**Approach**: Specialists send tool requests via relay messages to a "tool handler" agent

**Pros**:
- Uses existing relay infrastructure
- No new servers needed
- Async communication (fire-and-forget or await response)

**Cons**:
- Adds messaging overhead
- Requires tool handler agent in backend
- More complex than direct API calls
- Relay message format less intuitive than HTTP

**Implementation**:
1. Create `ToolHandler` agent in backend that listens for tool requests
2. Specialists send relay messages: `TO: ToolHandler\nTOOL: create_block\nINPUT: {...}`
3. ToolHandler parses message, calls `executeSpecialistTool()`, replies with result
4. Update spawner prompt with relay protocol instructions

## Recommendation: Option 1 (HTTP API)

**Rationale**:
1. **Endpoints already exist** - we're 80% there
2. **Simplest implementation** - just update the prompt
3. **Standard pattern** - HTTP is universal, no special infrastructure
4. **Debuggable** - can test with curl, see logs
5. **Scalable** - works even if specialists are spawned remotely in future
6. **Aligned with architecture** - planner-core uses HTTP APIs between subdomains

## Implementation Plan (Option 1)

### Changes Needed

#### 1. Environment Variable
Add to `.env`:
```
IDEATION_API_URL=http://localhost:3001
```

#### 2. Update Spawner Prompt
File: `packages/ideation/src/relay/spawner.ts`

Replace tool description section (lines 113-163) with:

```typescript
## API Access

You can create/update blocks via the HTTP API.

**API Base**: ${process.env.IDEATION_API_URL || 'http://localhost:3001'}
**Session ID**: ${sessionId}

### Create Block

\`\`\`bash
curl -X POST ${process.env.IDEATION_API_URL || 'http://localhost:3001'}/api/ideation/sessions/${sessionId}/blocks \\
  -H "Content-Type: application/json" \\
  -d @- << 'EOF'
{
  "type": "feature",
  "title": "Your Block Title",
  "keyword": "Short",
  "emoji": "🎯",
  "content": "## Overview\\n\\nYour markdown content here",
  "confidence": 70,
  "specialist": "${name}",
  "sourceContext": "Turn X"
}
EOF
\`\`\`

### List Blocks

\`\`\`bash
curl ${process.env.IDEATION_API_URL || 'http://localhost:3001'}/api/ideation/sessions/${sessionId}/blocks
\`\`\`

### Update Block

\`\`\`bash
curl -X PATCH ${process.env.IDEATION_API_URL || 'http://localhost:3001'}/api/ideation/sessions/${sessionId}/blocks/{blockId} \\
  -H "Content-Type: application/json" \\
  -d '{ "confidence": 80, "content": "Updated content" }'
\`\`\`

**When to create blocks:**
- Features or capabilities identified
- Entities or data structures needed
- User flows or interactions
- Technical constraints or requirements
- Integration points or dependencies
- Risk areas requiring attention

**Block workflow:**
1. List existing blocks first to avoid duplication
2. Create blocks with appropriate confidence (0-100)
3. Update blocks as understanding evolves
```

#### 3. No Backend Changes
All required endpoints already exist. No changes needed.

#### 4. Testing
1. Spawn a specialist
2. Verify it can list blocks
3. Verify it can create a block
4. Check block appears in session via GET /api/ideation/sessions/:id/blocks

## Future Enhancements

If HTTP calls feel too clunky for agents:
1. **Create thin wrapper script**: `~/.claude/bin/ideation-block` that wraps curl
2. **MCP server** (Option 2) for richer tooling if specialists proliferate
3. **SDK package**: `@ideation/agent-sdk` with helper functions

## Current Server Configuration

**Ideation Server**:
- Port: 3001 (configurable via `IDEATION_PORT`)
- Running: Yes (process 5840 detected)
- API: `/api/ideation/*`

**Main Planner Server**:
- Port: 3009 (detected from vite proxy config)
- Not currently running as separate service

## Testing Checklist

- [ ] Add IDEATION_API_URL to .env
- [ ] Update spawner.ts prompt with HTTP API instructions
- [ ] Spawn a specialist agent
- [ ] Verify specialist receives API instructions in prompt
- [ ] Have specialist call POST /blocks endpoint
- [ ] Verify block is created in database
- [ ] Verify block appears in GET /blocks response
- [ ] Test specialist can list blocks before creating
- [ ] Test specialist can update block confidence

## API Endpoint Reference

All endpoints use JSON request/response bodies.

### POST /api/ideation/sessions/:id/blocks
**Request body**:
```json
{
  "type": "feature",
  "title": "string",
  "keyword": "string",
  "emoji": "string",
  "content": "string (markdown)",
  "confidence": 0-100,
  "specialist": "string (optional, defaults to 'user')",
  "sourceContext": "string (optional, defaults to 'user-created')"
}
```

**Response**: Block object (201)

### PATCH /api/ideation/sessions/:id/blocks/:blockId
**Request body** (all fields optional):
```json
{
  "title": "string",
  "keyword": "string",
  "emoji": "string",
  "content": "string",
  "confidence": 0-100,
  "status": "forming" | "emerging" | "developing" | "ready"
}
```

**Response**: Updated Block object (200)

### GET /api/ideation/sessions/:id/blocks
**Response**: Array of Block objects (200)

### DELETE /api/ideation/sessions/:id/blocks/:blockId
**Response**: 204 No Content

## Conclusion

**Immediate action**: Implement Option 1 (HTTP API calls)
- Minimal code changes (just update prompt)
- Leverages existing infrastructure
- Provides immediate unblocking for specialists

**Future consideration**: If specialist usage grows significantly, revisit Option 2 (MCP server) for richer tooling experience.

# Agent-Relay Patterns

## spawn() vs RelayClient

Critical distinction for this project:

| Pattern | Use Case | Lifecycle |
|---------|----------|-----------|
| `spawn()` | Task-oriented CLI agents | Executes task, then exits |
| `RelayClient` | Persistent services | Always-on, listens for messages |

**PlannerLead uses `RelayClient`**, not `spawn()`. It's a persistent service that needs to remain active and respond to messages.

## Non-Blocking Connection Pattern

Server startup does not block on relay availability:
- Relay connection attempted at startup but failure doesn't block
- **Connected mode**: Real agents, full relay messaging
- **Disconnected mode**: Mock responses, test mode fallback
- Check connection status to determine operational mode

## PlannerLead Architecture

Location: `packages/server/src/relay/planner-lead.ts`

- Persistent service using `RelayClient` (NOT `spawn()`)
- Listens on `#planner` channel + individual `#plan-{uuid}` channels
- Uses Anthropic SDK for responses (mock fallback if key missing)
- Tool calling support: 10 tools in `planner-lead-tools/` for plan CRUD, step manipulation
- Conversation history management per channel

## Channel Membership

- Agents must explicitly call `joinChannel()` before sending/receiving channel messages
- Broadcast requires channel membership in relay daemon

## Plan Channel IDs

- Format: `#plan-{full-uuid}` (uses full UUID for consistency)
- Display truncation happens in UI layer, not in channel IDs
- Use `getPlanChannelId()` from `packages/server/src/relay/channels.ts`

## Message Routing (ws-proxy)

Location: `packages/server/src/relay/ws-proxy.ts`

WebSocket proxy bridges browser ↔ relay communication:
- Mounted at `/ws/relay` route
- Direct messages: `client.sendMessage()`
- Channel messages: `client.sendChannelMessage()`
- Always pass `fromName` and `entityType` for proper rendering

## Cross-Domain Bridges

**Ideation Bridge** (`packages/server/src/relay/ideation-bridge.ts`):
- Listens for relay messages tagged for ideation
- Forwards to ideation service
- Enables domain communication without direct coupling

**Forge Spawner** (`packages/server/src/relay/forge-spawner.ts`):
- Creates forge tasks when plan execution requested via relay
- Bridges planning → execution workflow

## Frontend Relay Integration

Location: `packages/planner-ui/src/contexts/RelayContext.tsx`

- `RelayContext` provides shared WebSocket connection
- `useRelayConnection` manages WebSocket lifecycle (connect/reconnect/handlers)
- `useActiveChannels` subscribes to plan channels
- `useChannelMessages` fetches channel message history
- **Single shared connection per app via Context** (never per-component)

## Real-time Updates

- `usePlanEvents` hook subscribes to SSE for plan changes
- For persistent services like PlannerLead, don't gate subscriptions on `connectionStatus === 'connected'`—always subscribe

## Connection Handling

- Implement graceful fallback to mock mode when API keys are missing
- Add debug logging for WebSocket connections, agent spawning, tool execution
- Handle `connectionState` issues; may indicate relay daemon SQLite or performance problems

## Common Mistakes

- Using `spawn()` for persistent conversational agents
- Forgetting channel membership before channel operations
- Over-relying on `connectionStatus` for SSE subscriptions with persistent services
- Creating per-component relay connections (use shared Context)

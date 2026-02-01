# Agent-Relay Patterns

## spawn() vs RelayClient

Critical distinction for this project:

| Pattern | Use Case | Lifecycle |
|---------|----------|-----------|
| `spawn()` | Task-oriented CLI agents | Executes task, then exits |
| `RelayClient` | Persistent services | Always-on, listens for messages |

**PlannerLead must use `RelayClient`**, not `spawn()`. It's a persistent service that needs to remain active and respond to messages.

## Channel Membership

- Agents must explicitly call `joinChannel()` before sending/receiving channel messages
- Broadcast requires channel membership in relay daemon

## Message Routing (ws-proxy)

The `ws-proxy.ts` handles message routing between clients:
- Direct messages: `client.sendMessage()`
- Channel messages: `client.sendChannelMessage()`
- Always pass `fromName` and `entityType` for proper rendering

## Plan Channel IDs

- Format: `#plan-{full-uuid}` (uses full UUID for consistency)
- Display truncation happens in UI layer, not in channel IDs
- Use `getPlanChannelId()` from `src/relay/channels.ts` for channel ID generation

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

# Server

Meta-server that mounts planner, ideation, and forge plugins.

## What This Is

A thin composition layer with zero business logic. This server imports domain plugins (`planner-core`, `ideation-core`, `forge-core`), mounts their routers, and provides shared infrastructure (relay integration, WebSocket proxy, middleware).

## Architecture

```
┌─────────────────────────────────────────────┐
│              Server (this)                  │
│  ┌──────────────────────────────────────┐   │
│  │  Express App                         │   │
│  │  ├─ CORS                             │   │
│  │  ├─ Timeout middleware               │   │
│  │  ├─ Plan channel middleware          │   │
│  │  ├─ QA channel middleware            │   │
│  │  └─ Error handler                    │   │
│  └──────────────────────────────────────┘   │
│                                             │
│  ┌──────────────────────────────────────┐   │
│  │  Plugin Routers                      │   │
│  │  ├─ /api -> planner.router           │   │
│  │  ├─ /api/ideation -> ideation.router │   │
│  │  └─ /api/forge -> forge.router       │   │
│  └──────────────────────────────────────┘   │
│                                             │
│  ┌──────────────────────────────────────┐   │
│  │  Relay Integration                   │   │
│  │  ├─ WebSocket proxy (/ws/relay)      │   │
│  │  ├─ Channel management               │   │
│  │  ├─ PlannerLead agent                │   │
│  │  ├─ Ideation bridge                  │   │
│  │  └─ Forge spawner                    │   │
│  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

## Startup Sequence

1. Initialize planner service with SQLite storage
2. Initialize ideation service
3. Create Express app with middleware stack
4. Mount channel middleware (plan creation, QA broadcasting)
5. Mount server API router (relay-aware channel handlers)
6. Mount plugin routers
7. Attempt relay connection (non-blocking on failure)
8. Initialize forge service (mode detection based on relay connection)
9. Initialize ideation bridge (routes relay messages to ideation package)
10. Initialize channel management and sync existing plan/session channels
11. Initialize PlannerLead agent
12. Start session timeout service
13. Mount error handler (must be last)
14. Start HTTP server
15. Attach WebSocket proxy to HTTP server

## Plugin System

Plugins expose a standard interface:

```typescript
interface Plugin {
  router: Router;              // Express router to mount
  initialize: () => Promise<void>;  // Setup logic
  shutdown: () => void;        // Cleanup logic
  getStorage: () => Storage;   // Optional: expose storage
}
```

Plugins are self-contained: own storage, own API routes, own domain logic.

## Relay Integration (SDK 3.x)

Uses `@agent-relay/sdk` 3.x with broker-based connection.

### WebSocket Proxy (`/ws/relay`)

Server-as-router pattern — the server acts as the message router for browser clients rather than proxying to a relay daemon WebSocket:
- Routes client messages to agents via the SDK broker
- Broadcasts agent messages to subscribed browser clients
- Manages channel membership and presence locally

### Channel Management

Local registry pattern — channel state is maintained in-process:
- **Plan Channels**: `#plan-{uuid}` created on plan creation, synced on startup
- **Session Channels**: `#session-{uuid}` for ideation sessions
- SDK handles relay-side channel operations; server tracks local subscriptions

### PlannerLead Agent

Persistent service agent that:
- Listens for plan-related questions
- Routes messages to appropriate channels
- Uses `RelayClient` (not `spawn()`) for always-on operation

### Forge Spawner

Manages agent lifecycle for forge task execution:
- Spawns task-specific agents via SDK agent handles
- Tracks active agents for health reporting
- Emits lifecycle events (spawned, completed, failed)

## Middleware Stack

Execution order (top to bottom):

1. `cors()` - Cross-origin resource sharing
2. `express.json()` - JSON body parsing
3. `timeoutMiddleware` - Request timeout handling (30s default)
4. `planChannelMiddleware` - Intercepts POST /api/plans to create relay channels
5. `qaChannelMiddleware` - Broadcasts QA messages when questions are answered
6. Server API router - Relay-aware channel handlers
7. Plugin routers - Domain-specific routes
8. `errorHandler` - Centralized error handling (must be last)

## Environment Variables

```bash
PORT=3001                      # HTTP server port
DB_PATH=./planner.db          # Planner database path
IDEATION_DB_PATH=./ideation.db # Ideation database path
FORGE_DB_PATH=./forge.db      # Forge database path
FORGE_MODE=real|test          # Forge execution mode (auto-detected if not set)
TUNER_URL=http://localhost:5000  # Optional: Tuner service for DOT framework
ANTHROPIC_API_KEY=sk-...      # Required for AI features
```

## Development

```bash
npm run build      # Compile TypeScript
npm run dev        # Start with hot reload (tsx --watch)
npm run start      # Start without hot reload
npm run typecheck  # Type checking only
```

## Graceful Shutdown

Handles `SIGTERM` and `SIGINT`:

1. Stop PlannerLead agent
2. Stop ideation bridge
3. Stop session timeout service
4. Close WebSocket server
5. Close HTTP server
6. Disconnect relay
7. Shutdown all plugin services
8. Exit process

## Key Files

- `src/server.ts` - Main entry point and startup orchestration
- `src/api/routes.ts` - Server-level API routes (relay, channels)
- `src/middleware/timeout.ts` - Request timeout middleware
- `src/relay/` - Relay client, channel management, agent services
- `src/relay/ws-proxy.ts` - WebSocket proxy for browser clients
- `src/relay/planner-lead.ts` - PlannerLead agent service
- `src/relay/forge-spawner.ts` - Forge task agent spawner

## Design Principles

- **Zero Business Logic**: Server composes, doesn't implement
- **Plugin Isolation**: Each domain plugin is self-contained
- **Graceful Degradation**: Relay connection failure doesn't prevent startup
- **Relay-First**: Agent communication uses relay protocol, not HTTP

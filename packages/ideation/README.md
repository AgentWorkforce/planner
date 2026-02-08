# ideation-core

Brainstorming facilitation engine that refines vague ideas into structured requirements through conversational AI.

## Architecture

Ideation uses a conversational interviewer agent ("Interviewer") that invisibly spawns specialist agents to gather domain-specific understanding. The user sees a single coherent conversation while specialists work behind the scenes to provide context-aware depth.

**Key concepts:**

- **Session**: A brainstorming conversation with transcript, understanding, and specialist activity
- **Interviewer**: Lead agent that guides the conversation and coordinates specialists
- **Specialists**: Dynamically spawned agents (e.g., Backend, Frontend, DevOps) that provide domain expertise
- **Understanding**: Structured knowledge captured by specialists (stored as blocks and freeform notes)
- **Blocks**: Canvas-displayable nuggets of understanding (features, constraints, questions)
- **Planner Sends**: Handoff records tracking when sessions are sent to Planner for plan creation

## Integration

Mount as an Express plugin in a larger application:

```typescript
import { createIdeationService } from 'ideation-core';

const ideation = createIdeationService({
  dbPath: './ideation.db',
  plannerUrl: 'http://localhost:3001', // Optional: enables send-to-planner
});

await ideation.initialize();
app.use('/api/ideation', ideation.router);

// Shutdown
await ideation.shutdown();
```

## API Endpoints

```
POST   /sessions                    # Create new session
GET    /sessions/:id                # Get session with full context
PATCH  /sessions/:id                # Update session (e.g., add message)
POST   /sessions/:id/send-to-planner # Handoff to Planner
GET    /sessions/:id/events         # SSE stream for real-time updates
```

## Specialist System

Specialists are spawned on-demand based on conversation context:

- **Backend**: API design, data modeling, architecture
- **Frontend**: UI/UX, component structure, state management
- **DevOps**: Infrastructure, deployment, CI/CD
- **Security**: Auth, permissions, threat modeling
- **QA**: Testing strategy, edge cases

Specialists communicate via agent-relay, contributing understanding that shapes the Interviewer's responses.

## Configuration

Environment variables:

- `ANTHROPIC_API_KEY`: Required for real AI mode (falls back to mock mode if missing)
- `AGENT_RELAY_OUTBOX`: Set by agent-relay for specialist communication
- `IDEATION_DB`: Override default database path

## Exports

### Domain Types
- `Session`, `SessionStatus`, `Block`, `Understanding`, `PlannerSend`

### Storage
- `IdeationStorage` (interface), `SQLiteIdeationStorage`

### API
- `createIdeationRouter`, `createHttpPlannerClient`

### Services
- `initInterviewer`, `stopInterviewer`

## Development

```bash
npm run build      # Compile TypeScript
npm run start      # Run standalone server
npm run dev        # Watch mode
npm test           # Run tests
```

# @plannr/mull

Cross-agent shared memory -- extracts knowledge from session data into structured topic files.

## What This Is

Agent sessions produce rich but noisy data. Knowledge dies with the session. Spawned agents start blank. Mull is the cross-agent, cross-session memory layer: it reads session trajectories, extracts structured knowledge, and writes persistent topic files that any future agent can consume.

## Core Concepts

- **Session**: A completed agent interaction (forge run, relay conversation, trajectory file, raw transcript)
- **Adapter**: Normalizes a specific data source into a common `SessionData` shape
- **PreExtract**: The deterministic extraction output -- entities, facts, topic matches, filtered transcript
- **Nugget**: A single unit of extracted knowledge with category, slug, causal links, and provenance
- **Topic File**: A markdown file with YAML frontmatter containing all nuggets for a given topic
- **Synthesis**: The LLM step that converts a PreExtract into structured nuggets
- **Topic Store**: The persistence layer that merges nuggets into topic files (slug-based dedup)

## Pipeline

Mull runs in two stages.

### Stage 1: Deterministic Extraction ($0, <100ms, no LLM)

- Load session data via adapters (forge DB, relay daemon, trajectory files, transcripts)
- Extract entities using compromise.js NLP + regex (proper nouns, file paths, tool names)
- Extract structural facts (decisions, events, retrospectives -- preserved from structured data)
- Match entities against existing topic files for topic routing
- Filter transcript to only key exchanges (decision-adjacent, constraints, retrospectives)

### Stage 2: Synthesis (one LLM call via `claude -p`)

- Trail decision shortcut: pre-structured decisions map directly to nuggets without LLM
- LLM receives the PreExtract (entities, facts, filtered transcript) -- NOT raw session data
- Produces structured nuggets with categories, slugs, causal links
- Post-synthesis quality filter rejects completion noise and hollow reasoning
- Falls back to trail decisions if LLM unavailable

## Adapters

| Adapter | Source | Session Type |
|---------|--------|-------------|
| `forge` | Forge DB `trajectory_events` table | `run_id` |
| `relay-daemon` | Relay message JSONL files | `channel` |
| `trail` | `.trajectory.json` files | `plan_id` |
| `transcript` | Raw text/markdown/JSON | `run_id` |

All adapters implement the `SessionAdapter` interface and normalize to `SessionData`.

## CLI Usage

```bash
# Single session
mull <session-id> --source forge --dir ./forge.db

# All unprocessed sessions
mull --all --source forge --dir ./forge.db

# Dry run (preview extraction, no files written)
mull <session-id> --source forge --dir ./forge.db --dry-run

# Force re-process (ignore cursor)
mull <session-id> --source forge --dir ./forge.db --force

# Custom output directory
mull <session-id> --source forge --dir ./forge.db --memory-dir ./memory
```

## Agent-Relay Integration

Mull integrates with [agent-relay](https://github.com/agentworkforce/relay) in two ways: batch processing of persisted relay data, and real-time triggers during forge execution.

### Batch Processing (relay-daemon adapter)

The `relay-daemon` adapter reads agent-relay's persisted JSONL message files after sessions complete. It understands the daemon's storage format (`messages/YYYY-MM-DD.jsonl` + `sessions.jsonl`) and extracts session data from agent conversations.

```bash
# Process a specific relay channel
mull <session-id> --source relay-daemon --dir .agent-relay/

# Process all unprocessed relay sessions
mull --all --source relay-daemon --dir .agent-relay/

# Dry run on relay data
mull <session-id> --source relay-daemon --dir .agent-relay/ --dry-run
```

The adapter filters by agent name and session time window, skips system messages, and respects cursors for incremental processing. The `--dir` flag points to the relay daemon's data directory (default: `.agent-relay/`).

### Real-Time Triggers (server mode)

When running as part of the plannr server, mull hooks into forge's in-process events automatically. No relay dependency required -- triggers fire on forge trajectory events directly.

```
Forge run → trajectory event (decision, task completion, gate, retrospective)
         → TriggerManager accumulates entities
         → Batches LLM synthesis when threshold reached (3+ entities, timer, or session end)
         → Writes to topic files in background
```

Controlled via environment variable:

```bash
MULL_TRIGGERS_ENABLED=true   # default: true when server starts
```

The server wires adapters automatically -- forge DB, trajectory files, and relay daemon (if relay is connected). See `packages/server/src/server.ts` for the full initialization sequence.

### When to Use Which

| Scenario | Approach |
|----------|----------|
| Running the plannr server | Real-time triggers fire automatically |
| Historical analysis of past relay sessions | CLI with `--source relay-daemon` |
| Batch processing forge runs | CLI with `--source forge` |
| CI/CD knowledge extraction | CLI with `--all --source forge` |

## Programmatic API

```typescript
import { mull } from '@plannr/mull';

const result = await mull(sessionRef, {
  adapters: [mullAdapter],
  config: { memoryDir: './memory' },
});
// -> { topicsUpdated: 2, topicsCreated: 1, nuggetsWritten: 5, errors: [], llmFailed: false }
```

### Service Factory

For server integration, use the service factory:

```typescript
import { createMullService } from '@plannr/mull';

const mullService = createMullService({
  memoryDir: './memory',
  adapters: [forgeAdapter, relayAdapter],
});
```

## Configuration

Config resolution order: defaults -> `mull.config.json` -> `package.json` `"mull"` key -> CLI flags.

```json
{
  "memoryDir": "./memory",
  "adapters": [
    { "type": "forge", "dbPath": "./forge.db" },
    { "type": "relay-daemon", "dir": "./.agent-relay" }
  ]
}
```

Zero-config default: uses `./memory` output dir. Adapter must be specified via `--source` flag or config.

## Nugget Categories

| Category | What Belongs | What Doesn't |
|----------|-------------|--------------|
| Decisions | Choices between alternatives with reasoning | Implementation status |
| Constraints | Limitations discovered through failure | Known framework limitations |
| Patterns | Implicit team conventions not enforced by tooling | Standard best practices |
| Gotchas | Non-obvious traps that waste hours | Obvious errors |
| Context | Why something is shaped a certain way | What code does (read the code) |

## Key Exports

```typescript
// Main pipeline
export { mull } from './mull.js';
export { mullAll } from './mull-all.js';
export { createMullService } from './service.js';

// Pipeline steps
export { buildPreExtract } from './pipeline/extract.js';
export { synthesizeNuggets } from './pipeline/synthesize.js';
export { extractTrailDecisions } from './pipeline/extract-trail-decisions.js';
export { extractDryRunDetails } from './pipeline/extract-dry-run-details.js';

// Adapters
export { toMullAdapter, toMullAdapters } from './adapters/adapter-bridge.js';

// Synthesizers
export { LlmSynthesizer } from './synthesizers/llm-synthesizer.js';

// Default implementations
export { FileTopicStore } from './defaults/topic-store.js';
export { PassthroughSynthesizer } from './defaults/passthrough-synthesizer.js';

// Real-time triggers
export { TriggerManager, registerMullTriggers } from './realtime/index.js';

// Types
export type {
  SessionRef, SessionData, Nugget, PreExtract,
  MullResult, MullConfig, MullAdapter, NuggetSynthesizer, TopicStore,
} from './domain/types.js';
export type { SessionAdapter } from './adapters/core-types.js';
```

## Output Format

Topic files live in the `memory/` directory:

- **YAML frontmatter**: topic name, sessions list, tags (capped at 10)
- **Sections**: Decisions, Constraints, Patterns, Gotchas, Context
- **Each nugget**: `### slug-name` + description + `**Why**` + optional `**Caused**` + `**When**`
- **`index.md`**: auto-generated table of all topics with tags, session counts, dates

Merge is idempotent -- same session re-run produces identical output (slug-based dedup).

## File Structure

```
packages/mull/src/
  mull.ts                        # Main pipeline: mull(sessionRef, opts)
  mull-all.ts                    # Batch processing: mullAll(opts)
  cli.ts                         # CLI entry point (commander)
  service.ts                     # Service factory for server integration
  domain/types.ts                # SessionData, PreExtract, Nugget, TopicStore
  adapters/
    core-types.ts                # SessionAdapter interface
    adapter-bridge.ts            # SessionAdapter -> MullAdapter bridge
    factory.ts                   # Adapter factory from config
    schemas.ts                   # Adapter config validation
    implementations/
      forge-db-adapter.ts        # Reads forge.db trajectory_events
      relay-daemon-adapter.ts    # Reads relay JSONL message files
      trajectory-adapter.ts      # Reads .trajectory.json files
      transcript-adapter.ts      # Reads raw transcripts
  pipeline/
    extract.ts                   # Stage 1: entities, facts, topics, transcript filter
    extract-trail-decisions.ts   # Deterministic nuggets from structured decisions
    extract-dry-run-details.ts   # Dry-run display formatter
    synthesize.ts                # Orchestrates synthesis
  synthesizers/
    llm-synthesizer.ts           # claude -p based LLM synthesis
    index.ts                     # Synthesizer exports
  defaults/
    topic-store.ts               # FileTopicStore (delegates to merge layer)
    passthrough-synthesizer.ts   # Testing: passes messages as nuggets
  routing/
    session-ref-router.ts        # Routes SessionRef to correct adapter
  config/
    resolve.ts                   # Config resolution (defaults + file + overrides)
    resolve-adapters.ts          # Adapter instantiation from config
  memory/
    merge-topic-files.ts         # Slug-based merge with section ordering
    read-topic-file.ts           # YAML frontmatter + markdown body parser
    write-topic-file.ts          # Atomic write with advisory locking
    rebuild-toc.ts               # index.md table generation
  realtime/
    index.ts                     # Real-time trigger hooks
    types.ts                     # Trigger event types
    event-hooks.ts               # Event-driven mull triggers
  cli/
    format-dry-run.ts            # Dry-run output formatting
  api/
    handlers/                    # HTTP API handlers
    routes.ts                    # Express router
    schemas.ts                   # API request/response validation
```

## Dependencies

| Package | Purpose |
|---------|---------|
| `compromise` | NLP entity extraction (proper nouns, topics, organizations) |
| `commander` | CLI framework |
| `better-sqlite3` | Forge DB adapter (SQLite read-only) |
| `gray-matter` | YAML frontmatter parsing |
| `yaml` | YAML serialization |
| `zod` | Schema validation |
| `express` | API layer |

LLM synthesis uses `claude -p` CLI (no SDK dependency required).

## Development

```bash
# Run tests
npm test -w @plannr/mull

# Watch mode
npm run test:watch -w @plannr/mull

# Type check
npm run typecheck -w @plannr/mull

# Dry run on forge data
npx tsx packages/mull/src/cli.ts <run-uuid> --source forge --dir ./forge.db --dry-run

# Process all forge sessions
npx tsx packages/mull/src/cli.ts --all --source forge --dir ./forge.db --memory-dir ./memory
```

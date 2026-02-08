# PlannerLead Conversation Persistence

## Problem

PlannerLead loses all conversation context on server restart. The current `conversation-history.ts` stores messages in a pure in-memory `Map<string, ConversationMessage[]>`. When the server process restarts, PlannerLead has no memory of prior conversations in any channel.

This breaks mid-conversation planning sessions where PlannerLead was actively refining a plan, answering questions, or coordinating with spawned agents.

## Reference Implementation

The ideation package solves this with a **lazy hydration** pattern:

- **Storage**: Transcript stored as a JSON array column in the SQLite `ideation_sessions` table, appended via `json_insert(transcript, '$[#]', json(?))`
- **In-memory cache**: `ConversationHistoryStore` holds per-channel messages in a `Map`, plus a `Set<channelId>` tracking which channels have been hydrated
- **Lazy load**: On first message to a channel after restart, if in-memory history is empty but DB has transcript data, hydrate from DB (one-time per channel per server instance)
- **Deduplication**: Tracks hydration state to prevent re-hydrating or double-adding messages that the API handler already persisted

## Design

### Database Schema

Add a `channel_transcripts` table to `planner.db`:

```sql
CREATE TABLE IF NOT EXISTS channel_transcripts (
  channel_id TEXT PRIMARY KEY,
  transcript TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL
);
```

Single row per channel. The `transcript` column holds a JSON array of messages. Using `json_insert` for append-only writes avoids full-column rewrites.

### Storage Interface

Add two methods to `PlanStorage`:

```typescript
// Append a message to a channel's transcript
appendChannelTranscript(channelId: string, message: { role: string; content: string }): void;

// Get the full transcript for a channel
getChannelTranscript(channelId: string): { role: string; content: string }[] | null;
```

### Migration

New migration in `packages/planner/src/storage/migrations/` (next sequential number):

```sql
CREATE TABLE IF NOT EXISTS channel_transcripts (
  channel_id TEXT PRIMARY KEY,
  transcript TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL
);
```

### SQLite Implementation

In `packages/planner/src/storage/sqlite.ts`:

**appendChannelTranscript**: Upsert the channel row, then append using SQLite `json_insert`:

```sql
-- First message for channel (INSERT)
INSERT INTO channel_transcripts (channel_id, transcript, updated_at)
VALUES (?, json_array(json(?)), ?)
ON CONFLICT(channel_id) DO UPDATE SET
  transcript = json_insert(transcript, '$[#]', json(?)),
  updated_at = ?;
```

**getChannelTranscript**: Simple SELECT + JSON parse:

```sql
SELECT transcript FROM channel_transcripts WHERE channel_id = ?;
```

### Conversation History Changes

Modify `packages/server/src/relay/conversation-history.ts`:

1. Add a `hydrated: Set<string>` to track which channels have been restored from DB
2. Add `hydrateFromTranscript(channelId, messages[])` method that:
   - Skips if already hydrated (`hydrated.has(channelId)`)
   - Filters to `user`/`assistant` roles only
   - Applies the same 50-message FIFO limit
   - Trims in pairs (even count) to maintain role alternation for Anthropic API
   - Marks channel as hydrated
3. Add `hasHistory(channelId): boolean` method for the hydration check
4. The existing `addMessage()` function remains unchanged (it's the in-memory write path)

### PlannerLead Integration

Modify `packages/server/src/relay/planner-lead.ts`:

1. In `handleMessage`, before `addMessage(channelId, 'user', body)`:
   - Check `hasHistory(channelId)` on the in-memory store
   - If empty, call `storage.getChannelTranscript(channelId)`
   - If DB has data, call `hydrateFromTranscript(channelId, dbMessages)`
2. After `addMessage(channelId, 'user', body)` — persist to DB:
   - Call `storage.appendChannelTranscript(channelId, { role: 'user', content: body })`
3. After `addMessage(channelId, 'assistant', response)` — persist to DB:
   - Call `storage.appendChannelTranscript(channelId, { role: 'assistant', content: response })`

The `notifyPlanReady` path should also persist its synthetic user message and assistant response.

### What NOT to persist

- Tool use blocks (internal to the API call, not part of conversational context)
- System messages like `[System] Domain expert has joined`
- Mock mode responses (no value in restoring mock conversations)

## File Changes

| File | Change |
|------|--------|
| `packages/planner/src/storage/migrations/NNN-channel-transcripts.sql` | New table |
| `packages/planner/src/storage/interface.ts` | Add 2 methods |
| `packages/planner/src/storage/sqlite.ts` | Implement 2 methods |
| `packages/server/src/relay/conversation-history.ts` | Add hydration logic, `hasHistory`, `hydrateFromTranscript` |
| `packages/server/src/relay/planner-lead.ts` | Wire up persist-on-write + hydrate-on-first-access |

## Edge Cases

- **Channel transcript grows unbounded in DB**: Add periodic cleanup. Transcripts older than 7 days (or channels with no recent activity) can be pruned. Not critical for v1.
- **Role alternation**: Anthropic API requires user-first, alternating roles. The hydration must ensure this invariant (the ideation pattern trims in pairs for this reason).
- **Concurrent writes**: SQLite serializes writes, so `json_insert` is safe. No concurrent mutation risk.
- **Domain expert / Interviewer messages**: These are added as `user` role with a `[Domain Expert Response]:` prefix. They should be persisted as-is — they're part of the conversational context PlannerLead needs.

## Scope

This is a focused change — 5 files, no API surface changes, no UI changes. The persistence is invisible to the user; conversations just survive restarts.

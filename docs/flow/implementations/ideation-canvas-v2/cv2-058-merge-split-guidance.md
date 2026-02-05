# CV2-058: Merge/Split Guidance Implementation

**Status**: ✅ Completed
**Date**: 2026-02-04

## Summary

Added merge/split guidance capabilities to specialist prompts and tools, enabling specialists to identify when blocks are too granular (should merge) or cover too many concerns (should split).

## Changes Made

### 1. Tool Schema Updates (`packages/ideation/src/specialists/tools.ts`)

**Added `list_blocks` tool**:
- New tool to view all blocks in session
- Returns block summaries with preview
- Enables specialists to assess existing blocks before creating new ones

**Extended `create_block` and `update_block` tools**:
- Added `merge_suggestion` field with `block_ids[]` and `rationale`
- Added `split_suggestion` field with `rationale`
- Updated tool descriptions to encourage checking existing blocks

**Type Updates**:
```typescript
export interface CreateBlockInput {
  // ... existing fields
  merge_suggestion?: {
    block_ids: string[];
    rationale: string;
  };
  split_suggestion?: {
    rationale: string;
  };
}

export interface ListBlocksInput {
  session_id: string;
}
```

### 2. Prompt Template Updates (`packages/ideation/src/specialists/templates.ts`)

**Added guidance section**: `CRITICAL: Check Existing Blocks First`
- Instructions to use `list_blocks` before creating blocks
- Avoid duplication
- Assess merge/split opportunities

**Merge/Split Guidance Section**:
- **When blocks are too granular (MERGE)**: Multiple related sub-concepts → one cohesive block
- **When blocks cover too much (SPLIT)**: Multiple distinct concerns in one block
- **Granularity guideline**: One cohesive concept per block (2-3 sentence test)

Example scenarios:
- Merge: "User Profile" + "User Settings" + "User Preferences" → "User Management"
- Split: "Authentication & Authorization & Session Management" → 3 separate blocks

### 3. Tool Executor Implementation (`packages/ideation/src/specialists/tool-executor.ts`)

**Implemented `list_blocks` tool**:
```typescript
case 'list_blocks': {
  const session = await storage.getSession(session_id);
  const blockSummaries = session.blocks.map(block => ({
    id: block.id,
    type: block.type,
    title: block.title,
    keyword: block.keyword,
    emoji: block.emoji,
    status: block.status,
    confidence: block.confidence,
    specialist: block.specialist,
    content_preview: block.content.slice(0, 200) + '...',
  }));
  return { success: true, data: { blocks: blockSummaries, total: blockSummaries.length } };
}
```

**Enhanced `create_block` and `update_block`**:
- Process `merge_suggestion` and `split_suggestion` fields
- Queue insights to Interviewer when suggestions provided
- Insights include affected block titles and rationale
- Priority set to 6 (above normal, below urgent)

Example insight queued:
```
Merge suggestion: Consider merging blocks [User Profile, User Settings].
Rationale: These represent related aspects of user account management.
```

**Mock tool results updated**:
- Added mock response for `list_blocks`
- Returns sample block summaries for testing

## Design Decisions

### 1. Suggestions as Insights, Not Actions
- Merge/split are **suggestions**, not automatic actions
- Queued to Interviewer for human consideration
- Preserves human control over block structure

### 2. Priority 6 for Suggestions
- Above normal observations (5)
- Below critical concerns (8+)
- Surfaces to user without overwhelming

### 3. Block IDs in Merge, Rationale in Split
- **Merge**: Includes specific block IDs to merge (actionable)
- **Split**: Rationale only (split is more creative, needs human judgment)

### 4. Content Preview in list_blocks
- Full content would be verbose
- 200 char preview provides enough context
- Specialists can request full block if needed

## Integration Points

### Specialists → Interviewer
- Merge/split suggestions flow through `specialistQueue`
- Interviewer receives as observations
- Can weave into conversation naturally

### Future: UI Integration (V3)
When implementing merge/split UI:
- Display merge/split suggestions as badges/indicators on blocks
- Provide merge wizard (select blocks → confirm → create merged block)
- Provide split wizard (describe concerns → create child blocks)
- Track `mergedFrom[]` and `splitFrom` fields on resulting blocks

## Testing

- ✅ All existing tests pass
- ✅ Mock tool results include `list_blocks`
- ✅ Type safety maintained across tool chain

## Usage Example

Specialist prompt behavior:

```
Specialist: [uses list_blocks]
Sees: "User Profile", "User Settings", "User Preferences" (all emerging, 40-60% confidence)

Specialist: [creates or updates block with merge_suggestion]
{
  merge_suggestion: {
    block_ids: ["block-1", "block-2", "block-3"],
    rationale: "These three blocks represent related aspects of user account management.
                Merging them into a single 'User Account Management' block would provide
                better cohesion and avoid fragmenting related requirements."
  }
}

Interviewer receives insight:
"Merge suggestion: Consider merging blocks [User Profile, User Settings, User Preferences].
Rationale: These three blocks represent related aspects..."

Interviewer weaves into conversation:
"I'm noticing we have several related blocks around user accounts. Should we consolidate
these into a single feature?"
```

## Files Modified

1. `/packages/ideation/src/specialists/tools.ts`
   - Added `list_blocks` tool definition
   - Extended `create_block` and `update_block` schemas
   - Added type definitions for merge/split suggestions

2. `/packages/ideation/src/specialists/templates.ts`
   - Added "Check Existing Blocks First" section
   - Added "Merge/Split Guidance" section with examples
   - Updated block creation guidance

3. `/packages/ideation/src/specialists/tool-executor.ts`
   - Implemented `list_blocks` executor
   - Added merge/split suggestion processing in `create_block`
   - Added merge/split suggestion processing in `update_block`
   - Updated mock tool results

## Next Steps (Future Work)

### V3 Enhancements:
1. **UI for merge/split actions**
   - Merge wizard with block selection
   - Split wizard with concern decomposition
   - Visual indicators for suggestions

2. **Analytics on suggestions**
   - Track acceptance rate of merge/split suggestions
   - Identify patterns in granularity issues
   - Improve specialist heuristics

3. **Auto-merge for obvious cases**
   - Very high confidence merge suggestions
   - Duplicate detection (identical titles/content)
   - User setting to enable/disable

4. **Similarity scoring**
   - Semantic similarity between blocks
   - Suggest merges proactively based on content overlap
   - Use embeddings for smarter clustering

## Acceptance Criteria

- ✅ Specialists can call `list_blocks` to view existing blocks
- ✅ Specialists can provide merge suggestions with block IDs and rationale
- ✅ Specialists can provide split suggestions with rationale
- ✅ Merge/split suggestions queue insights to Interviewer
- ✅ Prompt templates include guidance on when to suggest merge/split
- ✅ All tests pass
- ✅ Type safety maintained

## Blockers/Dependencies

None. This is a self-contained enhancement to the specialist system.

## Related Tasks

- #269: Update specialist prompts for blocks (prerequisite)
- #261: Create create_block MCP tool (prerequisite)
- #266: Create update_block MCP tool (prerequisite)
- #268: User edit highlighting UI (parallel work, shares block tracking concerns)

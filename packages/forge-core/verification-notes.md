# Question Entity Schema Verification

## Task: Define Question entity schema

All acceptance criteria are met:

✅ **QuestionSchema**: Fully defined in `src/domain/types.ts` with all required fields:
   - question_id, run_id, task_id, agent_id, text, options?, blocking_level
   - steps_blocked, cascade_depth, can_use_default, default_value?
   - subscribers: string[], status, answer?, priority_score
   - created_at, answered_at?

✅ **BlockingLevelSchema**: `z.enum(['hard_block', 'soft_block', 'preference', 'fyi'])`
   - Defined at line ~164 in types.ts

✅ **QuestionStatusSchema**: `z.enum(['pending', 'answered', 'dismissed', 'auto_defaulted'])`
   - Also includes 'auto_answered_from_trajectory' as enhancement
   - Defined at line ~188 in types.ts

✅ **createQuestion() factory**: Implemented at line ~921 in types.ts
   - Uses exact priority formula from architecture context:
   - `blocking_level_value*100 + steps_blocked*10 + subscribers.length*15 + cascade_depth*5 - (can_use_default ? 30 : 0)`

✅ **BLOCKING_LEVEL_VALUES**: Exact values from architecture context:
   - hard_block: 3, soft_block: 2, preference: 1, fyi: 0

## Implementation Details

The Question entity was already fully implemented in `packages/forge-core/src/domain/types.ts`.
Previous verification: commit dba67ec3 "Verify Question entity schema - already fully implemented in types.ts"

All exports are available via `packages/forge-core/src/domain/index.ts`:
- QuestionSchema, Question type
- BlockingLevelSchema, QuestionBlockingLevel type  
- QuestionStatusSchema, QuestionStatus type
- createQuestion() factory function
- calculateQuestionPriorityScore() function
- BLOCKING_LEVEL_VALUES constant

## Conclusion

No code changes needed. Schema is complete and meets all acceptance criteria.

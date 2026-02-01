/**
 * Specialist MCP Tools
 *
 * Tool definitions for specialist capabilities.
 * Observations are freeform - intelligence lives in prompts, not schema validation.
 */

import type Anthropic from '@anthropic-ai/sdk';

// =============================================================================
// Tool Definitions
// =============================================================================

export const SPECIALIST_TOOLS: Anthropic.Tool[] = [
  {
    name: 'update_observations',
    description: 'Store your observations about the brainstorming session. Structure is freeform - use whatever makes sense for your domain. Always include a confidence field.',
    input_schema: {
      type: 'object' as const,
      properties: {
        session_id: {
          type: 'string',
          description: 'The session ID',
        },
        observations: {
          type: 'object',
          description: 'Your observations - freeform structure. Include confidence: exploring|forming|confident',
        },
      },
      required: ['session_id', 'observations'],
    },
  },
  {
    name: 'read_understanding',
    description: 'Read the current understanding from all specialists. Use this to see what others have observed and avoid redundancy.',
    input_schema: {
      type: 'object' as const,
      properties: {
        session_id: {
          type: 'string',
          description: 'The session ID',
        },
      },
      required: ['session_id'],
    },
  },
  {
    name: 'queue_insight',
    description: 'Queue an insight for the Interviewer to weave into conversation. You never speak directly to users - the Interviewer presents your insights as its own.',
    input_schema: {
      type: 'object' as const,
      properties: {
        session_id: {
          type: 'string',
          description: 'The session ID',
        },
        type: {
          type: 'string',
          enum: ['question', 'observation', 'concern'],
          description: 'Type of insight: question (something to ask), observation (something noticed), concern (potential issue)',
        },
        content: {
          type: 'string',
          description: 'The insight content. For questions, phrase as what the Interviewer should ask.',
        },
        priority: {
          type: 'number',
          description: 'Priority 1-10 (10 = highest, most urgent). Use 5 for normal observations, 8+ for important questions or concerns.',
        },
      },
      required: ['session_id', 'type', 'content', 'priority'],
    },
  },
];

// =============================================================================
// Tool Input Types
// =============================================================================

export interface UpdateObservationsInput {
  session_id: string;
  observations: Record<string, unknown>;
}

export interface ReadUnderstandingInput {
  session_id: string;
}

export interface QueueInsightInput {
  session_id: string;
  type: 'question' | 'observation' | 'concern';
  content: string;
  priority: number;
}

export type SpecialistToolInput =
  | { name: 'update_observations'; input: UpdateObservationsInput }
  | { name: 'read_understanding'; input: ReadUnderstandingInput }
  | { name: 'queue_insight'; input: QueueInsightInput };

// =============================================================================
// Tool Result
// =============================================================================

export interface SpecialistToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

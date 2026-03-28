/**
 * Specialist MCP Tools
 *
 * Tool definitions for specialist capabilities.
 * Observations are freeform - intelligence lives in prompts, not schema validation.
 */

import type { ToolDefinition } from '../interviewer/tools.js';

// =============================================================================
// Tool Definitions
// =============================================================================

export const SPECIALIST_TOOLS: ToolDefinition[] = [
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
  {
    name: 'create_block',
    description: 'Create a crystallized concept block from your analysis. Use when you identify a concrete component, feature, entity, flow, or constraint that should be captured. Check existing blocks first with list_blocks to avoid duplication and assess merge opportunities.',
    input_schema: {
      type: 'object' as const,
      properties: {
        session_id: {
          type: 'string',
          description: 'The session ID to create the block in',
        },
        type: {
          type: 'string',
          description: 'Block type (feature, entity, flow, constraint, integration, etc.)',
        },
        title: {
          type: 'string',
          description: 'Clear, descriptive title for the block',
        },
        keyword: {
          type: 'string',
          description: 'Short label (1-3 words) for physics block display',
        },
        emoji: {
          type: 'string',
          description: 'Visual identifier emoji for the block',
        },
        content: {
          type: 'string',
          description: 'Markdown mini-spec with details, requirements, and considerations',
        },
        confidence: {
          type: 'number',
          description: 'Confidence level 0-100 (0-30: forming, 30-60: emerging, 60-90: developing, 90-100: ready)',
        },
        merge_suggestion: {
          type: 'object',
          description: 'Optional: Suggest merging this block with existing blocks if concepts are too granular',
          properties: {
            block_ids: {
              type: 'array',
              items: { type: 'string' },
              description: 'IDs of blocks that should be merged together',
            },
            rationale: {
              type: 'string',
              description: 'Why these blocks should be merged',
            },
          },
          required: ['block_ids', 'rationale'],
        },
        split_suggestion: {
          type: 'object',
          description: 'Optional: Suggest splitting this block if it covers too many distinct concepts',
          properties: {
            rationale: {
              type: 'string',
              description: 'Why this block should be split and what the separate concerns are',
            },
          },
          required: ['rationale'],
        },
      },
      required: ['session_id', 'type', 'title', 'keyword', 'emoji', 'content', 'confidence'],
    },
  },
  {
    name: 'update_block',
    description: 'Update an existing block with new confidence level, content, or status. Use to refine blocks as understanding develops. Can also suggest merge/split actions.',
    input_schema: {
      type: 'object' as const,
      properties: {
        session_id: {
          type: 'string',
          description: 'The session ID containing the block',
        },
        block_id: {
          type: 'string',
          description: 'The block ID to update',
        },
        confidence: {
          type: 'number',
          description: 'Updated confidence level 0-100',
        },
        content: {
          type: 'string',
          description: 'Updated markdown content (replaces existing)',
        },
        status: {
          type: 'string',
          enum: ['forming', 'emerging', 'developing', 'ready'],
          description: 'Updated status (cannot be set to curated via this tool)',
        },
        merge_suggestion: {
          type: 'object',
          description: 'Optional: Suggest merging this block with existing blocks if concepts are too granular',
          properties: {
            block_ids: {
              type: 'array',
              items: { type: 'string' },
              description: 'IDs of blocks that should be merged together (including this one)',
            },
            rationale: {
              type: 'string',
              description: 'Why these blocks should be merged',
            },
          },
          required: ['block_ids', 'rationale'],
        },
        split_suggestion: {
          type: 'object',
          description: 'Optional: Suggest splitting this block if it covers too many distinct concepts',
          properties: {
            rationale: {
              type: 'string',
              description: 'Why this block should be split and what the separate concerns are',
            },
          },
          required: ['rationale'],
        },
      },
      required: ['session_id', 'block_id'],
    },
  },
  {
    name: 'list_blocks',
    description: 'View all blocks in the current session. Use this to check existing blocks before creating new ones, and to assess whether blocks should be merged or split.',
    input_schema: {
      type: 'object' as const,
      properties: {
        session_id: {
          type: 'string',
          description: 'The session ID to list blocks from',
        },
      },
      required: ['session_id'],
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

export interface CreateBlockInput {
  session_id: string;
  type: string;
  title: string;
  keyword: string;
  emoji: string;
  content: string;
  confidence: number;
  merge_suggestion?: {
    block_ids: string[];
    rationale: string;
  };
  split_suggestion?: {
    rationale: string;
  };
}

export interface UpdateBlockInput {
  session_id: string;
  block_id: string;
  confidence?: number;
  content?: string;
  status?: 'forming' | 'emerging' | 'developing' | 'ready';
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

export type SpecialistToolInput =
  | { name: 'update_observations'; input: UpdateObservationsInput }
  | { name: 'read_understanding'; input: ReadUnderstandingInput }
  | { name: 'queue_insight'; input: QueueInsightInput }
  | { name: 'create_block'; input: CreateBlockInput }
  | { name: 'update_block'; input: UpdateBlockInput }
  | { name: 'list_blocks'; input: ListBlocksInput };

// =============================================================================
// Tool Result
// =============================================================================

export interface SpecialistToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

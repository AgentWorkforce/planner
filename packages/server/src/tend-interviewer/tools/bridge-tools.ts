/**
 * Bridge Tools
 *
 * Tools that bridge between phases: ideation → planning → forging.
 */

import type Anthropic from '@anthropic-ai/sdk';

export const BRIDGE_TOOLS: Anthropic.Tool[] = [
  {
    name: 'graduate_project',
    description: 'Graduate the project to the next phase. From ideation→planning: converts blocks to plan. From planning→forging: starts execution.',
    input_schema: {
      type: 'object' as const,
      properties: {
        block_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Block IDs to graduate (for ideation→planning transition)',
        },
        reason: {
          type: 'string',
          description: 'Why graduation is appropriate now',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_project_status',
    description: 'Get current project state with linked entities (session, plan, run)',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'update_focus',
    description: 'Set the current context focus (what user is looking at)',
    input_schema: {
      type: 'object' as const,
      properties: {
        focus_type: {
          type: 'string',
          enum: ['step', 'scope', 'block'],
          description: 'Type of entity to focus on',
        },
        focus_id: {
          type: 'string',
          description: 'ID of the entity',
        },
      },
      required: ['focus_type', 'focus_id'],
    },
  },
];

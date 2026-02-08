/**
 * Ideation Tools
 *
 * Tools for brainstorming phase: specialists, blocks, understanding.
 * These delegate to the existing ideation interviewer tools.
 */

import type Anthropic from '@anthropic-ai/sdk';

export const IDEATION_TOOLS: Anthropic.Tool[] = [
  {
    name: 'spawn_specialist',
    description: 'Spawn a specialist agent to provide expertise. Use when conversation reveals need for specific knowledge. Specialists are invisible to user.',
    input_schema: {
      type: 'object' as const,
      properties: {
        session_id: {
          type: 'string',
          description: 'The session ID',
        },
        name: {
          type: 'string',
          description: 'Specialist name (e.g., Architect, Designer, Security, QA, or custom)',
        },
        focus: {
          type: 'string',
          description: 'What this specialist should focus on',
        },
        prompt_context: {
          type: 'string',
          description: 'Optional additional context from the conversation',
        },
      },
      required: ['session_id', 'name', 'focus'],
    },
  },
  {
    name: 'read_blocks',
    description: 'Get the current session blocks (curated insights)',
    input_schema: {
      type: 'object' as const,
      properties: {
        session_id: {
          type: 'string',
          description: 'The session ID to read blocks from',
        },
      },
      required: ['session_id'],
    },
  },
  {
    name: 'update_understanding',
    description: 'Update specialist observations. Called when specialists report insights. Structure is freeform.',
    input_schema: {
      type: 'object' as const,
      properties: {
        session_id: {
          type: 'string',
          description: 'The session ID',
        },
        specialist_name: {
          type: 'string',
          description: 'Name of the specialist (e.g., Architect, Designer, Security)',
        },
        observations: {
          type: 'object',
          description: 'Freeform observations object - structure defined by specialist',
        },
      },
      required: ['session_id', 'specialist_name', 'observations'],
    },
  },
  {
    name: 'update_synthesis',
    description: 'Update the AI understanding synthesis for the session. Call this when understanding has evolved significantly.',
    input_schema: {
      type: 'object' as const,
      properties: {
        session_id: {
          type: 'string',
          description: 'The session ID',
        },
        idea_summary: {
          type: 'string',
          description: 'Brief synopsis of the overall idea (2-3 sentences)',
        },
        specialist_perspectives: {
          type: 'object',
          description: 'Per-specialist synthesized perspectives',
          additionalProperties: {
            type: 'object',
            properties: {
              take: { type: 'string', description: "Specialist's key take on the idea" },
              concerns: { type: 'array', items: { type: 'string' }, description: 'Key concerns identified' },
              confidence: { type: 'string', enum: ['exploring', 'forming', 'confident'], description: 'Confidence level of this specialist' },
            },
            required: ['take', 'concerns', 'confidence'],
          },
        },
      },
      required: ['session_id', 'idea_summary', 'specialist_perspectives'],
    },
  },
];

/**
 * Interaction Tools
 *
 * Tools for AI to request user input, spawn agents, etc.
 */

import type Anthropic from '@anthropic-ai/sdk';

export const INTERACTION_TOOLS: Anthropic.Tool[] = [
  {
    name: 'ask_question',
    description: 'Pose a question to the user (appears in ReplyBar)',
    input_schema: {
      type: 'object' as const,
      properties: {
        question: {
          type: 'string',
          description: 'The question to ask',
        },
        attention_level: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
          description: 'How urgent this question is',
        },
      },
      required: ['question'],
    },
  },
  {
    name: 'present_choices',
    description: 'Present multiple choice options to the user',
    input_schema: {
      type: 'object' as const,
      properties: {
        question: {
          type: 'string',
          description: 'The question/prompt',
        },
        choices: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of choices to present',
        },
      },
      required: ['question', 'choices'],
    },
  },
  {
    name: 'request_approval',
    description: 'Request approval for a specific action (gate)',
    input_schema: {
      type: 'object' as const,
      properties: {
        action: {
          type: 'string',
          description: 'What action needs approval',
        },
        reason: {
          type: 'string',
          description: 'Why this needs approval',
        },
      },
      required: ['action', 'reason'],
    },
  },
];

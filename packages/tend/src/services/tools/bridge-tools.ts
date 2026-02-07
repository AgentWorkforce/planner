/**
 * Tool definitions for phase transitions and cross-domain operations
 */

import type { ToolDefinition } from './ideation-tools';

export const bridgeTools: ToolDefinition[] = [
  {
    name: 'graduate_to_plan',
    description: 'Graduate from ideation to planning phase. Use when ideas are sufficiently developed and ready to be structured into a plan.',
    input_schema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'The ideation session to graduate from',
        },
        selectedBlockIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Which idea blocks to include in the plan',
        },
        planTitle: {
          type: 'string',
          description: 'Title for the new plan',
        },
      },
      required: ['sessionId'],
    },
  },
  {
    name: 'graduate_to_forge',
    description: 'Graduate from planning to execution (Forge). Use when a plan is approved and ready to execute.',
    input_schema: {
      type: 'object',
      properties: {
        planId: {
          type: 'string',
          description: 'The plan to execute',
        },
        version: {
          type: 'number',
          description: 'The version to execute (must be approved)',
        },
        runName: {
          type: 'string',
          description: 'Name for the execution run',
        },
      },
      required: ['planId'],
    },
  },
  {
    name: 'set_focus',
    description: 'Set the current focus for the conversation. Use when the user wants to focus on a specific step, scope, or area.',
    input_schema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['step', 'scope', 'session', 'run', 'none'],
          description: 'What type of entity to focus on',
        },
        id: {
          type: 'string',
          description: 'The ID of the entity to focus on',
        },
      },
      required: ['type'],
    },
  },
  {
    name: 'ask_question',
    description: 'Ask the user a clarifying question. Use when you need more information to proceed.',
    input_schema: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          description: 'The question to ask',
        },
        context: {
          type: 'string',
          description: 'Why you are asking this question',
        },
        suggestedAnswers: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional suggested answers for multiple choice',
        },
      },
      required: ['question'],
    },
  },
];

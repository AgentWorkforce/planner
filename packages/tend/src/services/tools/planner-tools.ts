/**
 * Tool definitions for planning operations
 */

import type { ToolDefinition } from './ideation-tools';

export const plannerTools: ToolDefinition[] = [
  {
    name: 'create_plan',
    description: 'Create a new plan version. Use when graduating from ideation to structured planning, or when starting a new plan.',
    input_schema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Plan title/goal',
        },
        context: {
          type: 'string',
          description: 'Background context for the plan',
        },
        scope: {
          type: 'string',
          description: 'Which scope/domain this plan covers',
        },
      },
      required: ['title'],
    },
  },
  {
    name: 'add_step',
    description: 'Add a new step to the current plan. Use when breaking down work into actionable items.',
    input_schema: {
      type: 'object',
      properties: {
        planId: {
          type: 'string',
          description: 'The plan to add the step to',
        },
        title: {
          type: 'string',
          description: 'Step title',
        },
        description: {
          type: 'string',
          description: 'Detailed description of what needs to be done',
        },
        ownerRole: {
          type: 'string',
          description: 'Role responsible for this step (e.g., "backend:Coder")',
        },
        scope: {
          type: 'string',
          description: 'Which scope/repo this step belongs to',
        },
      },
      required: ['planId', 'title'],
    },
  },
  {
    name: 'update_step',
    description: 'Update an existing step in the plan. Use when refining step details or acceptance criteria.',
    input_schema: {
      type: 'object',
      properties: {
        planId: {
          type: 'string',
          description: 'The plan containing the step',
        },
        stepId: {
          type: 'string',
          description: 'The step to update',
        },
        title: {
          type: 'string',
          description: 'Updated step title',
        },
        description: {
          type: 'string',
          description: 'Updated description',
        },
        acceptanceCriteria: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              description: { type: 'string' },
              type: { type: 'string' },
            },
          },
          description: 'Acceptance criteria for this step',
        },
      },
      required: ['planId', 'stepId'],
    },
  },
  {
    name: 'set_dependencies',
    description: 'Set dependencies between steps. Use when establishing the execution order.',
    input_schema: {
      type: 'object',
      properties: {
        planId: {
          type: 'string',
          description: 'The plan containing the steps',
        },
        stepId: {
          type: 'string',
          description: 'The step to set dependencies for',
        },
        dependencies: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of step IDs that this step depends on',
        },
      },
      required: ['planId', 'stepId', 'dependencies'],
    },
  },
  {
    name: 'approve_plan',
    description: 'Approve a plan version, locking it for execution. Use when the plan is complete and ready to execute.',
    input_schema: {
      type: 'object',
      properties: {
        planId: {
          type: 'string',
          description: 'The plan to approve',
        },
        version: {
          type: 'number',
          description: 'The version to approve',
        },
      },
      required: ['planId'],
    },
  },
];

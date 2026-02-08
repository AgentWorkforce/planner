/**
 * Planner Tools
 *
 * Tools for planning phase: steps, dependencies, acceptance criteria.
 * Adapted from planner-lead tools to use project.plan_id context.
 */

import type Anthropic from '@anthropic-ai/sdk';

export const PLANNER_TOOLS: Anthropic.Tool[] = [
  {
    name: 'create_step',
    description: 'Create a new step in the plan. Reads plan_id from current project context.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: {
          type: 'string',
          description: 'Step title (concise, actionable)',
        },
        description: {
          type: 'string',
          description: 'Detailed description of what needs to be done',
        },
        scope: {
          type: 'string',
          description: 'Optional scope grouping (e.g., "api-service", "frontend")',
        },
        owner_role: {
          type: 'string',
          description: 'Optional role assignment (e.g., "backend:Coder")',
        },
      },
      required: ['title'],
    },
  },
  {
    name: 'update_step',
    description: 'Update an existing step. Reads plan_id from current project context.',
    input_schema: {
      type: 'object' as const,
      properties: {
        step_id: {
          type: 'string',
          description: 'The step ID to update',
        },
        title: {
          type: 'string',
          description: 'New title',
        },
        description: {
          type: 'string',
          description: 'New description',
        },
        scope: {
          type: 'string',
          description: 'New scope',
        },
      },
      required: ['step_id'],
    },
  },
  {
    name: 'add_dependency',
    description: 'Add a dependency between steps. Step A depends on Step B = A cannot start until B completes.',
    input_schema: {
      type: 'object' as const,
      properties: {
        step_id: {
          type: 'string',
          description: 'The step that has the dependency',
        },
        depends_on_step_id: {
          type: 'string',
          description: 'The step it depends on',
        },
      },
      required: ['step_id', 'depends_on_step_id'],
    },
  },
  {
    name: 'suggest_scope',
    description: 'Suggest a scope grouping for steps. Scopes group related work (e.g., by repo, team, domain).',
    input_schema: {
      type: 'object' as const,
      properties: {
        scope_name: {
          type: 'string',
          description: 'Name of the scope (e.g., "api-service", "web-frontend")',
        },
        description: {
          type: 'string',
          description: 'What this scope encompasses',
        },
      },
      required: ['scope_name', 'description'],
    },
  },
];

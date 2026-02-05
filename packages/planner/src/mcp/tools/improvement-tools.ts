/**
 * Plan improvement suggestion tools.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { PlanStorage } from '../../storage/interface.js';
import { createImprovement, type ImprovementType } from '../../domain/improvement.js';
import { success, error, type ToolResponse } from './shared.js';

const VALID_IMPROVEMENT_TYPES = [
  'missing_criteria',
  'unclear_description',
  'missing_dependency',
  'redundant_step',
  'scope_suggestion',
] as const;

/**
 * Improvement tool schemas.
 */
export const improvementTools: Tool[] = [
  {
    name: 'suggest_improvement',
    description:
      'Suggest an improvement to the plan. Creates a pending improvement that can be accepted or dismissed by the user. Use this when you notice issues or opportunities to enhance the plan quality.',
    inputSchema: {
      type: 'object',
      properties: {
        plan_id: {
          type: 'string',
          description: 'The UUID of the plan',
        },
        version: {
          type: 'number',
          description: 'The version number this improvement applies to',
        },
        type: {
          type: 'string',
          enum: [
            'missing_criteria',
            'unclear_description',
            'missing_dependency',
            'redundant_step',
            'scope_suggestion',
          ],
          description: 'Type of improvement being suggested',
        },
        description: {
          type: 'string',
          description: 'Human-readable explanation of the improvement',
        },
        step_id: {
          type: 'string',
          description: 'The step this improvement targets (if applicable)',
        },
        suggested_change: {
          type: 'object',
          description: 'Structured data describing the suggested change',
        },
      },
      required: ['plan_id', 'version', 'type', 'description'],
    },
  },
];

/**
 * Tool handlers
 */

export function handleSuggestImprovement(
  storage: PlanStorage,
  args: Record<string, unknown>
): ToolResponse {
  const planId = args.plan_id as string;
  const version = args.version as number;
  const type = args.type as string;
  const description = args.description as string;
  const stepId = args.step_id as string | undefined;
  const suggestedChange = args.suggested_change as Record<string, unknown> | undefined;

  if (!planId) {
    return error('plan_id is required');
  }
  if (version === undefined || version === null) {
    return error('version is required');
  }
  if (!type) {
    return error('type is required');
  }
  if (!description) {
    return error('description is required');
  }

  // Validate type
  if (!VALID_IMPROVEMENT_TYPES.includes(type as typeof VALID_IMPROVEMENT_TYPES[number])) {
    return error(`Invalid improvement type: ${type}. Must be one of: ${VALID_IMPROVEMENT_TYPES.join(', ')}`);
  }

  const plan = storage.getPlan(planId);
  if (!plan) {
    return error(`Plan not found: ${planId}`);
  }

  const planVersion = storage.getVersion(planId, version);
  if (!planVersion) {
    return error(`Version ${version} not found for plan ${planId}`);
  }

  // If step_id is provided, validate it exists
  if (stepId) {
    const stepExists = planVersion.steps.some((s) => s.step_id === stepId);
    if (!stepExists) {
      return error(`Step not found: ${stepId}`);
    }
  }

  // Create the improvement
  const improvement = createImprovement({
    plan_id: planId,
    version,
    step_id: stepId,
    type: type as ImprovementType,
    description,
    suggested_change: suggestedChange,
  });

  storage.createImprovement(improvement);
  return success({ improvement });
}

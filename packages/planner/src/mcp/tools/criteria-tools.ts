/**
 * Acceptance criteria tools - add, edit, remove.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { PlanStorage } from '../../storage/interface.js';
import type { Step } from '../../domain/step.js';
import { PlanStatus } from '../../domain/status.js';
import { success, error, checkVersionConflict, type ToolResponse } from './shared.js';

/**
 * Criteria tool schemas.
 */
export const criteriaTools: Tool[] = [
  {
    name: 'add_criteria',
    description:
      'Add an acceptance criterion to a step. Returns the updated step. Supports optimistic locking via expected_version.',
    inputSchema: {
      type: 'object',
      properties: {
        plan_id: {
          type: 'string',
          description: 'The UUID of the plan',
        },
        step_id: {
          type: 'string',
          description: 'The UUID of the step',
        },
        description: {
          type: 'string',
          description: 'Description of the acceptance criterion',
        },
        type: {
          type: 'string',
          description: 'Type of criterion (e.g., "test", "review", "metric")',
        },
        expected_version: {
          type: 'number',
          description: 'Expected version number for optimistic locking. If provided and version has changed, returns VERSION_CONFLICT error.',
        },
      },
      required: ['plan_id', 'step_id', 'description'],
    },
  },
  {
    name: 'remove_criteria',
    description: 'Remove an acceptance criterion from a step',
    inputSchema: {
      type: 'object',
      properties: {
        plan_id: { type: 'string', description: 'The UUID of the plan' },
        step_id: { type: 'string', description: 'The step ID' },
        criterion_id: { type: 'string', description: 'The criterion ID to remove' },
        expected_version: { type: 'number', description: 'Expected version for optimistic locking' }
      },
      required: ['plan_id', 'step_id', 'criterion_id']
    }
  },
  {
    name: 'edit_criteria',
    description: 'Edit an existing acceptance criterion on a step',
    inputSchema: {
      type: 'object',
      properties: {
        plan_id: { type: 'string', description: 'The UUID of the plan' },
        step_id: { type: 'string', description: 'The step ID' },
        criterion_id: { type: 'string', description: 'The criterion ID to edit' },
        description: { type: 'string', description: 'New description for the criterion' },
        type: { type: 'string', description: 'New type for the criterion' },
        expected_version: { type: 'number', description: 'Expected version for optimistic locking' }
      },
      required: ['plan_id', 'step_id', 'criterion_id']
    }
  },
];

/**
 * Tool handlers
 */

export function handleAddCriteria(
  storage: PlanStorage,
  args: Record<string, unknown>
): ToolResponse {
  const planId = args.plan_id as string;
  const stepId = args.step_id as string;
  const description = args.description as string;
  const type = args.type as string | undefined;
  const expectedVersion = args.expected_version as number | undefined;

  if (!planId) {
    return error('plan_id is required');
  }
  if (!stepId) {
    return error('step_id is required');
  }
  if (!description) {
    return error('description is required');
  }

  const plan = storage.getPlan(planId);
  if (!plan) {
    return error(`Plan not found: ${planId}`);
  }

  const latestVersion = storage.getLatestVersion(planId);
  if (!latestVersion) {
    return error('No version found for plan');
  }
  if (latestVersion.status !== PlanStatus.Draft) {
    return error('Can only add criteria to draft version');
  }

  // Optimistic locking check
  const conflict = checkVersionConflict(expectedVersion, latestVersion.version);
  if (conflict) {
    return conflict;
  }

  const stepIndex = latestVersion.steps.findIndex((s) => s.step_id === stepId);
  if (stepIndex === -1) {
    return error(`Step not found: ${stepId}`);
  }

  const existingStep = latestVersion.steps[stepIndex]!;
  const criterion = {
    id: crypto.randomUUID(),
    description,
    ...(type !== undefined && { type }),
  };

  const updatedStep: Step = {
    ...existingStep,
    acceptance_criteria: [...(existingStep.acceptance_criteria ?? []), criterion],
  };

  const newSteps = [...latestVersion.steps];
  newSteps[stepIndex] = updatedStep;

  const now = new Date().toISOString();
  const newVersion = {
    ...latestVersion,
    version: latestVersion.version + 1,
    steps: newSteps,
    created_at: now,
    updated_at: now,
  };

  storage.createVersion(newVersion);
  return success({ version: newVersion, step: updatedStep, criterion });
}

export function handleRemoveCriteria(
  storage: PlanStorage,
  args: Record<string, unknown>
): ToolResponse {
  const planId = args.plan_id as string;
  const stepId = args.step_id as string;
  const criterionId = args.criterion_id as string;
  const expectedVersion = args.expected_version as number | undefined;

  if (!planId) {
    return error('plan_id is required');
  }
  if (!stepId) {
    return error('step_id is required');
  }
  if (!criterionId) {
    return error('criterion_id is required');
  }

  const plan = storage.getPlan(planId);
  if (!plan) {
    return error(`Plan not found: ${planId}`);
  }

  const latestVersion = storage.getLatestVersion(planId);
  if (!latestVersion) {
    return error('No version found for plan');
  }
  if (latestVersion.status !== PlanStatus.Draft) {
    return error('Can only remove criteria from draft version');
  }

  // Optimistic locking check
  const conflict = checkVersionConflict(expectedVersion, latestVersion.version);
  if (conflict) {
    return conflict;
  }

  const stepIndex = latestVersion.steps.findIndex((s) => s.step_id === stepId);
  if (stepIndex === -1) {
    return error(`Step not found: ${stepId}`);
  }

  const existingStep = latestVersion.steps[stepIndex]!;
  const acceptanceCriteria = existingStep.acceptance_criteria ?? [];

  const criterionIndex = acceptanceCriteria.findIndex((c) => c.id === criterionId);
  if (criterionIndex === -1) {
    return error(`Criterion not found: ${criterionId}`);
  }

  // Remove the criterion
  const updatedCriteria = acceptanceCriteria.filter((c) => c.id !== criterionId);

  const updatedStep: Step = {
    ...existingStep,
    acceptance_criteria: updatedCriteria,
  };

  const newSteps = [...latestVersion.steps];
  newSteps[stepIndex] = updatedStep;

  const now = new Date().toISOString();
  const newVersion = {
    ...latestVersion,
    version: latestVersion.version + 1,
    steps: newSteps,
    created_at: now,
    updated_at: now,
  };

  storage.createVersion(newVersion);
  return success({ version: newVersion, step: updatedStep });
}

export function handleEditCriteria(
  storage: PlanStorage,
  args: Record<string, unknown>
): ToolResponse {
  const planId = args.plan_id as string;
  const stepId = args.step_id as string;
  const criterionId = args.criterion_id as string;
  const description = args.description as string | undefined;
  const type = args.type as string | undefined;
  const expectedVersion = args.expected_version as number | undefined;

  if (!planId) {
    return error('plan_id is required');
  }
  if (!stepId) {
    return error('step_id is required');
  }
  if (!criterionId) {
    return error('criterion_id is required');
  }

  // Require at least one field to update
  if (description === undefined && type === undefined) {
    return error('At least one of description or type must be provided');
  }

  // Validate non-empty strings if provided
  if (description !== undefined && description.trim() === '') {
    return error('description cannot be empty');
  }
  if (type !== undefined && type.trim() === '') {
    return error('type cannot be empty');
  }

  const plan = storage.getPlan(planId);
  if (!plan) {
    return error(`Plan not found: ${planId}`);
  }

  const latestVersion = storage.getLatestVersion(planId);
  if (!latestVersion) {
    return error('No version found for plan');
  }
  if (latestVersion.status !== PlanStatus.Draft) {
    return error('Can only edit criteria in draft version');
  }

  // Optimistic locking check
  const conflict = checkVersionConflict(expectedVersion, latestVersion.version);
  if (conflict) {
    return conflict;
  }

  const stepIndex = latestVersion.steps.findIndex((s) => s.step_id === stepId);
  if (stepIndex === -1) {
    return error(`Step not found: ${stepId}`);
  }

  const existingStep = latestVersion.steps[stepIndex]!;
  const acceptanceCriteria = existingStep.acceptance_criteria ?? [];

  const criterionIndex = acceptanceCriteria.findIndex((c) => c.id === criterionId);
  if (criterionIndex === -1) {
    return error(`Criterion not found: ${criterionId}`);
  }

  // Update the criterion with provided fields
  const existingCriterion = acceptanceCriteria[criterionIndex]!;
  const updatedCriterion = {
    ...existingCriterion,
    ...(description !== undefined && { description }),
    ...(type !== undefined && { type }),
  };

  const updatedCriteria = [...acceptanceCriteria];
  updatedCriteria[criterionIndex] = updatedCriterion;

  const updatedStep: Step = {
    ...existingStep,
    acceptance_criteria: updatedCriteria,
  };

  const newSteps = [...latestVersion.steps];
  newSteps[stepIndex] = updatedStep;

  const now = new Date().toISOString();
  const newVersion = {
    ...latestVersion,
    version: latestVersion.version + 1,
    steps: newSteps,
    created_at: now,
    updated_at: now,
  };

  storage.createVersion(newVersion);
  return success({ version: newVersion, step: updatedStep, criterion: updatedCriterion });
}

/**
 * Step manipulation tools - add, edit, remove, set dependencies.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { PlanStorage } from '../../storage/interface.js';
import { createStep, validateStepDag, type Step } from '../../domain/step.js';
import { PlanStatus } from '../../domain/status.js';
import { success, error, checkVersionConflict, type ToolResponse } from './shared.js';

/**
 * Step tool schemas.
 */
export const stepTools: Tool[] = [
  {
    name: 'add_step',
    description:
      'Add a step to the latest draft version of a plan. Returns the updated version with the new step. Supports optimistic locking via expected_version.',
    inputSchema: {
      type: 'object',
      properties: {
        plan_id: {
          type: 'string',
          description: 'The UUID of the plan',
        },
        title: {
          type: 'string',
          description: 'The title of the step (required)',
        },
        description: {
          type: 'string',
          description: 'Detailed description of the step',
        },
        scope: {
          type: 'string',
          description: 'The scope (e.g., repo, team, domain) for this step',
        },
        owner_role: {
          type: 'string',
          description: 'The role responsible for this step (e.g., "backend:Coder")',
        },
        dependencies: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of step_ids this step depends on',
        },
        expected_version: {
          type: 'number',
          description: 'Expected version number for optimistic locking. If provided and version has changed, returns VERSION_CONFLICT error.',
        },
      },
      required: ['plan_id', 'title'],
    },
  },
  {
    name: 'edit_step',
    description:
      'Modify an existing step in the draft version. Only specified fields are updated; others are preserved. Supports optimistic locking via expected_version.',
    inputSchema: {
      type: 'object',
      properties: {
        plan_id: {
          type: 'string',
          description: 'The UUID of the plan',
        },
        step_id: {
          type: 'string',
          description: 'The UUID of the step to edit',
        },
        title: {
          type: 'string',
          description: 'New title for the step',
        },
        description: {
          type: 'string',
          description: 'New description for the step',
        },
        scope: {
          type: 'string',
          description: 'New scope for the step',
        },
        owner_role: {
          type: 'string',
          description: 'New owner role for the step',
        },
        expected_version: {
          type: 'number',
          description: 'Expected version number for optimistic locking. If provided and version has changed, returns VERSION_CONFLICT error.',
        },
      },
      required: ['plan_id', 'step_id'],
    },
  },
  {
    name: 'remove_step',
    description:
      'Remove a step from the draft version. Also removes this step_id from other steps\' dependencies. Supports optimistic locking via expected_version.',
    inputSchema: {
      type: 'object',
      properties: {
        plan_id: {
          type: 'string',
          description: 'The UUID of the plan',
        },
        step_id: {
          type: 'string',
          description: 'The UUID of the step to remove',
        },
        expected_version: {
          type: 'number',
          description: 'Expected version number for optimistic locking. If provided and version has changed, returns VERSION_CONFLICT error.',
        },
      },
      required: ['plan_id', 'step_id'],
    },
  },
  {
    name: 'set_dependencies',
    description:
      'Set the dependencies for a step. Validates that all dependency step_ids exist and no cycles are created. Supports optimistic locking via expected_version.',
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
        dependencies: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of step_ids this step depends on',
        },
        expected_version: {
          type: 'number',
          description: 'Expected version number for optimistic locking. If provided and version has changed, returns VERSION_CONFLICT error.',
        },
      },
      required: ['plan_id', 'step_id', 'dependencies'],
    },
  },
];

/**
 * Tool handlers
 */

export function handleAddStep(
  storage: PlanStorage,
  args: Record<string, unknown>
): ToolResponse {
  const planId = args.plan_id as string;
  const title = args.title as string;
  const expectedVersion = args.expected_version as number | undefined;

  if (!planId) {
    return error('plan_id is required');
  }
  if (!title) {
    return error('title is required');
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
    return error('Can only add steps to draft version');
  }

  // Optimistic locking check
  const conflict = checkVersionConflict(expectedVersion, latestVersion.version);
  if (conflict) {
    return conflict;
  }

  // Create new step
  const step = createStep(title, {
    description: args.description as string | undefined,
    scope: args.scope as string | undefined,
    owner_role: args.owner_role as string | undefined,
    dependencies: args.dependencies as string[] | undefined,
  });

  // Create new version with the step added
  const now = new Date().toISOString();
  const newVersion = {
    ...latestVersion,
    version: latestVersion.version + 1,
    steps: [...latestVersion.steps, step],
    created_at: now,
    updated_at: now,
  };

  storage.createVersion(newVersion);
  return success({ version: newVersion, step });
}

export function handleEditStep(
  storage: PlanStorage,
  args: Record<string, unknown>
): ToolResponse {
  const planId = args.plan_id as string;
  const stepId = args.step_id as string;
  const expectedVersion = args.expected_version as number | undefined;

  if (!planId) {
    return error('plan_id is required');
  }
  if (!stepId) {
    return error('step_id is required');
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
    return error('Can only edit steps in draft version');
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

  // Update step with provided fields
  const existingStep = latestVersion.steps[stepIndex]!;
  const updatedStep: Step = {
    ...existingStep,
    ...(args.title !== undefined && { title: args.title as string }),
    ...(args.description !== undefined && { description: args.description as string }),
    ...(args.scope !== undefined && { scope: args.scope as string }),
    ...(args.owner_role !== undefined && { owner_role: args.owner_role as string }),
  };

  // Create new version with updated step
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

export function handleRemoveStep(
  storage: PlanStorage,
  args: Record<string, unknown>
): ToolResponse {
  const planId = args.plan_id as string;
  const stepId = args.step_id as string;
  const expectedVersion = args.expected_version as number | undefined;

  if (!planId) {
    return error('plan_id is required');
  }
  if (!stepId) {
    return error('step_id is required');
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
    return error('Can only remove steps from draft version');
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

  // Remove step and clean up dependencies pointing to it
  const newSteps = latestVersion.steps
    .filter((s) => s.step_id !== stepId)
    .map((s) => ({
      ...s,
      dependencies: s.dependencies?.filter((d) => d !== stepId),
    }));

  const now = new Date().toISOString();
  const newVersion = {
    ...latestVersion,
    version: latestVersion.version + 1,
    steps: newSteps,
    created_at: now,
    updated_at: now,
  };

  storage.createVersion(newVersion);
  return success({ version: newVersion });
}

export function handleSetDependencies(
  storage: PlanStorage,
  args: Record<string, unknown>
): ToolResponse {
  const planId = args.plan_id as string;
  const stepId = args.step_id as string;
  const dependencies = args.dependencies as string[];
  const expectedVersion = args.expected_version as number | undefined;

  if (!planId) {
    return error('plan_id is required');
  }
  if (!stepId) {
    return error('step_id is required');
  }
  if (!Array.isArray(dependencies)) {
    return error('dependencies must be an array');
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
    return error('Can only set dependencies in draft version');
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

  // Validate all dependency IDs exist
  const stepIds = new Set(latestVersion.steps.map((s) => s.step_id));
  for (const depId of dependencies) {
    if (!stepIds.has(depId)) {
      return error(`Dependency step not found: ${depId}`);
    }
    if (depId === stepId) {
      return error('Step cannot depend on itself');
    }
  }

  // Create proposed steps to check for cycles
  const proposedSteps = latestVersion.steps.map((s, i) =>
    i === stepIndex ? { ...s, dependencies } : s
  );

  if (!validateStepDag(proposedSteps)) {
    return error('Setting these dependencies would create a cycle');
  }

  // Apply the change
  const newSteps = [...latestVersion.steps];
  newSteps[stepIndex] = { ...newSteps[stepIndex]!, dependencies };

  const now = new Date().toISOString();
  const newVersion = {
    ...latestVersion,
    version: latestVersion.version + 1,
    steps: newSteps,
    created_at: now,
    updated_at: now,
  };

  storage.createVersion(newVersion);
  return success({ version: newVersion, step: newSteps[stepIndex] });
}

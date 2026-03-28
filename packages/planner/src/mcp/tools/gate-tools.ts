/**
 * Approval gate tools - add, remove.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { PlanStorage } from '../../storage/interface.js';
import type { Step } from '../../domain/step.js';
import { PlanStatus } from '../../domain/status.js';
import { success, error, checkVersionConflict, type ToolResponse } from './shared.js';

/**
 * Gate tool schemas.
 */
export const gateTools: Tool[] = [
  {
    name: 'add_gate',
    description:
      'Add a human approval gate to a step. Gates require explicit sign-off before proceeding. Supports optimistic locking via expected_version.',
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
        approver_role: {
          type: 'string',
          description: 'The role required to approve (e.g., "tech_lead")',
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
    name: 'remove_gate',
    description: 'Remove an approval gate from a step',
    inputSchema: {
      type: 'object',
      properties: {
        plan_id: { type: 'string', description: 'The UUID of the plan' },
        step_id: { type: 'string', description: 'The step ID' },
        expected_version: { type: 'number', description: 'Expected version for optimistic locking' }
      },
      required: ['plan_id', 'step_id']
    }
  },
];

/**
 * Tool handlers
 */

export function handleAddGate(
  storage: PlanStorage,
  args: Record<string, unknown>
): ToolResponse {
  const planId = args.plan_id as string;
  const stepId = args.step_id as string;
  const approverRole = args.approver_role as string | undefined;
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
    return error('Can only add gates to draft version');
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
  const updatedStep: Step = {
    ...existingStep,
    gate: {
      type: 'human_approval',
      ...(approverRole !== undefined && { approver_role: approverRole }),
    },
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

export function handleRemoveGate(
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
    return error('Can only remove gates from draft version');
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

  // Check if step has a gate to remove
  if (!existingStep.gate) {
    return error('Step does not have a gate to remove');
  }

  const updatedStep: Step = {
    ...existingStep,
    gate: undefined,
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

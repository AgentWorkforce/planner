/**
 * Step manipulation tools for PlannerLead.
 */

import type { PlanStorage } from '../../../../planner/src/storage/interface.js';
import type { PlanVersion } from '../../../../planner/src/domain/plan.js';
import type { Step } from '../../../../planner/src/domain/step.js';
import { randomUUID } from 'crypto';
import { emitPlanChange } from '../../../../planner/src/events/plan-events.js';
import type { ToolResult, AddStepInput, EditStepInput } from './types.js';
import { findPlanByIdPrefix } from './plan-tools.js';

/**
 * Execute add_step tool.
 */
export async function executeAddStep(
  input: AddStepInput,
  storage: PlanStorage
): Promise<ToolResult> {
  try {
    // Support partial IDs from channel names
    const plan = findPlanByIdPrefix(storage, input.plan_id);
    if (!plan) {
      return { success: false, error: `Plan not found: ${input.plan_id}` };
    }

    const version = storage.getLatestVersion(plan.plan_id);
    if (!version) {
      return { success: false, error: `No version found for plan: ${plan.plan_id}` };
    }

    if (version.status !== 'draft') {
      return { success: false, error: `Cannot add steps to ${version.status} plan. Only draft plans can be modified.` };
    }

    const stepId = `step-${randomUUID().slice(0, 8)}`;
    const newStep: Step = {
      step_id: stepId,
      title: input.title,
      dependencies: input.dependencies || [],
    };
    if (input.description !== undefined) newStep.description = input.description;
    if (input.scope !== undefined) newStep.scope = input.scope;

    const now = new Date().toISOString();
    const newVersion: PlanVersion = {
      ...version,
      version: version.version + 1,
      steps: [...version.steps, newStep],
      updated_at: now,
    };

    storage.createVersion(newVersion);

    // Emit event for real-time UI updates
    emitPlanChange(plan.plan_id, newVersion.version, 'step_added', stepId);

    return {
      success: true,
      result: {
        step_id: stepId,
        title: input.title,
        message: `Added step "${input.title}" to plan`,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
}

/**
 * Execute edit_step tool.
 */
export async function executeEditStep(
  input: EditStepInput,
  storage: PlanStorage
): Promise<ToolResult> {
  try {
    // Support partial IDs from channel names
    const plan = findPlanByIdPrefix(storage, input.plan_id);
    if (!plan) {
      return { success: false, error: `Plan not found: ${input.plan_id}` };
    }

    const version = storage.getLatestVersion(plan.plan_id);
    if (!version) {
      return { success: false, error: `No version found for plan: ${plan.plan_id}` };
    }

    if (version.status !== 'draft') {
      return { success: false, error: `Cannot edit steps in ${version.status} plan. Only draft plans can be modified.` };
    }

    const existingStepIndex = version.steps.findIndex((s: Step) => s.step_id === input.step_id);
    if (existingStepIndex === -1) {
      return { success: false, error: `Step not found: ${input.step_id}` };
    }

    // Safe assertion: existingStepIndex !== -1 guarantees this element exists
    const existingStep = version.steps[existingStepIndex]!;
    const updatedStep: Step = {
      step_id: existingStep.step_id,
      title: input.title ?? existingStep.title,
      dependencies: input.dependencies ?? existingStep.dependencies,
      description: input.description ?? existingStep.description,
      scope: existingStep.scope,
      owner_role: existingStep.owner_role,
      acceptance_criteria: existingStep.acceptance_criteria,
      gate: existingStep.gate,
      sub_plan_id: existingStep.sub_plan_id,
    };

    const updatedSteps = [...version.steps];
    updatedSteps[existingStepIndex] = updatedStep;

    const now = new Date().toISOString();
    const newVersion: PlanVersion = {
      ...version,
      version: version.version + 1,
      steps: updatedSteps,
      updated_at: now,
    };

    storage.createVersion(newVersion);

    // Emit event for real-time UI updates
    emitPlanChange(plan.plan_id, newVersion.version, 'step_edited', input.step_id);

    return {
      success: true,
      result: {
        step_id: input.step_id,
        title: updatedStep.title,
        message: `Updated step "${updatedStep.title}"`,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
}

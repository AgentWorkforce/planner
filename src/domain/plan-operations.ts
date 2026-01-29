/**
 * Reusable plan modification functions.
 *
 * These functions encapsulate the core logic for modifying plans and are used by:
 * - MCP tool handlers (src/mcp/tools/index.ts)
 * - HTTP endpoints (src/api/handlers/chat.ts applySuggestion)
 *
 * Each function creates a new version with the requested modification,
 * supporting optimistic locking via expectedVersion parameter.
 */

import type { PlanStorage } from '../storage/interface.js';
import type { Step } from './step.js';
import type { AcceptanceCriterion } from './criterion.js';
import { createStep, validateStepDag } from './step.js';
import { PlanStatus } from './status.js';
import { randomUUID } from 'crypto';
import { emitPlanChange } from '../events/plan-events.js';

/**
 * Result type for plan operations.
 */
export type OperationResult<T = unknown> =
  | { success: true; version: number; data?: T }
  | { success: false; error: string; code: OperationErrorCode };

/**
 * Error codes for plan operations.
 */
export type OperationErrorCode =
  | 'PLAN_NOT_FOUND'
  | 'VERSION_NOT_FOUND'
  | 'STEP_NOT_FOUND'
  | 'CRITERION_NOT_FOUND'
  | 'NOT_DRAFT'
  | 'VERSION_CONFLICT'
  | 'INVALID_DEPENDENCY'
  | 'CYCLE_DETECTED'
  | 'VALIDATION_ERROR';

/**
 * Step data for adding a new step.
 */
export interface AddStepData {
  title: string;
  description?: string;
  scope?: string;
  owner_role?: string;
  dependencies?: string[];
}

/**
 * Step update data for editing a step.
 */
export interface EditStepData {
  title?: string;
  description?: string;
  scope?: string;
  owner_role?: string;
}

/**
 * Acceptance criterion data.
 */
export interface CriteriaData {
  description: string;
  type?: string;
}

/**
 * Check version conflict and return error if detected.
 * Returns OperationResult<never> so it's assignable to any OperationResult<T>.
 */
function checkConflict(
  expectedVersion: number | undefined,
  currentVersion: number
): OperationResult<never> | null {
  if (expectedVersion !== undefined && expectedVersion !== currentVersion) {
    return {
      success: false,
      error: 'Version has changed since last read. Re-read the plan before editing.',
      code: 'VERSION_CONFLICT',
    };
  }
  return null;
}

/**
 * Validate plan exists and is in draft status.
 * Returns error result (assignable to any OperationResult<T>) or the latestVersion.
 */
function validateDraftPlan(
  storage: PlanStorage,
  planId: string
): { error: OperationResult<never> } | { latestVersion: NonNullable<ReturnType<PlanStorage['getLatestVersion']>> } {
  const plan = storage.getPlan(planId);
  if (!plan) {
    return {
      error: {
        success: false,
        error: `Plan not found: ${planId}`,
        code: 'PLAN_NOT_FOUND',
      },
    };
  }

  const latestVersion = storage.getLatestVersion(planId);
  if (!latestVersion) {
    return {
      error: {
        success: false,
        error: 'No version found for plan',
        code: 'VERSION_NOT_FOUND',
      },
    };
  }

  if (latestVersion.status !== PlanStatus.Draft) {
    return {
      error: {
        success: false,
        error: 'Can only modify draft versions',
        code: 'NOT_DRAFT',
      },
    };
  }

  return { latestVersion };
}

/**
 * Add a new step to a plan.
 *
 * Creates a new version with the step added.
 *
 * @param storage - Plan storage
 * @param planId - Plan ID
 * @param stepData - Step data (title required, others optional)
 * @param expectedVersion - Expected version for optimistic locking
 * @returns Operation result with new version number and created step
 */
export function addStepToPlan(
  storage: PlanStorage,
  planId: string,
  stepData: AddStepData,
  expectedVersion?: number
): OperationResult<{ step: Step }> {
  const validation = validateDraftPlan(storage, planId);
  if ('error' in validation) {
    return validation.error;
  }

  const { latestVersion } = validation;
  if (!latestVersion) {
    return { success: false, error: 'No version found', code: 'VERSION_NOT_FOUND' };
  }

  // Optimistic locking check
  const conflict = checkConflict(expectedVersion, latestVersion.version);
  if (conflict) {
    return conflict;
  }

  // Create new step
  const step = createStep(stepData.title, {
    description: stepData.description,
    scope: stepData.scope,
    owner_role: stepData.owner_role,
    dependencies: stepData.dependencies,
  });

  // Create new version with step added
  const now = new Date().toISOString();
  const newVersion = {
    ...latestVersion,
    version: latestVersion.version + 1,
    steps: [...latestVersion.steps, step],
    created_at: now,
    updated_at: now,
  };

  storage.createVersion(newVersion);

  // Emit event for SSE clients
  emitPlanChange(planId, newVersion.version, 'step_added', step.step_id);

  return {
    success: true,
    version: newVersion.version,
    data: { step },
  };
}

/**
 * Edit an existing step in a plan.
 *
 * Creates a new version with the step modified.
 * Only specified fields are updated; others are preserved.
 *
 * @param storage - Plan storage
 * @param planId - Plan ID
 * @param stepId - Step ID to edit
 * @param updates - Fields to update
 * @param expectedVersion - Expected version for optimistic locking
 * @returns Operation result with new version number and updated step
 */
export function editStepInPlan(
  storage: PlanStorage,
  planId: string,
  stepId: string,
  updates: EditStepData,
  expectedVersion?: number
): OperationResult<{ step: Step }> {
  const validation = validateDraftPlan(storage, planId);
  if ('error' in validation) {
    return validation.error;
  }

  const { latestVersion } = validation;
  if (!latestVersion) {
    return { success: false, error: 'No version found', code: 'VERSION_NOT_FOUND' };
  }

  // Optimistic locking check
  const conflict = checkConflict(expectedVersion, latestVersion.version);
  if (conflict) {
    return conflict;
  }

  const stepIndex = latestVersion.steps.findIndex((s) => s.step_id === stepId);
  if (stepIndex === -1) {
    return {
      success: false,
      error: `Step not found: ${stepId}`,
      code: 'STEP_NOT_FOUND',
    };
  }

  // Update step with provided fields
  const existingStep = latestVersion.steps[stepIndex]!;
  const updatedStep: Step = {
    ...existingStep,
    ...(updates.title !== undefined && { title: updates.title }),
    ...(updates.description !== undefined && { description: updates.description }),
    ...(updates.scope !== undefined && { scope: updates.scope }),
    ...(updates.owner_role !== undefined && { owner_role: updates.owner_role }),
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

  // Emit event for SSE clients
  emitPlanChange(planId, newVersion.version, 'step_edited', stepId);

  return {
    success: true,
    version: newVersion.version,
    data: { step: updatedStep },
  };
}

/**
 * Remove a step from a plan.
 *
 * Creates a new version with the step removed.
 * Also cleans up dependencies pointing to the removed step.
 *
 * @param storage - Plan storage
 * @param planId - Plan ID
 * @param stepId - Step ID to remove
 * @param expectedVersion - Expected version for optimistic locking
 * @returns Operation result with new version number
 */
export function removeStepFromPlan(
  storage: PlanStorage,
  planId: string,
  stepId: string,
  expectedVersion?: number
): OperationResult {
  const validation = validateDraftPlan(storage, planId);
  if ('error' in validation) {
    return validation.error;
  }

  const { latestVersion } = validation;
  if (!latestVersion) {
    return { success: false, error: 'No version found', code: 'VERSION_NOT_FOUND' };
  }

  // Optimistic locking check
  const conflict = checkConflict(expectedVersion, latestVersion.version);
  if (conflict) {
    return conflict;
  }

  const stepIndex = latestVersion.steps.findIndex((s) => s.step_id === stepId);
  if (stepIndex === -1) {
    return {
      success: false,
      error: `Step not found: ${stepId}`,
      code: 'STEP_NOT_FOUND',
    };
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

  // Emit event for SSE clients
  emitPlanChange(planId, newVersion.version, 'step_removed', stepId);

  return {
    success: true,
    version: newVersion.version,
  };
}

/**
 * Add an acceptance criterion to a step.
 *
 * Creates a new version with the criterion added to the specified step.
 *
 * @param storage - Plan storage
 * @param planId - Plan ID
 * @param stepId - Step ID to add criterion to
 * @param criteriaData - Criterion data (description required, type optional)
 * @param expectedVersion - Expected version for optimistic locking
 * @returns Operation result with new version number and created criterion
 */
export function addCriteriaToStep(
  storage: PlanStorage,
  planId: string,
  stepId: string,
  criteriaData: CriteriaData,
  expectedVersion?: number
): OperationResult<{ step: Step; criterion: AcceptanceCriterion }> {
  const validation = validateDraftPlan(storage, planId);
  if ('error' in validation) {
    return validation.error;
  }

  const { latestVersion } = validation;
  if (!latestVersion) {
    return { success: false, error: 'No version found', code: 'VERSION_NOT_FOUND' };
  }

  // Optimistic locking check
  const conflict = checkConflict(expectedVersion, latestVersion.version);
  if (conflict) {
    return conflict;
  }

  const stepIndex = latestVersion.steps.findIndex((s) => s.step_id === stepId);
  if (stepIndex === -1) {
    return {
      success: false,
      error: `Step not found: ${stepId}`,
      code: 'STEP_NOT_FOUND',
    };
  }

  const existingStep = latestVersion.steps[stepIndex]!;
  const criterion: AcceptanceCriterion = {
    id: randomUUID(),
    description: criteriaData.description,
    ...(criteriaData.type !== undefined && { type: criteriaData.type }),
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

  // Emit event for SSE clients
  emitPlanChange(planId, newVersion.version, 'criteria_added', stepId);

  return {
    success: true,
    version: newVersion.version,
    data: { step: updatedStep, criterion },
  };
}

/**
 * Edit an existing acceptance criterion in a step.
 *
 * Creates a new version with the criterion modified.
 *
 * @param storage - Plan storage
 * @param planId - Plan ID
 * @param stepId - Step ID containing the criterion
 * @param criteriaId - Criterion ID to edit
 * @param updates - Fields to update (description and/or type)
 * @param expectedVersion - Expected version for optimistic locking
 * @returns Operation result with new version number and updated criterion
 */
export function editCriteriaInStep(
  storage: PlanStorage,
  planId: string,
  stepId: string,
  criteriaId: string,
  updates: Partial<CriteriaData>,
  expectedVersion?: number
): OperationResult<{ step: Step; criterion: AcceptanceCriterion }> {
  const validation = validateDraftPlan(storage, planId);
  if ('error' in validation) {
    return validation.error;
  }

  const { latestVersion } = validation;
  if (!latestVersion) {
    return { success: false, error: 'No version found', code: 'VERSION_NOT_FOUND' };
  }

  // Optimistic locking check
  const conflict = checkConflict(expectedVersion, latestVersion.version);
  if (conflict) {
    return conflict;
  }

  const stepIndex = latestVersion.steps.findIndex((s) => s.step_id === stepId);
  if (stepIndex === -1) {
    return {
      success: false,
      error: `Step not found: ${stepId}`,
      code: 'STEP_NOT_FOUND',
    };
  }

  const existingStep = latestVersion.steps[stepIndex]!;
  const criteriaIndex = existingStep.acceptance_criteria?.findIndex((c) => c.id === criteriaId) ?? -1;

  if (criteriaIndex === -1) {
    return {
      success: false,
      error: `Criterion not found: ${criteriaId}`,
      code: 'CRITERION_NOT_FOUND',
    };
  }

  const existingCriterion = existingStep.acceptance_criteria![criteriaIndex]!;
  const updatedCriterion: AcceptanceCriterion = {
    ...existingCriterion,
    ...(updates.description !== undefined && { description: updates.description }),
    ...(updates.type !== undefined && { type: updates.type }),
  };

  const newCriteria = [...(existingStep.acceptance_criteria ?? [])];
  newCriteria[criteriaIndex] = updatedCriterion;

  const updatedStep: Step = {
    ...existingStep,
    acceptance_criteria: newCriteria,
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

  // Emit event for SSE clients
  emitPlanChange(planId, newVersion.version, 'criteria_edited', stepId);

  return {
    success: true,
    version: newVersion.version,
    data: { step: updatedStep, criterion: updatedCriterion },
  };
}

/**
 * Set dependencies for a step.
 *
 * Creates a new version with the step's dependencies updated.
 * Validates that all dependency step_ids exist and no cycles are created.
 *
 * @param storage - Plan storage
 * @param planId - Plan ID
 * @param stepId - Step ID to set dependencies for
 * @param dependencies - Array of step IDs this step depends on
 * @param expectedVersion - Expected version for optimistic locking
 * @returns Operation result with new version number and updated step
 */
export function setStepDependencies(
  storage: PlanStorage,
  planId: string,
  stepId: string,
  dependencies: string[],
  expectedVersion?: number
): OperationResult<{ step: Step }> {
  const validation = validateDraftPlan(storage, planId);
  if ('error' in validation) {
    return validation.error;
  }

  const { latestVersion } = validation;
  if (!latestVersion) {
    return { success: false, error: 'No version found', code: 'VERSION_NOT_FOUND' };
  }

  // Optimistic locking check
  const conflict = checkConflict(expectedVersion, latestVersion.version);
  if (conflict) {
    return conflict;
  }

  const stepIndex = latestVersion.steps.findIndex((s) => s.step_id === stepId);
  if (stepIndex === -1) {
    return {
      success: false,
      error: `Step not found: ${stepId}`,
      code: 'STEP_NOT_FOUND',
    };
  }

  // Validate all dependency IDs exist
  const stepIds = new Set(latestVersion.steps.map((s) => s.step_id));
  for (const depId of dependencies) {
    if (!stepIds.has(depId)) {
      return {
        success: false,
        error: `Dependency step not found: ${depId}`,
        code: 'INVALID_DEPENDENCY',
      };
    }
    if (depId === stepId) {
      return {
        success: false,
        error: 'Step cannot depend on itself',
        code: 'INVALID_DEPENDENCY',
      };
    }
  }

  // Create proposed steps to check for cycles
  const proposedSteps = latestVersion.steps.map((s, i) =>
    i === stepIndex ? { ...s, dependencies } : s
  );

  if (!validateStepDag(proposedSteps)) {
    return {
      success: false,
      error: 'Setting these dependencies would create a cycle',
      code: 'CYCLE_DETECTED',
    };
  }

  // Apply the change
  const newSteps = [...latestVersion.steps];
  const updatedStep: Step = { ...newSteps[stepIndex]!, dependencies };
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

  return {
    success: true,
    version: newVersion.version,
    data: { step: updatedStep },
  };
}

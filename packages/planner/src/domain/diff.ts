import { z } from 'zod';
import { StepSchema, type Step } from './step.js';
import { type PlanVersion, PlanVersionSchema } from './plan.js';
import { PlanStatus } from './status.js';

/**
 * FieldChange tracks a single field modification
 */
export const FieldChangeSchema = z.object({
  field: z.string(),
  old_value: z.unknown(),
  new_value: z.unknown(),
});

export type FieldChange = z.infer<typeof FieldChangeSchema>;

/**
 * StepChange captures a step addition or removal
 */
export const StepChangeSchema = z.object({
  step_id: z.string(),
  step: StepSchema,
});

export type StepChange = z.infer<typeof StepChangeSchema>;

/**
 * StepModification captures changes to an existing step
 */
export const StepModificationSchema = z.object({
  step_id: z.string(),
  field_changes: z.array(FieldChangeSchema),
});

export type StepModification = z.infer<typeof StepModificationSchema>;

/**
 * EdgeChange captures a dependency edge addition or removal
 */
export const EdgeChangeSchema = z.object({
  from_step_id: z.string(),
  to_step_id: z.string(),
});

export type EdgeChange = z.infer<typeof EdgeChangeSchema>;

/**
 * VersionDiff captures all structural changes between two versions
 */
export const VersionDiffSchema = z.object({
  from_version: z.number().int().nonnegative(),
  to_version: z.number().int().positive(),
  summary_changed: z.boolean(),
  steps_added: z.array(StepChangeSchema),
  steps_removed: z.array(StepChangeSchema),
  steps_modified: z.array(StepModificationSchema),
  dependencies_added: z.array(EdgeChangeSchema),
  dependencies_removed: z.array(EdgeChangeSchema),
});

export type VersionDiff = z.infer<typeof VersionDiffSchema>;

/**
 * RFC 6902 JSON Patch operation
 */
export const JsonPatchOpSchema = z.object({
  op: z.enum(['add', 'remove', 'replace']),
  path: z.string(),
  value: z.unknown().optional(),
});

export type JsonPatchOp = z.infer<typeof JsonPatchOpSchema>;

/**
 * Creates a new version from an existing version.
 * Increments version number, sets status to draft, copies steps and config.
 */
export function createVersionFrom(source: PlanVersion): PlanVersion {
  const now = new Date().toISOString();
  const newVersion: PlanVersion = {
    plan_id: source.plan_id,
    version: source.version + 1,
    status: PlanStatus.Draft,
    summary: { ...source.summary },
    steps: source.steps.map((s) => ({ ...s, dependencies: [...s.dependencies] })),
    // Preserve decomposition config from previous version
    decomposition_config: source.decomposition_config,
    // Preserve understanding from previous version
    understanding: source.understanding,
    created_at: now,
    updated_at: now,
  };
  return PlanVersionSchema.parse(newVersion);
}

/**
 * Computes structural diff between two plan versions.
 */
export function computeDiff(
  oldVersion: PlanVersion,
  newVersion: PlanVersion
): VersionDiff {
  const oldStepMap = new Map(oldVersion.steps.map((s) => [s.step_id, s]));
  const newStepMap = new Map(newVersion.steps.map((s) => [s.step_id, s]));

  const steps_added: StepChange[] = [];
  const steps_removed: StepChange[] = [];
  const steps_modified: StepModification[] = [];
  const dependencies_added: EdgeChange[] = [];
  const dependencies_removed: EdgeChange[] = [];

  // Find added steps
  for (const [stepId, step] of newStepMap) {
    if (!oldStepMap.has(stepId)) {
      steps_added.push({ step_id: stepId, step });
    }
  }

  // Find removed steps
  for (const [stepId, step] of oldStepMap) {
    if (!newStepMap.has(stepId)) {
      steps_removed.push({ step_id: stepId, step });
    }
  }

  // Find modified steps and track field-level changes
  for (const [stepId, newStep] of newStepMap) {
    const oldStep = oldStepMap.get(stepId);
    if (oldStep) {
      const field_changes = computeStepFieldChanges(oldStep, newStep);
      if (field_changes.length > 0) {
        steps_modified.push({ step_id: stepId, field_changes });
      }

      // Track dependency edge changes
      const oldDeps = new Set(oldStep.dependencies);
      const newDeps = new Set(newStep.dependencies);

      for (const dep of newDeps) {
        if (!oldDeps.has(dep)) {
          dependencies_added.push({ from_step_id: stepId, to_step_id: dep });
        }
      }

      for (const dep of oldDeps) {
        if (!newDeps.has(dep)) {
          dependencies_removed.push({ from_step_id: stepId, to_step_id: dep });
        }
      }
    }
  }

  // Check if summary changed
  const summary_changed =
    oldVersion.summary.goal !== newVersion.summary.goal ||
    oldVersion.summary.context !== newVersion.summary.context;

  return VersionDiffSchema.parse({
    from_version: oldVersion.version,
    to_version: newVersion.version,
    summary_changed,
    steps_added,
    steps_removed,
    steps_modified,
    dependencies_added,
    dependencies_removed,
  });
}

/**
 * Computes field-level changes between two steps
 */
function computeStepFieldChanges(oldStep: Step, newStep: Step): FieldChange[] {
  const changes: FieldChange[] = [];
  const fields: (keyof Step)[] = [
    'title',
    'scope',
    'description',
    'owner_role',
    'sub_plan_id',
  ];

  for (const field of fields) {
    if (oldStep[field] !== newStep[field]) {
      changes.push({
        field,
        old_value: oldStep[field],
        new_value: newStep[field],
      });
    }
  }

  // Check acceptance_criteria changes
  const oldCriteria = JSON.stringify(oldStep.acceptance_criteria ?? []);
  const newCriteria = JSON.stringify(newStep.acceptance_criteria ?? []);
  if (oldCriteria !== newCriteria) {
    changes.push({
      field: 'acceptance_criteria',
      old_value: oldStep.acceptance_criteria,
      new_value: newStep.acceptance_criteria,
    });
  }

  // Check gate changes
  const oldGate = JSON.stringify(oldStep.gate ?? null);
  const newGate = JSON.stringify(newStep.gate ?? null);
  if (oldGate !== newGate) {
    changes.push({
      field: 'gate',
      old_value: oldStep.gate,
      new_value: newStep.gate,
    });
  }

  return changes;
}

/**
 * Converts a VersionDiff to RFC 6902 JSON Patch format
 */
export function toJsonPatch(diff: VersionDiff): JsonPatchOp[] {
  const patches: JsonPatchOp[] = [];

  // Summary changes
  if (diff.summary_changed) {
    patches.push({
      op: 'replace',
      path: '/summary',
      value: undefined, // Would need new summary value
    });
  }

  // Added steps
  for (const added of diff.steps_added) {
    patches.push({
      op: 'add',
      path: `/steps/-`,
      value: added.step,
    });
  }

  // Removed steps
  for (const removed of diff.steps_removed) {
    patches.push({
      op: 'remove',
      path: `/steps/${removed.step_id}`,
    });
  }

  // Modified steps
  for (const modified of diff.steps_modified) {
    for (const change of modified.field_changes) {
      patches.push({
        op: 'replace',
        path: `/steps/${modified.step_id}/${change.field}`,
        value: change.new_value,
      });
    }
  }

  return patches;
}

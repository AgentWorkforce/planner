/**
 * ArtifactValidator - DOT Framework Artifact-Based Dependency Validation
 *
 * Validates that tasks have their input artifacts satisfied before execution.
 * This provides stronger guarantees than step-id-based dependencies alone.
 *
 * Features:
 * - Validates input artifacts against produced outputs
 * - Tracks artifact availability across the run
 * - Reports missing or unavailable artifacts
 */

import type { ForgeStorage } from '../storage/interface.js';
import type { Task, Artifact, ArtifactReference } from '../domain/types.js';

// ============================================
// Types
// ============================================

/**
 * Result of artifact availability check
 */
export interface ArtifactAvailability {
  /** Whether all required artifacts are available */
  satisfied: boolean;
  /** Missing required artifacts */
  missing: ArtifactReference[];
  /** Available artifacts (matched) */
  available: Artifact[];
  /** Optional artifacts that are missing (not blocking) */
  optionalMissing: ArtifactReference[];
}

/**
 * Result of validating a task's artifact dependencies
 */
export interface ArtifactValidationResult {
  /** Whether the task can proceed (all required inputs available) */
  canProceed: boolean;
  /** Task being validated */
  taskId: string;
  /** Detailed availability check */
  availability: ArtifactAvailability;
  /** Human-readable message about validation */
  message: string;
}

// ============================================
// ArtifactValidator
// ============================================

/**
 * ArtifactValidator checks that task input artifacts are satisfied
 * before allowing task execution.
 *
 * This complements step-based dependencies with content-based validation:
 * - Step dependencies: "task B runs after task A completes"
 * - Artifact dependencies: "task B needs file X that task A produces"
 */
export class ArtifactValidator {
  private storage: ForgeStorage;

  constructor(storage: ForgeStorage) {
    this.storage = storage;
  }

  /**
   * Validates whether a task's input artifacts are available.
   *
   * @param task - The task to validate
   * @param runId - Run ID to scope artifact search
   * @returns Validation result with availability details
   */
  validateTaskInputs(task: Task, runId: string): ArtifactValidationResult {
    const inputArtifacts = task.input_artifacts ?? [];

    // No inputs required - always valid
    if (inputArtifacts.length === 0) {
      return {
        canProceed: true,
        taskId: task.task_id,
        availability: {
          satisfied: true,
          missing: [],
          available: [],
          optionalMissing: [],
        },
        message: 'No input artifacts required',
      };
    }

    // Get all artifacts produced in this run
    const producedArtifacts = this.storage.listArtifactsByRun(runId);

    // Check each input artifact
    const missing: ArtifactReference[] = [];
    const optionalMissing: ArtifactReference[] = [];
    const available: Artifact[] = [];

    for (const inputRef of inputArtifacts) {
      const match = this.findMatchingArtifact(inputRef, producedArtifacts);

      if (match) {
        available.push(match);
      } else if (inputRef.required !== false) {
        missing.push(inputRef);
      } else {
        optionalMissing.push(inputRef);
      }
    }

    const satisfied = missing.length === 0;
    const canProceed = satisfied;

    let message: string;
    if (satisfied) {
      if (optionalMissing.length > 0) {
        message = `All required artifacts available (${optionalMissing.length} optional missing)`;
      } else {
        message = `All ${inputArtifacts.length} input artifacts available`;
      }
    } else {
      const missingRefs = missing.map(m => `${m.type}:${m.reference}`).join(', ');
      message = `Missing required artifacts: ${missingRefs}`;
    }

    return {
      canProceed,
      taskId: task.task_id,
      availability: {
        satisfied,
        missing,
        available,
        optionalMissing,
      },
      message,
    };
  }

  /**
   * Validates multiple tasks and returns those that can proceed.
   *
   * @param tasks - Tasks to validate
   * @param runId - Run ID
   * @returns Tasks that have satisfied artifact dependencies
   */
  filterReadyTasks(tasks: Task[], runId: string): Task[] {
    return tasks.filter(task => {
      const result = this.validateTaskInputs(task, runId);
      return result.canProceed;
    });
  }

  /**
   * Gets a summary of artifact dependencies for a run.
   *
   * @param runId - Run ID
   * @returns Summary of produced and expected artifacts
   */
  getArtifactSummary(runId: string): {
    produced: Artifact[];
    expectedByPendingTasks: ArtifactReference[];
  } {
    const produced = this.storage.listArtifactsByRun(runId);
    const tasks = this.storage.listTasksByRun(runId);

    // Collect all input artifacts from pending/queued/blocked tasks
    const pendingTasks = tasks.filter(t =>
      t.status === 'pending' || t.status === 'queued' || t.status === 'blocked'
    );

    const expectedByPendingTasks: ArtifactReference[] = [];
    for (const task of pendingTasks) {
      if (task.input_artifacts) {
        expectedByPendingTasks.push(...task.input_artifacts);
      }
    }

    return { produced, expectedByPendingTasks };
  }

  /**
   * Registers that a task has produced an artifact.
   * Called after task completion to record outputs.
   *
   * @param task - Completed task
   * @param runId - Run ID
   */
  async recordTaskOutputs(task: Task, runId: string): Promise<void> {
    const outputArtifacts = task.output_artifacts ?? [];

    for (const outputRef of outputArtifacts) {
      // Create artifact record
      const artifact: Artifact = {
        artifact_id: crypto.randomUUID(),
        task_id: task.task_id,
        type: outputRef.type,
        reference: outputRef.reference,
        created_at: new Date().toISOString(),
      };

      this.storage.createArtifact(artifact);
    }
  }

  // ============================================
  // Private Helpers
  // ============================================

  /**
   * Finds an artifact that matches the given reference.
   * Matching is done by type and reference pattern.
   */
  private findMatchingArtifact(
    ref: ArtifactReference,
    artifacts: Artifact[]
  ): Artifact | null {
    for (const artifact of artifacts) {
      // Type must match
      if (artifact.type !== ref.type) {
        continue;
      }

      // Reference can be exact match or pattern match
      if (this.matchesReference(artifact.reference, ref.reference)) {
        return artifact;
      }
    }

    return null;
  }

  /**
   * Checks if an artifact reference matches a required reference.
   * Supports exact match and glob-like patterns.
   */
  private matchesReference(artifactRef: string, requiredRef: string): boolean {
    // Exact match
    if (artifactRef === requiredRef) {
      return true;
    }

    // Glob pattern: "src/*.ts" matches "src/foo.ts"
    if (requiredRef.includes('*')) {
      const pattern = requiredRef
        .replace(/\*/g, '.*')
        .replace(/\//g, '\\/');
      const regex = new RegExp(`^${pattern}$`);
      return regex.test(artifactRef);
    }

    // Prefix match for directories: "src/components/" matches "src/components/Button.tsx"
    if (requiredRef.endsWith('/') && artifactRef.startsWith(requiredRef)) {
      return true;
    }

    return false;
  }
}

/**
 * Factory function to create ArtifactValidator.
 */
export function createArtifactValidator(storage: ForgeStorage): ArtifactValidator {
  return new ArtifactValidator(storage);
}

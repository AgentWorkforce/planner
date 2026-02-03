import type { ForgeStorage } from '../storage/interface.js';
import type { Run } from '../domain/types.js';
import { createRun, createTask, RunStatus } from '../domain/types.js';
import type { ForgeConfig } from '../config/forge-config.js';
import { PlannerClient, PlannerApiError } from './planner-client.js';
import { transformToForgePlan, type TransformWarning } from './plan-transformer.js';
import { validateForgePlan, type ValidationError } from './plan-validator.js';

/**
 * Result of starting a run from a plan reference.
 */
export interface HandoffResult {
  /** Whether the handoff was successful */
  success: boolean;
  /** The created run ID (if successful) */
  run_id?: string;
  /** Number of tasks created */
  tasks_count?: number;
  /** Error message (if failed) */
  error?: string;
  /** Detailed error information */
  error_details?: HandoffError;
  /** Warnings from plan transformation */
  warnings?: TransformWarning[];
}

/**
 * Error types that can occur during handoff.
 */
export type HandoffErrorType =
  | 'fetch_failed'
  | 'transform_failed'
  | 'validation_failed'
  | 'storage_failed'
  | 'status_report_failed'
  | 'plan_not_ready';

/**
 * Detailed error information from handoff.
 */
export interface HandoffError {
  type: HandoffErrorType;
  message: string;
  validation_errors?: ValidationError[];
  planner_error?: {
    status_code: number;
    response?: unknown;
  };
}

/**
 * Options for the handoff operation.
 */
export interface HandoffOptions {
  /** Skip validation (use with caution) */
  skip_validation?: boolean;
  /** Report status to Planner after creating run */
  report_status?: boolean;
}

/**
 * Starts a new run from a plan reference.
 *
 * This function orchestrates the handoff from Planner to Forge:
 * 1. Fetches the plan version from Planner API
 * 2. Transforms the plan to Forge format using configuration
 * 3. Validates the transformed plan
 * 4. Creates the run and tasks in storage
 * 5. Optionally reports the run status back to Planner
 *
 * @param planId - The plan UUID
 * @param version - The specific version to execute (optional, uses latest if omitted)
 * @param config - The Forge configuration with mappings
 * @param storage - The Forge storage instance
 * @param options - Optional configuration for the handoff
 * @returns HandoffResult indicating success or failure
 */
export async function startRunFromPlanRef(
  planId: string,
  version: number | undefined,
  config: ForgeConfig,
  storage: ForgeStorage,
  options: HandoffOptions = {}
): Promise<HandoffResult> {
  // Validate that we have Planner configuration
  if (!config.planner) {
    return {
      success: false,
      error: 'Planner configuration is required',
      error_details: {
        type: 'fetch_failed',
        message: 'No Planner API configuration provided in ForgeConfig',
      },
    };
  }

  const plannerClient = new PlannerClient(config.planner);

  // Step 1: Fetch the plan version from Planner
  let planVersion;
  try {
    planVersion = await plannerClient.fetchPlanVersion(planId, version);
  } catch (err) {
    if (err instanceof PlannerApiError) {
      return {
        success: false,
        error: `Failed to fetch plan: ${err.message}`,
        error_details: {
          type: 'fetch_failed',
          message: err.message,
          planner_error: {
            status_code: err.statusCode,
            response: err.response,
          },
        },
      };
    }
    return {
      success: false,
      error: `Failed to fetch plan: ${err instanceof Error ? err.message : String(err)}`,
      error_details: {
        type: 'fetch_failed',
        message: err instanceof Error ? err.message : String(err),
      },
    };
  }

  // Check plan status - only approved or published plans can be executed
  if (planVersion.status !== 'approved' && planVersion.status !== 'published') {
    return {
      success: false,
      error: `Plan is not ready for execution (status: ${planVersion.status})`,
      error_details: {
        type: 'plan_not_ready',
        message: `Plan must be approved or published to execute, current status: ${planVersion.status}`,
      },
    };
  }

  // Step 2: Transform the plan to Forge format
  let transformResult;
  try {
    transformResult = transformToForgePlan(planVersion, config);
  } catch (err) {
    return {
      success: false,
      error: `Failed to transform plan: ${err instanceof Error ? err.message : String(err)}`,
      error_details: {
        type: 'transform_failed',
        message: err instanceof Error ? err.message : String(err),
      },
    };
  }

  const { plan: forgePlan, warnings } = transformResult;

  // Step 3: Validate the transformed plan
  if (!options.skip_validation) {
    const validationResult = validateForgePlan(forgePlan);
    if (!validationResult.valid) {
      return {
        success: false,
        error: `Plan validation failed: ${validationResult.errors.map((e) => e.message).join('; ')}`,
        error_details: {
          type: 'validation_failed',
          message: 'Plan failed validation checks',
          validation_errors: validationResult.errors,
        },
        warnings,
      };
    }
  }

  // Step 4: Create the run and tasks in storage
  let run: Run;
  let tasksCount: number;

  try {
    const result = storage.transaction(() => {
      // Create the run
      const newRun = createRun(forgePlan);
      storage.createRun(newRun);

      // Create tasks for each step
      let count = 0;
      for (const step of forgePlan.steps) {
        const task = createTask(newRun.run_id, step);
        storage.createTask(task);
        count++;
      }

      return { run: newRun, count };
    });

    run = result.run;
    tasksCount = result.count;
  } catch (err) {
    return {
      success: false,
      error: `Failed to create run in storage: ${err instanceof Error ? err.message : String(err)}`,
      error_details: {
        type: 'storage_failed',
        message: err instanceof Error ? err.message : String(err),
      },
      warnings,
    };
  }

  // Step 5: Report status back to Planner (optional)
  if (options.report_status !== false && config.planner) {
    try {
      await plannerClient.reportRunStatus(planId, {
        run_id: run.run_id,
        status: run.status,
        tasks_total: tasksCount,
        tasks_completed: 0,
      });
    } catch (err) {
      // Log the error but don't fail the handoff
      // The run was created successfully, status reporting is best-effort
      console.warn(
        `Failed to report run status to Planner: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return {
    success: true,
    run_id: run.run_id,
    tasks_count: tasksCount,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Validates a plan reference without creating a run.
 * Useful for pre-flight checks before execution.
 *
 * @param planId - The plan UUID
 * @param version - The specific version to validate (optional)
 * @param config - The Forge configuration with mappings
 * @returns HandoffResult with validation status (no run_id)
 */
export async function validatePlanRef(
  planId: string,
  version: number | undefined,
  config: ForgeConfig
): Promise<Omit<HandoffResult, 'run_id' | 'tasks_count'>> {
  if (!config.planner) {
    return {
      success: false,
      error: 'Planner configuration is required',
      error_details: {
        type: 'fetch_failed',
        message: 'No Planner API configuration provided in ForgeConfig',
      },
    };
  }

  const plannerClient = new PlannerClient(config.planner);

  // Fetch the plan
  let planVersion;
  try {
    planVersion = await plannerClient.fetchPlanVersion(planId, version);
  } catch (err) {
    if (err instanceof PlannerApiError) {
      return {
        success: false,
        error: `Failed to fetch plan: ${err.message}`,
        error_details: {
          type: 'fetch_failed',
          message: err.message,
          planner_error: {
            status_code: err.statusCode,
            response: err.response,
          },
        },
      };
    }
    return {
      success: false,
      error: `Failed to fetch plan: ${err instanceof Error ? err.message : String(err)}`,
      error_details: {
        type: 'fetch_failed',
        message: err instanceof Error ? err.message : String(err),
      },
    };
  }

  // Check plan status
  if (planVersion.status !== 'approved' && planVersion.status !== 'published') {
    return {
      success: false,
      error: `Plan is not ready for execution (status: ${planVersion.status})`,
      error_details: {
        type: 'plan_not_ready',
        message: `Plan must be approved or published to execute, current status: ${planVersion.status}`,
      },
    };
  }

  // Transform and validate
  const transformResult = transformToForgePlan(planVersion, config);
  const validationResult = validateForgePlan(transformResult.plan);

  if (!validationResult.valid) {
    return {
      success: false,
      error: `Plan validation failed: ${validationResult.errors.map((e) => e.message).join('; ')}`,
      error_details: {
        type: 'validation_failed',
        message: 'Plan failed validation checks',
        validation_errors: validationResult.errors,
      },
      warnings: transformResult.warnings.length > 0 ? transformResult.warnings : undefined,
    };
  }

  return {
    success: true,
    warnings: transformResult.warnings.length > 0 ? transformResult.warnings : undefined,
  };
}

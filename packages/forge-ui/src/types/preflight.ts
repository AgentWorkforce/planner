/**
 * Preflight types for validating plans before execution
 */

/**
 * Status of a preflight check
 */
export type PreflightCheckStatus = 'pass' | 'fail' | 'warning' | 'pending';

/**
 * Individual preflight check result
 */
export interface PreflightCheck {
  id: string;
  name: string;
  status: PreflightCheckStatus;
  message?: string;
}

/**
 * Step from a plan for preflight display
 */
export interface ForgeStep {
  step_id: string;
  title: string;
  description?: string;
  scope?: string;
  dependencies?: string[];
  gate?: {
    type: 'human_approval';
    approver_role?: string;
  };
}

/**
 * Plan data for preflight validation
 */
export interface ForgePlan {
  plan_id: string;
  plan_version: number;
  goal: string;
  steps: ForgeStep[];
  metadata?: Record<string, unknown>;
}

/**
 * Result of preflight validation
 */
export interface PreflightValidationResult {
  checks: PreflightCheck[];
  valid: boolean;
}

/**
 * Response from run creation
 */
export interface CreateRunResponse {
  run_id: string;
  status: string;
}

/**
 * Options for creating a run
 */
export interface CreateRunOptions {
  environment?: string;
}

/**
 * Available environments for run execution
 */
export type Environment = 'development' | 'staging' | 'production';

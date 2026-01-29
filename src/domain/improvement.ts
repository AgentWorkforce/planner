/**
 * Improvement domain entity.
 *
 * Represents AI-suggested improvements to a plan.
 * Improvements are suggestions that don't require immediate action
 * but could enhance the plan quality.
 */

/**
 * Types of improvements the AI can suggest.
 */
export type ImprovementType =
  | 'missing_criteria'      // Step lacks acceptance criteria
  | 'unclear_description'   // Step description is vague or ambiguous
  | 'missing_dependency'    // Step may depend on something not declared
  | 'redundant_step'        // Step overlaps with another
  | 'scope_suggestion';     // Scope could be added or refined

/**
 * Status of an improvement suggestion.
 */
export type ImprovementStatus = 'pending' | 'accepted' | 'dismissed';

/**
 * Improvement entity representing an AI suggestion.
 */
export interface Improvement {
  /** Unique improvement identifier */
  improvement_id: string;

  /** Plan this improvement applies to */
  plan_id: string;

  /** Version this improvement applies to */
  version: number;

  /** Optional step this improvement targets */
  step_id?: string;

  /** Type of improvement */
  type: ImprovementType;

  /** Human-readable description of the improvement */
  description: string;

  /** Structured suggested change (JSON) */
  suggested_change?: Record<string, unknown>;

  /** Current status */
  status: ImprovementStatus;

  /** When the improvement was created */
  created_at: string;

  /** When the improvement was last updated */
  updated_at: string;
}

/**
 * Input for creating a new improvement.
 */
export interface CreateImprovementInput {
  plan_id: string;
  version: number;
  step_id?: string;
  type: ImprovementType;
  description: string;
  suggested_change?: Record<string, unknown>;
}

/**
 * Create a new improvement with defaults.
 */
export function createImprovement(input: CreateImprovementInput): Improvement {
  const now = new Date().toISOString();
  return {
    improvement_id: crypto.randomUUID(),
    plan_id: input.plan_id,
    version: input.version,
    step_id: input.step_id,
    type: input.type,
    description: input.description,
    suggested_change: input.suggested_change,
    status: 'pending',
    created_at: now,
    updated_at: now,
  };
}

/**
 * Check if an improvement is still actionable.
 */
export function isImprovementPending(improvement: Improvement): boolean {
  return improvement.status === 'pending';
}

/**
 * Accept an improvement.
 */
export function acceptImprovement(improvement: Improvement): Improvement {
  return {
    ...improvement,
    status: 'accepted',
    updated_at: new Date().toISOString(),
  };
}

/**
 * Dismiss an improvement.
 */
export function dismissImprovement(improvement: Improvement): Improvement {
  return {
    ...improvement,
    status: 'dismissed',
    updated_at: new Date().toISOString(),
  };
}

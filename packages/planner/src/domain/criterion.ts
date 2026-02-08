import { z } from 'zod';

// ============================================
// Criterion Validation Method
// ============================================

/**
 * How to validate an acceptance criterion.
 * DOT Framework addition for machine-verifiable criteria.
 */
export const CriterionValidation = {
  /** Check if the output/artifact exists */
  Exists: 'exists',
  /** Validate against a JSON schema */
  Schema: 'schema',
  /** Run automated tests */
  Test: 'test',
  /** Requires human review */
  Human: 'human',
} as const;

export type CriterionValidation = (typeof CriterionValidation)[keyof typeof CriterionValidation];

export const CriterionValidationSchema = z.enum(['exists', 'schema', 'test', 'human']);

// ============================================
// Acceptance Criterion
// ============================================

/**
 * AcceptanceCriterion defines what must be true for a step to be complete.
 * - id: unique identifier within the step
 * - description: what must be verified
 * - type: optional category (e.g., 'test', 'review', 'metric')
 * - validation: optional DOT Framework field - how to validate this criterion
 * - schema_ref: optional DOT Framework field - reference to validation schema
 */
export const AcceptanceCriterionSchema = z.object({
  id: z.string().min(1, 'Criterion id is required'),
  description: z.string(), // Allow empty during editing; validate non-empty at approval
  type: z.string().optional(),
  /** How to validate this criterion (DOT Framework) */
  validation: CriterionValidationSchema.optional(),
  /** Reference to validation schema if validation='schema' (DOT Framework) */
  schema_ref: z.string().optional(),
});

export type AcceptanceCriterion = z.infer<typeof AcceptanceCriterionSchema>;

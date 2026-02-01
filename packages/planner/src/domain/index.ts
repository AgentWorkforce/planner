// Understanding schemas and types
export {
  ConfidenceSchema,
  AgentObservationsSchema,
  UnderstandingSchema,
  type Confidence,
  type AgentObservations,
  type Understanding,
} from './understanding.js';

// Context schemas and types
export {
  RoleContextSchema,
  ContextSchema,
  SUGGESTED_ROLES,
  type RoleContext,
  type Context,
  type SuggestedRole,
} from './context.js';

// Specification schemas and types (freeform - any domain, any fields)
export {
  DomainSpecSchema,
  StepSpecificationSchema,
  SUGGESTED_DOMAINS,
  type DomainSpec,
  type StepSpecification,
  type SuggestedDomain,
} from './specification.js';

// Re-export existing domain models for convenience
export { PlanSchema, PlanVersionSchema, createPlan, createPlanVersion } from './plan.js';
export type { Plan, PlanVersion } from './plan.js';

export { StepSchema, createStep, validateStepDag } from './step.js';
export type { Step, CreateStepOptions } from './step.js';

export { SummarySchema } from './summary.js';
export type { Summary } from './summary.js';

export { PlanStatusSchema, PlanStatus } from './status.js';

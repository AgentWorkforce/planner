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

// DOT Framework: Complexity estimation
export {
  ComplexityEstimateSchema,
  ComplexitySignalsSchema,
  ComplexityLevelSchema,
  ComplexityRecommendationSchema,
  ComplexityLevel,
  ComplexityRecommendation,
  COMPLEXITY_LEVEL_THRESHOLDS,
  COMPLEXITY_RECOMMENDATION_THRESHOLDS,
  mapScoreToLevel,
  mapScoreToRecommendation,
} from './complexity.js';
export type { ComplexityEstimate, ComplexitySignals } from './complexity.js';

// DOT Framework: Language tier detection
export {
  LanguageTierSchema,
  LanguageTier,
  LANGUAGE_TO_TIER,
  FILE_EXTENSION_TO_TIER,
  TIER_MULTIPLIERS,
  DOMAIN_ADJUSTMENTS,
  getTierMultiplier,
  getLanguageTier,
  getExtensionTier,
  getDomainAdjustment,
  getEffectiveMultiplier,
} from './language-tier.js';

// DOT Framework: Task contracts
export {
  TaskContractSchema,
  ContractInputSchema,
  ContractOutputSchema,
  DoneDefinitionSchema,
  ContractInputType,
  ContractInputTypeSchema,
  ContractOutputType,
  ContractOutputTypeSchema,
  OutputValidation,
  OutputValidationSchema,
  createContractInput,
  createContractOutput,
  createDoneDefinition,
  createTaskContract,
} from './contract.js';
export type {
  TaskContract,
  ContractInput,
  ContractOutput,
  DoneDefinition,
} from './contract.js';

// DOT Framework: Decomposition configuration
export {
  DecompositionConfigSchema,
  StepComplexityLevel,
  StepComplexityLevelSchema,
  DEFAULT_DECOMPOSITION_CONFIG,
  createDecompositionConfig,
  exceedsStepLimit,
  exceedsDepthLimit,
  requiresDecomposition,
} from './decomposition-config.js';
export type { DecompositionConfig } from './decomposition-config.js';

// DOT Framework: Criterion validation (extended)
export {
  AcceptanceCriterionSchema,
  CriterionValidation,
  CriterionValidationSchema,
} from './criterion.js';
export type { AcceptanceCriterion } from './criterion.js';

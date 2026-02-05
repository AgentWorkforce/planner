// Tuner integration for Planner
// Fetches configuration from Tuner service with graceful fallback

export {
  // Config types and schemas
  PlannerConfigSchema,
  ComplexityWeightsSchema,
  LanguageComplexityMultipliersSchema,
  DecompositionSettingsSchema,
  LLMadjustmentSettingsSchema,
  DEFAULT_PLANNER_CONFIG,
  mergeWithDefaults,
  validateConfig,
} from './config.js';

export type {
  PlannerConfig,
  ComplexityWeights,
  LanguageComplexityMultipliers,
  DecompositionSettings,
  LLMadjustmentSettings,
} from './config.js';

export {
  // TunerClient class and helpers
  TunerClient,
  createTunerClient,
  getDefaultTunerClient,
  initDefaultTunerClient,
  stopDefaultTunerClient,
} from './client.js';

export type { TunerClientOptions, TunerClientStatus } from './client.js';

export { emitPlanQualitySignal } from './quality-signal.js';

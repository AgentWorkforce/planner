// DOT Framework Services for Planner
// Core services for complexity estimation, language detection, limits enforcement, and contract validation

// ============================================
// Complexity Estimator
// ============================================

export {
  // Main estimation function
  estimateComplexity,
  estimateComplexityBatch,
  enrichStepsWithComplexity,

  // Helper functions
  countTokens,
  detectComplexityKeywords,
  getFoundKeywords,
  countScopes,

  // Analysis
  summarizeComplexity,

  // Constants
  COMPLEXITY_KEYWORDS,
} from './complexity-estimator.js';

export type {
  EstimateComplexityOptions,
  ComplexitySummary,
} from './complexity-estimator.js';

// ============================================
// Language Detector
// ============================================

export {
  // Main detection function
  detectLanguageTier,
  analyzeLanguage,

  // Extraction helpers
  extractFileExtensions,
  extractLanguageKeywords,
  detectDomains,
  detectDomainAdjustment,
  // Note: getEffectiveMultiplier also exists in domain/language-tier.ts
  // Use getEffectiveMultiplier from domain for tier-only, this one for step context
  getEffectiveMultiplier as getStepEffectiveMultiplier,

  // Batch processing
  enrichStepsWithLanguageTier,
  analyzeLanguageBatch,
} from './language-detector.js';

export type { LanguageDetectionResult } from './language-detector.js';

// ============================================
// Limits Enforcer
// ============================================

export {
  // Main validation functions
  validatePlanLimits,
  validateSubPlanDepth,
  validateAllSubPlanDepths,
  validateAllLimits,

  // Helper functions
  groupStepsByScope,
  countStepsPerScope,
  getStepDistributionSummary,
} from './limits-enforcer.js';

export type {
  LimitsValidationResult,
  ScopeStepCount,
  DepthValidationResult,
  // Note: PlanStorage is a minimal interface for depth validation
  // Use storage/interface.ts PlanStorage for full storage interface
  PlanStorage as LimitsEnforcerPlanStorage,
} from './limits-enforcer.js';

// ============================================
// Contract Validator
// ============================================

export {
  // Main validation functions
  validateContract,
  validateAllContracts,
  validateContractDependencies,

  // Helper functions
  hasValidContract,
  getContractInputSources,
  getRequiredInputSources,
  analyzeContractCoverage,
} from './contract-validator.js';

export type {
  ContractValidationResult,
  ContractValidationContext,
  ContractCoverageAnalysis,
} from './contract-validator.js';

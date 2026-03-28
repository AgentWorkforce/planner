// API Middleware exports

// MCP Authentication
export {
  createMcpAuthMiddleware,
  createOptionalMcpAuthMiddleware,
  validatePlanAccess,
} from './mcp-auth.js';

export type {
  McpSessionContext,
  AuthenticatedMcpRequest,
} from './mcp-auth.js';

// DOT Framework: Plan Enrichment
export {
  enrichStep,
  enrichSteps,
  enrichPlanVersion,
  enrichPlanVersionForCreate,
  enrichPlanVersionForUpdate,
  createEnrichmentMiddleware,
  logEnrichmentResult,
} from './dot-enrichment.js';

export type {
  EnrichmentOptions,
  EnrichmentResult,
} from './dot-enrichment.js';

// DOT Framework: Plan Validation
export {
  validatePlanDOT,
  validatePlanDOTSync,
  createValidationMiddleware,
  formatValidationResponse,
  mergeValidationIntoResponse,
  needsValidation,
  getValidationSummary,
} from './dot-validation.js';

export type {
  DOTValidationResult,
  DOTValidationOptions,
} from './dot-validation.js';

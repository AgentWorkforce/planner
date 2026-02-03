// Planner client for API access
export {
  PlannerClient,
  createPlannerClient,
  PlannerApiError,
  type PlanVersion,
  type PlanStatus,
  type PlannerStep,
  type PlannerSummary,
  type PlannerAcceptanceCriterion,
  type PlannerGate,
  type RunStatusUpdate,
  type ChangeRequest,
  type SuggestedChange,
  type ChangeRequestResponse,
} from './planner-client.js';

// Plan transformer
export {
  transformToForgePlan,
  getStepsWithoutRepo,
  getStepsWithoutCli,
  type TransformResult,
  type TransformWarning,
} from './plan-transformer.js';

// Plan validator
export {
  validateForgePlan,
  validatePlanStructure,
  getTopologicalOrder,
  type ValidationResult,
  type ValidationError,
  type ValidationErrorType,
} from './plan-validator.js';

// Handoff orchestration
export {
  startRunFromPlanRef,
  validatePlanRef,
  type HandoffResult,
  type HandoffError,
  type HandoffErrorType,
  type HandoffOptions,
} from './handoff.js';

// Status reporter
export {
  StatusReporter,
  createStatusReporter,
  countTasksByStatus,
  type PlannerSyncError,
  type StatusReporterHealth,
  type RunWithSync,
} from './status-reporter.js';

// Change request handler
export {
  ChangeRequestHandler,
  createChangeRequestHandler,
  suggestAddStep,
  suggestRemoveStep,
  suggestModifyStep,
  suggestAddDependency,
  suggestRemoveDependency,
  type BlockedTaskInfo,
  type TaskSuggestedChange,
  type ChangeRequestResult,
  type ChangeRequestOptions,
} from './change-request-handler.js';

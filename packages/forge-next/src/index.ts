/**
 * forge-next — thin execution layer built on @agent-relay/sdk workflows.
 *
 * Compiles PlanVersions into relay WorkflowConfigs and manages
 * gates, questions, and status aggregation.
 */

export { compilePlan } from './compiler.js';
export { ModelSelector } from './model-selector.js';
export { GateManager } from './gate-manager.js';
export { QuestionManager } from './question-manager.js';
export { RunMonitor } from './run-monitor.js';
export { createForgeNextRouter } from './api/routes.js';

// Re-export domain types
export type {
  ForgeNextRun,
  Gate,
  GateStatus,
  Question,
  QuestionStatus,
  ForgeNextEvent,
  ForgeConfig,
  StepOverride,
  StepMetricsEvent,
  RunMetricsEvent,
  StallWarningEvent,
  StepRetryContextEvent,
  StepFailedEnrichedEvent,
  StepScoredEvent,
} from './types.js';

// Re-export storage interface
export type { ForgeNextStorage } from './storage/interface.js';
export { SqliteForgeNextStorage } from './storage/sqlite.js';

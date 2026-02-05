// Checkpointing service
export {
  CheckpointService,
  type GetActiveAgentsFn,
  type CheckpointTrigger,
} from './checkpointing.js';

// Recovery service
export {
  RecoveryService,
  setGlobalRecoveryService,
  getRecoveryLog,
  TaskFailureHandler,
  createTaskFailureHandler,
  type OrphanDetectionResult,
  type RunRecoveryAction,
  type RecoveryLog,
  type GetActualAgentsFn,
  type TerminateAgentFn,
  type RetryTaskFn,
  type RecoveryServiceConfig,
  type TaskFailureContext,
  type TaskFailureResult,
} from './recovery.js';

// Confidence handler (DOT Framework)
export {
  ConfidenceHandler,
  createConfidenceHandler,
  ConfidenceAction,
  type ConfidenceCheckResult,
  type CheckConfidenceOptions,
} from './confidence-handler.js';

// Health monitoring
export {
  HealthMonitor,
  TaskTimeoutManager,
  createTaskTimeoutManager,
  type HealthMonitorConfig,
  type AgentHealthInfo,
  type OnStuckAgentsCallback,
  type TaskTimeoutInfo,
  type TimeoutCheckResult,
  type OnTaskTimeoutCallback,
  type SignalAgentShutdownFn,
  type FailTaskWithTimeoutFn,
} from './health-monitor.js';

// Shutdown handling
export {
  ShutdownHandler,
  type ShutdownHandlerConfig,
  type ShutdownPhaseCallback,
  type ShutdownState,
  type InProgressTask,
  type GetInProgressTasksFn,
  type StopAcceptingRunsFn,
  type StopEnqueueingTasksFn,
  type TerminateAllAgentsFn,
  type GetActiveRunIdsFn,
} from './shutdown.js';

// Trajectory capture service
export {
  TrajectoryCapture,
  createTrajectoryCapture,
  type TrajectoryCaptureEvents,
} from './trajectory-capture.js';

// Tracked state transitions
export {
  trackedTransitionRun,
  trackedTransitionTask,
  trackGateReached,
  trackGateApproved,
  trackGateRejected,
  trackQuestionAsked,
  trackQuestionAnswered,
  trackQuestionDismissed,
  trackAgentSpawned,
  trackAgentExited,
  trackCheckpointCreated,
} from './tracked-transitions.js';

// Trajectory pruning
export {
  TrajectoryPruner,
  createTrajectoryPruner,
  type TrajectoryPruningConfig,
} from './trajectory-pruning.js';

// Gate service
export {
  GateService,
  createGateService,
  type GateDetectionResult,
  type GateApprovalOptions,
  type GateRejectionOptions,
  type GateDecisionResult,
  type PendingGateInfo,
  type ScheduleReadyTasksFn,
} from './gate-service.js';

// Question service
export {
  QuestionService,
  createQuestionService,
  type AskQuestionOptions,
  type AskQuestionResult,
  type AnswerQuestionResult,
  type PendingQuestionInfo,
  type NotifySubscribersFn,
} from './question-service.js';

// User trajectory service
export {
  UserTrajectoryService,
  type RecordDecisionOptions,
  type GetPreferenceOptions,
  type FindSimilarOptions,
  type OverridePreferenceOptions,
} from './user-trajectory-service.js';

// Guardian service
export {
  GuardianService,
  createGuardianService,
  type SpawnGuardianOptions,
  type SpawnGuardianResult,
  type RecordObservationOptions,
  type GuardianTriggerEvent,
  type GuardianRetrospective,
  type SendMessageFn,
  type AlertHumanFn,
} from './guardian-service.js';

// Guardian templates
export {
  GUARDIAN_PROMPT_TEMPLATES,
  createSecurityGuardianConfig,
  createArchitectGuardianConfig,
  createQAGuardianConfig,
  createComplianceGuardianConfig,
  createStandardGuardianConfigs,
  SECURITY_DETECTION_PATTERNS,
  ARCHITECTURE_DETECTION_PATTERNS,
  QA_DETECTION_PATTERNS,
  checkTriggerPatterns,
  findTriggerMatches,
} from './guardian-templates.js';

// Retrospective service
export {
  RetrospectiveService,
  createRetrospectiveService,
  type SendRelayMessageFn as RetrospectiveSendRelayMessageFn,
  type WaitForAgentResponseFn,
  type InjectRetrospectiveOptions,
  type RetrospectiveServiceEvents,
} from './retrospective-service.js';

// Budget service (DOT Framework)
export {
  BudgetService,
  createBudgetService,
  type TaskUsage,
  type BudgetRemaining,
  type BudgetWarningLevel,
  type BudgetCheckResult,
} from './budget-service.js';

// Task queue service (DOT Framework parallelism)
export {
  TaskQueue,
  createTaskQueue,
  type QueuedTask,
  type QueueStats,
} from './task-queue.js';

// Run service (DOT Framework integration)
export {
  RunService,
  createRunService,
  type RunServiceConfig,
  type TaskDispatchDecision,
  type TaskWithModel,
  type TaskCompletionResult,
  type TaskOutcomeEmission,
  type RunOutcomeEmission,
  type OutcomeEmitter,
} from './run-service.js';

// Model selector (DOT Framework model routing)
export {
  ModelSelector,
  createModelSelector,
  type ModelSelectionContext,
  type ModelSelectionResult,
} from './model-selector.js';

// Artifact validator (DOT Framework dependency validation)
export {
  ArtifactValidator,
  createArtifactValidator,
  type ArtifactAvailability,
  type ArtifactValidationResult,
} from './artifact-validator.js';

// Config refresh service (DOT Framework Tuner integration)
export {
  ConfigRefreshService,
  createConfigRefreshService,
  type ConfigRefreshConfig,
  type TunerForgeConfig,
  type OnConfigChangeCallback,
} from './config-refresh.js';

// Test executor (testbench mock execution)
export {
  TestExecutor,
  createTestExecutor,
  type TestExecutorConfig,
} from './test-executor.js';

// Agent spawner types (DI for agent lifecycle)
export type {
  SpawnTaskOptions,
  SpawnTaskResult,
  SpawnTaskFn,
  IsSpawnerAvailableFn,
  ForgeExecutionMode,
} from './agent-spawner.js';

// Orchestrator (real execution via RunService)
export {
  Orchestrator,
  createOrchestrator,
  type OrchestratorConfig,
} from './orchestrator.js';

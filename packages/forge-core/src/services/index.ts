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
  type OrphanDetectionResult,
  type RunRecoveryAction,
  type RecoveryLog,
  type GetActualAgentsFn,
  type TerminateAgentFn,
  type RetryTaskFn,
  type RecoveryServiceConfig,
} from './recovery.js';

// Health monitoring
export {
  HealthMonitor,
  type HealthMonitorConfig,
  type AgentHealthInfo,
  type OnStuckAgentsCallback,
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

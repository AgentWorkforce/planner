import { z } from 'zod';
import {
  RetrospectiveRecordedPayloadSchema,
  RetrospectiveTimeoutPayloadSchema,
  RetrospectiveParseErrorPayloadSchema,
  RetrospectiveValidationErrorPayloadSchema,
} from './retrospective.js';

// ============================================
// Trajectory Event Types
// ============================================

/**
 * All supported trajectory event types.
 * These capture the complete execution lifecycle for replay and debugging.
 */
export const TrajectoryEventType = {
  // Run lifecycle
  RunStarted: 'run_started',
  RunCompleted: 'run_completed',
  RunFailed: 'run_failed',
  RunPaused: 'run_paused',
  RunCancelled: 'run_cancelled',
  RunResumed: 'run_resumed',

  // Task lifecycle
  TaskStarted: 'task_started',
  TaskCompleted: 'task_completed',
  TaskFailed: 'task_failed',
  TaskBlocked: 'task_blocked',
  TaskQueued: 'task_queued',
  TaskRetrying: 'task_retrying',

  // Agent lifecycle
  AgentSpawned: 'agent_spawned',
  AgentProgress: 'agent_progress',
  AgentToolCall: 'agent_tool_call',
  AgentExited: 'agent_exited',

  // Gates and questions
  GateReached: 'gate_reached',
  GateApproved: 'gate_approved',
  GateRejected: 'gate_rejected',
  HumanInputRequested: 'human_input_requested',
  QuestionAnswered: 'question_answered',
  QuestionDismissed: 'question_dismissed',
  QuestionAutoAnswered: 'question_auto_answered',
  QuestionAutoDefaulted: 'question_auto_defaulted',
  QuestionSubscriberAdded: 'question_subscriber_added',

  // Audit events
  AuditStarted: 'audit_started',
  AuditCompleted: 'audit_completed',

  // Decision and checkpoint events
  DecisionRecorded: 'decision_recorded',
  CheckpointCreated: 'checkpoint_created',

  // Guardian events
  GuardianSpawned: 'guardian_spawned',
  GuardianStopped: 'guardian_stopped',
  GuardianObservation: 'guardian_observation',
  GuardianTriggerReceived: 'guardian_trigger_received',

  // Retrospective events
  RetrospectiveRecorded: 'retrospective_recorded',
  RetrospectiveTimeout: 'retrospective_timeout',
  RetrospectiveParseError: 'retrospective_parse_error',
  RetrospectiveValidationError: 'retrospective_validation_error',

  // Recovery events
  RecoveryStrategySelected: 'recovery_strategy_selected',
  TaskEscalated: 'task_escalated',
  TaskSkipped: 'task_skipped',

  // Budget events
  BudgetInitialized: 'budget_initialized',
  BudgetUpdated: 'budget_updated',
  BudgetWarning: 'budget_warning',
} as const;

export type TrajectoryEventType =
  (typeof TrajectoryEventType)[keyof typeof TrajectoryEventType];

export const TrajectoryEventTypeSchema = z.enum([
  'run_started',
  'run_completed',
  'run_failed',
  'run_paused',
  'run_cancelled',
  'run_resumed',
  'task_started',
  'task_completed',
  'task_failed',
  'task_blocked',
  'task_queued',
  'task_retrying',
  'agent_spawned',
  'agent_progress',
  'agent_tool_call',
  'agent_exited',
  'gate_reached',
  'gate_approved',
  'gate_rejected',
  'human_input_requested',
  'question_answered',
  'question_dismissed',
  'question_auto_answered',
  'question_auto_defaulted',
  'question_subscriber_added',
  'audit_started',
  'audit_completed',
  'decision_recorded',
  'checkpoint_created',
  'guardian_spawned',
  'guardian_stopped',
  'guardian_observation',
  'guardian_trigger_received',
  'retrospective_recorded',
  'retrospective_timeout',
  'retrospective_parse_error',
  'retrospective_validation_error',
  'recovery_strategy_selected',
  'task_escalated',
  'task_skipped',
  'budget_initialized',
  'budget_updated',
  'budget_warning',
]);

// ============================================
// Run Event Payloads
// ============================================

export const RunStartedPayloadSchema = z.object({
  plan_id: z.string().uuid(),
  plan_version: z.number().int().positive(),
  goal: z.string().optional(),
});

export type RunStartedPayload = z.infer<typeof RunStartedPayloadSchema>;

export const RunCompletedPayloadSchema = z.object({
  duration_ms: z.number().int().optional(),
  tasks_completed: z.number().int().optional(),
  tasks_total: z.number().int().optional(),
});

export type RunCompletedPayload = z.infer<typeof RunCompletedPayloadSchema>;

export const RunFailedPayloadSchema = z.object({
  error: z.string(),
  failed_task_id: z.string().uuid().optional(),
  duration_ms: z.number().int().optional(),
});

export type RunFailedPayload = z.infer<typeof RunFailedPayloadSchema>;

export const RunPausedPayloadSchema = z.object({
  reason: z.string().optional(),
  pending_gate_id: z.string().uuid().optional(),
});

export type RunPausedPayload = z.infer<typeof RunPausedPayloadSchema>;

export const RunCancelledPayloadSchema = z.object({
  reason: z.string().optional(),
  cancelled_by: z.string().optional(),
});

export type RunCancelledPayload = z.infer<typeof RunCancelledPayloadSchema>;

export const RunResumedPayloadSchema = z.object({
  resumed_by: z.string().optional(),
  previous_status: z.string().optional(),
});

export type RunResumedPayload = z.infer<typeof RunResumedPayloadSchema>;

// ============================================
// Task Event Payloads
// ============================================

export const TaskStartedPayloadSchema = z.object({
  step_id: z.string().min(1),
  step_title: z.string().min(1),
  attempt_number: z.number().int().positive(),
  agent_id: z.string().optional(),
  workspace_path: z.string().optional(),
});

export type TaskStartedPayload = z.infer<typeof TaskStartedPayloadSchema>;

export const TaskCompletedPayloadSchema = z.object({
  step_id: z.string().min(1),
  step_title: z.string().min(1),
  attempt_number: z.number().int().positive(),
  duration_ms: z.number().int().optional(),
  artifacts_produced: z.number().int().optional(),
});

export type TaskCompletedPayload = z.infer<typeof TaskCompletedPayloadSchema>;

export const TaskFailedPayloadSchema = z.object({
  step_id: z.string().min(1),
  step_title: z.string().min(1),
  attempt_number: z.number().int().positive(),
  error: z.string(),
  will_retry: z.boolean().optional(),
  duration_ms: z.number().int().optional(),
});

export type TaskFailedPayload = z.infer<typeof TaskFailedPayloadSchema>;

export const TaskBlockedPayloadSchema = z.object({
  step_id: z.string().min(1),
  step_title: z.string().min(1),
  blocked_by: z.array(z.string()).optional(),
  reason: z.string().optional(),
});

export type TaskBlockedPayload = z.infer<typeof TaskBlockedPayloadSchema>;

export const TaskQueuedPayloadSchema = z.object({
  step_id: z.string().min(1),
  step_title: z.string().min(1),
  dependencies_met: z.boolean().optional(),
});

export type TaskQueuedPayload = z.infer<typeof TaskQueuedPayloadSchema>;

export const TaskRetryingPayloadSchema = z.object({
  step_id: z.string().min(1),
  step_title: z.string().min(1),
  previous_attempt: z.number().int().positive(),
  next_attempt: z.number().int().positive(),
  previous_error: z.string().optional(),
});

export type TaskRetryingPayload = z.infer<typeof TaskRetryingPayloadSchema>;

// ============================================
// Agent Event Payloads
// ============================================

export const AgentSpawnedPayloadSchema = z.object({
  agent_id: z.string().min(1),
  cli: z.string().optional(),
  workspace_path: z.string().optional(),
  step_id: z.string().optional(),
});

export type AgentSpawnedPayload = z.infer<typeof AgentSpawnedPayloadSchema>;

export const AgentProgressPayloadSchema = z.object({
  agent_id: z.string().min(1),
  message: z.string(),
  progress_pct: z.number().min(0).max(100).optional(),
  current_action: z.string().optional(),
});

export type AgentProgressPayload = z.infer<typeof AgentProgressPayloadSchema>;

export const AgentToolCallPayloadSchema = z.object({
  agent_id: z.string().min(1),
  tool_name: z.string().min(1),
  tool_args: z.record(z.unknown()).optional(),
  tool_result: z.record(z.unknown()).optional(),
  duration_ms: z.number().int().optional(),
  success: z.boolean().optional(),
});

export type AgentToolCallPayload = z.infer<typeof AgentToolCallPayloadSchema>;

export const AgentExitedPayloadSchema = z.object({
  agent_id: z.string().min(1),
  exit_code: z.number().int().optional(),
  reason: z.string().optional(),
  duration_ms: z.number().int().optional(),
});

export type AgentExitedPayload = z.infer<typeof AgentExitedPayloadSchema>;

// ============================================
// Gate Event Payloads
// ============================================

export const GateReachedPayloadSchema = z.object({
  gate_id: z.string().uuid(),
  step_id: z.string().min(1),
  step_title: z.string().min(1),
  approver_role: z.string().optional(),
});

export type GateReachedPayload = z.infer<typeof GateReachedPayloadSchema>;

export const GateApprovedPayloadSchema = z.object({
  gate_id: z.string().uuid(),
  step_id: z.string().min(1),
  step_title: z.string().min(1),
  approved_by: z.string().optional(),
  comment: z.string().optional(),
});

export type GateApprovedPayload = z.infer<typeof GateApprovedPayloadSchema>;

export const GateRejectedPayloadSchema = z.object({
  gate_id: z.string().uuid(),
  step_id: z.string().min(1),
  step_title: z.string().min(1),
  rejected_by: z.string().optional(),
  comment: z.string().optional(),
  reason: z.string().optional(),
});

export type GateRejectedPayload = z.infer<typeof GateRejectedPayloadSchema>;

// ============================================
// Question Event Payloads
// ============================================

export const HumanInputRequestedPayloadSchema = z.object({
  question_id: z.string().uuid(),
  agent_id: z.string().min(1),
  text: z.string().min(1),
  blocking_level: z.string(),
  options: z.array(z.string()).optional(),
});

export type HumanInputRequestedPayload = z.infer<typeof HumanInputRequestedPayloadSchema>;

export const QuestionAnsweredPayloadSchema = z.object({
  question_id: z.string().uuid(),
  agent_id: z.string().min(1),
  answer: z.string(),
  answered_by: z.string().optional(),
  wait_duration_ms: z.number().int().optional(),
});

export type QuestionAnsweredPayload = z.infer<typeof QuestionAnsweredPayloadSchema>;

export const QuestionDismissedPayloadSchema = z.object({
  question_id: z.string().uuid(),
  agent_id: z.string().min(1),
  dismissed_by: z.string().optional(),
  reason: z.string().optional(),
});

export type QuestionDismissedPayload = z.infer<typeof QuestionDismissedPayloadSchema>;

export const QuestionAutoAnsweredPayloadSchema = z.object({
  question_id: z.string().uuid(),
  agent_id: z.string().min(1),
  text: z.string().min(1),
  answer: z.string(),
  source_question_id: z.string().uuid().optional(),
  similarity_score: z.number().optional(),
});

export type QuestionAutoAnsweredPayload = z.infer<typeof QuestionAutoAnsweredPayloadSchema>;

export const QuestionAutoDefaultedPayloadSchema = z.object({
  question_id: z.string().uuid(),
  agent_id: z.string().min(1),
  text: z.string().min(1),
  default_value: z.string(),
  timeout_seconds: z.number().int().optional(),
});

export type QuestionAutoDefaultedPayload = z.infer<typeof QuestionAutoDefaultedPayloadSchema>;

export const QuestionSubscriberAddedPayloadSchema = z.object({
  question_id: z.string().uuid(),
  original_agent_id: z.string().min(1),
  subscriber_agent_id: z.string().min(1),
  new_subscriber_count: z.number().int(),
  new_priority_score: z.number().int(),
});

export type QuestionSubscriberAddedPayload = z.infer<typeof QuestionSubscriberAddedPayloadSchema>;

// ============================================
// Audit Event Payloads
// ============================================

export const AuditStartedPayloadSchema = z.object({
  step_id: z.string().min(1),
  step_title: z.string().min(1),
  criteria_count: z.number().int().optional(),
});

export type AuditStartedPayload = z.infer<typeof AuditStartedPayloadSchema>;

export const AuditCompletedPayloadSchema = z.object({
  step_id: z.string().min(1),
  step_title: z.string().min(1),
  passed: z.boolean(),
  findings: z
    .array(
      z.object({
        criterion_id: z.string(),
        status: z.enum(['pass', 'fail']),
        details: z.string(),
      })
    )
    .optional(),
  duration_ms: z.number().int().optional(),
});

export type AuditCompletedPayload = z.infer<typeof AuditCompletedPayloadSchema>;

// ============================================
// Decision and Checkpoint Payloads
// ============================================

export const DecisionRecordedPayloadSchema = z.object({
  agent_id: z.string().min(1),
  decision: z.string().min(1),
  reasoning: z.string().optional(),
  alternatives: z.array(z.string()).optional(),
  context: z.record(z.unknown()).optional(),
});

export type DecisionRecordedPayload = z.infer<typeof DecisionRecordedPayloadSchema>;

export const CheckpointCreatedPayloadSchema = z.object({
  checkpoint_id: z.string().uuid(),
  task_count: z.number().int().optional(),
  completed_count: z.number().int().optional(),
  snapshot_size_bytes: z.number().int().optional(),
});

export type CheckpointCreatedPayload = z.infer<typeof CheckpointCreatedPayloadSchema>;

// ============================================
// Guardian Event Payloads
// ============================================

export const GuardianSpawnedPayloadSchema = z.object({
  guardian_id: z.string().uuid(),
  guardian_type: z.enum(['Security', 'Architect', 'QA', 'Compliance']),
  project_id: z.string().min(1),
  agent_name: z.string().min(1),
  shadow_targets: z.array(z.string()).optional(),
  speak_on: z.array(z.string()).optional(),
});

export type GuardianSpawnedPayload = z.infer<typeof GuardianSpawnedPayloadSchema>;

export const GuardianStoppedPayloadSchema = z.object({
  guardian_id: z.string().uuid(),
  guardian_type: z.enum(['Security', 'Architect', 'QA', 'Compliance']),
  project_id: z.string().min(1),
  error: z.string().optional(),
  duration_ms: z.number().int().optional(),
});

export type GuardianStoppedPayload = z.infer<typeof GuardianStoppedPayloadSchema>;

export const GuardianObservationPayloadSchema = z.object({
  guardian_id: z.string().uuid(),
  guardian_type: z.enum(['Security', 'Architect', 'QA', 'Compliance']),
  observation: z.string().min(1),
  concern_level: z.enum(['info', 'warning', 'critical']),
  recommendation: z.string().optional(),
  worker_agent_id: z.string().optional(),
  trigger_type: z.string().optional(),
  intervention_taken: z.string().optional(),
});

export type GuardianObservationPayload = z.infer<typeof GuardianObservationPayloadSchema>;

export const GuardianTriggerReceivedPayloadSchema = z.object({
  guardian_id: z.string().uuid(),
  trigger_type: z.string().min(1),
  source: z.string().min(1),
  payload: z.record(z.unknown()).optional(),
});

export type GuardianTriggerReceivedPayload = z.infer<typeof GuardianTriggerReceivedPayloadSchema>;

// ============================================
// Recovery Event Payloads
// ============================================

export const RecoveryStrategySelectedPayloadSchema = z.object({
  task_id: z.string().min(1),
  attempt_number: z.number().int().positive(),
  strategy: z.string().min(1),
  error_message: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export type RecoveryStrategySelectedPayload = z.infer<typeof RecoveryStrategySelectedPayloadSchema>;

export const TaskEscalatedPayloadSchema = z.object({
  task_id: z.string().min(1),
  attempt_number: z.number().int().positive(),
  error_message: z.string().optional(),
  gate_id: z.string().uuid().optional(),
});

export type TaskEscalatedPayload = z.infer<typeof TaskEscalatedPayloadSchema>;

export const TaskSkippedPayloadSchema = z.object({
  task_id: z.string().min(1),
  reason: z.string().optional(),
  error_message: z.string().optional(),
});

export type TaskSkippedPayload = z.infer<typeof TaskSkippedPayloadSchema>;

// ============================================
// Budget Event Payloads
// ============================================

export const BudgetInitializedPayloadSchema = z.object({
  tokens_allowed: z.number().nullable(),
  cost_allowed_usd: z.number().nullable(),
});

export type BudgetInitializedPayload = z.infer<typeof BudgetInitializedPayloadSchema>;

export const BudgetUpdatedPayloadSchema = z.object({
  task_id: z.string(),
  tokens_used: z.number(),
  cost_usd: z.number(),
  duration_ms: z.number().nullable().optional(),
});

export type BudgetUpdatedPayload = z.infer<typeof BudgetUpdatedPayloadSchema>;

export const BudgetWarningPayloadSchema = z.object({
  warning_level: z.string(),
  tokens_pct_used: z.number().optional(),
  cost_pct_used: z.number().optional(),
  message: z.string().optional(),
});

export type BudgetWarningPayload = z.infer<typeof BudgetWarningPayloadSchema>;

// ============================================
// Payload Schema Map
// ============================================

/**
 * Maps event types to their payload schemas for validation.
 */
export const TrajectoryPayloadSchemas: Record<TrajectoryEventType, z.ZodType> = {
  [TrajectoryEventType.RunStarted]: RunStartedPayloadSchema,
  [TrajectoryEventType.RunCompleted]: RunCompletedPayloadSchema,
  [TrajectoryEventType.RunFailed]: RunFailedPayloadSchema,
  [TrajectoryEventType.RunPaused]: RunPausedPayloadSchema,
  [TrajectoryEventType.RunCancelled]: RunCancelledPayloadSchema,
  [TrajectoryEventType.RunResumed]: RunResumedPayloadSchema,
  [TrajectoryEventType.TaskStarted]: TaskStartedPayloadSchema,
  [TrajectoryEventType.TaskCompleted]: TaskCompletedPayloadSchema,
  [TrajectoryEventType.TaskFailed]: TaskFailedPayloadSchema,
  [TrajectoryEventType.TaskBlocked]: TaskBlockedPayloadSchema,
  [TrajectoryEventType.TaskQueued]: TaskQueuedPayloadSchema,
  [TrajectoryEventType.TaskRetrying]: TaskRetryingPayloadSchema,
  [TrajectoryEventType.AgentSpawned]: AgentSpawnedPayloadSchema,
  [TrajectoryEventType.AgentProgress]: AgentProgressPayloadSchema,
  [TrajectoryEventType.AgentToolCall]: AgentToolCallPayloadSchema,
  [TrajectoryEventType.AgentExited]: AgentExitedPayloadSchema,
  [TrajectoryEventType.GateReached]: GateReachedPayloadSchema,
  [TrajectoryEventType.GateApproved]: GateApprovedPayloadSchema,
  [TrajectoryEventType.GateRejected]: GateRejectedPayloadSchema,
  [TrajectoryEventType.HumanInputRequested]: HumanInputRequestedPayloadSchema,
  [TrajectoryEventType.QuestionAnswered]: QuestionAnsweredPayloadSchema,
  [TrajectoryEventType.QuestionDismissed]: QuestionDismissedPayloadSchema,
  [TrajectoryEventType.QuestionAutoAnswered]: QuestionAutoAnsweredPayloadSchema,
  [TrajectoryEventType.QuestionAutoDefaulted]: QuestionAutoDefaultedPayloadSchema,
  [TrajectoryEventType.QuestionSubscriberAdded]: QuestionSubscriberAddedPayloadSchema,
  [TrajectoryEventType.AuditStarted]: AuditStartedPayloadSchema,
  [TrajectoryEventType.AuditCompleted]: AuditCompletedPayloadSchema,
  [TrajectoryEventType.DecisionRecorded]: DecisionRecordedPayloadSchema,
  [TrajectoryEventType.CheckpointCreated]: CheckpointCreatedPayloadSchema,
  [TrajectoryEventType.GuardianSpawned]: GuardianSpawnedPayloadSchema,
  [TrajectoryEventType.GuardianStopped]: GuardianStoppedPayloadSchema,
  [TrajectoryEventType.GuardianObservation]: GuardianObservationPayloadSchema,
  [TrajectoryEventType.GuardianTriggerReceived]: GuardianTriggerReceivedPayloadSchema,
  // Retrospective events
  [TrajectoryEventType.RetrospectiveRecorded]: RetrospectiveRecordedPayloadSchema,
  [TrajectoryEventType.RetrospectiveTimeout]: RetrospectiveTimeoutPayloadSchema,
  [TrajectoryEventType.RetrospectiveParseError]: RetrospectiveParseErrorPayloadSchema,
  [TrajectoryEventType.RetrospectiveValidationError]: RetrospectiveValidationErrorPayloadSchema,
  // Recovery events
  [TrajectoryEventType.RecoveryStrategySelected]: RecoveryStrategySelectedPayloadSchema,
  [TrajectoryEventType.TaskEscalated]: TaskEscalatedPayloadSchema,
  [TrajectoryEventType.TaskSkipped]: TaskSkippedPayloadSchema,
  // Budget events
  [TrajectoryEventType.BudgetInitialized]: BudgetInitializedPayloadSchema,
  [TrajectoryEventType.BudgetUpdated]: BudgetUpdatedPayloadSchema,
  [TrajectoryEventType.BudgetWarning]: BudgetWarningPayloadSchema,
};

/**
 * Validates a payload against the schema for a given event type.
 * Returns true if valid, throws Zod error if invalid.
 */
export function validateTrajectoryPayload(
  eventType: TrajectoryEventType,
  payload: Record<string, unknown>
): boolean {
  const schema = TrajectoryPayloadSchemas[eventType];
  if (!schema) {
    throw new Error(`Unknown trajectory event type: ${eventType}`);
  }
  schema.parse(payload);
  return true;
}

/**
 * Safely validates a payload without throwing.
 * Returns { success: true, data } or { success: false, error }.
 */
export function safeValidateTrajectoryPayload(
  eventType: TrajectoryEventType,
  payload: Record<string, unknown>
): { success: true; data: unknown } | { success: false; error: z.ZodError } {
  const schema = TrajectoryPayloadSchemas[eventType];
  if (!schema) {
    return {
      success: false,
      error: new z.ZodError([
        {
          code: 'custom',
          path: ['event_type'],
          message: `Unknown trajectory event type: ${eventType}`,
        },
      ]),
    };
  }
  return schema.safeParse(payload);
}

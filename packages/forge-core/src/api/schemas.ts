import { z } from 'zod';
import { RunStatusSchema, ForgePlanSchema } from '../domain/types.js';

// ============================================
// Create Run Request
// ============================================

/**
 * Request body for creating a new run.
 * Either provide the full plan inline, or reference an existing plan by ID and version.
 */
export const CreateRunRequestSchema = z
  .object({
    /**
     * Full plan inline (preferred for API simplicity)
     */
    plan: ForgePlanSchema.optional(),
    /**
     * Reference to existing plan by ID
     */
    plan_id: z.string().uuid().optional(),
    /**
     * Plan version (required if plan_id is provided)
     */
    plan_version: z.number().int().positive().optional(),
  })
  .refine((data) => data.plan || (data.plan_id && data.plan_version), {
    message: 'Either plan must be provided, or both plan_id and plan_version must be specified',
  });

export type CreateRunRequest = z.infer<typeof CreateRunRequestSchema>;

// ============================================
// List Runs Query
// ============================================

/**
 * Query parameters for listing runs.
 */
export const ListRunsQuerySchema = z.object({
  /**
   * Filter by run status
   */
  status: RunStatusSchema.optional(),
  /**
   * Maximum number of runs to return (default: 50)
   */
  limit: z.coerce.number().int().positive().max(100).default(50),
  /**
   * Number of runs to skip for pagination
   */
  offset: z.coerce.number().int().nonnegative().default(0),
});

export type ListRunsQuery = z.infer<typeof ListRunsQuerySchema>;

// ============================================
// Run Response
// ============================================

/**
 * Response schema for run operations.
 */
export const RunResponseSchema = z.object({
  run_id: z.string().uuid(),
  plan_id: z.string().uuid(),
  plan_version: z.number().int().positive(),
  status: RunStatusSchema,
  has_pending_gate: z.boolean(),
  tasks_count: z.number().int().nonnegative(),
  tasks_completed: z.number().int().nonnegative(),
  started_at: z.string().datetime().optional(),
  completed_at: z.string().datetime().optional(),
  error: z.string().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type RunResponse = z.infer<typeof RunResponseSchema>;

/**
 * Response for creating a new run.
 */
export const CreateRunResponseSchema = z.object({
  run_id: z.string().uuid(),
  status: RunStatusSchema,
  tasks_count: z.number().int().nonnegative(),
});

export type CreateRunResponse = z.infer<typeof CreateRunResponseSchema>;

/**
 * Response for listing runs.
 */
export const ListRunsResponseSchema = z.object({
  runs: z.array(RunResponseSchema),
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
});

export type ListRunsResponse = z.infer<typeof ListRunsResponseSchema>;

// ============================================
// Run with Tasks Response
// ============================================

/**
 * Task summary for run details response.
 */
export const TaskSummarySchema = z.object({
  task_id: z.string().uuid(),
  step_id: z.string(),
  step_title: z.string(),
  status: z.string(),
  dependencies: z.array(z.string()),
  current_attempt: z.number().int().optional(),
  agent_id: z.string().optional(),
  gate_id: z.string().uuid().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type TaskSummary = z.infer<typeof TaskSummarySchema>;

/**
 * Full run details with all tasks.
 */
export const RunWithTasksResponseSchema = RunResponseSchema.extend({
  tasks: z.array(TaskSummarySchema),
});

export type RunWithTasksResponse = z.infer<typeof RunWithTasksResponseSchema>;

// ============================================
// Task Detail Response
// ============================================

/**
 * Attempt details for task detail response.
 */
export const AttemptDetailSchema = z.object({
  attempt_id: z.string().uuid(),
  attempt_number: z.number().int().positive(),
  started_at: z.string().datetime(),
  ended_at: z.string().datetime().optional(),
  outcome: z.string().optional(),
  error: z.string().optional(),
  agent_id: z.string().optional(),
});

export type AttemptDetail = z.infer<typeof AttemptDetailSchema>;

/**
 * Artifact details for task detail response.
 */
export const ArtifactDetailSchema = z.object({
  artifact_id: z.string().uuid(),
  type: z.string(),
  reference: z.string(),
  metadata: z.record(z.unknown()).optional(),
  created_at: z.string().datetime(),
});

export type ArtifactDetail = z.infer<typeof ArtifactDetailSchema>;

/**
 * Full task details with attempts and artifacts.
 */
export const TaskDetailResponseSchema = z.object({
  task: TaskSummarySchema,
  attempts: z.array(AttemptDetailSchema),
  artifacts: z.array(ArtifactDetailSchema),
});

export type TaskDetailResponse = z.infer<typeof TaskDetailResponseSchema>;

// ============================================
// Run Control Responses
// ============================================

/**
 * Response for pause/resume/cancel operations.
 */
export const RunControlResponseSchema = z.object({
  run_id: z.string().uuid(),
  status: RunStatusSchema,
  previous_status: RunStatusSchema,
  updated_at: z.string().datetime(),
});

export type RunControlResponse = z.infer<typeof RunControlResponseSchema>;

// ============================================
// Active Agents Response
// ============================================

/**
 * Active agent information.
 */
export const ActiveAgentSchema = z.object({
  agent_id: z.string(),
  run_id: z.string().uuid(),
  task_id: z.string().uuid(),
  status: z.string(),
  last_heartbeat: z.string().datetime().optional(),
  current_task_title: z.string().optional(),
});

export type ActiveAgent = z.infer<typeof ActiveAgentSchema>;

/**
 * Response for listing active agents.
 */
export const ListActiveAgentsResponseSchema = z.object({
  agents: z.array(ActiveAgentSchema),
  total: z.number().int().nonnegative(),
});

export type ListActiveAgentsResponse = z.infer<typeof ListActiveAgentsResponseSchema>;

/**
 * Query parameters for listing active agents.
 */
export const ListActiveAgentsQuerySchema = z.object({
  run_id: z.string().uuid().optional(),
});

export type ListActiveAgentsQuery = z.infer<typeof ListActiveAgentsQuerySchema>;

// ============================================
// SSE Event Types
// ============================================

/**
 * SSE event types for run events stream.
 */
export const RunSSEEventTypes = {
  RunStatusChanged: 'run_status_changed',
  TaskStatusChanged: 'task_status_changed',
  GateReached: 'gate_reached',
  AgentProgress: 'agent_progress',
  QuestionAdded: 'question_added',
  Heartbeat: 'heartbeat',
  Connected: 'connected',
} as const;

export type RunSSEEventType = (typeof RunSSEEventTypes)[keyof typeof RunSSEEventTypes];

// ============================================
// Error Response
// ============================================

/**
 * Standard error response.
 */
export const ErrorResponseSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
  details: z.unknown().optional(),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

// ============================================
// Health Check Response
// ============================================

/**
 * Health check response.
 */
export const HealthCheckResponseSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  version: z.string().optional(),
  uptime_seconds: z.number().optional(),
  active_runs: z.number().int().nonnegative().optional(),
  active_agents: z.number().int().nonnegative().optional(),
});

export type HealthCheckResponse = z.infer<typeof HealthCheckResponseSchema>;

import { z } from 'zod';
import { RunStatusSchema, ForgePlanSchema, AuditFindingSchema } from '../domain/types.js';
import { BuildStatusSchema, BuildRunStatusSchema, BuildRequestSchema, BuildTierSchema } from '../domain/build-types.js';

// ============================================
// Step Override
// ============================================

/**
 * Per-step execution overrides for a run.
 * Allows skipping steps or forcing a specific model for a step.
 */
export const StepOverrideSchema = z.object({
  step_id: z.string().min(1),
  model: z.enum(['haiku', 'sonnet', 'opus']).optional(),
  skip: z.boolean().optional(),
});

export type StepOverride = z.infer<typeof StepOverrideSchema>;

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
    /**
     * Workspace directory for agent execution (propagated to all tasks)
     */
    workspace_path: z.string().optional(),
    /**
     * Execution policy overrides (partial policy, rest uses defaults from DOT Framework)
     */
    execution_policy: z.object({
      parallelism: z.object({
        max_concurrent_tasks: z.number().int().positive().optional(),
        max_concurrent_per_scope: z.number().int().positive().optional(),
        prefer_sequential_in_scope: z.boolean().optional(),
      }).optional(),
      budgets: z.object({
        total_cost_limit_usd: z.number().positive().optional(),
        max_total_tokens: z.number().int().positive().optional(),
      }).optional(),
    }).optional(),
    /**
     * Per-step overrides: skip individual steps or force a specific model
     */
    step_overrides: z.array(StepOverrideSchema).optional(),
  })
  .refine((data) => data.plan || data.plan_id, {
    message: 'Either plan or plan_id must be provided',
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
  scope: z.string().optional(),
  owner_role: z.string().optional(),
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
  audit_findings: z.array(AuditFindingSchema).optional(),
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
  AcAuditComplete: 'ac_audit_complete',
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

// ============================================
// Build Schemas
// ============================================

/**
 * Response for a Build.
 */
export const BuildResponseSchema = z.object({
  build_id: z.string().uuid(),
  status: BuildStatusSchema,
  tiers: z.array(BuildTierSchema),
  concurrency_limit: z.number().int(),
  skip_completed: z.boolean(),
  mode: z.string(),
  workspace_path: z.string().nullable(),
  error: z.string().nullable(),
  created_at: z.string(),
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  updated_at: z.string(),
});

export type BuildResponse = z.infer<typeof BuildResponseSchema>;

/**
 * Response for a BuildRun.
 */
export const BuildRunResponseSchema = z.object({
  build_id: z.string().uuid(),
  run_id: z.string().uuid(),
  plan_id: z.string().uuid(),
  plan_version: z.number().int().nullable(),
  tier: z.number().int(),
  status: BuildRunStatusSchema,
  created_at: z.string(),
  updated_at: z.string(),
});

export type BuildRunResponse = z.infer<typeof BuildRunResponseSchema>;

/**
 * Response for creating a new build.
 */
export const CreateBuildResponseSchema = z.object({
  build_id: z.string().uuid(),
  status: BuildStatusSchema,
  tiers_count: z.number().int(),
  plans_count: z.number().int(),
});

export type CreateBuildResponse = z.infer<typeof CreateBuildResponseSchema>;

/**
 * Response for listing builds.
 */
export const ListBuildsResponseSchema = z.object({
  builds: z.array(BuildResponseSchema),
  total: z.number().int().nonnegative(),
});

export type ListBuildsResponse = z.infer<typeof ListBuildsResponseSchema>;

/**
 * Full build details with all runs.
 */
export const BuildWithRunsResponseSchema = BuildResponseSchema.extend({
  runs: z.array(BuildRunResponseSchema),
});

export type BuildWithRunsResponse = z.infer<typeof BuildWithRunsResponseSchema>;

/**
 * Response for build control operations (pause/resume/cancel).
 */
export const BuildControlResponseSchema = z.object({
  build_id: z.string().uuid(),
  status: BuildStatusSchema,
  previous_status: BuildStatusSchema,
  updated_at: z.string(),
});

export type BuildControlResponse = z.infer<typeof BuildControlResponseSchema>;

/**
 * Query parameters for listing builds.
 */
export const ListBuildsQuerySchema = z.object({
  status: BuildStatusSchema.optional(),
});

export type ListBuildsQuery = z.infer<typeof ListBuildsQuerySchema>;

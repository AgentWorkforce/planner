// ============================================
// App Factory
// ============================================

export {
  createForgeApp,
  startForgeServer,
  type ForgeAppConfig,
  type ForgeAppDeps,
} from './app.js';

// ============================================
// Router Factory
// ============================================

export {
  createForgeRouter,
  type ForgeRouterDeps,
  type ForgeRouterConfig,
} from './routes.js';

// ============================================
// Route Registration
// ============================================

export { registerTrajectoryRoutes } from './routes/trajectory.js';
export {
  registerGateRoutes,
  registerRunEventsRoutes,
  type RegisterGateRoutesOptions,
} from './routes/gates.js';
export { registerRunRoutes, type RegisterRunRoutesOptions } from './routes/runs.js';
export { registerAgentRoutes, type RegisterAgentRoutesOptions } from './routes/agents.js';
export {
  registerQuestionRoutes,
  type RegisterQuestionRoutesOptions,
} from './routes/questions.js';
export { registerMCPRoutes, type RegisterMCPRoutesOptions } from './routes/mcp.js';

// ============================================
// Request/Response Schemas
// ============================================

export {
  // Create run
  CreateRunRequestSchema,
  type CreateRunRequest,
  // List runs
  ListRunsQuerySchema,
  type ListRunsQuery,
  // Run responses
  RunResponseSchema,
  type RunResponse,
  CreateRunResponseSchema,
  type CreateRunResponse,
  ListRunsResponseSchema,
  type ListRunsResponse,
  // Task schemas
  TaskSummarySchema,
  type TaskSummary,
  RunWithTasksResponseSchema,
  type RunWithTasksResponse,
  // Task detail
  AttemptDetailSchema,
  type AttemptDetail,
  ArtifactDetailSchema,
  type ArtifactDetail,
  TaskDetailResponseSchema,
  type TaskDetailResponse,
  // Run control
  RunControlResponseSchema,
  type RunControlResponse,
  // Agents
  ActiveAgentSchema,
  type ActiveAgent,
  ListActiveAgentsResponseSchema,
  type ListActiveAgentsResponse,
  ListActiveAgentsQuerySchema,
  type ListActiveAgentsQuery,
  // SSE events
  RunSSEEventTypes,
  type RunSSEEventType,
  // Error responses
  ErrorResponseSchema,
  type ErrorResponse,
  // Health check
  HealthCheckResponseSchema,
  type HealthCheckResponse,
} from './schemas.js';

// ============================================
// Run Handlers
// ============================================

export {
  createRunHandler,
  listRunsHandler,
  getRunHandler,
  type RunHandlerDeps,
  type ScheduleReadyTasksFn as RunScheduleReadyTasksFn,
  type CreateRunHandlerFn,
  type ListRunsHandlerFn,
  type GetRunHandlerFn,
} from './handlers/runs.js';

// ============================================
// Run Control Handlers
// ============================================

export {
  pauseRunHandler,
  resumeRunHandler,
  cancelRunHandler,
  type RunControlHandlerDeps,
  type TerminateActiveAgentsFn,
  type ScheduleReadyTasksFn as ControlScheduleReadyTasksFn,
  type PauseRunHandlerFn,
  type ResumeRunHandlerFn,
  type CancelRunHandlerFn,
} from './handlers/run-control.js';

// ============================================
// Task Handlers
// ============================================

export {
  getTaskDetailHandler,
  type TaskHandlerDeps,
  type GetTaskDetailHandlerFn,
} from './handlers/tasks.js';

// ============================================
// Agent Handlers
// ============================================

export {
  listActiveAgentsHandler,
  type AgentHandlerDeps,
  type AgentPresence,
  type GetAgentPresenceFn,
  type ListActiveAgentsHandlerFn,
} from './handlers/agents.js';

// ============================================
// Trajectory Handlers
// ============================================

export {
  getTrajectoryHandler,
  getTrajectoryStatsHandler,
  ListTrajectoryQuerySchema,
  TrajectoryStatsQuerySchema,
  type ListTrajectoryQuery,
  type TrajectoryStatsQuery,
  type TrajectoryListResponse,
  type TrajectoryStatsResponse,
  type TaskStats,
  type TrajectoryHandler,
  type TrajectoryStatsHandler,
} from './handlers/trajectory.js';

// ============================================
// Gate Handlers
// ============================================

export {
  approveGateHandler,
  rejectGateHandler,
  listPendingGatesHandler,
  ApproveGateRequestSchema,
  RejectGateRequestSchema,
  ListPendingGatesQuerySchema,
  type ApproveGateRequest,
  type RejectGateRequest,
  type ListPendingGatesQuery,
  type GateDecisionResponse,
  type PendingGatesResponse,
  type ApproveGateHandlerFn,
  type RejectGateHandlerFn,
  type ListPendingGatesHandlerFn,
} from './handlers/gates.js';

// ============================================
// SSE Handlers
// ============================================

export {
  runEventsSSEHandler,
  fullRunEventsSSEHandler,
  gateEventsSSEHandler,
  GateSSEEvents,
  type GateSSEEvent,
  type GateReachedSSEPayload,
  type GateApprovedSSEPayload,
  type GateRejectedSSEPayload,
  type RunEventsSSEDeps,
  type RunEventsSSEHandlerFn,
  type FullRunEventsSSEHandlerFn,
  type GateEventsSSEHandlerFn,
} from './handlers/sse.js';

// ============================================
// Question Handlers
// ============================================

export {
  createQuestionHandler,
  listPendingQuestionsHandler,
  listQuestionHistoryHandler,
  answerQuestionHandler,
  dismissQuestionHandler,
  getQuestionHandler,
  CreateQuestionRequestSchema,
  AnswerQuestionRequestSchema,
  DismissQuestionRequestSchema,
  ListPendingQuestionsQuerySchema,
  ListQuestionHistoryQuerySchema,
  type CreateQuestionRequest,
  type AnswerQuestionRequest,
  type DismissQuestionRequest,
  type ListPendingQuestionsQuery,
  type ListQuestionHistoryQuery,
  type CreateQuestionResponse,
  type AnswerQuestionResponse,
  type DismissQuestionResponse,
  type PendingQuestionsResponse,
  type QuestionHistoryResponse,
  type CreateQuestionHandlerFn,
  type ListPendingQuestionsHandlerFn,
  type ListQuestionHistoryHandlerFn,
  type AnswerQuestionHandlerFn,
  type DismissQuestionHandlerFn,
  type GetQuestionHandlerFn,
} from './handlers/questions.js';

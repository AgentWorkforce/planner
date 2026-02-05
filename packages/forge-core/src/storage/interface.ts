import type {
  Run,
  RunStatus,
  Task,
  TaskStatus,
  TaskAttempt,
  Artifact,
  Gate,
  GateStatus,
  Question,
  QuestionStatus,
  Checkpoint,
  TrajectoryEvent,
  WorkspaceCleanup,
  GuardianEvent,
  GuardianConcernLevel,
  ActiveGuardian,
  GuardianStatus,
} from '../domain/types.js';
import type {
  UserTrajectoryEvent,
  UserTrajectoryScope,
  DerivedPreference,
} from '../domain/user-trajectory.js';

/**
 * Filter options for trajectory event queries
 */
export interface TrajectoryEventFilter {
  task_id?: string;
  event_type?: string;
  from_timestamp?: string;
  to_timestamp?: string;
}

/**
 * Filter options for guardian event queries
 */
export interface GuardianEventFilter {
  guardian_type?: 'Security' | 'Architect' | 'QA' | 'Compliance';
  concern_level?: GuardianConcernLevel;
  from_timestamp?: string;
  to_timestamp?: string;
  run_id?: string;
  task_id?: string;
}

/**
 * ForgeStorage interface defines all storage operations for Forge entities.
 * Follows the hybrid storage pattern: relational columns for queries, JSONB for documents.
 */
export interface ForgeStorage {
  // ============================================
  // Run operations
  // ============================================

  /**
   * Creates a new Run
   */
  createRun(run: Run): Run;

  /**
   * Gets a Run by ID
   */
  getRun(runId: string): Run | null;

  /**
   * Updates a Run with partial data
   */
  updateRun(runId: string, updates: Partial<Run>): Run | null;

  /**
   * Updates only the status of a Run
   */
  updateRunStatus(runId: string, status: RunStatus): Run | null;

  /**
   * Updates the has_pending_gate flag on a Run
   */
  updateRunGateFlag(runId: string, hasPendingGate: boolean): Run | null;

  /**
   * Lists all Runs, optionally filtered by status
   */
  listRuns(status?: RunStatus): Run[];

  /**
   * Gets all active Runs (running or paused)
   */
  getActiveRuns(): Run[];

  // ============================================
  // Task operations
  // ============================================

  /**
   * Creates a new Task
   */
  createTask(task: Task): Task;

  /**
   * Gets a Task by ID
   */
  getTask(taskId: string): Task | null;

  /**
   * Updates a Task with partial data
   */
  updateTask(taskId: string, updates: Partial<Task>): Task | null;

  /**
   * Updates only the status of a Task
   */
  updateTaskStatus(taskId: string, status: TaskStatus): Task | null;

  /**
   * Lists all Tasks for a Run
   */
  listTasksByRun(runId: string): Task[];

  /**
   * Gets tasks that are ready to execute:
   * - status = 'pending'
   * - all dependencies are 'completed'
   * - run.has_pending_gate = false
   */
  getReadyTasks(runId: string): Task[];

  /**
   * Gets task by step_id within a run
   */
  getTaskByStepId(runId: string, stepId: string): Task | null;

  // ============================================
  // TaskAttempt operations
  // ============================================

  /**
   * Creates a new TaskAttempt
   */
  createAttempt(attempt: TaskAttempt): TaskAttempt;

  /**
   * Gets a TaskAttempt by ID
   */
  getAttempt(attemptId: string): TaskAttempt | null;

  /**
   * Updates a TaskAttempt with partial data
   */
  updateAttempt(attemptId: string, updates: Partial<TaskAttempt>): TaskAttempt | null;

  /**
   * Lists all attempts for a Task
   */
  listAttemptsByTask(taskId: string): TaskAttempt[];

  // ============================================
  // Artifact operations
  // ============================================

  /**
   * Creates a new Artifact
   */
  createArtifact(artifact: Artifact): Artifact;

  /**
   * Lists all Artifacts for a Task
   */
  listArtifactsByTask(taskId: string): Artifact[];

  /**
   * Lists all Artifacts for a Run (across all tasks)
   */
  listArtifactsByRun(runId: string): Artifact[];

  // ============================================
  // Gate operations
  // ============================================

  /**
   * Creates a new Gate
   */
  createGate(gate: Gate): Gate;

  /**
   * Gets a Gate by ID
   */
  getGate(gateId: string): Gate | null;

  /**
   * Gets a Gate by Task ID
   */
  getGateByTaskId(taskId: string): Gate | null;

  /**
   * Updates a Gate with partial data
   */
  updateGate(gateId: string, updates: Partial<Gate>): Gate | null;

  /**
   * Updates the status of a Gate with decision info
   */
  updateGateDecision(
    gateId: string,
    status: GateStatus,
    decidedBy: string,
    comment?: string
  ): Gate | null;

  /**
   * Lists all pending Gates for a Run
   */
  listPendingGates(runId: string): Gate[];

  // ============================================
  // Workspace cleanup operations
  // ============================================

  /**
   * Schedules a workspace for cleanup
   */
  scheduleCleanup(taskId: string, cleanupAfter: string): WorkspaceCleanup;

  /**
   * Gets all expired cleanup entries (cleanup_after < now)
   */
  getExpiredCleanups(): WorkspaceCleanup[];

  /**
   * Deletes a cleanup entry after processing
   */
  deleteCleanup(taskId: string): boolean;

  // ============================================
  // Checkpoint operations (for durability)
  // ============================================

  /**
   * Creates a new Checkpoint
   */
  createCheckpoint(checkpoint: Checkpoint): Checkpoint;

  /**
   * Gets the latest Checkpoint for a Run
   */
  getLatestCheckpoint(runId: string): Checkpoint | null;

  /**
   * Lists all Checkpoints for a Run
   */
  listCheckpoints(runId: string): Checkpoint[];

  // ============================================
  // Trajectory Event operations
  // ============================================

  /**
   * Creates a new TrajectoryEvent
   */
  createTrajectoryEvent(event: TrajectoryEvent): TrajectoryEvent;

  /**
   * Lists TrajectoryEvents for a Run with optional filters
   */
  listTrajectoryEvents(runId: string, filter?: TrajectoryEventFilter): TrajectoryEvent[];

  /**
   * Deletes trajectory events older than the specified timestamp
   * @returns Number of events deleted
   */
  deleteTrajectoryEventsOlderThan(timestamp: string): number;

  /**
   * Deletes all trajectory events for a specific run
   * @returns Number of events deleted
   */
  deleteTrajectoryEventsByRunId(runId: string): number;

  /**
   * Counts trajectory events for a run
   */
  countTrajectoryEvents(runId: string): number;

  // ============================================
  // Question operations
  // ============================================

  /**
   * Creates a new Question
   */
  createQuestion(question: Question): Question;

  /**
   * Gets a Question by ID
   */
  getQuestion(questionId: string): Question | null;

  /**
   * Updates a Question with partial data
   */
  updateQuestion(questionId: string, updates: Partial<Question>): Question | null;

  /**
   * Answers a Question
   */
  answerQuestion(questionId: string, answer: string, answeredBy?: string): Question | null;

  /**
   * Dismisses a Question
   */
  dismissQuestion(questionId: string): Question | null;

  /**
   * Lists pending Questions for a Run, ordered by priority
   */
  listPendingByPriority(runId: string): Question[];

  /**
   * Lists all Questions for a Run, optionally filtered by status
   */
  listQuestionsByRun(runId: string, status?: QuestionStatus): Question[];

  // ============================================
  // Guardian Event operations
  // ============================================

  /**
   * Creates a new GuardianEvent
   */
  createGuardianEvent(event: GuardianEvent): GuardianEvent;

  /**
   * Lists GuardianEvents for a project with optional filters
   */
  listGuardianEvents(projectId: string, filter?: GuardianEventFilter): GuardianEvent[];

  /**
   * Gets guardian events by guardian type
   */
  getGuardianEventsByType(
    projectId: string,
    guardianType: 'Security' | 'Architect' | 'QA' | 'Compliance'
  ): GuardianEvent[];

  /**
   * Counts guardian events by concern level for a project
   */
  countGuardianEventsByConcernLevel(
    projectId: string
  ): Record<GuardianConcernLevel, number>;

  /**
   * Deletes guardian events older than the specified timestamp
   * @returns Number of events deleted
   */
  deleteGuardianEventsOlderThan(timestamp: string): number;

  // ============================================
  // Active Guardian operations
  // ============================================

  /**
   * Creates a new ActiveGuardian record
   */
  createActiveGuardian(guardian: ActiveGuardian): ActiveGuardian;

  /**
   * Gets an ActiveGuardian by ID
   */
  getActiveGuardian(guardianId: string): ActiveGuardian | null;

  /**
   * Updates an ActiveGuardian with partial data
   */
  updateActiveGuardian(
    guardianId: string,
    updates: Partial<ActiveGuardian>
  ): ActiveGuardian | null;

  /**
   * Lists all active guardians for a project
   */
  listActiveGuardians(projectId: string, status?: GuardianStatus): ActiveGuardian[];

  /**
   * Gets all active guardians across all projects
   */
  getAllActiveGuardians(): ActiveGuardian[];

  /**
   * Stops a guardian by updating its status
   */
  stopGuardian(guardianId: string, error?: string): ActiveGuardian | null;

  // ============================================
  // User Trajectory Event operations
  // ============================================

  /**
   * Creates a new UserTrajectoryEvent
   */
  createUserTrajectoryEvent(event: UserTrajectoryEvent): UserTrajectoryEvent;

  /**
   * Lists UserTrajectoryEvents for a user with optional scope filter
   */
  listUserTrajectoryEvents(
    userId: string,
    scope?: UserTrajectoryScope,
    projectId?: string,
    runId?: string
  ): UserTrajectoryEvent[];

  /**
   * Gets UserTrajectoryEvents by category for preference derivation
   */
  getUserTrajectoryEventsByCategory(
    userId: string,
    category: string,
    scope?: UserTrajectoryScope
  ): UserTrajectoryEvent[];

  /**
   * Searches for similar questions in user trajectory history
   */
  searchSimilarUserTrajectoryEvents(
    userId: string,
    questionText: string,
    scope?: UserTrajectoryScope,
    limit?: number
  ): UserTrajectoryEvent[];

  // ============================================
  // User Preference operations
  // ============================================

  /**
   * Creates a new DerivedPreference
   */
  createPreference(preference: DerivedPreference): DerivedPreference;

  /**
   * Gets a preference by user, scope, and category
   */
  getPreference(
    userId: string,
    scope: UserTrajectoryScope,
    category: string,
    projectId?: string,
    runId?: string
  ): DerivedPreference | null;

  /**
   * Updates or inserts a preference
   */
  upsertPreference(preference: DerivedPreference): DerivedPreference;

  /**
   * Lists all preferences for a user, optionally filtered by scope
   */
  listPreferences(
    userId: string,
    scope?: UserTrajectoryScope,
    projectId?: string,
    runId?: string
  ): DerivedPreference[];

  /**
   * Gets preferences above a confidence threshold
   */
  getPreferencesAboveThreshold(
    userId: string,
    threshold: number,
    scope?: UserTrajectoryScope
  ): DerivedPreference[];

  /**
   * Deletes a preference
   */
  deletePreference(preferenceId: string): boolean;

  // ============================================
  // Transaction support
  // ============================================

  /**
   * Executes a function within a database transaction
   */
  transaction<T>(fn: () => T): T;

  // ============================================
  // Lifecycle
  // ============================================

  /**
   * Closes the database connection
   */
  close(): void;
}

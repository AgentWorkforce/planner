import { BaseSqliteStorage } from '@plannr/storage-base';
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
  TaskExecutionMetric,
} from '../../domain/types.js';
import type {
  UserTrajectoryEvent,
  UserTrajectoryScope,
  DerivedPreference,
} from '../../domain/user-trajectory.js';
import type { ForgeStorage, TrajectoryEventFilter, GuardianEventFilter } from '../interface.js';
import { ALL_SCHEMA_STATEMENTS, MIGRATION_STATEMENTS } from '../schema.js';

// Import module functions
import * as Runs from './runs.js';
import * as Tasks from './tasks.js';
import * as Attempts from './attempts.js';
import * as Artifacts from './artifacts.js';
import * as Gates from './gates.js';
import * as Workspaces from './workspaces.js';
import * as Checkpoints from './checkpoints.js';
import * as Trajectories from './trajectories.js';
import * as Questions from './questions.js';
import * as UserTrajectories from './user-trajectories.js';
import * as Preferences from './preferences.js';
import * as Guardians from './guardians.js';
import * as Metrics from './metrics.js';

/**
 * SQLite implementation of ForgeStorage.
 * Uses hybrid storage pattern: relational columns for queries, JSONB for documents.
 */
export class SqliteForgeStorage extends BaseSqliteStorage implements ForgeStorage {
  constructor(dbPath: string = ':memory:') {
    super(dbPath);
  }

  /**
   * Initialize database schema and run migrations.
   */
  protected initializeSchema(): void {
    // Run all schema statements (CREATE TABLE IF NOT EXISTS is idempotent)
    for (const statement of ALL_SCHEMA_STATEMENTS) {
      this.db.exec(statement);
    }

    // Run migrations for existing databases
    // ALTER TABLE ADD COLUMN doesn't support IF NOT EXISTS in SQLite,
    // so we catch "duplicate column" errors
    for (const migration of MIGRATION_STATEMENTS) {
      try {
        this.db.exec(migration);
      } catch (err: unknown) {
        const error = err as Error;
        // Ignore "duplicate column" errors
        if (!error.message.includes('duplicate column')) {
          throw err;
        }
      }
    }
  }

  // ============================================
  // Run operations
  // ============================================

  createRun(run: Run): Run {
    return Runs.createRun(this.db, run);
  }

  getRun(runId: string): Run | null {
    return Runs.getRun(this.db, runId);
  }

  updateRun(runId: string, updates: Partial<Run>): Run | null {
    return Runs.updateRun(this.db, runId, updates);
  }

  updateRunStatus(runId: string, status: RunStatus): Run | null {
    return Runs.updateRunStatus(this.db, runId, status);
  }

  updateRunGateFlag(runId: string, hasPendingGate: boolean): Run | null {
    return Runs.updateRunGateFlag(this.db, runId, hasPendingGate);
  }

  listRuns(status?: RunStatus): Run[] {
    return Runs.listRuns(this.db, status);
  }

  getActiveRuns(): Run[] {
    return Runs.getActiveRuns(this.db);
  }

  // ============================================
  // Task operations
  // ============================================

  createTask(task: Task): Task {
    return Tasks.createTask(this.db, task);
  }

  getTask(taskId: string): Task | null {
    return Tasks.getTask(this.db, taskId);
  }

  updateTask(taskId: string, updates: Partial<Task>): Task | null {
    return Tasks.updateTask(this.db, taskId, updates);
  }

  updateTaskStatus(taskId: string, status: TaskStatus): Task | null {
    return Tasks.updateTaskStatus(this.db, taskId, status);
  }

  listTasksByRun(runId: string): Task[] {
    return Tasks.listTasksByRun(this.db, runId);
  }

  getReadyTasks(runId: string): Task[] {
    return Tasks.getReadyTasks(this.db, runId);
  }

  getTaskByStepId(runId: string, stepId: string): Task | null {
    return Tasks.getTaskByStepId(this.db, runId, stepId);
  }

  // ============================================
  // TaskAttempt operations
  // ============================================

  createAttempt(attempt: TaskAttempt): TaskAttempt {
    return Attempts.createAttempt(this.db, attempt);
  }

  getAttempt(attemptId: string): TaskAttempt | null {
    return Attempts.getAttempt(this.db, attemptId);
  }

  updateAttempt(attemptId: string, updates: Partial<TaskAttempt>): TaskAttempt | null {
    return Attempts.updateAttempt(this.db, attemptId, updates);
  }

  listAttemptsByTask(taskId: string): TaskAttempt[] {
    return Attempts.listAttemptsByTask(this.db, taskId);
  }

  // ============================================
  // Artifact operations
  // ============================================

  createArtifact(artifact: Artifact): Artifact {
    return Artifacts.createArtifact(this.db, artifact);
  }

  listArtifactsByTask(taskId: string): Artifact[] {
    return Artifacts.listArtifactsByTask(this.db, taskId);
  }

  listArtifactsByRun(runId: string): Artifact[] {
    return Artifacts.listArtifactsByRun(this.db, runId);
  }

  // ============================================
  // Gate operations
  // ============================================

  createGate(gate: Gate): Gate {
    return Gates.createGate(this.db, gate);
  }

  getGate(gateId: string): Gate | null {
    return Gates.getGate(this.db, gateId);
  }

  getGateByTaskId(taskId: string): Gate | null {
    return Gates.getGateByTaskId(this.db, taskId);
  }

  updateGate(gateId: string, updates: Partial<Gate>): Gate | null {
    return Gates.updateGate(this.db, gateId, updates);
  }

  updateGateDecision(
    gateId: string,
    status: GateStatus,
    decidedBy: string,
    comment?: string
  ): Gate | null {
    return Gates.updateGateDecision(this.db, gateId, status, decidedBy, comment);
  }

  listPendingGates(runId: string): Gate[] {
    return Gates.listPendingGates(this.db, runId);
  }

  // ============================================
  // Workspace cleanup operations
  // ============================================

  scheduleCleanup(taskId: string, cleanupAfter: string): WorkspaceCleanup {
    return Workspaces.scheduleCleanup(this.db, taskId, cleanupAfter);
  }

  getExpiredCleanups(): WorkspaceCleanup[] {
    return Workspaces.getExpiredCleanups(this.db);
  }

  deleteCleanup(taskId: string): boolean {
    return Workspaces.deleteCleanup(this.db, taskId);
  }

  // ============================================
  // Checkpoint operations
  // ============================================

  createCheckpoint(checkpoint: Checkpoint): Checkpoint {
    return Checkpoints.createCheckpoint(this.db, checkpoint);
  }

  getLatestCheckpoint(runId: string): Checkpoint | null {
    return Checkpoints.getLatestCheckpoint(this.db, runId);
  }

  listCheckpoints(runId: string): Checkpoint[] {
    return Checkpoints.listCheckpoints(this.db, runId);
  }

  // ============================================
  // Trajectory Event operations
  // ============================================

  createTrajectoryEvent(event: TrajectoryEvent): TrajectoryEvent {
    return Trajectories.createTrajectoryEvent(this.db, event);
  }

  listTrajectoryEvents(runId: string, filter?: TrajectoryEventFilter): TrajectoryEvent[] {
    return Trajectories.listTrajectoryEvents(this.db, runId, filter);
  }

  deleteTrajectoryEventsOlderThan(timestamp: string): number {
    return Trajectories.deleteTrajectoryEventsOlderThan(this.db, timestamp);
  }

  deleteTrajectoryEventsByRunId(runId: string): number {
    return Trajectories.deleteTrajectoryEventsByRunId(this.db, runId);
  }

  countTrajectoryEvents(runId: string): number {
    return Trajectories.countTrajectoryEvents(this.db, runId);
  }

  // ============================================
  // Question operations
  // ============================================

  createQuestion(question: Question): Question {
    return Questions.createQuestion(this.db, question);
  }

  getQuestion(questionId: string): Question | null {
    return Questions.getQuestion(this.db, questionId);
  }

  updateQuestion(questionId: string, updates: Partial<Question>): Question | null {
    return Questions.updateQuestion(this.db, questionId, updates);
  }

  answerQuestion(questionId: string, answer: string, answeredBy?: string): Question | null {
    return Questions.answerQuestion(this.db, questionId, answer, answeredBy);
  }

  dismissQuestion(questionId: string): Question | null {
    return Questions.dismissQuestion(this.db, questionId);
  }

  listPendingByPriority(runId: string): Question[] {
    return Questions.listPendingByPriority(this.db, runId);
  }

  listQuestionsByRun(runId: string, status?: QuestionStatus): Question[] {
    return Questions.listQuestionsByRun(this.db, runId, status);
  }

  // ============================================
  // Guardian Event operations
  // ============================================

  createGuardianEvent(event: GuardianEvent): GuardianEvent {
    return Guardians.createGuardianEvent(this.db, event);
  }

  listGuardianEvents(projectId: string, filter?: GuardianEventFilter): GuardianEvent[] {
    return Guardians.listGuardianEvents(this.db, projectId, filter);
  }

  getGuardianEventsByType(
    projectId: string,
    guardianType: 'Security' | 'Architect' | 'QA' | 'Compliance'
  ): GuardianEvent[] {
    return Guardians.getGuardianEventsByType(this.db, projectId, guardianType);
  }

  countGuardianEventsByConcernLevel(
    projectId: string
  ): Record<GuardianConcernLevel, number> {
    return Guardians.countGuardianEventsByConcernLevel(this.db, projectId);
  }

  deleteGuardianEventsOlderThan(timestamp: string): number {
    return Guardians.deleteGuardianEventsOlderThan(this.db, timestamp);
  }

  // ============================================
  // Active Guardian operations
  // ============================================

  createActiveGuardian(guardian: ActiveGuardian): ActiveGuardian {
    return Guardians.createActiveGuardian(this.db, guardian);
  }

  getActiveGuardian(guardianId: string): ActiveGuardian | null {
    return Guardians.getActiveGuardian(this.db, guardianId);
  }

  updateActiveGuardian(
    guardianId: string,
    updates: Partial<ActiveGuardian>
  ): ActiveGuardian | null {
    return Guardians.updateActiveGuardian(this.db, guardianId, updates);
  }

  listActiveGuardians(projectId: string, status?: GuardianStatus): ActiveGuardian[] {
    return Guardians.listActiveGuardians(this.db, projectId, status);
  }

  getAllActiveGuardians(): ActiveGuardian[] {
    return Guardians.getAllActiveGuardians(this.db);
  }

  stopGuardian(guardianId: string, error?: string): ActiveGuardian | null {
    return Guardians.stopGuardian(this.db, guardianId, error);
  }

  // ============================================
  // User Trajectory Event operations
  // ============================================

  createUserTrajectoryEvent(event: UserTrajectoryEvent): UserTrajectoryEvent {
    return UserTrajectories.createUserTrajectoryEvent(this.db, event);
  }

  listUserTrajectoryEvents(
    userId: string,
    scope?: UserTrajectoryScope,
    projectId?: string,
    runId?: string
  ): UserTrajectoryEvent[] {
    return UserTrajectories.listUserTrajectoryEvents(this.db, userId, scope, projectId, runId);
  }

  getUserTrajectoryEventsByCategory(
    userId: string,
    category: string,
    scope?: UserTrajectoryScope
  ): UserTrajectoryEvent[] {
    return UserTrajectories.getUserTrajectoryEventsByCategory(this.db, userId, category, scope);
  }

  searchSimilarUserTrajectoryEvents(
    userId: string,
    questionText: string,
    scope?: UserTrajectoryScope,
    limit?: number
  ): UserTrajectoryEvent[] {
    return UserTrajectories.searchSimilarUserTrajectoryEvents(
      this.db,
      userId,
      questionText,
      scope,
      limit
    );
  }

  // ============================================
  // User Preference operations
  // ============================================

  createPreference(preference: DerivedPreference): DerivedPreference {
    return Preferences.createPreference(this.db, preference);
  }

  getPreference(
    userId: string,
    scope: UserTrajectoryScope,
    category: string,
    projectId?: string,
    runId?: string
  ): DerivedPreference | null {
    return Preferences.getPreference(this.db, userId, scope, category, projectId, runId);
  }

  upsertPreference(preference: DerivedPreference): DerivedPreference {
    return Preferences.upsertPreference(this.db, preference);
  }

  listPreferences(
    userId: string,
    scope?: UserTrajectoryScope,
    projectId?: string,
    runId?: string
  ): DerivedPreference[] {
    return Preferences.listPreferences(this.db, userId, scope, projectId, runId);
  }

  getPreferencesAboveThreshold(
    userId: string,
    threshold: number,
    scope?: UserTrajectoryScope
  ): DerivedPreference[] {
    return Preferences.getPreferencesAboveThreshold(this.db, userId, threshold, scope);
  }

  deletePreference(preferenceId: string): boolean {
    return Preferences.deletePreference(this.db, preferenceId);
  }

  // ============================================
  // Task Execution Metrics (DOT Framework)
  // ============================================

  saveTaskMetric(metric: TaskExecutionMetric): TaskExecutionMetric {
    return Metrics.saveTaskMetric(this.db, metric);
  }

  getTaskMetrics(runId: string): TaskExecutionMetric[] {
    return Metrics.getTaskMetrics(this.db, runId);
  }

  getTaskMetricsByModel(modelId: string): TaskExecutionMetric[] {
    return Metrics.getTaskMetricsByModel(this.db, modelId);
  }

  // ============================================
  // Run Budgets (DOT Framework)
  // ============================================

  initRunBudget(
    runId: string,
    tokensAllowed?: number,
    costAllowedUsd?: number
  ): void {
    return Metrics.initRunBudget(this.db, runId, tokensAllowed, costAllowedUsd);
  }

  updateRunBudget(
    runId: string,
    tokensUsed: number,
    costUsed: number
  ): void {
    return Metrics.updateRunBudget(this.db, runId, tokensUsed, costUsed);
  }

  getRunBudget(
    runId: string
  ): {
    tokens_used: number;
    tokens_allowed: number | null;
    cost_used_usd: number;
    cost_allowed_usd: number | null;
  } | null {
    return Metrics.getRunBudget(this.db, runId);
  }

  // ============================================
  // Transaction support
  // ============================================

  /**
   * Executes a function within a database transaction.
   * Overrides the protected method from BaseSqliteStorage to make it public.
   */
  public transaction<T>(fn: () => T): T {
    return super.transaction(fn);
  }
}

// ============================================
// Factory function and exports
// ============================================

/**
 * Creates a new ForgeStorage instance backed by SQLite.
 * @param dbPath Path to the SQLite database file, or ':memory:' for in-memory
 */
export function createForgeStorage(dbPath: string = ':memory:'): ForgeStorage {
  return new SqliteForgeStorage(dbPath);
}

// Default export for convenience
export default SqliteForgeStorage;

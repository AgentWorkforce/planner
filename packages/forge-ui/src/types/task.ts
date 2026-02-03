/**
 * Task types for the Forge orchestration UI
 */

export enum TaskStatus {
  PENDING = 'pending',
  BLOCKED = 'blocked',
  READY = 'ready',
  ASSIGNED = 'assigned',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

export interface Task {
  task_id: string;
  run_id: string;
  step_id: string;
  status: TaskStatus;

  // Step information
  title: string;
  description?: string;
  scope?: string;
  owner_role?: string;

  // Dependency tracking
  dependencies: string[];
  blocked_by?: string[];

  // Assignment
  assigned_agent_id?: string;
  assigned_at?: string;

  // Timing
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;

  // Results
  result?: TaskResult;
  attempts: TaskAttempt[];

  // Metadata
  metadata?: Record<string, unknown>;
}

export interface TaskResult {
  success: boolean;
  output?: string;
  error?: string;
  artifacts?: string[];
}

export interface TaskAttempt {
  attempt_id: string;
  task_id: string;
  attempt_number: number;
  status: 'running' | 'completed' | 'failed';

  agent_id?: string;
  started_at: string;
  completed_at?: string;

  result?: TaskResult;
  error?: string;

  // Execution context
  reasoning_trajectory_id?: string;
}

export interface TaskSummary {
  task_id: string;
  step_id: string;
  title: string;
  status: TaskStatus;
  scope?: string;
  assigned_agent_id?: string;
  attempt_count: number;
}

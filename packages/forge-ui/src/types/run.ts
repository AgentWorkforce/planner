/**
 * Run types for the Forge orchestration UI
 */

export enum RunStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export interface Run {
  run_id: string;
  plan_id: string;
  plan_version: number;
  status: RunStatus;

  // Progress tracking (matches forge-core API response)
  tasks_count: number;
  tasks_completed: number;
  has_pending_gate?: boolean;

  // Legacy aliases for backwards compatibility
  total_tasks?: number;
  completed_tasks?: number;
  failed_tasks?: number;

  // Timing
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;

  // Context
  triggered_by?: string;
  plan_goal?: string;
  error?: string;

  // Metadata
  metadata?: Record<string, unknown>;

  // Tasks (included in RunWithTasksResponse)
  tasks?: TaskSummaryFromAPI[];
}

/**
 * Task summary as returned by the API
 */
export interface TaskSummaryFromAPI {
  task_id: string;
  step_id: string;
  step_title: string;
  status: string;
  dependencies: string[];
  current_attempt?: number;
  agent_id?: string;
  gate_id?: string;
  created_at: string;
  updated_at: string;
}

export interface RunSummary {
  run_id: string;
  plan_id: string;
  plan_goal?: string;
  status: RunStatus;
  tasks_count: number;
  tasks_completed: number;
  has_pending_gate?: boolean;
  started_at?: string;
  created_at: string;
  // Legacy aliases
  total_tasks?: number;
  completed_tasks?: number;
}

export interface RunFilter {
  status?: RunStatus | RunStatus[];
  plan_id?: string;
  limit?: number;
  offset?: number;
}

export interface RunListResponse {
  runs: RunSummary[];
  total: number;
  limit: number;
  offset: number;
}

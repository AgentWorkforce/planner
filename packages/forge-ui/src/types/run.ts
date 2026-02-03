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

  // Progress tracking
  total_tasks: number;
  completed_tasks: number;
  failed_tasks: number;

  // Timing
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;

  // Context
  triggered_by?: string;
  plan_goal?: string;

  // Metadata
  metadata?: Record<string, unknown>;
}

export interface RunSummary {
  run_id: string;
  plan_id: string;
  plan_goal?: string;
  status: RunStatus;
  total_tasks: number;
  completed_tasks: number;
  started_at?: string;
  created_at: string;
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

/**
 * Agent types for the Forge orchestration UI
 */

export enum AgentState {
  IDLE = 'idle',
  WORKING = 'working',
  WAITING = 'waiting',
  NEEDS_INPUT = 'needs_input',
  ERROR = 'error',
  OFFLINE = 'offline',
}

/**
 * Agent status for active agent monitoring
 * Used by ActiveAgentsSection and related components
 */
export enum AgentStatus {
  WORKING = 'working',
  BLOCKED = 'blocked',
  IDLE = 'idle',
  ERROR = 'error',
}

export interface Agent {
  agent_id: string;
  name: string;
  role: string;
  state: AgentState;

  // Current work
  current_task_id?: string;
  current_run_id?: string;

  // Stats
  tasks_completed: number;
  tasks_failed: number;

  // Timing
  started_at?: string;
  last_activity_at?: string;

  // Metadata
  metadata?: Record<string, unknown>;
}

export interface AgentSummary {
  agent_id: string;
  name: string;
  role: string;
  state: AgentState;
  current_task_id?: string;
}

/**
 * Agent message for activity log
 */
export interface AgentMessage {
  message_id: string;
  content: string;
  timestamp: string;
}

/**
 * Artifact produced by an agent
 */
export interface AgentArtifact {
  artifact_id: string;
  type: string;
  label: string;
  url: string;
}

/**
 * Active agent with extended details for monitoring
 * Used by the agent cards feature
 */
export interface ActiveAgent {
  agent_id: string;
  run_id: string;
  task_id: string;
  task_title: string;
  owner_role?: string;
  status: AgentStatus;
  last_message?: string;
  last_heartbeat: string;

  // Extended details for detail panel
  task_description?: string;
  acceptance_criteria?: string[];
  artifacts?: AgentArtifact[];
  recent_messages?: AgentMessage[];
}

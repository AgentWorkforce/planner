/**
 * Agent Spawner Types — Dependency Injection for Agent Lifecycle
 *
 * forge-core defines these lightweight function types.
 * The server package injects relay-backed implementations.
 * This follows the same DI pattern as ideation's SpawnAgentFn.
 */

// Re-export TerminateAgentFn from recovery (single source of truth)
export type { TerminateAgentFn } from './recovery.js';

/**
 * Options for spawning a task execution agent.
 */
export interface SpawnTaskOptions {
  /** Task being executed */
  taskId: string;
  /** Run the task belongs to */
  runId: string;
  /** Human-readable step title */
  stepTitle: string;
  /** Step description/instructions */
  stepDescription?: string;
  /** Scope from plan step (e.g., 'api-service') */
  scope?: string;
  /** Role from plan step (e.g., 'backend:Coder') */
  ownerRole?: string;
  /** Workspace directory for agent execution */
  workspacePath?: string;
  /** CLI command to use (from ForgeConfig role_cli_mapping) */
  cli: string;
  /** Model to use (from ModelSelector, e.g., 'sonnet') */
  model?: string;
  /** Timeout in seconds (from ForgeConfig) */
  timeout?: number;
  /** Acceptance criteria for the step */
  acceptanceCriteria?: Array<{ id: string; description: string; type?: string }>;
}

/**
 * Result from spawning a task agent.
 */
export interface SpawnTaskResult {
  /** Agent identifier (for tracking and termination) */
  agentId: string;
  /** Process ID if available */
  pid?: number;
}

/**
 * Function to spawn a task execution agent.
 * Injected by server (backed by relay, or mock for testing).
 */
export type SpawnTaskFn = (options: SpawnTaskOptions) => Promise<SpawnTaskResult>;

/**
 * Function to check if the spawner is available.
 */
export type IsSpawnerAvailableFn = () => boolean;

/**
 * Forge execution mode.
 * - test: TestExecutor with synthetic metrics, outcomes tagged source='test'
 * - real: Orchestrator with RunService + agent spawning, outcomes tagged source='production'
 * - training: TestExecutor with synthetic metrics, outcomes tagged source='training' (tuner learns)
 */
export type ForgeExecutionMode = 'test' | 'real' | 'training';

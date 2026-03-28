import type { TrajectoryCapture } from './trajectory-capture.js';
import type { Task, BudgetsConfig } from '../domain/types.js';
import { DEFAULT_EXECUTION_POLICY } from '../domain/types.js';

/**
 * Configuration for the health monitor
 */
export interface HealthMonitorConfig {
  /**
   * Threshold in milliseconds after which an agent is considered stuck.
   * Default: 5 minutes (300000ms)
   * Can be overridden via FORGE_AGENT_STUCK_THRESHOLD env var.
   */
  stuckThresholdMs: number;

  /**
   * Interval in milliseconds between health checks.
   * Default: 60 seconds (60000ms)
   */
  checkIntervalMs: number;

  /**
   * Whether to automatically start the health check loop.
   * Default: false
   */
  autoStart: boolean;
}

/**
 * Information about an agent's health status
 */
export interface AgentHealthInfo {
  agentId: string;
  lastHeartbeat: Date;
  isStuck: boolean;
  msSinceLastHeartbeat: number;
}

/**
 * Callback invoked when stuck agents are detected
 */
export type OnStuckAgentsCallback = (stuckAgentIds: string[]) => void;

const DEFAULT_CONFIG: HealthMonitorConfig = {
  stuckThresholdMs: parseInt(process.env.FORGE_AGENT_STUCK_THRESHOLD ?? '300000', 10), // 5 min
  checkIntervalMs: 60000, // 1 min
  autoStart: false,
};

/**
 * HealthMonitor tracks agent heartbeats and detects stuck agents.
 *
 * Heartbeats should be updated when:
 * - Agent sends a report_progress tool call
 * - Agent sends a relay message
 * - Any other sign of agent activity
 *
 * An agent is considered "stuck" if no heartbeat has been received
 * for longer than the configured threshold (default: 5 minutes).
 */
export class HealthMonitor {
  private heartbeats: Map<string, Date> = new Map();
  private config: HealthMonitorConfig;
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private onStuckAgentsCallbacks: OnStuckAgentsCallback[] = [];
  private isRunning = false;

  constructor(config: Partial<HealthMonitorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    if (this.config.autoStart) {
      this.start();
    }
  }

  /**
   * Starts the health monitoring loop.
   */
  start(): void {
    if (this.isRunning) {
      console.warn('[HealthMonitor] Already running');
      return;
    }

    console.log(
      `[HealthMonitor] Starting health checks (interval: ${this.config.checkIntervalMs}ms, ` +
      `stuck threshold: ${this.config.stuckThresholdMs}ms)`
    );

    this.isRunning = true;
    this.checkInterval = setInterval(() => {
      this.runHealthCheck();
    }, this.config.checkIntervalMs);
  }

  /**
   * Stops the health monitoring loop.
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    console.log('[HealthMonitor] Stopping health checks');

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    this.isRunning = false;
  }

  /**
   * Registers a callback to be invoked when stuck agents are detected.
   */
  onStuckAgents(callback: OnStuckAgentsCallback): void {
    this.onStuckAgentsCallbacks.push(callback);
  }

  /**
   * Removes a previously registered callback.
   */
  removeOnStuckAgents(callback: OnStuckAgentsCallback): void {
    const index = this.onStuckAgentsCallbacks.indexOf(callback);
    if (index !== -1) {
      this.onStuckAgentsCallbacks.splice(index, 1);
    }
  }

  /**
   * Records a heartbeat for an agent.
   *
   * @param agentId - The ID of the agent
   * @param timestamp - Optional timestamp, defaults to now
   */
  trackAgentHeartbeat(agentId: string, timestamp?: Date): void {
    const heartbeatTime = timestamp ?? new Date();
    this.heartbeats.set(agentId, heartbeatTime);
  }

  /**
   * Removes an agent from tracking (e.g., when agent is released).
   */
  removeAgent(agentId: string): void {
    this.heartbeats.delete(agentId);
  }

  /**
   * Clears all agent tracking data.
   */
  clearAll(): void {
    this.heartbeats.clear();
  }

  /**
   * Gets the IDs of all agents that appear to be stuck.
   *
   * @returns Array of agent IDs that haven't sent a heartbeat within the threshold
   */
  detectStuckAgents(): string[] {
    const now = Date.now();
    const stuckAgents: string[] = [];

    this.heartbeats.forEach((lastHeartbeat, agentId) => {
      const msSinceHeartbeat = now - lastHeartbeat.getTime();
      if (msSinceHeartbeat > this.config.stuckThresholdMs) {
        stuckAgents.push(agentId);
      }
    });

    return stuckAgents;
  }

  /**
   * Gets health information for a specific agent.
   */
  getAgentHealth(agentId: string): AgentHealthInfo | null {
    const lastHeartbeat = this.heartbeats.get(agentId);
    if (!lastHeartbeat) {
      return null;
    }

    const now = Date.now();
    const msSinceLastHeartbeat = now - lastHeartbeat.getTime();

    return {
      agentId,
      lastHeartbeat,
      isStuck: msSinceLastHeartbeat > this.config.stuckThresholdMs,
      msSinceLastHeartbeat,
    };
  }

  /**
   * Gets health information for all tracked agents.
   */
  getAllAgentHealth(): AgentHealthInfo[] {
    const result: AgentHealthInfo[] = [];

    this.heartbeats.forEach((_, agentId) => {
      const health = this.getAgentHealth(agentId);
      if (health) {
        result.push(health);
      }
    });

    return result;
  }

  /**
   * Gets the list of all tracked agent IDs.
   */
  getTrackedAgents(): string[] {
    const keys: string[] = [];
    this.heartbeats.forEach((_, key) => keys.push(key));
    return keys;
  }

  /**
   * Gets the current configuration.
   */
  getConfig(): HealthMonitorConfig {
    return { ...this.config };
  }

  /**
   * Updates the configuration. Changes take effect immediately.
   */
  updateConfig(updates: Partial<HealthMonitorConfig>): void {
    const wasRunning = this.isRunning;
    const intervalChanged = updates.checkIntervalMs !== undefined &&
      updates.checkIntervalMs !== this.config.checkIntervalMs;

    this.config = { ...this.config, ...updates };

    // Restart the interval if it changed
    if (wasRunning && intervalChanged) {
      this.stop();
      this.start();
    }
  }

  /**
   * Whether the health monitor is currently running.
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Runs a single health check iteration.
   * This is called automatically by the interval, but can also be called manually.
   */
  runHealthCheck(): void {
    const stuckAgents = this.detectStuckAgents();

    if (stuckAgents.length > 0) {
      console.warn(
        `[HealthMonitor] Detected ${stuckAgents.length} stuck agent(s): ${stuckAgents.join(', ')}`
      );

      // Notify callbacks
      for (const callback of this.onStuckAgentsCallbacks) {
        try {
          callback(stuckAgents);
        } catch (error) {
          console.error('[HealthMonitor] Error in onStuckAgents callback:', error);
        }
      }
    }
  }

  /**
   * Gets a summary of the current health status.
   */
  getHealthSummary(): {
    totalTracked: number;
    healthy: number;
    stuck: number;
    isRunning: boolean;
    config: HealthMonitorConfig;
  } {
    const allHealth = this.getAllAgentHealth();
    const stuckCount = allHealth.filter((h) => h.isStuck).length;

    return {
      totalTracked: allHealth.length,
      healthy: allHealth.length - stuckCount,
      stuck: stuckCount,
      isRunning: this.isRunning,
      config: this.getConfig(),
    };
  }
}

// ============================================
// Task Timeout Manager (DOT Framework)
// ============================================

/**
 * Information about a tracked task timeout
 */
export interface TaskTimeoutInfo {
  taskId: string;
  runId: string;
  agentId?: string;
  startedAt: Date;
  timeoutMs: number;
  timeoutAt: Date;
}

/**
 * Result of a timeout check
 */
export interface TimeoutCheckResult {
  taskId: string;
  isTimedOut: boolean;
  elapsedMs: number;
  remainingMs: number;
}

/**
 * Callback invoked when a task times out
 */
export type OnTaskTimeoutCallback = (info: TaskTimeoutInfo) => void | Promise<void>;

/**
 * Function to signal agent for graceful shutdown
 */
export type SignalAgentShutdownFn = (agentId: string, reason: string) => Promise<void>;

/**
 * Function to fail a task with timeout
 */
export type FailTaskWithTimeoutFn = (taskId: string, runId: string) => Promise<void>;

/**
 * TaskTimeoutManager enforces per-task timeouts from ExecutionPolicy.
 *
 * Features:
 * - Tracks task start times and calculates timeouts
 * - Periodic check for timed-out tasks
 * - Signals agents for graceful shutdown
 * - Captures timeout events in trajectory
 *
 * Research basis: METR 2025 - P(success) ~= (0.5)^(T/50min)
 * Default 5 minute timeout optimizes success probability.
 */
export class TaskTimeoutManager {
  private trackedTasks: Map<string, TaskTimeoutInfo> = new Map();
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;
  private checkIntervalMs: number;
  private defaultTimeoutMs: number;
  private trajectoryCapture: TrajectoryCapture | null;
  private onTimeoutCallbacks: OnTaskTimeoutCallback[] = [];
  private signalAgentShutdown: SignalAgentShutdownFn | null;
  private failTaskWithTimeout: FailTaskWithTimeoutFn | null;

  constructor(options?: {
    /** Interval between timeout checks (default: 10s) */
    checkIntervalMs?: number;
    /** Default timeout from BudgetsConfig (default: 300s = 5min) */
    defaultTimeoutMs?: number;
    /** Trajectory capture for observability */
    trajectoryCapture?: TrajectoryCapture;
    /** Function to signal agent for shutdown */
    signalAgentShutdown?: SignalAgentShutdownFn;
    /** Function to fail a task */
    failTaskWithTimeout?: FailTaskWithTimeoutFn;
  }) {
    this.checkIntervalMs = options?.checkIntervalMs ?? 10000; // 10 seconds
    this.defaultTimeoutMs = options?.defaultTimeoutMs ??
      (DEFAULT_EXECUTION_POLICY.budgets.per_task_time_seconds * 1000);
    this.trajectoryCapture = options?.trajectoryCapture ?? null;
    this.signalAgentShutdown = options?.signalAgentShutdown ?? null;
    this.failTaskWithTimeout = options?.failTaskWithTimeout ?? null;
  }

  /**
   * Starts the timeout monitoring loop.
   */
  start(): void {
    if (this.isRunning) {
      console.warn('[TaskTimeoutManager] Already running');
      return;
    }

    console.log(
      `[TaskTimeoutManager] Starting timeout checks (interval: ${this.checkIntervalMs}ms, ` +
      `default timeout: ${this.defaultTimeoutMs}ms)`
    );

    this.isRunning = true;
    this.checkInterval = setInterval(() => {
      this.runTimeoutCheck();
    }, this.checkIntervalMs);
  }

  /**
   * Stops the timeout monitoring loop.
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    console.log('[TaskTimeoutManager] Stopping timeout checks');

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    this.isRunning = false;
  }

  /**
   * Tracks a task for timeout enforcement.
   *
   * @param task - The task to track
   * @param runId - Run the task belongs to
   * @param budgets - Optional budget config (uses default if not provided)
   */
  trackTask(task: Task, runId: string, budgets?: BudgetsConfig): void {
    const timeoutMs = budgets?.per_task_time_seconds
      ? budgets.per_task_time_seconds * 1000
      : this.defaultTimeoutMs;

    const now = new Date();
    const info: TaskTimeoutInfo = {
      taskId: task.task_id,
      runId,
      agentId: task.agent_id,
      startedAt: now,
      timeoutMs,
      timeoutAt: new Date(now.getTime() + timeoutMs),
    };

    this.trackedTasks.set(task.task_id, info);
  }

  /**
   * Removes a task from tracking (e.g., when completed).
   */
  untrackTask(taskId: string): void {
    this.trackedTasks.delete(taskId);
  }

  /**
   * Registers a callback for task timeouts.
   */
  onTimeout(callback: OnTaskTimeoutCallback): void {
    this.onTimeoutCallbacks.push(callback);
  }

  /**
   * Checks if a specific task has timed out.
   */
  checkTaskTimeout(taskId: string): TimeoutCheckResult | null {
    const info = this.trackedTasks.get(taskId);
    if (!info) {
      return null;
    }

    const now = Date.now();
    const elapsedMs = now - info.startedAt.getTime();
    const remainingMs = Math.max(0, info.timeoutMs - elapsedMs);

    return {
      taskId,
      isTimedOut: elapsedMs >= info.timeoutMs,
      elapsedMs,
      remainingMs,
    };
  }

  /**
   * Runs a timeout check on all tracked tasks.
   */
  async runTimeoutCheck(): Promise<void> {
    const now = Date.now();
    const timedOutTasks: TaskTimeoutInfo[] = [];

    this.trackedTasks.forEach((info) => {
      if (now >= info.timeoutAt.getTime()) {
        timedOutTasks.push(info);
      }
    });

    // Handle each timed-out task
    for (const info of timedOutTasks) {
      await this.handleTimeout(info);
    }
  }

  /**
   * Handles a single task timeout.
   */
  private async handleTimeout(info: TaskTimeoutInfo): Promise<void> {
    console.warn(
      `[TaskTimeoutManager] Task ${info.taskId} timed out after ${info.timeoutMs}ms`
    );

    // Remove from tracking first to avoid duplicate processing
    this.trackedTasks.delete(info.taskId);

    // Capture trajectory event
    if (this.trajectoryCapture) {
      this.trajectoryCapture.capture(
        info.runId,
        'task_timeout',
        {
          task_id: info.taskId,
          agent_id: info.agentId,
          timeout_ms: info.timeoutMs,
          started_at: info.startedAt.toISOString(),
        },
        info.taskId
      );
    }

    // Signal agent for graceful shutdown
    if (info.agentId && this.signalAgentShutdown) {
      try {
        await this.signalAgentShutdown(info.agentId, 'Task timeout exceeded');
      } catch (error) {
        console.error(
          `[TaskTimeoutManager] Failed to signal agent ${info.agentId} for shutdown:`,
          error
        );
      }
    }

    // Fail the task with timeout outcome
    if (this.failTaskWithTimeout) {
      try {
        await this.failTaskWithTimeout(info.taskId, info.runId);
      } catch (error) {
        console.error(
          `[TaskTimeoutManager] Failed to fail task ${info.taskId}:`,
          error
        );
      }
    }

    // Notify callbacks
    for (const callback of this.onTimeoutCallbacks) {
      try {
        await callback(info);
      } catch (error) {
        console.error('[TaskTimeoutManager] Error in onTimeout callback:', error);
      }
    }
  }

  /**
   * Gets all tracked tasks with their timeout status.
   */
  getAllTaskTimeouts(): TimeoutCheckResult[] {
    const results: TimeoutCheckResult[] = [];
    this.trackedTasks.forEach((_, taskId) => {
      const result = this.checkTaskTimeout(taskId);
      if (result) {
        results.push(result);
      }
    });
    return results;
  }

  /**
   * Gets the number of tracked tasks.
   */
  getTrackedCount(): number {
    return this.trackedTasks.size;
  }

  /**
   * Clears all tracked tasks.
   */
  clearAll(): void {
    this.trackedTasks.clear();
  }

  /**
   * Updates the default timeout.
   */
  setDefaultTimeout(timeoutMs: number): void {
    this.defaultTimeoutMs = timeoutMs;
  }
}

/**
 * Factory function to create TaskTimeoutManager.
 */
export function createTaskTimeoutManager(options?: {
  checkIntervalMs?: number;
  defaultTimeoutMs?: number;
  trajectoryCapture?: TrajectoryCapture;
  signalAgentShutdown?: SignalAgentShutdownFn;
  failTaskWithTimeout?: FailTaskWithTimeoutFn;
}): TaskTimeoutManager {
  return new TaskTimeoutManager(options);
}

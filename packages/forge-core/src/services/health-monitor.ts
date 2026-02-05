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

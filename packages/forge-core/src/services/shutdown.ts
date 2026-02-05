import type { CheckpointService } from './checkpointing.js';

/**
 * Configuration for the shutdown handler
 */
export interface ShutdownHandlerConfig {
  /**
   * Maximum time to wait for in-progress tasks before forcing shutdown.
   * Default: 60 seconds (60000ms)
   * Can be overridden via FORGE_SHUTDOWN_TIMEOUT env var.
   */
  shutdownTimeoutMs: number;

  /**
   * Whether to automatically register signal handlers.
   * Default: true
   */
  autoRegisterSignals: boolean;
}

/**
 * Callback for handling shutdown phases
 */
export type ShutdownPhaseCallback = () => Promise<void> | void;

/**
 * State of the shutdown process
 */
export type ShutdownState = 'running' | 'graceful' | 'forced' | 'complete';

/**
 * Information about an in-progress task
 */
export interface InProgressTask {
  taskId: string;
  runId: string;
  agentId?: string;
}

/**
 * Function to get the list of in-progress tasks
 */
export type GetInProgressTasksFn = () => InProgressTask[];

/**
 * Function to stop accepting new runs
 */
export type StopAcceptingRunsFn = () => void;

/**
 * Function to stop enqueueing new tasks
 */
export type StopEnqueueingTasksFn = () => void;

/**
 * Function to terminate all agents
 */
export type TerminateAllAgentsFn = () => Promise<void>;

/**
 * Function to get active run IDs for checkpointing
 */
export type GetActiveRunIdsFn = () => string[];

const DEFAULT_CONFIG: ShutdownHandlerConfig = {
  shutdownTimeoutMs: parseInt(process.env.FORGE_SHUTDOWN_TIMEOUT ?? '60000', 10),
  autoRegisterSignals: true,
};

/**
 * ShutdownHandler manages graceful shutdown of the Forgemaster.
 *
 * On SIGTERM or SIGINT:
 * 1. Stop accepting new runs
 * 2. Stop enqueueing new tasks
 * 3. Wait for in-progress tasks to complete (up to timeout)
 * 4. Create final checkpoints for all active runs
 * 5. Terminate remaining agents
 *
 * This ensures that:
 * - No work is lost during shutdown
 * - Runs can be recovered from checkpoints on restart
 * - Resources are properly cleaned up
 */
export class ShutdownHandler {
  private config: ShutdownHandlerConfig;
  private state: ShutdownState = 'running';
  private shutdownPromise: Promise<void> | null = null;
  private shutdownResolve: (() => void) | null = null;

  // Callbacks for different shutdown phases
  private onShutdownStartCallbacks: ShutdownPhaseCallback[] = [];
  private onGracefulCompleteCallbacks: ShutdownPhaseCallback[] = [];
  private onForcedShutdownCallbacks: ShutdownPhaseCallback[] = [];
  private onShutdownCompleteCallbacks: ShutdownPhaseCallback[] = [];

  // Dependencies (injected)
  private checkpointService: CheckpointService | null = null;
  private getInProgressTasks: GetInProgressTasksFn | null = null;
  private stopAcceptingRuns: StopAcceptingRunsFn | null = null;
  private stopEnqueueingTasks: StopEnqueueingTasksFn | null = null;
  private terminateAllAgents: TerminateAllAgentsFn | null = null;
  private getActiveRunIds: GetActiveRunIdsFn | null = null;

  constructor(config: Partial<ShutdownHandlerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    if (this.config.autoRegisterSignals) {
      this.registerSignalHandlers();
    }
  }

  /**
   * Injects dependencies needed for shutdown operations.
   * Call this after constructing related services.
   */
  setDependencies(deps: {
    checkpointService?: CheckpointService;
    getInProgressTasks?: GetInProgressTasksFn;
    stopAcceptingRuns?: StopAcceptingRunsFn;
    stopEnqueueingTasks?: StopEnqueueingTasksFn;
    terminateAllAgents?: TerminateAllAgentsFn;
    getActiveRunIds?: GetActiveRunIdsFn;
  }): void {
    this.checkpointService = deps.checkpointService ?? this.checkpointService;
    this.getInProgressTasks = deps.getInProgressTasks ?? this.getInProgressTasks;
    this.stopAcceptingRuns = deps.stopAcceptingRuns ?? this.stopAcceptingRuns;
    this.stopEnqueueingTasks = deps.stopEnqueueingTasks ?? this.stopEnqueueingTasks;
    this.terminateAllAgents = deps.terminateAllAgents ?? this.terminateAllAgents;
    this.getActiveRunIds = deps.getActiveRunIds ?? this.getActiveRunIds;
  }

  /**
   * Registers handlers for SIGTERM and SIGINT signals.
   */
  registerSignalHandlers(): void {
    const handleSignal = (signal: string) => {
      console.log(`[ShutdownHandler] Received ${signal}`);
      this.initiateShutdown().catch((error) => {
        console.error('[ShutdownHandler] Error during shutdown:', error);
        process.exit(1);
      });
    };

    process.on('SIGTERM', () => handleSignal('SIGTERM'));
    process.on('SIGINT', () => handleSignal('SIGINT'));

    console.log('[ShutdownHandler] Signal handlers registered (SIGTERM, SIGINT)');
  }

  /**
   * Initiates the graceful shutdown process.
   *
   * @returns Promise that resolves when shutdown is complete
   */
  async initiateShutdown(): Promise<void> {
    // If already shutting down, return existing promise
    if (this.shutdownPromise) {
      console.log('[ShutdownHandler] Shutdown already in progress');
      return this.shutdownPromise;
    }

    // Create shutdown promise
    this.shutdownPromise = new Promise((resolve) => {
      this.shutdownResolve = resolve;
    });

    console.log('[ShutdownHandler] Initiating graceful shutdown...');
    this.state = 'graceful';

    // Notify shutdown start callbacks
    await this.runCallbacks(this.onShutdownStartCallbacks, 'onShutdownStart');

    // Step 1: Stop accepting new runs
    if (this.stopAcceptingRuns) {
      console.log('[ShutdownHandler] Stopping acceptance of new runs');
      this.stopAcceptingRuns();
    }

    // Step 2: Stop enqueueing new tasks
    if (this.stopEnqueueingTasks) {
      console.log('[ShutdownHandler] Stopping task enqueueing');
      this.stopEnqueueingTasks();
    }

    // Step 3: Wait for in-progress tasks
    const waitSucceeded = await this.waitForInProgressTasks();

    if (waitSucceeded) {
      await this.runCallbacks(this.onGracefulCompleteCallbacks, 'onGracefulComplete');
    } else {
      console.log('[ShutdownHandler] Timeout exceeded, forcing shutdown');
      this.state = 'forced';
      await this.runCallbacks(this.onForcedShutdownCallbacks, 'onForcedShutdown');
    }

    // Step 4: Create final checkpoints
    await this.createFinalCheckpoints();

    // Step 5: Terminate remaining agents
    if (this.terminateAllAgents) {
      console.log('[ShutdownHandler] Terminating remaining agents');
      try {
        await this.terminateAllAgents();
      } catch (error) {
        console.error('[ShutdownHandler] Error terminating agents:', error);
      }
    }

    // Complete shutdown
    this.state = 'complete';
    await this.runCallbacks(this.onShutdownCompleteCallbacks, 'onShutdownComplete');

    console.log('[ShutdownHandler] Shutdown complete');
    this.shutdownResolve?.();
  }

  /**
   * Waits for in-progress tasks to complete, up to the configured timeout.
   *
   * @returns true if all tasks completed, false if timeout was reached
   */
  private async waitForInProgressTasks(): Promise<boolean> {
    if (!this.getInProgressTasks) {
      console.log('[ShutdownHandler] No getInProgressTasks function, skipping wait');
      return true;
    }

    const startTime = Date.now();
    const checkInterval = 1000; // Check every second

    while (Date.now() - startTime < this.config.shutdownTimeoutMs) {
      const inProgress = this.getInProgressTasks();

      if (inProgress.length === 0) {
        console.log('[ShutdownHandler] All in-progress tasks completed');
        return true;
      }

      const elapsed = Math.round((Date.now() - startTime) / 1000);
      const remaining = Math.round((this.config.shutdownTimeoutMs - (Date.now() - startTime)) / 1000);
      console.log(
        `[ShutdownHandler] Waiting for ${inProgress.length} in-progress task(s)... ` +
        `(${elapsed}s elapsed, ${remaining}s remaining)`
      );

      await this.sleep(checkInterval);
    }

    // Timeout reached
    const remaining = this.getInProgressTasks();
    console.warn(
      `[ShutdownHandler] Timeout reached with ${remaining.length} task(s) still in progress: ` +
      remaining.map((t) => t.taskId).join(', ')
    );
    return false;
  }

  /**
   * Creates final checkpoints for all active runs.
   */
  private async createFinalCheckpoints(): Promise<void> {
    if (!this.checkpointService || !this.getActiveRunIds) {
      console.log('[ShutdownHandler] Checkpoint service not available, skipping final checkpoints');
      return;
    }

    const activeRunIds = this.getActiveRunIds();
    console.log(`[ShutdownHandler] Creating final checkpoints for ${activeRunIds.length} active run(s)`);

    for (const runId of activeRunIds) {
      try {
        await this.checkpointService.createCheckpoint(runId, 'manual');
        console.log(`[ShutdownHandler] Created final checkpoint for run ${runId}`);
      } catch (error) {
        console.error(`[ShutdownHandler] Failed to create checkpoint for run ${runId}:`, error);
      }
    }

    // Wait for any pending checkpoints
    await this.checkpointService.waitForPendingCheckpoints();
  }

  /**
   * Runs a list of callbacks, catching and logging any errors.
   */
  private async runCallbacks(
    callbacks: ShutdownPhaseCallback[],
    phaseName: string
  ): Promise<void> {
    for (const callback of callbacks) {
      try {
        await callback();
      } catch (error) {
        console.error(`[ShutdownHandler] Error in ${phaseName} callback:`, error);
      }
    }
  }

  /**
   * Registers a callback to be called when shutdown starts.
   */
  onShutdownStart(callback: ShutdownPhaseCallback): void {
    this.onShutdownStartCallbacks.push(callback);
  }

  /**
   * Registers a callback to be called when graceful shutdown completes.
   */
  onGracefulComplete(callback: ShutdownPhaseCallback): void {
    this.onGracefulCompleteCallbacks.push(callback);
  }

  /**
   * Registers a callback to be called when forced shutdown begins.
   */
  onForcedShutdown(callback: ShutdownPhaseCallback): void {
    this.onForcedShutdownCallbacks.push(callback);
  }

  /**
   * Registers a callback to be called when shutdown is complete.
   */
  onShutdownComplete(callback: ShutdownPhaseCallback): void {
    this.onShutdownCompleteCallbacks.push(callback);
  }

  /**
   * Gets the current shutdown state.
   */
  getState(): ShutdownState {
    return this.state;
  }

  /**
   * Whether shutdown has been initiated.
   */
  isShuttingDown(): boolean {
    return this.state !== 'running';
  }

  /**
   * Gets the current configuration.
   */
  getConfig(): ShutdownHandlerConfig {
    return { ...this.config };
  }

  /**
   * Updates the configuration.
   */
  updateConfig(updates: Partial<ShutdownHandlerConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Simple sleep utility.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

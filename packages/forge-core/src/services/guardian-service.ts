import type { ForgeStorage } from '../storage/interface.js';
import type {
  GuardianEvent,
  ActiveGuardian,
  GuardianConcernLevel,
} from '../domain/types.js';
import {
  createGuardianEvent,
  createActiveGuardian,
  GuardianStatus,
} from '../domain/types.js';
import { TrajectoryEventType } from '../domain/trajectory-events.js';
import type { TrajectoryCapture } from './trajectory-capture.js';
import type {
  GuardianConfig,
  GuardianType,
} from '../config/forge-config.js';
import { DEFAULT_GUARDIAN_TRIGGERS } from '../config/forge-config.js';

// ============================================
// Guardian Service Types
// ============================================

/**
 * Options for spawning a guardian agent
 */
export interface SpawnGuardianOptions {
  /** Guardian type (Security, Architect, QA, Compliance) */
  type: GuardianType;
  /** Configuration for the guardian */
  config: GuardianConfig;
  /** Project ID this guardian is watching */
  projectId: string;
  /** Optional custom agent name (defaults to guardian-{type}-{projectId}) */
  agentName?: string;
}

/**
 * Result of spawning a guardian
 */
export interface SpawnGuardianResult {
  /** The created guardian record */
  guardian: ActiveGuardian;
  /** Whether spawn was successful */
  success: boolean;
  /** Error message if spawn failed */
  error?: string;
}

/**
 * Options for recording a guardian observation
 */
export interface RecordObservationOptions {
  /** The guardian making the observation */
  guardianId: string;
  /** The observation text */
  observation: string;
  /** Concern level of the observation */
  concernLevel: GuardianConcernLevel;
  /** Optional recommendation */
  recommendation?: string;
  /** Optional run ID if observing a specific run */
  runId?: string;
  /** Optional task ID if observing a specific task */
  taskId?: string;
  /** Optional worker agent ID being observed */
  workerAgentId?: string;
  /** Optional trigger type that caused this observation */
  triggerType?: string;
  /** Optional intervention taken by the guardian */
  interventionTaken?: string;
}

/**
 * Trigger event that guardians receive
 */
export interface GuardianTriggerEvent {
  /** Type of trigger */
  triggerType: string;
  /** Source of the trigger (task, agent, etc.) */
  source: string;
  /** Project ID */
  projectId: string;
  /** Optional run ID */
  runId?: string;
  /** Optional task ID */
  taskId?: string;
  /** Optional worker agent ID */
  workerAgentId?: string;
  /** Payload data for the trigger */
  payload: Record<string, unknown>;
  /** Timestamp of the trigger */
  timestamp: string;
}

/**
 * Guardian retrospective summary
 */
export interface GuardianRetrospective {
  /** Guardian ID */
  guardianId: string;
  /** Guardian type */
  guardianType: GuardianType;
  /** Project ID */
  projectId: string;
  /** Run ID if specific to a run */
  runId?: string;
  /** Summary of observations during the period */
  summary: string;
  /** List of concerns raised */
  concerns: Array<{
    level: GuardianConcernLevel;
    observation: string;
    recommendation?: string;
    timestamp: string;
  }>;
  /** Overall assessment */
  assessment: 'clean' | 'minor_issues' | 'needs_attention' | 'critical';
  /** Key recommendations */
  recommendations: string[];
  /** Timestamp of retrospective */
  timestamp: string;
}

/**
 * Callback for sending messages to workers or humans
 */
export type SendMessageFn = (
  targetAgentId: string,
  message: string,
  metadata?: Record<string, unknown>
) => Promise<void>;

/**
 * Callback for alerting humans
 */
export type AlertHumanFn = (
  guardianId: string,
  concernLevel: GuardianConcernLevel,
  message: string,
  metadata?: Record<string, unknown>
) => Promise<void>;

// ============================================
// Guardian Service
// ============================================

/**
 * GuardianService manages the lifecycle and operations of guardian agents.
 *
 * Guardians are persistent agents that:
 * - Shadow worker agents via relay's shadow capability
 * - Monitor for specific concerns (security, architecture, QA, compliance)
 * - Intervene when triggers are detected
 * - Record observations in guardian trajectory
 * - Provide retrospectives on run completion
 */
export class GuardianService {
  private storage: ForgeStorage;
  private trajectoryCapture: TrajectoryCapture;
  private sendMessage?: SendMessageFn;
  private alertHuman?: AlertHumanFn;

  /** Map of active guardian instances by guardian_id */
  private activeGuardians: Map<string, ActiveGuardian> = new Map();

  /** Map of trigger subscriptions: trigger_type -> Set<guardian_id> */
  private triggerSubscriptions: Map<string, Set<string>> = new Map();

  constructor(
    storage: ForgeStorage,
    trajectoryCapture: TrajectoryCapture,
    options?: {
      sendMessage?: SendMessageFn;
      alertHuman?: AlertHumanFn;
    }
  ) {
    this.storage = storage;
    this.trajectoryCapture = trajectoryCapture;
    this.sendMessage = options?.sendMessage;
    this.alertHuman = options?.alertHuman;
  }

  // ============================================
  // Guardian Spawning
  // ============================================

  /**
   * Spawns a guardian agent for a project.
   *
   * The guardian will:
   * 1. Be registered in active_guardians table
   * 2. Subscribe to speak_on triggers
   * 3. Begin shadowing specified targets (if any)
   *
   * @param options - Spawn options
   * @returns Spawn result with guardian record
   */
  spawnGuardian(options: SpawnGuardianOptions): SpawnGuardianResult {
    const { type, config, projectId } = options;

    // Generate agent name if not provided
    const agentName = options.agentName ?? `guardian-${type.toLowerCase()}-${projectId.substring(0, 8)}`;

    // Get speak_on triggers (use defaults if not specified)
    const speakOn = config.speak_on.length > 0
      ? config.speak_on
      : (DEFAULT_GUARDIAN_TRIGGERS[type] as string[]) ?? [];

    // Get shadow targets
    const shadowTargets = config.shadow_targets ?? [];

    try {
      // Create guardian record
      const guardian = createActiveGuardian(
        projectId,
        type,
        agentName,
        shadowTargets,
        speakOn
      );

      // Store in database
      this.storage.createActiveGuardian(guardian);

      // Track locally
      this.activeGuardians.set(guardian.guardian_id, guardian);

      // Subscribe to triggers
      for (const trigger of speakOn) {
        if (!this.triggerSubscriptions.has(trigger)) {
          this.triggerSubscriptions.set(trigger, new Set());
        }
        this.triggerSubscriptions.get(trigger)!.add(guardian.guardian_id);
      }

      // Log spawn event
      this.trajectoryCapture.capture(
        '', // No specific run
        TrajectoryEventType.GuardianSpawned,
        {
          guardian_id: guardian.guardian_id,
          guardian_type: type,
          project_id: projectId,
          agent_name: agentName,
          shadow_targets: shadowTargets,
          speak_on: speakOn,
        }
      );

      return {
        guardian,
        success: true,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        guardian: null as unknown as ActiveGuardian,
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Stops a guardian agent.
   *
   * @param guardianId - ID of guardian to stop
   * @param error - Optional error if stopping due to failure
   * @returns Updated guardian record or null if not found
   */
  stopGuardian(guardianId: string, error?: string): ActiveGuardian | null {
    const guardian = this.activeGuardians.get(guardianId);
    if (!guardian) {
      // Try to get from storage
      const stored = this.storage.getActiveGuardian(guardianId);
      if (!stored) {
        return null;
      }
    }

    // Update in storage
    const updated = this.storage.stopGuardian(guardianId, error);
    if (!updated) {
      return null;
    }

    // Remove from local tracking
    this.activeGuardians.delete(guardianId);

    // Unsubscribe from triggers
    for (const subscribers of this.triggerSubscriptions.values()) {
      subscribers.delete(guardianId);
    }

    // Log stop event
    this.trajectoryCapture.capture(
      '', // No specific run
      TrajectoryEventType.GuardianStopped,
      {
        guardian_id: guardianId,
        guardian_type: updated.guardian_type,
        project_id: updated.project_id,
        error,
        duration_ms: updated.stopped_at && updated.spawned_at
          ? new Date(updated.stopped_at).getTime() - new Date(updated.spawned_at).getTime()
          : undefined,
      }
    );

    return updated;
  }

  // ============================================
  // Observation Recording
  // ============================================

  /**
   * Records an observation from a guardian.
   *
   * @param options - Observation options
   * @returns Created guardian event
   */
  recordObservation(options: RecordObservationOptions): GuardianEvent {
    const guardian = this.activeGuardians.get(options.guardianId)
      ?? this.storage.getActiveGuardian(options.guardianId);

    if (!guardian) {
      throw new Error(`Guardian not found: ${options.guardianId}`);
    }

    const event = createGuardianEvent(
      guardian.project_id,
      guardian.guardian_type,
      options.observation,
      options.concernLevel,
      options.recommendation,
      {
        runId: options.runId,
        taskId: options.taskId,
        workerAgentId: options.workerAgentId,
        triggerType: options.triggerType,
        interventionTaken: options.interventionTaken,
      }
    );

    this.storage.createGuardianEvent(event);

    // Also log to trajectory capture if we have a run
    if (options.runId) {
      this.trajectoryCapture.capture(
        options.runId,
        TrajectoryEventType.GuardianObservation,
        {
          guardian_id: options.guardianId,
          guardian_type: guardian.guardian_type,
          observation: options.observation,
          concern_level: options.concernLevel,
          recommendation: options.recommendation,
          worker_agent_id: options.workerAgentId,
          trigger_type: options.triggerType,
          intervention_taken: options.interventionTaken,
        },
        options.taskId
      );
    }

    return event;
  }

  // ============================================
  // Trigger Handling
  // ============================================

  /**
   * Processes a trigger event and notifies subscribed guardians.
   *
   * @param event - Trigger event
   * @returns List of guardian IDs that were notified
   */
  async processTrigger(event: GuardianTriggerEvent): Promise<string[]> {
    const subscribers = this.triggerSubscriptions.get(event.triggerType);
    if (!subscribers || subscribers.size === 0) {
      return [];
    }

    const notified: string[] = [];

    for (const guardianId of subscribers) {
      const guardian = this.activeGuardians.get(guardianId)
        ?? this.storage.getActiveGuardian(guardianId);

      if (!guardian || guardian.status !== GuardianStatus.Active) {
        continue;
      }

      // Check if guardian is watching this project
      if (guardian.project_id !== event.projectId) {
        continue;
      }

      // Check if guardian is shadowing the worker (if specified)
      if (event.workerAgentId && guardian.shadow_targets.length > 0) {
        if (!guardian.shadow_targets.includes(event.workerAgentId) &&
            !guardian.shadow_targets.includes('*')) {
          continue;
        }
      }

      notified.push(guardianId);

      // Trigger handler could invoke guardian's response logic here
      // For now, we just record that the trigger was delivered
      this.trajectoryCapture.capture(
        event.runId ?? '',
        TrajectoryEventType.GuardianTriggerReceived,
        {
          guardian_id: guardianId,
          trigger_type: event.triggerType,
          source: event.source,
          payload: event.payload,
        },
        event.taskId
      );
    }

    return notified;
  }

  // ============================================
  // Intervention
  // ============================================

  /**
   * Guardian intervenes by messaging a worker.
   *
   * @param guardianId - Guardian making the intervention
   * @param workerAgentId - Worker to message
   * @param message - Message content
   * @param concernLevel - Level of concern
   */
  async interveneWithWorker(
    guardianId: string,
    workerAgentId: string,
    message: string,
    concernLevel: GuardianConcernLevel
  ): Promise<void> {
    const guardian = this.activeGuardians.get(guardianId)
      ?? this.storage.getActiveGuardian(guardianId);

    if (!guardian) {
      throw new Error(`Guardian not found: ${guardianId}`);
    }

    if (this.sendMessage) {
      await this.sendMessage(workerAgentId, message, {
        from_guardian: guardianId,
        guardian_type: guardian.guardian_type,
        concern_level: concernLevel,
      });
    }

    // Record the intervention
    this.recordObservation({
      guardianId,
      observation: `Sent intervention message to worker ${workerAgentId}`,
      concernLevel,
      workerAgentId,
      interventionTaken: `message: ${message.substring(0, 100)}...`,
    });
  }

  /**
   * Guardian alerts a human about a concern.
   *
   * @param guardianId - Guardian raising the alert
   * @param message - Alert message
   * @param concernLevel - Level of concern
   * @param metadata - Additional metadata
   */
  async alertHumanOperator(
    guardianId: string,
    message: string,
    concernLevel: GuardianConcernLevel,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const guardian = this.activeGuardians.get(guardianId)
      ?? this.storage.getActiveGuardian(guardianId);

    if (!guardian) {
      throw new Error(`Guardian not found: ${guardianId}`);
    }

    if (this.alertHuman) {
      await this.alertHuman(guardianId, concernLevel, message, {
        guardian_type: guardian.guardian_type,
        project_id: guardian.project_id,
        ...metadata,
      });
    }

    // Record the alert
    this.recordObservation({
      guardianId,
      observation: `Raised human alert: ${message.substring(0, 100)}`,
      concernLevel,
      interventionTaken: 'human_alert',
    });
  }

  // ============================================
  // Retrospective
  // ============================================

  /**
   * Generates a retrospective summary for a guardian.
   *
   * @param guardianId - Guardian to generate retrospective for
   * @param runId - Optional specific run to summarize
   * @returns Retrospective summary
   */
  generateRetrospective(guardianId: string, runId?: string): GuardianRetrospective {
    const guardian = this.activeGuardians.get(guardianId)
      ?? this.storage.getActiveGuardian(guardianId);

    if (!guardian) {
      throw new Error(`Guardian not found: ${guardianId}`);
    }

    // Get all events for this guardian
    const events = this.storage.listGuardianEvents(guardian.project_id, {
      guardian_type: guardian.guardian_type,
      run_id: runId,
    });

    // Count concerns by level
    const concernCounts = this.storage.countGuardianEventsByConcernLevel(guardian.project_id);

    // Build concerns list
    const concerns = events.map(e => ({
      level: e.concern_level,
      observation: e.observation,
      recommendation: e.recommendation,
      timestamp: e.timestamp,
    }));

    // Determine overall assessment
    let assessment: GuardianRetrospective['assessment'] = 'clean';
    if (concernCounts.critical > 0) {
      assessment = 'critical';
    } else if (concernCounts.warning > 3) {
      assessment = 'needs_attention';
    } else if (concernCounts.warning > 0 || concernCounts.info > 5) {
      assessment = 'minor_issues';
    }

    // Collect unique recommendations
    const recommendations = [...new Set(
      events
        .filter(e => e.recommendation)
        .map(e => e.recommendation!)
    )];

    // Generate summary
    const summary = this.generateSummaryText(guardian, events, concernCounts);

    const retrospective: GuardianRetrospective = {
      guardianId,
      guardianType: guardian.guardian_type,
      projectId: guardian.project_id,
      runId,
      summary,
      concerns,
      assessment,
      recommendations,
      timestamp: new Date().toISOString(),
    };

    // Store retrospective as a guardian event
    this.recordObservation({
      guardianId,
      observation: `Retrospective: ${summary}`,
      concernLevel: assessment === 'critical' ? 'critical' :
                   assessment === 'needs_attention' ? 'warning' : 'info',
      runId,
      triggerType: 'retrospective',
    });

    return retrospective;
  }

  private generateSummaryText(
    guardian: ActiveGuardian,
    events: GuardianEvent[],
    counts: Record<GuardianConcernLevel, number>
  ): string {
    const total = events.length;
    if (total === 0) {
      return `${guardian.guardian_type} guardian observed no issues during monitoring period.`;
    }

    const parts: string[] = [];
    parts.push(`${guardian.guardian_type} guardian recorded ${total} observations:`);

    if (counts.critical > 0) {
      parts.push(`${counts.critical} critical`);
    }
    if (counts.warning > 0) {
      parts.push(`${counts.warning} warnings`);
    }
    if (counts.info > 0) {
      parts.push(`${counts.info} informational`);
    }

    return parts.join(' ');
  }

  // ============================================
  // Query Methods
  // ============================================

  /**
   * Gets a guardian by ID.
   */
  getGuardian(guardianId: string): ActiveGuardian | null {
    return this.activeGuardians.get(guardianId)
      ?? this.storage.getActiveGuardian(guardianId);
  }

  /**
   * Lists active guardians for a project.
   */
  listGuardians(projectId: string): ActiveGuardian[] {
    return this.storage.listActiveGuardians(projectId, GuardianStatus.Active);
  }

  /**
   * Lists all active guardians across all projects.
   */
  listAllActiveGuardians(): ActiveGuardian[] {
    return this.storage.getAllActiveGuardians();
  }

  /**
   * Gets guardian events/trajectory for a guardian type.
   */
  getGuardianTrajectory(
    projectId: string,
    guardianType: GuardianType
  ): GuardianEvent[] {
    return this.storage.getGuardianEventsByType(projectId, guardianType);
  }

  /**
   * Initializes guardians from storage on service startup.
   * Call this to restore guardian state after restart.
   */
  restoreGuardians(projectId?: string): void {
    const guardians = projectId
      ? this.storage.listActiveGuardians(projectId, GuardianStatus.Active)
      : this.storage.getAllActiveGuardians();

    for (const guardian of guardians) {
      this.activeGuardians.set(guardian.guardian_id, guardian);

      // Restore trigger subscriptions
      for (const trigger of guardian.speak_on) {
        if (!this.triggerSubscriptions.has(trigger)) {
          this.triggerSubscriptions.set(trigger, new Set());
        }
        this.triggerSubscriptions.get(trigger)!.add(guardian.guardian_id);
      }
    }
  }
}

// ============================================
// Factory Function
// ============================================

/**
 * Creates a new GuardianService instance.
 */
export function createGuardianService(
  storage: ForgeStorage,
  trajectoryCapture: TrajectoryCapture,
  options?: {
    sendMessage?: SendMessageFn;
    alertHuman?: AlertHumanFn;
  }
): GuardianService {
  return new GuardianService(storage, trajectoryCapture, options);
}

import { EventEmitter } from 'events';
import type { ForgeStorage, TrajectoryEventFilter } from '../storage/interface.js';
import type { TrajectoryCapture } from './trajectory-capture.js';
import type { Task, TrajectoryEvent } from '../domain/types.js';
import {
  RetrospectiveSchema,
  type Retrospective,
  type LinkedRetrospective,
  type LinkedRetrospectiveDecision,
  type RetrospectiveResult,
  type RetrospectiveSuccess,
  type RetrospectiveTimeoutResult,
  type RetrospectiveParseErrorResult,
  type RetrospectiveValidationErrorResult,
} from '../domain/retrospective.js';
import { TrajectoryEventType } from '../domain/trajectory-events.js';
import {
  generateRetrospectivePrompt,
  type RetrospectivePromptContext,
  type RetrospectivePromptConfig,
  DEFAULT_RETROSPECTIVE_CONFIG,
} from '../templates/retrospective-prompt.js';
import {
  levenshteinDistance,
  combinedTextSimilarity,
} from '../domain/user-trajectory.js';

// ============================================
// Types
// ============================================

/**
 * Function signature for sending a relay message to an agent.
 */
export type SendRelayMessageFn = (
  agentId: string,
  message: string
) => Promise<void>;

/**
 * Function signature for receiving a response from an agent.
 * Should resolve with the agent's response text, or reject on timeout.
 */
export type WaitForAgentResponseFn = (
  agentId: string,
  timeoutMs: number
) => Promise<string>;

/**
 * Options for injecting a retrospective prompt.
 */
export interface InjectRetrospectiveOptions {
  /** The task that was completed */
  task: Task;
  /** The agent ID that completed the task */
  agentId: string;
  /** Optional task description */
  taskDescription?: string;
  /** Optional acceptance criteria */
  acceptanceCriteria?: string[];
  /** Optional override for timeout (defaults to config) */
  timeoutMs?: number;
  /** Last message from the agent (for timeout events) */
  agentLastMessage?: string;
}

/**
 * Events emitted by RetrospectiveService.
 */
export interface RetrospectiveServiceEvents {
  retrospective_recorded: (event: {
    taskId: string;
    agentId: string;
    retrospective: LinkedRetrospective;
    eventId: string;
  }) => void;
  retrospective_timeout: (event: {
    taskId: string;
    agentId: string;
    timeoutMs: number;
    eventId: string;
  }) => void;
  retrospective_error: (event: {
    taskId: string;
    agentId: string;
    error: string;
    eventId: string;
  }) => void;
}

// ============================================
// RetrospectiveService
// ============================================

/**
 * RetrospectiveService handles capturing structured reflections from agents
 * after task completion.
 *
 * Features:
 * - Injects retrospective prompts after task completion
 * - Parses and validates retrospective responses
 * - Links decisions to earlier record_decision calls
 * - Stores all outcomes (success, timeout, errors) as trajectory events
 */
export class RetrospectiveService extends EventEmitter {
  private storage: ForgeStorage;
  private trajectoryCapture: TrajectoryCapture;
  private config: RetrospectivePromptConfig;
  private sendRelayMessage: SendRelayMessageFn;
  private waitForAgentResponse: WaitForAgentResponseFn;

  constructor(
    storage: ForgeStorage,
    trajectoryCapture: TrajectoryCapture,
    sendRelayMessage: SendRelayMessageFn,
    waitForAgentResponse: WaitForAgentResponseFn,
    config?: Partial<RetrospectivePromptConfig>
  ) {
    super();
    this.storage = storage;
    this.trajectoryCapture = trajectoryCapture;
    this.sendRelayMessage = sendRelayMessage;
    this.waitForAgentResponse = waitForAgentResponse;
    this.config = { ...DEFAULT_RETROSPECTIVE_CONFIG, ...config };
  }

  /**
   * Checks if retrospective prompting is enabled.
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Injects a retrospective prompt to an agent and waits for response.
   * Handles timeout, parsing errors, and validation errors.
   *
   * @param options - Options for the retrospective injection
   * @returns The retrospective result (success, timeout, or error)
   */
  async injectRetrospectivePrompt(
    options: InjectRetrospectiveOptions
  ): Promise<RetrospectiveResult> {
    const { task, agentId, taskDescription, acceptanceCriteria, agentLastMessage } = options;
    const timeoutMs = options.timeoutMs ?? this.config.timeoutMs;

    // Generate the prompt
    const promptContext: RetrospectivePromptContext = {
      taskTitle: task.step_title,
      taskDescription,
      stepId: task.step_id,
      acceptanceCriteria,
      projectContext: this.config.projectContext,
      additionalInstructions: this.config.additionalInstructions,
    };

    const prompt = generateRetrospectivePrompt(promptContext, this.config.customTemplate);

    // Send the prompt to the agent
    try {
      await this.sendRelayMessage(agentId, prompt);
    } catch (err) {
      // If we can't send the message, record as timeout (agent may be gone)
      return this.handleTimeout(
        task,
        agentId,
        timeoutMs,
        agentLastMessage,
        `Failed to send retrospective prompt: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    // Wait for the agent's response
    let response: string;
    try {
      response = await this.waitForAgentResponse(agentId, timeoutMs);
    } catch (err) {
      // Timeout or error waiting for response
      const reason = err instanceof Error ? err.message : 'Timeout waiting for retrospective response';
      return this.handleTimeout(task, agentId, timeoutMs, agentLastMessage, reason);
    }

    // Parse and validate the response
    return this.parseAndStoreRetrospective(task, agentId, response);
  }

  /**
   * Parses a retrospective response and stores the result.
   *
   * @param task - The task the retrospective is for
   * @param agentId - The agent that provided the response
   * @param response - The raw response text from the agent
   * @returns The parsed and stored retrospective result
   */
  parseAndStoreRetrospective(
    task: Task,
    agentId: string,
    response: string
  ): RetrospectiveResult {
    // Try to parse as JSON
    let parsed: unknown;
    try {
      // Try to extract JSON from response (in case of markdown code blocks)
      const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/) ||
                        response.match(/(\{[\s\S]*\})/);
      const jsonStr = jsonMatch?.[1]?.trim() ?? response.trim();
      parsed = JSON.parse(jsonStr);
    } catch (err) {
      return this.handleParseError(
        task,
        agentId,
        response,
        `Invalid JSON: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    // Validate against schema
    const validationResult = RetrospectiveSchema.safeParse(parsed);
    if (!validationResult.success) {
      return this.handleValidationError(task, agentId, response, validationResult.error.issues);
    }

    const retrospective = validationResult.data;

    // Link decisions to earlier record_decision calls
    const linkedRetrospective = this.linkDecisions(task.task_id, retrospective);

    // Store as trajectory event
    const event = this.trajectoryCapture.capture(
      task.run_id,
      TrajectoryEventType.RetrospectiveRecorded,
      {
        task_id: task.task_id,
        agent_id: agentId,
        retrospective: linkedRetrospective,
      },
      task.task_id
    );

    const result: RetrospectiveSuccess = {
      status: 'success',
      retrospective: linkedRetrospective,
      event_id: event?.event_id ?? '',
    };

    this.emit('retrospective_recorded', {
      taskId: task.task_id,
      agentId,
      retrospective: linkedRetrospective,
      eventId: event?.event_id ?? '',
    });

    return result;
  }

  /**
   * Links retrospective decisions to earlier record_decision trajectory events.
   * Uses fuzzy matching on the question text.
   *
   * @param taskId - The task ID to look up decisions for
   * @param retrospective - The retrospective to link decisions in
   * @returns The retrospective with linked decision event IDs
   */
  linkDecisions(taskId: string, retrospective: Retrospective): LinkedRetrospective {
    // Get all decision_recorded events for this task
    const task = this.storage.getTask(taskId);
    if (!task) {
      return {
        ...retrospective,
        decisions: retrospective.decisions.map((d) => ({ ...d, linked_event_ids: [] })),
      };
    }

    const filter: TrajectoryEventFilter = {
      task_id: taskId,
      event_type: TrajectoryEventType.DecisionRecorded,
    };

    const decisionEvents = this.storage.listTrajectoryEvents(task.run_id, filter);

    // Link each retrospective decision to matching events
    const linkedDecisions: LinkedRetrospectiveDecision[] = retrospective.decisions.map(
      (decision) => {
        const linkedEventIds: string[] = [];

        for (const event of decisionEvents) {
          const payload = event.payload as {
            decision?: string;
            context?: { question?: string };
          };

          // Match by question similarity
          const eventQuestion = payload.context?.question ?? '';
          const eventDecision = payload.decision ?? '';

          // Check similarity between retrospective question and event question
          const questionSimilarity = combinedTextSimilarity(
            decision.question.toLowerCase(),
            eventQuestion.toLowerCase()
          );

          // Also check if the chosen decision matches
          const decisionSimilarity = combinedTextSimilarity(
            decision.chosen.toLowerCase(),
            eventDecision.toLowerCase()
          );

          // Consider a match if either question or decision is very similar
          // Using a threshold of 0.6 for fuzzy matching
          if (questionSimilarity >= 0.6 || decisionSimilarity >= 0.6) {
            linkedEventIds.push(event.event_id);
          }
        }

        return {
          ...decision,
          linked_event_ids: linkedEventIds.length > 0 ? linkedEventIds : undefined,
        };
      }
    );

    return {
      ...retrospective,
      decisions: linkedDecisions,
    };
  }

  /**
   * Handles timeout when waiting for retrospective response.
   */
  private handleTimeout(
    task: Task,
    agentId: string,
    timeoutMs: number,
    agentLastMessage?: string,
    reason?: string
  ): RetrospectiveTimeoutResult {
    const event = this.trajectoryCapture.capture(
      task.run_id,
      TrajectoryEventType.RetrospectiveTimeout,
      {
        task_id: task.task_id,
        agent_id: agentId,
        timeout_duration_ms: timeoutMs,
        agent_last_message: agentLastMessage,
        reason: reason ?? 'Timeout waiting for retrospective response',
      },
      task.task_id
    );

    const result: RetrospectiveTimeoutResult = {
      status: 'timeout',
      timeout_duration_ms: timeoutMs,
      event_id: event?.event_id ?? '',
    };

    this.emit('retrospective_timeout', {
      taskId: task.task_id,
      agentId,
      timeoutMs,
      eventId: event?.event_id ?? '',
    });

    return result;
  }

  /**
   * Handles JSON parse errors.
   */
  private handleParseError(
    task: Task,
    agentId: string,
    rawResponse: string,
    parseError: string
  ): RetrospectiveParseErrorResult {
    const event = this.trajectoryCapture.capture(
      task.run_id,
      TrajectoryEventType.RetrospectiveParseError,
      {
        task_id: task.task_id,
        agent_id: agentId,
        raw_response: rawResponse,
        parse_error: parseError,
      },
      task.task_id
    );

    const result: RetrospectiveParseErrorResult = {
      status: 'parse_error',
      raw_response: rawResponse,
      parse_error: parseError,
      event_id: event?.event_id ?? '',
    };

    this.emit('retrospective_error', {
      taskId: task.task_id,
      agentId,
      error: `Parse error: ${parseError}`,
      eventId: event?.event_id ?? '',
    });

    return result;
  }

  /**
   * Handles schema validation errors.
   */
  private handleValidationError(
    task: Task,
    agentId: string,
    rawResponse: string,
    issues: Array<{ path: (string | number)[]; message: string }>
  ): RetrospectiveValidationErrorResult {
    const validationErrors = issues.map((issue) => ({
      path: issue.path,
      message: issue.message,
    }));

    const event = this.trajectoryCapture.capture(
      task.run_id,
      TrajectoryEventType.RetrospectiveValidationError,
      {
        task_id: task.task_id,
        agent_id: agentId,
        raw_response: rawResponse,
        validation_errors: validationErrors,
      },
      task.task_id
    );

    const result: RetrospectiveValidationErrorResult = {
      status: 'validation_error',
      raw_response: rawResponse,
      validation_errors: validationErrors,
      event_id: event?.event_id ?? '',
    };

    this.emit('retrospective_error', {
      taskId: task.task_id,
      agentId,
      error: `Validation errors: ${validationErrors.map((e) => e.message).join(', ')}`,
      eventId: event?.event_id ?? '',
    });

    return result;
  }

  /**
   * Retrieves a retrospective result for a task from trajectory events.
   *
   * @param taskId - The task ID to get retrospective for
   * @returns The retrospective result if found, null otherwise
   */
  getRetrospectiveForTask(taskId: string): RetrospectiveResult | null {
    const task = this.storage.getTask(taskId);
    if (!task) {
      return null;
    }

    // Look for retrospective events for this task
    const allEvents = this.storage.listTrajectoryEvents(task.run_id, { task_id: taskId });

    // Check for each type of retrospective event in order of preference
    for (const event of allEvents) {
      if (event.event_type === TrajectoryEventType.RetrospectiveRecorded) {
        const payload = event.payload as {
          retrospective: LinkedRetrospective;
        };
        return {
          status: 'success',
          retrospective: payload.retrospective,
          event_id: event.event_id,
        };
      }

      if (event.event_type === TrajectoryEventType.RetrospectiveTimeout) {
        const payload = event.payload as {
          timeout_duration_ms: number;
        };
        return {
          status: 'timeout',
          timeout_duration_ms: payload.timeout_duration_ms,
          event_id: event.event_id,
        };
      }

      if (event.event_type === TrajectoryEventType.RetrospectiveParseError) {
        const payload = event.payload as {
          raw_response: string;
          parse_error: string;
        };
        return {
          status: 'parse_error',
          raw_response: payload.raw_response,
          parse_error: payload.parse_error,
          event_id: event.event_id,
        };
      }

      if (event.event_type === TrajectoryEventType.RetrospectiveValidationError) {
        const payload = event.payload as {
          raw_response: string;
          validation_errors: Array<{ path: (string | number)[]; message: string }>;
        };
        return {
          status: 'validation_error',
          raw_response: payload.raw_response,
          validation_errors: payload.validation_errors,
          event_id: event.event_id,
        };
      }
    }

    return null;
  }
}

// ============================================
// Factory Function
// ============================================

/**
 * Creates a new RetrospectiveService instance.
 */
export function createRetrospectiveService(
  storage: ForgeStorage,
  trajectoryCapture: TrajectoryCapture,
  sendRelayMessage: SendRelayMessageFn,
  waitForAgentResponse: WaitForAgentResponseFn,
  config?: Partial<RetrospectivePromptConfig>
): RetrospectiveService {
  return new RetrospectiveService(
    storage,
    trajectoryCapture,
    sendRelayMessage,
    waitForAgentResponse,
    config
  );
}

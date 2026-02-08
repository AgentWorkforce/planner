/**
 * API client for Forge CLI
 *
 * Provides methods for all Forge API operations using native fetch.
 */

import type {
  Run,
  Task,
  ForgePlan,
  Gate,
  Question,
  TrajectoryEvent,
} from '../domain/types.js';

// ============================================
// Types
// ============================================

/**
 * API error response
 */
export interface ApiError {
  error: string;
  details?: string;
}

/**
 * Run list response
 */
export interface ListRunsResponse {
  runs: Run[];
  total: number;
}

/**
 * Run detail response
 */
export interface RunDetailResponse {
  run: Run;
  tasks: Task[];
}

/**
 * Trajectory response
 */
export interface TrajectoryResponse {
  events: TrajectoryEvent[];
  total: number;
  has_more: boolean;
}

/**
 * Trajectory stats response
 */
export interface TrajectoryStatsResponse {
  total_events: number;
  events_by_type: Record<string, number>;
  first_event?: string;
  last_event?: string;
}

/**
 * Pending gates response
 */
export interface PendingGatesResponse {
  gates: Array<
    Gate & {
      run_id: string;
      step_id: string;
      step_title: string;
    }
  >;
}

/**
 * Pending questions response
 */
export interface PendingQuestionsResponse {
  questions: Question[];
}

// ============================================
// API Client Class
// ============================================

/**
 * Forge API client for CLI operations.
 *
 * Uses native fetch for HTTP requests with descriptive error handling.
 */
export class ForgeApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    // Remove trailing slash if present
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  // ============================================
  // Private helpers
  // ============================================

  /**
   * Make an HTTP request and handle errors
   */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (body !== undefined) {
      options.body = JSON.stringify(body);
    }

    let response: Response;
    try {
      response = await fetch(url, options);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Connection failed: ${message}. Is the Forge API running at ${this.baseUrl}?`);
    }

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errorBody = (await response.json()) as ApiError;
        if (errorBody.error) {
          errorMessage = errorBody.error;
          if (errorBody.details) {
            errorMessage += `: ${errorBody.details}`;
          }
        }
      } catch {
        // Ignore JSON parse errors for error response
      }
      throw new Error(errorMessage);
    }

    // Handle empty responses (204 No Content)
    if (
      response.status === 204 ||
      response.headers.get('content-length') === '0'
    ) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  // ============================================
  // Run Operations
  // ============================================

  /**
   * List runs with optional status filter
   */
  async listRuns(status?: string): Promise<ListRunsResponse> {
    const params = status ? `?status=${encodeURIComponent(status)}` : '';
    return this.request<ListRunsResponse>('GET', `/runs${params}`);
  }

  /**
   * Get a single run by ID
   */
  async getRun(runId: string): Promise<RunDetailResponse> {
    return this.request<RunDetailResponse>('GET', `/runs/${runId}`);
  }

  /**
   * Start a new run from a plan
   */
  async startRun(plan: ForgePlan): Promise<RunDetailResponse> {
    return this.request<RunDetailResponse>('POST', '/runs', plan);
  }

  /**
   * Pause a running run
   */
  async pauseRun(runId: string): Promise<Run> {
    return this.request<Run>('POST', `/runs/${runId}/pause`);
  }

  /**
   * Resume a paused run
   */
  async resumeRun(runId: string): Promise<Run> {
    return this.request<Run>('POST', `/runs/${runId}/resume`);
  }

  /**
   * Cancel a run
   */
  async cancelRun(runId: string): Promise<Run> {
    return this.request<Run>('POST', `/runs/${runId}/cancel`);
  }

  // ============================================
  // Trajectory Operations
  // ============================================

  /**
   * Get trajectory events for a run
   */
  async getTrajectory(
    runId: string,
    options?: {
      taskId?: string;
      eventType?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<TrajectoryResponse> {
    const params = new URLSearchParams();
    if (options?.taskId) params.set('task_id', options.taskId);
    if (options?.eventType) params.set('event_type', options.eventType);
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.offset) params.set('offset', String(options.offset));

    const queryString = params.toString();
    const path = `/runs/${runId}/trajectory${queryString ? `?${queryString}` : ''}`;
    return this.request<TrajectoryResponse>('GET', path);
  }

  /**
   * Get trajectory statistics for a run
   */
  async getTrajectoryStats(runId: string): Promise<TrajectoryStatsResponse> {
    return this.request<TrajectoryStatsResponse>(
      'GET',
      `/runs/${runId}/trajectory/stats`
    );
  }

  /**
   * Export full trajectory for a run
   */
  async exportTrajectory(
    runId: string,
    format: 'json' | 'markdown' = 'json'
  ): Promise<TrajectoryResponse | string> {
    // Get all events
    const result = await this.getTrajectory(runId, { limit: 10000 });

    if (format === 'json') {
      return result;
    }

    // Format as markdown
    return this.formatTrajectoryAsMarkdown(runId, result.events);
  }

  /**
   * Search trajectory events
   * Note: This is a client-side implementation since the API doesn't have a search endpoint yet
   */
  async searchTrajectory(
    query: string,
    runId?: string
  ): Promise<TrajectoryEvent[]> {
    if (!runId) {
      // Get all active runs and search across them
      const { runs } = await this.listRuns();
      const results: TrajectoryEvent[] = [];

      for (const run of runs.slice(0, 10)) {
        // Limit to 10 runs
        const trajectory = await this.getTrajectory(run.run_id);
        const matches = trajectory.events.filter((event) => {
          const payloadStr = JSON.stringify(event.payload).toLowerCase();
          return payloadStr.includes(query.toLowerCase());
        });
        results.push(...matches);
      }

      return results;
    }

    const trajectory = await this.getTrajectory(runId);
    return trajectory.events.filter((event) => {
      const payloadStr = JSON.stringify(event.payload).toLowerCase();
      return payloadStr.includes(query.toLowerCase());
    });
  }

  /**
   * Format trajectory events as markdown
   */
  private formatTrajectoryAsMarkdown(
    runId: string,
    events: TrajectoryEvent[]
  ): string {
    const lines: string[] = [
      `# Run ${runId} Trajectory`,
      '',
    ];

    // Group events by task
    const eventsByTask = new Map<string, TrajectoryEvent[]>();
    const generalEvents: TrajectoryEvent[] = [];

    for (const event of events) {
      if (event.task_id) {
        const existing = eventsByTask.get(event.task_id) ?? [];
        existing.push(event);
        eventsByTask.set(event.task_id, existing);
      } else {
        generalEvents.push(event);
      }
    }

    // General events section
    if (generalEvents.length > 0) {
      lines.push('## General Events', '');
      for (const event of generalEvents) {
        const time = new Date(event.timestamp).toLocaleTimeString();
        lines.push(`- [${time}] **${event.event_type}**`);
        if (Object.keys(event.payload).length > 0) {
          lines.push(`  \`\`\`json`);
          lines.push(`  ${JSON.stringify(event.payload, null, 2).split('\n').join('\n  ')}`);
          lines.push(`  \`\`\``);
        }
      }
      lines.push('');
    }

    // Task-specific events
    for (const [taskId, taskEvents] of eventsByTask) {
      lines.push(`## Task: ${taskId}`, '');
      lines.push('### Events', '');

      for (const event of taskEvents) {
        const time = new Date(event.timestamp).toLocaleTimeString();
        const summary = this.getEventSummary(event);
        lines.push(`- [${time}] ${event.event_type}${summary ? `: ${summary}` : ''}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Get a summary string for an event
   */
  private getEventSummary(event: TrajectoryEvent): string {
    const payload = event.payload as Record<string, unknown>;

    switch (event.event_type) {
      case 'decision_recorded':
        return String(payload['summary'] ?? payload['decision'] ?? '');
      case 'progress_reported':
        return String(payload['message'] ?? '');
      case 'task_started':
        return String(payload['agent_id'] ?? '');
      case 'task_completed':
        return 'completed';
      case 'task_failed':
        return String(payload['error'] ?? 'failed');
      default:
        return '';
    }
  }

  // ============================================
  // Gate Operations
  // ============================================

  /**
   * List pending gates
   */
  async listPendingGates(): Promise<PendingGatesResponse> {
    return this.request<PendingGatesResponse>('GET', '/gates/pending');
  }

  /**
   * Approve a gate
   */
  async approveGate(taskId: string, comment?: string): Promise<Gate> {
    const body = comment ? { comment } : {};
    return this.request<Gate>('POST', `/gates/${taskId}/approve`, body);
  }

  /**
   * Reject a gate
   */
  async rejectGate(taskId: string, reason: string): Promise<Gate> {
    return this.request<Gate>('POST', `/gates/${taskId}/reject`, { reason });
  }

  // ============================================
  // Question Operations
  // ============================================

  /**
   * List pending questions
   */
  async listPendingQuestions(): Promise<PendingQuestionsResponse> {
    return this.request<PendingQuestionsResponse>('GET', '/questions/pending');
  }

  /**
   * Answer a question
   */
  async answerQuestion(questionId: string, answer: string): Promise<Question> {
    return this.request<Question>('POST', `/questions/${questionId}/answer`, {
      answer,
    });
  }

  /**
   * Dismiss a question
   */
  async dismissQuestion(questionId: string): Promise<Question> {
    return this.request<Question>('POST', `/questions/${questionId}/dismiss`);
  }
}

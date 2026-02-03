import { z } from 'zod';
import type { PlannerConfig } from '../config/forge-config.js';
import type { RunStatus } from '../domain/types.js';

/**
 * Plan status from Planner service.
 */
export type PlanStatus = 'draft' | 'approved' | 'published';

/**
 * AcceptanceCriterion from Planner.
 */
export interface PlannerAcceptanceCriterion {
  id: string;
  description: string;
  type?: string;
}

/**
 * Gate configuration from Planner.
 */
export interface PlannerGate {
  type: 'human_approval';
  approver_role?: string;
}

/**
 * Step from Planner PlanVersion.
 */
export interface PlannerStep {
  step_id: string;
  title: string;
  scope?: string;
  description?: string;
  dependencies: string[];
  owner_role?: string;
  acceptance_criteria?: PlannerAcceptanceCriterion[];
  gate?: PlannerGate;
  sub_plan_id?: string;
}

/**
 * Summary from Planner PlanVersion.
 */
export interface PlannerSummary {
  goal: string;
  context?: string;
}

/**
 * PlanVersion as returned from Planner API.
 */
export interface PlanVersion {
  plan_id: string;
  version: number;
  status: PlanStatus;
  summary: PlannerSummary;
  steps: PlannerStep[];
  submitted_at?: string;
  approval_info?: {
    approved_by?: string;
    approved_at?: string;
    comment?: string;
  };
  change_request_id?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/**
 * Schema for validating PlanVersion from API response.
 */
export const PlanVersionResponseSchema = z.object({
  plan_id: z.string().uuid(),
  version: z.number().int().positive(),
  status: z.enum(['draft', 'approved', 'published']),
  summary: z.object({
    goal: z.string(),
    context: z.string().optional(),
  }),
  steps: z.array(
    z.object({
      step_id: z.string(),
      title: z.string(),
      scope: z.string().optional(),
      description: z.string().optional(),
      dependencies: z.array(z.string()).default([]),
      owner_role: z.string().optional(),
      acceptance_criteria: z
        .array(
          z.object({
            id: z.string(),
            description: z.string(),
            type: z.string().optional(),
          })
        )
        .optional(),
      gate: z
        .object({
          type: z.literal('human_approval'),
          approver_role: z.string().optional(),
        })
        .optional(),
      sub_plan_id: z.string().uuid().optional(),
    })
  ),
  submitted_at: z.string().datetime().optional(),
  approval_info: z
    .object({
      approved_by: z.string().optional(),
      approved_at: z.string().datetime().optional(),
      comment: z.string().optional(),
    })
    .optional(),
  change_request_id: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

/**
 * Run status update payload.
 */
export interface RunStatusUpdate {
  run_id: string;
  status: RunStatus;
  started_at?: string;
  completed_at?: string;
  error?: string;
  tasks_completed?: number;
  tasks_total?: number;
}

/**
 * Schema for RunStatusUpdate.
 */
export const RunStatusUpdateSchema = z.object({
  run_id: z.string().uuid(),
  status: z.enum(['pending', 'running', 'paused', 'completed', 'failed', 'cancelled']),
  started_at: z.string().datetime().optional(),
  completed_at: z.string().datetime().optional(),
  error: z.string().optional(),
  tasks_completed: z.number().int().optional(),
  tasks_total: z.number().int().optional(),
});

/**
 * Change request payload for structural changes needed in a plan.
 */
export interface ChangeRequest {
  run_id: string;
  task_id?: string;
  reason: string;
  suggested_changes?: SuggestedChange[];
}

/**
 * Individual suggested change within a ChangeRequest.
 */
export interface SuggestedChange {
  type: 'add_step' | 'remove_step' | 'modify_step' | 'add_dependency' | 'remove_dependency';
  step_id?: string;
  description: string;
  details?: Record<string, unknown>;
}

/**
 * Schema for ChangeRequest.
 */
export const ChangeRequestSchema = z.object({
  run_id: z.string().uuid(),
  task_id: z.string().uuid().optional(),
  reason: z.string().min(1),
  suggested_changes: z
    .array(
      z.object({
        type: z.enum([
          'add_step',
          'remove_step',
          'modify_step',
          'add_dependency',
          'remove_dependency',
        ]),
        step_id: z.string().optional(),
        description: z.string(),
        details: z.record(z.unknown()).optional(),
      })
    )
    .optional(),
});

/**
 * Response from creating a change request.
 */
export interface ChangeRequestResponse {
  change_request_id: string;
  plan_id: string;
  created_at: string;
}

/**
 * Error response from Planner API.
 */
export class PlannerApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly response?: unknown
  ) {
    super(message);
    this.name = 'PlannerApiError';
  }
}

/**
 * PlannerClient provides access to the Planner API for fetching plans,
 * reporting run status, and creating change requests.
 */
export class PlannerClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly timeoutMs: number;

  constructor(config: PlannerConfig) {
    // Remove trailing slash from base URL
    this.baseUrl = config.base_url.replace(/\/+$/, '');
    this.apiKey = config.api_key;
    this.timeoutMs = config.timeout_ms ?? 30000;
  }

  /**
   * Creates request headers including authorization if API key is configured.
   */
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    return headers;
  }

  /**
   * Performs an HTTP request with timeout handling.
   */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        headers: this.getHeaders(),
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        let responseBody: unknown;
        try {
          responseBody = await response.json();
        } catch {
          responseBody = await response.text();
        }
        throw new PlannerApiError(
          `Planner API error: ${response.status} ${response.statusText}`,
          response.status,
          responseBody
        );
      }

      return (await response.json()) as T;
    } catch (err) {
      if (err instanceof PlannerApiError) {
        throw err;
      }
      if (err instanceof Error && err.name === 'AbortError') {
        throw new PlannerApiError(
          `Request to ${path} timed out after ${this.timeoutMs}ms`,
          408
        );
      }
      throw new PlannerApiError(
        `Failed to connect to Planner API: ${err instanceof Error ? err.message : String(err)}`,
        0
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Fetches a specific version of a plan from the Planner service.
   *
   * @param planId - The plan UUID
   * @param version - The version number to fetch (optional, fetches latest if omitted)
   * @returns The PlanVersion object
   * @throws PlannerApiError if the request fails
   */
  async fetchPlanVersion(planId: string, version?: number): Promise<PlanVersion> {
    const path = version
      ? `/api/plans/${planId}/versions/${version}`
      : `/api/plans/${planId}/versions/latest`;

    const response = await this.request<unknown>('GET', path);
    return PlanVersionResponseSchema.parse(response);
  }

  /**
   * Reports run status back to the Planner service.
   *
   * @param planId - The plan UUID
   * @param statusUpdate - The status update payload
   * @throws PlannerApiError if the request fails
   */
  async reportRunStatus(planId: string, statusUpdate: RunStatusUpdate): Promise<void> {
    // Validate the status update
    RunStatusUpdateSchema.parse(statusUpdate);

    await this.request<void>(
      'POST',
      `/api/plans/${planId}/runs/${statusUpdate.run_id}/status`,
      statusUpdate
    );
  }

  /**
   * Creates a change request when the plan needs structural changes.
   *
   * @param planId - The plan UUID
   * @param changeRequest - The change request payload
   * @returns The created change request response
   * @throws PlannerApiError if the request fails
   */
  async createChangeRequest(
    planId: string,
    changeRequest: ChangeRequest
  ): Promise<ChangeRequestResponse> {
    // Validate the change request
    ChangeRequestSchema.parse(changeRequest);

    return this.request<ChangeRequestResponse>(
      'POST',
      `/api/plans/${planId}/change-requests`,
      changeRequest
    );
  }

  /**
   * Checks if the Planner service is reachable.
   *
   * @returns true if the service is reachable, false otherwise
   */
  async isReachable(): Promise<boolean> {
    try {
      await this.request<unknown>('GET', '/api/health');
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Creates a PlannerClient from configuration.
 */
export function createPlannerClient(config: PlannerConfig): PlannerClient {
  return new PlannerClient(config);
}

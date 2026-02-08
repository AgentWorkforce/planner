import type {
  Channel,
  AgentObservations,
  Confidence,
  DomainSpec,
  RoleContext,
} from '@/types';
import { getUserId } from '@/lib/identity';

const API_BASE = '/api';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new ApiError(response.status, data.error || 'Request failed');
  }
  return response.json();
}

export async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
  });
  return handleResponse<T>(response);
}

export async function post<T>(path: string, data?: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: data ? JSON.stringify(data) : undefined,
  });
  return handleResponse<T>(response);
}

export async function put<T>(path: string, data?: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: data ? JSON.stringify(data) : undefined,
  });
  return handleResponse<T>(response);
}

export async function del<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  });
  return handleResponse<T>(response);
}

export async function patch<T>(path: string, data?: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: data ? JSON.stringify(data) : undefined,
  });
  return handleResponse<T>(response);
}

// Bundled client for object-style imports
export const apiClient = {
  get,
  post,
  put,
  patch,
  delete: del,
};

// Re-export centralized user ID management
export { getUserId as getOrCreateUserId } from '@/lib/identity';

/**
 * Create or return existing DM channel with an agent.
 *
 * @param agentId - The agent's unique identifier
 * @param agentName - The agent's display name
 * @returns Promise resolving to the Channel object
 */
export async function createDmChannel(agentId: string, agentName: string): Promise<Channel> {
  const userId = getUserId();
  const response = await fetch(`${API_BASE}/channels/dm?userId=${encodeURIComponent(userId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentId, agentName }),
  });
  const data = await handleResponse<{ channel: Channel }>(response);
  return data.channel;
}

// ============================================
// Understanding API
// ============================================

/**
 * Input for updating agent observations.
 */
export interface UpdateUnderstandingInput {
  observations?: string[];
  keywords?: string[];
  questions?: string[];
  concerns?: string[];
  references?: string[];
  confidence?: Confidence;
}

/**
 * Response from updating understanding.
 */
export interface UpdateUnderstandingResponse {
  version: number;
  observations: AgentObservations;
}

/**
 * Update understanding observations for a specific role in a plan.
 *
 * @param planId - The plan UUID
 * @param role - The agent role (e.g., 'architect', 'security')
 * @param input - The observations to add/update
 * @returns Promise resolving to the updated observations
 */
export async function updateUnderstanding(
  planId: string,
  role: string,
  input: UpdateUnderstandingInput
): Promise<UpdateUnderstandingResponse> {
  return patch<UpdateUnderstandingResponse>(
    `/plans/${planId}/understanding/${encodeURIComponent(role)}`,
    input
  );
}

// ============================================
// Step Specification API
// ============================================

/**
 * Response from updating step specification.
 */
export interface UpdateStepSpecificationResponse {
  version: number;
  specification: DomainSpec;
}

/**
 * Update specification for a specific step and domain.
 * The domain can be any string (architecture, model, design, testing, security, or custom).
 * Pass empty object {} to delete a domain.
 *
 * @param planId - The plan UUID
 * @param stepId - The step ID within the plan
 * @param domain - The specification domain (any string)
 * @param spec - The domain specification data (freeform key-value pairs)
 * @returns Promise resolving to the updated specification
 */
export async function updateStepSpecification(
  planId: string,
  stepId: string,
  domain: string,
  spec: DomainSpec
): Promise<UpdateStepSpecificationResponse> {
  return patch<UpdateStepSpecificationResponse>(
    `/plans/${planId}/steps/${encodeURIComponent(stepId)}/specification/${encodeURIComponent(domain)}`,
    spec
  );
}

// ============================================
// Context API
// ============================================

/**
 * Response from updating context.
 */
export interface UpdateContextResponse {
  version: number;
  context: RoleContext;
}

/**
 * Update context for a specific role in a plan.
 *
 * @param planId - The plan UUID
 * @param role - The role name (e.g., 'designer', 'architect')
 * @param fields - The context fields for this role
 * @returns Promise resolving to the updated context
 */
export async function updateContext(
  planId: string,
  role: string,
  fields: RoleContext
): Promise<UpdateContextResponse> {
  return patch<UpdateContextResponse>(
    `/plans/${planId}/context/${encodeURIComponent(role)}`,
    fields
  );
}

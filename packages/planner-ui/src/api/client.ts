import type { Channel } from '@/types';

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

// Bundled client for object-style imports
export const apiClient = {
  get,
  post,
  put,
  delete: del,
};

/**
 * Get or create a stable anonymous user ID for this session.
 * Persists to sessionStorage so it survives page refreshes within the same tab.
 */
function getOrCreateUserId(): string {
  const SESSION_USER_ID_KEY = 'relay_anonymous_user_id';
  const stored = sessionStorage.getItem(SESSION_USER_ID_KEY);
  if (stored) {
    return stored;
  }
  const newId = `anon-${crypto.randomUUID().slice(0, 8)}`;
  sessionStorage.setItem(SESSION_USER_ID_KEY, newId);
  return newId;
}

/**
 * Create or return existing DM channel with an agent.
 *
 * @param agentId - The agent's unique identifier
 * @param agentName - The agent's display name
 * @returns Promise resolving to the Channel object
 */
export async function createDmChannel(agentId: string, agentName: string): Promise<Channel> {
  const userId = getOrCreateUserId();
  const response = await fetch(`${API_BASE}/channels/dm?userId=${encodeURIComponent(userId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentId, agentName }),
  });
  const data = await handleResponse<{ channel: Channel }>(response);
  return data.channel;
}

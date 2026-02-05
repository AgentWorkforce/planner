/**
 * API Client for Forge UI
 *
 * Provides typed HTTP methods for communicating with the Forge API.
 */

export const FORGE_API_BASE = '/api/forge';

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Parse API error response
 */
async function parseError(response: Response): Promise<ApiError> {
  let message = `Request failed with status ${response.status}`;
  let code: string | undefined;
  let details: unknown;

  try {
    const data = await response.json();
    if (data.error) {
      message = data.error.message || data.error;
      code = data.error.code;
      details = data.error.details;
    } else if (data.message) {
      message = data.message;
    }
  } catch {
    // Response is not JSON, use status text
    message = response.statusText || message;
  }

  return new ApiError(message, response.status, code, details);
}

/**
 * Build URL with query parameters
 */
function buildUrl(path: string, params?: Record<string, unknown>): string {
  const url = new URL(`${FORGE_API_BASE}${path}`, window.location.origin);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          value.forEach((v) => url.searchParams.append(key, String(v)));
        } else {
          url.searchParams.set(key, String(value));
        }
      }
    }
  }

  return url.toString();
}

/**
 * Base request function
 */
async function request<T>(
  method: string,
  path: string,
  options?: {
    body?: unknown;
    params?: Record<string, unknown>;
    headers?: Record<string, string>;
  }
): Promise<T> {
  const url = buildUrl(path, options?.params);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options?.headers,
  };

  const config: RequestInit = {
    method,
    headers,
  };

  if (options?.body !== undefined) {
    config.body = JSON.stringify(options.body);
  }

  const response = await fetch(url, config);

  if (!response.ok) {
    throw await parseError(response);
  }

  // Handle empty responses
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  return JSON.parse(text) as T;
}

/**
 * GET request
 */
export async function get<T>(
  path: string,
  params?: Record<string, unknown>
): Promise<T> {
  return request<T>('GET', path, { params });
}

/**
 * POST request
 */
export async function post<T>(
  path: string,
  body?: unknown,
  params?: Record<string, unknown>
): Promise<T> {
  return request<T>('POST', path, { body, params });
}

/**
 * PUT request
 */
export async function put<T>(
  path: string,
  body?: unknown,
  params?: Record<string, unknown>
): Promise<T> {
  return request<T>('PUT', path, { body, params });
}

/**
 * DELETE request
 */
export async function del<T>(
  path: string,
  params?: Record<string, unknown>
): Promise<T> {
  return request<T>('DELETE', path, { params });
}

/**
 * PATCH request
 */
export async function patch<T>(
  path: string,
  body?: unknown,
  params?: Record<string, unknown>
): Promise<T> {
  return request<T>('PATCH', path, { body, params });
}

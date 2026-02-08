/**
 * Fetch with exponential backoff retry logic.
 *
 * Only retries on network errors and 5xx server errors.
 * Does NOT retry on 4xx client errors (except 429 rate limiting).
 */

export interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
}

/**
 * Check if an error is retryable.
 * Network errors (connection refused, timeout) and 5xx are retryable.
 * 4xx errors are not retryable (except 429 rate limit).
 */
function isRetryableError(error: unknown, response?: Response): boolean {
  // Network/fetch errors are retryable
  if (error instanceof TypeError) {
    return true; // Network failure, DNS failure, etc.
  }

  // Response-based retry logic
  if (response) {
    const status = response.status;
    // 5xx server errors - retry
    if (status >= 500 && status < 600) return true;
    // 429 rate limit - retry
    if (status === 429) return true;
    // All other status codes (including 4xx) - don't retry
    return false;
  }

  // Unknown error type - don't retry
  return false;
}

/**
 * Calculate exponential backoff delay with jitter.
 */
function calculateDelay(attempt: number, config: RetryConfig): number {
  const exponentialDelay = config.initialDelay * Math.pow(2, attempt);
  const cappedDelay = Math.min(exponentialDelay, config.maxDelay);
  // Add jitter (±25% random variation)
  const jitter = cappedDelay * 0.25 * (Math.random() - 0.5);
  return Math.floor(cappedDelay + jitter);
}

/**
 * Fetch with retry logic using exponential backoff.
 *
 * @param url - URL to fetch
 * @param options - Standard fetch options
 * @param retryConfig - Retry configuration (defaults: maxRetries=2, 100ms→500ms)
 * @returns Promise resolving to Response
 * @throws Error after exhausting all retries
 */
export async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  retryConfig?: Partial<RetryConfig>
): Promise<Response> {
  const config: RetryConfig = {
    maxRetries: retryConfig?.maxRetries ?? 2,
    initialDelay: retryConfig?.initialDelay ?? 100,
    maxDelay: retryConfig?.maxDelay ?? 500,
  };

  let lastError: unknown;
  let lastResponse: Response | undefined;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      // If successful (2xx/3xx), return immediately
      if (response.ok || (response.status >= 300 && response.status < 400)) {
        return response;
      }

      // Check if we should retry this response
      if (isRetryableError(undefined, response) && attempt < config.maxRetries) {
        lastResponse = response;
        const delay = calculateDelay(attempt, config);
        console.log(
          `[fetch-retry] HTTP ${response.status} on ${url}, retrying in ${delay}ms (attempt ${attempt + 1}/${config.maxRetries})`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      // Non-retryable error or last attempt - return the response
      return response;
    } catch (error) {
      lastError = error;

      // Check if we should retry this error
      if (isRetryableError(error) && attempt < config.maxRetries) {
        const delay = calculateDelay(attempt, config);
        console.log(
          `[fetch-retry] Network error on ${url}, retrying in ${delay}ms (attempt ${attempt + 1}/${config.maxRetries}): ${error instanceof Error ? error.message : String(error)}`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      // Non-retryable error or last attempt - throw
      throw error;
    }
  }

  // Should never reach here, but TypeScript needs this
  if (lastResponse) {
    return lastResponse;
  }
  throw lastError ?? new Error('fetchWithRetry: unexpected state');
}

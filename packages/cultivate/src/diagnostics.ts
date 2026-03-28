/**
 * Diagnostic utilities for error handling and logging
 */

import type { CultivateStartupError, SignalProcessingError } from './errors.js';

/**
 * Sanitizes connection strings for safe logging by replacing passwords and tokens with '***'
 *
 * Handles common connection string formats:
 * - Redis: redis://user:pass@host:port → redis://user:***@host:port
 * - PostgreSQL: postgresql://user:pass@host:port/db → postgresql://user:***@host:port/db
 * - MongoDB: mongodb://user:pass@host:port → mongodb://user:***@host:port
 * - HTTP/HTTPS with basic auth: https://user:pass@host → https://user:***@host
 * - Bearer tokens in URLs: ?token=abc123 → ?token=***
 * - API keys: ?api_key=secret → ?api_key=***
 *
 * @param url - Connection string that may contain sensitive credentials
 * @returns Sanitized connection string with credentials replaced by '***'
 *
 * @example
 * sanitizeConnectionInfo('redis://user:mypassword@localhost:6379')
 * // Returns: 'redis://user:***@localhost:6379'
 *
 * @example
 * sanitizeConnectionInfo('https://api.example.com?token=secret123')
 * // Returns: 'https://api.example.com?token=***'
 */
export function sanitizeConnectionInfo(url: string): string {
  // Handle URLs with user:pass@ authentication
  let sanitized = url.replace(/:([^@/]+)@/, ':***@');

  // Handle query string tokens and API keys
  sanitized = sanitized.replace(/([?&])(token|api_key|key|secret)=([^&]+)/gi, '$1$2=***');

  return sanitized;
}

/**
 * Formats a CultivateStartupError for console output during startup failures
 *
 * Produces a multi-line formatted string with:
 * - Error code and message
 * - Dependency that failed
 * - Connection info (sanitized)
 * - Number of retry attempts
 * - Action items for resolving the error
 *
 * @param error - CultivateStartupError to format
 * @returns Multi-line formatted string for console output
 *
 * @example
 * const error = CultivateStartupError.redisUnavailable('redis://localhost:6379', new Error('ECONNREFUSED'), 3);
 * console.error(formatStartupDiagnostics(error));
 * // Outputs:
 * // ╔═══════════════════════════════════════════════════════════════╗
 * // ║ CULTIVATE STARTUP FAILED                                      ║
 * // ╚═══════════════════════════════════════════════════════════════╝
 * //
 * // Error Code:    REDIS_UNAVAILABLE
 * // Dependency:    Redis
 * // Connection:    redis://localhost:6379
 * // Retry Attempts: 3
 * //
 * // Message: Failed to connect to Redis: redis://localhost:6379
 * //
 * // ACTION ITEMS:
 * //   • Verify Redis is running and accessible
 * //   • Check connection string and credentials
 * //   • Review network/firewall settings
 */
export function formatStartupDiagnostics(error: CultivateStartupError): string {
  const lines: string[] = [];

  // Header
  lines.push('╔═══════════════════════════════════════════════════════════════╗');
  lines.push('║ CULTIVATE STARTUP FAILED                                      ║');
  lines.push('╚═══════════════════════════════════════════════════════════════╝');
  lines.push('');

  // Error details
  lines.push(`Error Code:     ${error.code}`);

  if (error.diagnostics) {
    lines.push(`Dependency:     ${error.diagnostics.dependency}`);
    lines.push(`Connection:     ${sanitizeConnectionInfo(error.diagnostics.connectionInfo)}`);
    lines.push(`Retry Attempts: ${error.diagnostics.retryAttempts}`);
  }

  lines.push('');
  lines.push(`Message: ${error.message}`);

  // Underlying cause if available
  if (error.cause instanceof Error) {
    lines.push('');
    lines.push(`Cause: ${error.cause.message}`);
  }

  lines.push('');
  lines.push('ACTION ITEMS:');

  // Code-specific action items
  switch (error.code) {
    case 'REDIS_UNAVAILABLE':
      lines.push('  • Verify Redis is running and accessible');
      lines.push('  • Check CULTIVATE_REDIS_URL environment variable');
      lines.push('  • Review network/firewall settings');
      break;

    case 'SQLITE_INIT_FAILED':
      lines.push('  • Check CULTIVATE_DB_PATH permissions and disk space');
      lines.push('  • Verify database file is not corrupted');
      lines.push('  • Review migration logs for schema issues');
      break;

    case 'ML_MODEL_LOAD_FAILED':
      lines.push('  • Ensure internet connectivity for model download');
      lines.push('  • Check CULTIVATE_EXTRACT_MODEL and CULTIVATE_CLUSTER_MODEL settings');
      lines.push('  • Verify disk space for model cache');
      break;

    case 'ANTHROPIC_UNAVAILABLE':
      lines.push('  • Verify ANTHROPIC_API_KEY is set and valid');
      lines.push('  • Check Anthropic API status and rate limits');
      lines.push('  • Review network connectivity to api.anthropic.com');
      break;

    case 'TUNER_UNAVAILABLE':
      lines.push('  • Verify TUNER_URL is correct');
      lines.push('  • Check if tuner service is running');
      lines.push('  • This is a non-critical dependency - cultivate can run without it');
      break;

    case 'QUEUE_INIT_FAILED':
      lines.push('  • Check Redis connection (BullMQ requires Redis)');
      lines.push('  • Verify queue configuration');
      lines.push('  • Review Redis memory and connection limits');
      break;

    case 'MISSING_CULTIVATE_SECRET':
      lines.push('  • Set CULTIVATE_SECRET environment variable');
      lines.push('  • Generate a secure random secret (32+ characters recommended)');
      lines.push('  • Example: export CULTIVATE_SECRET=$(openssl rand -hex 32)');
      break;

    default:
      lines.push('  • Check cultivate configuration and dependencies');
      lines.push('  • Review error logs for additional details');
      lines.push('  • Consult cultivate documentation');
  }

  return lines.join('\n');
}

/**
 * Determines if a SignalProcessingError should be retried or dead-lettered
 *
 * Retry logic based on error type and pipeline step:
 * - Auth/permission errors: NOT retryable (dead-letter)
 * - Transient network errors: Retryable
 * - Malformed data errors: NOT retryable (dead-letter)
 * - Temporary API failures: Retryable
 * - Model failures: Retryable (may be transient)
 *
 * @param error - Error to evaluate for retry eligibility
 * @returns true if error is retryable, false if it should be dead-lettered
 *
 * @example
 * const authError = new SignalProcessingError(
 *   'tier3-extraction',
 *   'sig-123',
 *   new Error('401 Unauthorized')
 * );
 * isRetryableError(authError); // Returns: false
 *
 * @example
 * const networkError = new SignalProcessingError(
 *   'scoring',
 *   'sig-456',
 *   new Error('ECONNRESET')
 * );
 * isRetryableError(networkError); // Returns: true
 */
export function isRetryableError(error: Error): boolean {
  // If it's not a SignalProcessingError, default to not retrying
  if (error.constructor.name !== 'SignalProcessingError') {
    return false;
  }

  const sigError = error as unknown as SignalProcessingError;
  const causeMessage = sigError.cause?.message?.toLowerCase() || '';

  // Auth and permission errors are NOT retryable
  if (
    causeMessage.includes('401') ||
    causeMessage.includes('403') ||
    causeMessage.includes('unauthorized') ||
    causeMessage.includes('forbidden') ||
    causeMessage.includes('authentication') ||
    causeMessage.includes('permission denied')
  ) {
    return false;
  }

  // Invalid/malformed data errors are NOT retryable
  if (
    causeMessage.includes('400') ||
    causeMessage.includes('bad request') ||
    causeMessage.includes('invalid') ||
    causeMessage.includes('malformed') ||
    causeMessage.includes('validation')
  ) {
    return false;
  }

  // Not found errors are NOT retryable (resource doesn't exist)
  if (causeMessage.includes('404') || causeMessage.includes('not found')) {
    return false;
  }

  // Network errors ARE retryable
  if (
    causeMessage.includes('econnrefused') ||
    causeMessage.includes('econnreset') ||
    causeMessage.includes('etimedout') ||
    causeMessage.includes('enetunreach') ||
    causeMessage.includes('network')
  ) {
    return true;
  }

  // Server errors (5xx) ARE retryable
  if (
    causeMessage.includes('500') ||
    causeMessage.includes('502') ||
    causeMessage.includes('503') ||
    causeMessage.includes('504') ||
    causeMessage.includes('internal server error') ||
    causeMessage.includes('service unavailable') ||
    causeMessage.includes('gateway timeout')
  ) {
    return true;
  }

  // Rate limit errors ARE retryable (with backoff)
  if (causeMessage.includes('429') || causeMessage.includes('rate limit')) {
    return true;
  }

  // Timeout errors ARE retryable
  if (causeMessage.includes('timeout')) {
    return true;
  }

  // Model-related errors ARE retryable (may be transient)
  if (
    causeMessage.includes('model') &&
    (causeMessage.includes('loading') ||
      causeMessage.includes('unavailable') ||
      causeMessage.includes('busy'))
  ) {
    return true;
  }

  // Default: do NOT retry unknown errors
  // Better to dead-letter and investigate than infinite retry
  return false;
}

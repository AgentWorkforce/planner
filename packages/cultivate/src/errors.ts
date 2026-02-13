/**
 * Cultivate-specific error types
 */

/**
 * Startup error codes
 *
 * - REDIS_UNAVAILABLE: Redis connection refused or timeout
 * - SQLITE_INIT_FAILED: Migration or file access error
 * - ML_MODEL_LOAD_FAILED: Transformers.js model download or load failure
 * - ANTHROPIC_UNAVAILABLE: API key missing or health check failed
 * - TUNER_UNAVAILABLE: Tuner service unreachable (warning only, not thrown)
 * - QUEUE_INIT_FAILED: BullMQ queue creation error
 */
export type CultivateStartupErrorCode =
  | 'REDIS_UNAVAILABLE'
  | 'SQLITE_INIT_FAILED'
  | 'ML_MODEL_LOAD_FAILED'
  | 'ANTHROPIC_UNAVAILABLE'
  | 'TUNER_UNAVAILABLE'
  | 'QUEUE_INIT_FAILED';

/**
 * Error thrown during Cultivate startup when a required dependency fails
 */
export class CultivateStartupError extends Error {
  public readonly code: CultivateStartupErrorCode;
  public readonly cause: unknown;

  constructor(
    code: CultivateStartupErrorCode,
    message: string,
    cause: unknown = null
  ) {
    super(message);
    this.name = 'CultivateStartupError';
    this.code = code;
    this.cause = cause;

    // Maintain proper stack trace for where our error was thrown (Node.js specific)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CultivateStartupError);
    }
  }

  /**
   * Format error with diagnostic information
   */
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      cause: this.cause instanceof Error ? this.cause.message : String(this.cause),
      stack: this.stack,
    };
  }
}

/**
 * Internal processing error (non-fatal, for logging)
 */
export class CultivateInternalError extends Error {
  public readonly context: Record<string, unknown>;

  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message);
    this.name = 'CultivateInternalError';
    this.context = context;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CultivateInternalError);
    }
  }
}

/**
 * Signal filtered by pipeline (expected behavior, not an error)
 */
export class SignalFilteredError extends Error {
  public readonly reason: string;
  public readonly tier: number;

  constructor(tier: number, reason: string) {
    super(`Signal filtered at Tier ${tier}: ${reason}`);
    this.name = 'SignalFilteredError';
    this.tier = tier;
    this.reason = reason;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SignalFilteredError);
    }
  }
}

/**
 * Signal processing error (retryable)
 */
export class SignalProcessingError extends Error {
  public readonly signal_id?: string;
  public readonly step: string;

  constructor(step: string, message: string, signal_id?: string) {
    super(`Signal processing failed at ${step}: ${message}`);
    this.name = 'SignalProcessingError';
    this.step = step;
    this.signal_id = signal_id;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SignalProcessingError);
    }
  }
}

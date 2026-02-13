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
 * Diagnostic information for startup errors
 */
export interface CultivateStartupDiagnostics {
  /** Name of the dependency that failed */
  dependency: string;
  /** Sanitized connection info (no passwords or secrets) */
  connectionInfo: string;
  /** Number of retry attempts made */
  retryAttempts: number;
}

/**
 * Error thrown during Cultivate startup when a required dependency fails
 */
export class CultivateStartupError extends Error {
  public readonly code: CultivateStartupErrorCode;
  public readonly cause: unknown;
  public readonly diagnostics?: CultivateStartupDiagnostics;

  constructor(
    code: CultivateStartupErrorCode,
    message: string,
    cause: unknown = null,
    diagnostics?: CultivateStartupDiagnostics
  ) {
    super(message);
    this.name = 'CultivateStartupError';
    this.code = code;
    this.cause = cause;
    this.diagnostics = diagnostics;

    // Maintain proper stack trace for where our error was thrown (Node.js specific)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CultivateStartupError);
    }
  }

  /**
   * Static factory: Redis unavailable
   */
  static redisUnavailable(
    connectionInfo: string,
    cause: unknown,
    retryAttempts = 0
  ): CultivateStartupError {
    return new CultivateStartupError(
      'REDIS_UNAVAILABLE',
      `Failed to connect to Redis: ${connectionInfo}`,
      cause,
      {
        dependency: 'Redis',
        connectionInfo,
        retryAttempts,
      }
    );
  }

  /**
   * Static factory: SQLite initialization failed
   */
  static sqliteInitFailed(
    dbPath: string,
    cause: unknown,
    retryAttempts = 0
  ): CultivateStartupError {
    return new CultivateStartupError(
      'SQLITE_INIT_FAILED',
      `Failed to initialize SQLite storage at ${dbPath}`,
      cause,
      {
        dependency: 'SQLite',
        connectionInfo: dbPath,
        retryAttempts,
      }
    );
  }

  /**
   * Static factory: ML model load failed
   */
  static mlModelLoadFailed(
    modelName: string,
    cause: unknown,
    retryAttempts = 0
  ): CultivateStartupError {
    return new CultivateStartupError(
      'ML_MODEL_LOAD_FAILED',
      `Failed to load ML model: ${modelName}`,
      cause,
      {
        dependency: 'Transformers.js',
        connectionInfo: modelName,
        retryAttempts,
      }
    );
  }

  /**
   * Static factory: Anthropic API unavailable
   */
  static anthropicUnavailable(
    reason: string,
    cause: unknown,
    retryAttempts = 0
  ): CultivateStartupError {
    return new CultivateStartupError(
      'ANTHROPIC_UNAVAILABLE',
      `Anthropic API unavailable: ${reason}`,
      cause,
      {
        dependency: 'Anthropic API',
        connectionInfo: reason,
        retryAttempts,
      }
    );
  }

  /**
   * Static factory: Tuner unavailable
   */
  static tunerUnavailable(
    tunerUrl: string,
    cause: unknown,
    retryAttempts = 0
  ): CultivateStartupError {
    return new CultivateStartupError(
      'TUNER_UNAVAILABLE',
      `Tuner service unreachable at ${tunerUrl}`,
      cause,
      {
        dependency: 'Tuner',
        connectionInfo: tunerUrl,
        retryAttempts,
      }
    );
  }

  /**
   * Static factory: Queue initialization failed
   */
  static queueInitFailed(
    queueName: string,
    cause: unknown,
    retryAttempts = 0
  ): CultivateStartupError {
    return new CultivateStartupError(
      'QUEUE_INIT_FAILED',
      `Failed to initialize queue: ${queueName}`,
      cause,
      {
        dependency: 'BullMQ',
        connectionInfo: queueName,
        retryAttempts,
      }
    );
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
      diagnostics: this.diagnostics,
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

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
 *
 * Used for unexpected runtime failures that need investigation.
 */
export class CultivateInternalError extends Error {
  public readonly operation: string;
  public readonly cause: Error;
  public readonly context: Record<string, unknown>;

  constructor(
    operation: string,
    cause: Error,
    context: Record<string, unknown> = {}
  ) {
    super(`Internal error during ${operation}: ${cause.message}`);
    this.name = 'CultivateInternalError';
    this.operation = operation;
    this.cause = cause;
    this.context = context;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CultivateInternalError);
    }
  }
}

/**
 * Signal metadata for tracking filtered signals
 */
export interface SignalMetadata {
  source_type: string;
  external_id: string;
  greenhouse_id?: string;
}

/**
 * Signal filtered by pipeline (expected behavior, not an error)
 *
 * This is NOT an error condition — it's the expected path for noise rejection.
 */
export class SignalFilteredError extends Error {
  public readonly filter_tier: 0 | 1 | 2;
  public readonly rule_name: string;
  public readonly reason: string;
  public readonly signal_metadata: SignalMetadata;

  constructor(
    filter_tier: 0 | 1 | 2,
    reason: string,
    signal_metadata: SignalMetadata,
    rule_name = ''
  ) {
    super(`Signal filtered at Tier ${filter_tier}: ${reason}`);
    this.name = 'SignalFilteredError';
    this.filter_tier = filter_tier;
    this.rule_name = rule_name;
    this.reason = reason;
    this.signal_metadata = signal_metadata;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SignalFilteredError);
    }
  }
}

/**
 * Signal processing error for pipeline failures that should dead-letter
 *
 * Used by BullMQ workers to decide dead-letter routing.
 */
export class SignalProcessingError extends Error {
  public readonly pipeline_step: string;
  public readonly signal_id: string;
  public readonly cause: Error;

  constructor(pipeline_step: string, signal_id: string, cause: Error) {
    super(`Signal processing failed at ${pipeline_step}: ${cause.message}`);
    this.name = 'SignalProcessingError';
    this.pipeline_step = pipeline_step;
    this.signal_id = signal_id;
    this.cause = cause;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SignalProcessingError);
    }
  }
}

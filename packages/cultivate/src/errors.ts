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
 * - MISSING_CULTIVATE_SECRET: CULTIVATE_SECRET environment variable not set
 */
export type CultivateStartupErrorCode =
  | 'REDIS_UNAVAILABLE'
  | 'SQLITE_INIT_FAILED'
  | 'ML_MODEL_LOAD_FAILED'
  | 'ANTHROPIC_UNAVAILABLE'
  | 'TUNER_UNAVAILABLE'
  | 'QUEUE_INIT_FAILED'
  | 'MISSING_CULTIVATE_SECRET';

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

  /**
   * Creates a new CultivateStartupError
   *
   * @param code - Error code identifying the type of startup failure
   * @param message - Human-readable error message
   * @param cause - Optional underlying error that caused this failure
   * @param diagnostics - Optional diagnostic information for debugging
   */
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
   * Static factory: Missing CULTIVATE_SECRET
   */
  static missingCultivateSecret(): CultivateStartupError {
    const message = `CULTIVATE_SECRET environment variable is required but not set.

This environment variable is used to encrypt source configuration credentials (API keys, tokens, client secrets, etc.) for secure storage.

To generate a secure CULTIVATE_SECRET, run:
  openssl rand -hex 32

Then set the environment variable:
  export CULTIVATE_SECRET="<generated-value>"

Or add it to your .env file:
  CULTIVATE_SECRET=<generated-value>`;

    return new CultivateStartupError(
      'MISSING_CULTIVATE_SECRET',
      message,
      null,
      {
        dependency: 'Environment Variables',
        connectionInfo: 'CULTIVATE_SECRET',
        retryAttempts: 0,
      }
    );
  }

  /**
   * Format error with diagnostic information for JSON serialization
   *
   * @returns Serialized error object with code, diagnostics, and stack trace
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
 *
 * @example
 * try {
 *   // ... risky operation
 * } catch (err) {
 *   throw new CultivateInternalError('cluster-assignment', err, { userId: '123' });
 * }
 */
export class CultivateInternalError extends Error {
  public readonly operation: string;
  public readonly cause: Error;
  public readonly context: Record<string, unknown>;

  /**
   * @param operation - String describing what was being done (e.g., 'cluster-assignment', 'score-computation')
   * @param cause - Original error that triggered this internal error
   * @param context - Arbitrary key-value diagnostics for debugging
   */
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
 *
 * @param filter_tier - Tier at which signal was filtered (0, 1, or 2)
 * @param reason - Human-readable rejection reason
 * @param signal_metadata - Signal tracking metadata
 * @param rule_name - Rule name for tier 1 rejections (e.g., 'noise_reject'), empty for tier 0/2
 */
export class SignalFilteredError extends Error {
  public readonly filter_tier: 0 | 1 | 2;
  public readonly rule_name: string;
  public readonly reason: string;
  public readonly signal_metadata: SignalMetadata;

  /**
   * Creates a new SignalFilteredError
   *
   * @param filter_tier - Tier at which signal was filtered (0, 1, or 2)
   * @param reason - Human-readable rejection reason
   * @param signal_metadata - Signal tracking metadata (source_type, external_id, greenhouse_id)
   * @param rule_name - Rule name for tier 1 rejections (e.g., 'noise_reject'), empty for tier 0/2
   */
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

  /**
   * Serialize error to JSON for logging and debugging
   *
   * @returns Serialized error object with filter details and signal metadata
   */
  toJSON() {
    return {
      name: this.name,
      filter_tier: this.filter_tier,
      rule_name: this.rule_name,
      reason: this.reason,
      signal_metadata: this.signal_metadata,
      message: this.message,
      stack: this.stack,
    };
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

  /**
   * Creates a new SignalProcessingError
   *
   * @param pipeline_step - Pipeline step where failure occurred (e.g., 'tier3-extraction', 'scoring')
   * @param signal_id - Signal identifier for dead-letter tracking
   * @param cause - Original error that caused the processing failure
   */
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

  /**
   * Serialize error to JSON for logging and dead-letter tracking
   *
   * @returns Serialized error object with pipeline step, signal ID, and cause details
   */
  toJSON() {
    return {
      name: this.name,
      pipeline_step: this.pipeline_step,
      signal_id: this.signal_id,
      cause: this.cause.message,
      message: this.message,
      stack: this.stack,
    };
  }
}

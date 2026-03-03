/**
 * Cultivate startup sequence with fail-fast dependency initialization
 */

import Redis from 'ioredis';
import Anthropic from '@anthropic-ai/sdk';
import { pipeline } from '@huggingface/transformers';
import type {
  CultivateStartupConfig,
  CultivateContext,
  CultivateQueues,
  CultivateWorkers,
  CultivateConfig,
} from './types.js';
import { CultivateStartupError } from './errors.js';
import { CultivateStorage } from './storage/index.js';
import { createQueues } from './jobs/queues.js';
import { createWorkers } from './jobs/workers.js';
import { createSSEBroadcaster } from './sse/broadcaster.js';
import { FilterRuleRegistry } from './filters/rule-registry.js';
import { registerDefaultRules } from './filters/default-rules.js';

/**
 * Initialize Cultivate with ordered dependency checks
 *
 * Dependencies are initialized in strict order:
 * 1. Redis connection
 * 2. SQLite storage (with migrations)
 * 3. Transformers.js ML model
 * 4. Anthropic API health check
 * 5. Tuner config fetch (optional)
 * 6. Filter rule registry with default rules
 * 7. SSE broadcaster
 * 8. BullMQ queues
 * 9. Scheduled job repeaters
 *
 * Each step fails fast if the dependency is unavailable.
 *
 * @param config - Startup configuration
 * @returns Initialized context with all dependencies
 * @throws CultivateStartupError on any fatal dependency failure
 */
export async function startCultivate(
  config: CultivateStartupConfig
): Promise<CultivateContext> {
  console.log('[cultivate] Starting initialization sequence...');

  // Step 1: Connect to Redis
  console.log('[cultivate] Step 1/9: Connecting to Redis...');
  const redis = await connectRedis(config);
  console.log('[cultivate] ✓ Redis connected');

  // Step 2: Initialize SQLite storage
  console.log('[cultivate] Step 2/9: Initializing SQLite storage...');
  const storage = await initializeStorage(config.dbPath);
  console.log('[cultivate] ✓ Storage initialized');

  // Auto-create default Greenhouse if none exist
  await ensureDefaultGreenhouse(storage);

  // Step 3: Load Transformers.js zero-shot classifier model
  console.log('[cultivate] Step 3/9: Loading Transformers.js ML model...');
  const mlModel = await loadMLModel();
  console.log('[cultivate] ✓ ML model loaded');

  // Step 4: Verify Anthropic API key and health
  console.log('[cultivate] Step 4/9: Verifying Anthropic API...');
  const anthropic = await verifyAnthropicAPI(config.anthropicApiKey);
  console.log('[cultivate] ✓ Anthropic API verified');

  // Step 5: Fetch initial Tuner config (optional - falls back to defaults)
  console.log('[cultivate] Step 5/9: Fetching Tuner config...');
  const tunerConfig = await fetchTunerConfig(config.tunerUrl);
  if (tunerConfig) {
    console.log('[cultivate] ✓ Tuner config loaded');
    // Save Tuner config to storage so workers can load it
    await storage.setConfig(tunerConfig);
    console.log('[cultivate] ✓ Tuner config saved to storage');
  } else {
    console.log('[cultivate] ⚠ Tuner unavailable, using defaults');
  }

  // Step 6: Initialize filter rule registry with default rules
  console.log('[cultivate] Step 6/9: Initializing filter rule registry...');
  const filterRegistry = new FilterRuleRegistry();
  registerDefaultRules(filterRegistry);
  console.log('[cultivate] ✓ Filter rule registry initialized with default rules');

  // Step 7: Create SSE broadcaster
  console.log('[cultivate] Step 7/9: Creating SSE broadcaster...');
  const sseBroadcaster = createSSEBroadcaster();
  console.log('[cultivate] ✓ SSE broadcaster created');

  // Step 8: Create BullMQ queues with Redis connection
  console.log('[cultivate] Step 8/9: Creating BullMQ queues...');
  const queues = await createQueues(redis);
  console.log('[cultivate] ✓ BullMQ queues created');

  // Step 9: Start scheduled job repeaters (workers)
  console.log('[cultivate] Step 9/9: Starting job workers...');
  const workers = await createWorkers(redis, {
    storage,
    mlModel,
    anthropic,
    sseBroadcaster,
    queues,
    config,
    filterRegistry,
  });
  console.log('[cultivate] ✓ Job workers started');

  console.log('[cultivate] ✅ Initialization complete');

  return {
    redis,
    storage,
    mlModel,
    anthropic,
    tunerConfig,
    sseBroadcaster,
    queues,
    workers,
    config,
    filterRegistry,
  };
}

/**
 * Step 1: Connect to Redis with fail-fast error handling
 */
async function connectRedis(config: CultivateStartupConfig): Promise<Redis> {
  try {
    const redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      db: config.redis.db ?? 0,
      connectTimeout: 5000, // 5 second timeout
      lazyConnect: true, // Don't auto-connect, we'll do it explicitly
    });

    // Explicitly connect and wait for success
    await redis.connect();

    // Test connection with ping
    const pong = await redis.ping();
    if (pong !== 'PONG') {
      throw new Error('Redis ping failed');
    }

    return redis;
  } catch (error) {
    throw new CultivateStartupError(
      'REDIS_UNAVAILABLE',
      `Failed to connect to Redis at ${config.redis.host}:${config.redis.port}`,
      error
    );
  }
}

/**
 * Step 2: Initialize SQLite storage with migrations
 */
async function initializeStorage(dbPath: string): Promise<CultivateStorage> {
  try {
    // Storage initializes synchronously in constructor (runs migrations)
    const storage = new CultivateStorage(dbPath);
    return storage;
  } catch (error) {
    throw new CultivateStartupError(
      'SQLITE_INIT_FAILED',
      `Failed to initialize SQLite storage at ${dbPath}`,
      error
    );
  }
}

/**
 * Auto-create default Greenhouse if none exist
 */
async function ensureDefaultGreenhouse(storage: CultivateStorage): Promise<void> {
  const greenhouses = await storage.listGreenhouses();
  if (greenhouses.length === 0) {
    console.log('[cultivate] No Greenhouses found, creating default...');
    await storage.createGreenhouse({
      name: 'Default',
      description: 'Auto-created default Greenhouse',
      mode: 'refinement',
      keyword_require: [],
      keyword_exclude: [],
      source_ids: [],
    });
    console.log('[cultivate] ✓ Default Greenhouse created');
  }
}

/**
 * Step 3: Load Transformers.js zero-shot classifier model
 */
async function loadMLModel(): Promise<any> {
  try {
    // Load the zero-shot classification model
    // Using Xenova/mobilebert-uncased-mnli as specified in the feature docs
    const classifier = await pipeline(
      'zero-shot-classification',
      'Xenova/mobilebert-uncased-mnli',
      {
        // Cache directory can be customized via TRANSFORMERS_CACHE env var
        // First load will download ~100MB model
      }
    );

    // Test the model with a simple classification
    const testResult = await classifier('This is a test', ['test', 'production']) as any;
    if (!testResult || !testResult.labels || !Array.isArray(testResult.labels)) {
      throw new Error('Model test failed - invalid output');
    }

    return classifier;
  } catch (error) {
    throw new CultivateStartupError(
      'ML_MODEL_LOAD_FAILED',
      'Failed to load Transformers.js zero-shot classifier model',
      error
    );
  }
}

/**
 * Step 4: Verify Anthropic API key and health
 */
async function verifyAnthropicAPI(apiKey: string): Promise<Anthropic> {
  if (!apiKey || apiKey.trim() === '') {
    throw new CultivateStartupError(
      'ANTHROPIC_UNAVAILABLE',
      'ANTHROPIC_API_KEY environment variable is missing or empty',
      null
    );
  }

  const anthropic = new Anthropic({ apiKey });

  try {
    // Perform a lightweight health check
    // Use a minimal message to verify the API is accessible
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-latest',
      max_tokens: 10,
      messages: [
        {
          role: 'user',
          content: 'ping',
        },
      ],
    });

    if (!response || !response.content || response.content.length === 0) {
      throw new Error('Invalid API response');
    }

    return anthropic;
  } catch (error) {
    throw new CultivateStartupError(
      'ANTHROPIC_UNAVAILABLE',
      'Anthropic API health check failed',
      error
    );
  }
}

/**
 * Step 5: Fetch initial Tuner config (non-fatal - falls back to defaults)
 */
async function fetchTunerConfig(
  tunerUrl?: string
): Promise<CultivateConfig | null> {
  if (!tunerUrl) {
    console.log('[cultivate] No TUNER_URL provided, skipping config fetch');
    return null;
  }

  try {
    const response = await fetch(`${tunerUrl}/api/tuner/config/cultivate`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    if (!response.ok) {
      console.warn(
        `[cultivate] Tuner config fetch returned ${response.status}, using defaults`
      );
      return null;
    }

    const config = (await response.json()) as CultivateConfig;
    return config;
  } catch (error) {
    // Tuner unavailability is NOT fatal - log warning and continue
    console.warn('[cultivate] Failed to fetch Tuner config, using defaults:', error);
    return null;
  }
}

/**
 * Cultivate package exports
 */

// =============================================================================
// Plugin Service (for mounting in planner backend)
// =============================================================================

export { createCultivateService } from './service.js';
export type { CultivateServiceConfig } from './service.js';

// =============================================================================
// API Routes
// =============================================================================

export { createCultivateRouter } from './routes.js';

// =============================================================================
// Core Startup & Initialization
// =============================================================================

export { startCultivate } from './startup.js';
export { CultivateStorage } from './storage/index.js';
export { createSSEBroadcaster } from './sse/broadcaster.js';
export { createQueues } from './jobs/queues.js';
export { createWorkers } from './jobs/workers.js';

export {
  CultivateStartupError,
  CultivateInternalError,
  SignalFilteredError,
  SignalProcessingError,
} from './errors.js';

export type {
  CultivateStartupConfig,
  CultivateContext,
  CultivateQueues,
  CultivateWorkers,
  CultivateConfig,
  CultivateWeights,
  SSEBroadcaster,
  CultivateService,
} from './types.js';

export type { Greenhouse, CreateGreenhouseInput } from './storage/index.js';

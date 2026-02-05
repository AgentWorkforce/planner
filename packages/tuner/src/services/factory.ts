/**
 * Service Factory for Tuner
 *
 * Creates and wires all Tuner services together with proper event handling.
 */

import { SQLiteTunerStorage, type TunerStorage } from '../storage/index.js';
import { DEFAULT_FORGE_CONFIG } from '../domain/config.js';
import { OutcomeCollector } from './outcome-collector.js';
import { BaselineService } from './baseline-service.js';
import { DriftDetector } from './drift-detector.js';
import { ModelSelector } from './model-selector.js';
import { StabilityControls } from './stability-controls.js';
import { ConfigWriter } from './config-writer.js';

/**
 * All Tuner service instances.
 */
export interface TunerServices {
  storage: TunerStorage;
  collector: OutcomeCollector;
  baseline: BaselineService;
  drift: DriftDetector;
  selector: ModelSelector;
  stability: StabilityControls;
  config: ConfigWriter;
}

/**
 * Create all Tuner services with proper wiring.
 *
 * Event flow:
 * 1. Forge emits task outcome → OutcomeCollector
 * 2. OutcomeCollector stores and emits 'task_outcome_received'
 * 3. Listeners update:
 *    - BaselineService (updates task baseline)
 *    - ModelSelector (updates Beta distribution)
 *    - DriftDetector (checks for drift)
 */
export function createTunerServices(dbPath: string): TunerServices {
  // Create storage
  const storage = new SQLiteTunerStorage(dbPath);

  // Create services (order matters for dependencies)
  const collector = new OutcomeCollector(storage);
  const baseline = new BaselineService(storage);
  const stability = new StabilityControls(storage);

  // Get initial config (or use defaults)
  const latestConfig = storage.getLatestConfigVersion();
  const forgeConfig = latestConfig?.forge_config ?? DEFAULT_FORGE_CONFIG;

  const selector = new ModelSelector(storage, forgeConfig);
  const drift = new DriftDetector(storage, baseline);
  const config = new ConfigWriter(storage, stability, selector, baseline);

  // Wire event handlers
  wireEventHandlers(collector, baseline, selector, drift);

  return {
    storage,
    collector,
    baseline,
    drift,
    selector,
    stability,
    config,
  };
}

/**
 * Wire event handlers between services.
 */
function wireEventHandlers(
  collector: OutcomeCollector,
  baseline: BaselineService,
  selector: ModelSelector,
  drift: DriftDetector
): void {
  // When a task outcome is received:
  collector.on('task_outcome_received', (outcome) => {
    try {
      // 1. Update task baseline (for drift detection)
      baseline.updateBaseline(outcome);

      // 2. Update model performance (for Thompson sampling)
      selector.recordOutcome(outcome);

      // 3. Check for drift (after baseline is updated)
      const alerts = drift.checkDrift(outcome);
      if (alerts.length > 0) {
        console.log(`[Tuner] ${alerts.length} drift alert(s) generated for pattern ${baseline.normalizePattern(outcome)}`);
      }
    } catch (error) {
      // Log but don't throw - async processing shouldn't break the flow
      console.error('[Tuner] Error processing task outcome:', error);
    }
  });

  // When a run outcome is received:
  collector.on('run_outcome_received', (outcome) => {
    try {
      // For now, just log. Future: aggregate run-level insights
      console.log(`[Tuner] Run ${outcome.run_id} completed: ${outcome.outcome} (${outcome.tasks_succeeded}/${outcome.tasks_total} tasks)`);
    } catch (error) {
      console.error('[Tuner] Error processing run outcome:', error);
    }
  });
}

/**
 * Create services with in-memory storage (for testing).
 */
export function createTestTunerServices(): TunerServices {
  return createTunerServices(':memory:');
}

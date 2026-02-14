/**
 * ML model initialization with singleton pattern
 *
 * This module manages the zero-shot classification model lifecycle:
 * - Lazy initialization via loadClassificationModel()
 * - Module-scoped singleton storage
 * - Startup readiness check via isModelLoaded()
 */

import { pipeline, type ZeroShotClassificationPipeline } from '@huggingface/transformers';
import { CultivateStartupError } from '../errors.js';

/**
 * Module-scoped singleton: stores the loaded classifier
 * null = not yet loaded
 */
let classifier: ZeroShotClassificationPipeline | null = null;

/**
 * Load the zero-shot classification model
 *
 * Downloads and initializes Xenova/mobilebert-uncased-mnli (~100MB on first load).
 * Subsequent calls are idempotent (returns existing classifier).
 *
 * Model is cached via TRANSFORMERS_CACHE env var (defaults to ~/.cache/huggingface).
 *
 * @throws {CultivateStartupError} ML_MODEL_LOAD_FAILED if model fails to load
 * @returns Promise that resolves when model is loaded and ready
 */
export async function loadClassificationModel(): Promise<void> {
  // Idempotent: if already loaded, return early
  if (classifier !== null) {
    return;
  }

  const modelName = 'Xenova/mobilebert-uncased-mnli';

  try {
    console.log(`[cultivate/ml] Loading zero-shot classifier: ${modelName}...`);

    // Load the pipeline (downloads model on first run)
    const loadedPipeline = await pipeline('zero-shot-classification', modelName, {
      // Cache directory can be customized via TRANSFORMERS_CACHE env var
      // First load will download ~100MB model
    });

    // Test the model with a simple classification to verify it works
    console.log('[cultivate/ml] Testing model with sample classification...');
    const testResult = await loadedPipeline('This is a test', ['test', 'production']);

    if (!testResult || !testResult.labels || !Array.isArray(testResult.labels)) {
      throw new Error('Model test failed - invalid output structure');
    }

    // Store in module singleton
    classifier = loadedPipeline;

    console.log(`[cultivate/ml] ✓ Model loaded and verified: ${modelName}`);
  } catch (error) {
    // Clear any partial state
    classifier = null;

    // Extract error message for diagnostics
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Throw structured startup error
    throw CultivateStartupError.mlModelLoadFailed(
      modelName,
      error,
      0 // retryAttempts
    );
  }
}

/**
 * Check if the ML model has been successfully loaded
 *
 * @returns true if model is loaded and ready, false otherwise
 */
export function isModelLoaded(): boolean {
  return classifier !== null;
}

/**
 * Get the loaded classifier instance
 *
 * @throws {Error} if model has not been loaded yet
 * @returns The loaded zero-shot classification pipeline
 */
export function getClassifier(): ZeroShotClassificationPipeline {
  if (classifier === null) {
    throw new Error('ML model not loaded. Call loadClassificationModel() first.');
  }
  return classifier;
}

/**
 * Clear the loaded model (for testing or hot reload scenarios)
 * @internal
 */
export function _clearModel(): void {
  classifier = null;
}

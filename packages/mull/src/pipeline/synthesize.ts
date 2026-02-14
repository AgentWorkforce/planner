import type {
  PreExtract,
  MullConfig,
  SynthesisResult,
  NuggetSynthesizer,
} from '../domain/types.js';

/**
 * Run nugget synthesis on a PreExtract using the provided synthesizer.
 *
 * Wraps the synthesizer call with error handling to ensure partial failures
 * (e.g., one batch of messages fails LLM extraction) don't crash the pipeline.
 */
export async function synthesizeNuggets(
  preExtract: PreExtract,
  config: MullConfig,
  synthesizer: NuggetSynthesizer,
): Promise<SynthesisResult> {
  try {
    return await synthesizer.synthesize(preExtract, config);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      nuggets: [],
      errors: [{
        stage: 'synthesize',
        message: `Synthesis failed: ${message}`,
        recoverable: true,
      }],
    };
  }
}

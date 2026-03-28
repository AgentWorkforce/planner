import * as crypto from 'node:crypto';
import type {
  NuggetSynthesizer,
  PreExtract,
  MullConfig,
  SynthesisResult,
  Nugget,
} from '../domain/types.js';

/**
 * Passthrough synthesizer that creates one nugget per non-system message.
 *
 * This is a placeholder implementation for testing and development.
 * Production use should provide a real synthesizer (e.g., LLM-based)
 * via MullOptions.synthesizer.
 */
export class PassthroughSynthesizer implements NuggetSynthesizer {
  async synthesize(preExtract: PreExtract, _config: MullConfig): Promise<SynthesisResult> {
    const nuggets: Nugget[] = [];

    for (const msg of preExtract.messages) {
      if (msg.role === 'system') continue;

      const topic = preExtract.existingTopics[0] ?? 'general';

      nuggets.push({
        id: crypto.randomUUID(),
        content: msg.content,
        topic,
        confidence: 0.5,
        source: {
          sessionRef: preExtract.sessionRef,
          messageIds: [msg.id],
        },
      });
    }

    return { nuggets, errors: [] };
  }
}

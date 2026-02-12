import * as crypto from 'node:crypto';
import type { PreExtract, Nugget } from '../domain/types.js';

/**
 * Extract trail decision nuggets from a PreExtract without LLM synthesis.
 *
 * This is the deterministic fallback used when LLM synthesis fails.
 * It creates one nugget per non-system message, preserving the raw
 * content as a "trail decision" record. The confidence is set low (0.3)
 * to indicate these are unrefined extractions.
 *
 * **Idempotency guarantee**: Given the same PreExtract (same messages,
 * same session ref, same existing topics), this function produces
 * structurally identical nuggets (same content, topic, confidence, source).
 * IDs use randomUUID for uniqueness but the merge layer deduplicates
 * by slug-based topic files — same adapters + same cursor state +
 * same source data = identical output in topic files.
 */
export function extractTrailDecisions(preExtract: PreExtract): Nugget[] {
  const nuggets: Nugget[] = [];

  for (const msg of preExtract.messages) {
    if (msg.role === 'system') continue;

    const topic = preExtract.existingTopics[0] ?? 'general';

    nuggets.push({
      id: crypto.randomUUID(),
      content: msg.content,
      topic,
      confidence: 0.3,
      source: {
        sessionRef: preExtract.sessionRef,
        messageIds: [msg.id],
      },
    });
  }

  return nuggets;
}

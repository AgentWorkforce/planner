import type { SessionData, MullConfig, PreExtract, TopicStore } from '../domain/types.js';

/**
 * Build a PreExtract from loaded session data.
 *
 * Enriches raw session data with context needed for synthesis:
 * - Existing topic slugs (so the synthesizer can route to known topics)
 * - Session metadata
 */
export async function buildPreExtract(
  sessionData: SessionData,
  config: MullConfig,
  topicStore: TopicStore,
): Promise<PreExtract> {
  const existingTopics = await topicStore.listTopics(config.memoryDir);

  return {
    sessionRef: sessionData.ref,
    messages: sessionData.messages,
    existingTopics,
    metadata: sessionData.metadata,
  };
}

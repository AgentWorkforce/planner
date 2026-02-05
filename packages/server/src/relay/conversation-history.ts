/**
 * Conversation History Manager
 *
 * Manages per-channel conversation history for PlannerLead.
 * Stores messages in memory with channel ID as key.
 * Implements sliding window to prevent context overflow.
 */

/** Message format compatible with Anthropic API */
export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Maximum messages per channel before FIFO eviction */
const MAX_MESSAGES_PER_CHANNEL = 50;

/** In-memory storage: channelId -> messages */
const channelHistories = new Map<string, ConversationMessage[]>();

/**
 * Add a message to a channel's conversation history.
 */
export function addMessage(
  channelId: string,
  role: 'user' | 'assistant',
  content: string
): void {
  let history = channelHistories.get(channelId);

  if (!history) {
    history = [];
    channelHistories.set(channelId, history);
  }

  history.push({ role, content });

  // FIFO eviction if over limit
  while (history.length > MAX_MESSAGES_PER_CHANNEL) {
    history.shift();
  }
}

/**
 * Get conversation history for a channel.
 * Returns array of messages in Anthropic API format.
 */
export function getHistory(channelId: string): ConversationMessage[] {
  return channelHistories.get(channelId) || [];
}

/**
 * Clear conversation history for a channel.
 */
export function clearHistory(channelId: string): void {
  channelHistories.delete(channelId);
}

/**
 * Get all channels with conversation history.
 */
export function getActiveChannels(): string[] {
  return Array.from(channelHistories.keys());
}

/**
 * Get message count for a channel.
 */
export function getMessageCount(channelId: string): number {
  return channelHistories.get(channelId)?.length || 0;
}

/**
 * Clear all conversation histories.
 * Useful for testing or shutdown.
 */
export function clearAllHistories(): void {
  channelHistories.clear();
}

/**
 * ConversationHistory class for object-oriented usage.
 */
export class ConversationHistory {
  private channelId: string;

  constructor(channelId: string) {
    this.channelId = channelId;
  }

  add(role: 'user' | 'assistant', content: string): void {
    addMessage(this.channelId, role, content);
  }

  get(): ConversationMessage[] {
    return getHistory(this.channelId);
  }

  clear(): void {
    clearHistory(this.channelId);
  }

  get count(): number {
    return getMessageCount(this.channelId);
  }
}

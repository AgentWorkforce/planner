/**
 * Conversation History
 *
 * In-memory conversation history per session channel.
 * The transcript is persisted in the database - this is for LLM context.
 */

import type Anthropic from '@anthropic-ai/sdk';

// =============================================================================
// Types
// =============================================================================

export type ConversationRole = 'user' | 'assistant';

export interface ConversationMessage {
  role: ConversationRole;
  content: string;
  timestamp: string;
}

// =============================================================================
// History Store
// =============================================================================

/**
 * Maximum messages to keep in history per session.
 * Prevents unbounded memory growth for long-running sessions.
 * 50 messages = ~25 exchanges.
 */
const MAX_HISTORY_MESSAGES = 50;

class ConversationHistoryStore {
  private histories: Map<string, ConversationMessage[]> = new Map();

  /**
   * Add a message to a channel's history.
   * Automatically trims to MAX_HISTORY_MESSAGES to prevent unbounded growth.
   */
  addMessage(channelId: string, role: ConversationRole, content: string): void {
    if (!this.histories.has(channelId)) {
      this.histories.set(channelId, []);
    }
    const history = this.histories.get(channelId)!;
    history.push({
      role,
      content,
      timestamp: new Date().toISOString(),
    });

    // Trim to max size (keep most recent messages)
    if (history.length > MAX_HISTORY_MESSAGES) {
      // Remove oldest messages, but always keep pairs (don't split user/assistant)
      const trimCount = history.length - MAX_HISTORY_MESSAGES;
      // Ensure we trim an even number to keep message pairs intact
      const adjustedTrimCount = trimCount % 2 === 0 ? trimCount : trimCount + 1;
      history.splice(0, adjustedTrimCount);
    }
  }

  /**
   * Get all messages for a channel.
   */
  getHistory(channelId: string): ConversationMessage[] {
    return this.histories.get(channelId) ?? [];
  }

  /**
   * Convert history to Anthropic message format.
   */
  getAnthropicMessages(channelId: string): Anthropic.MessageParam[] {
    const history = this.getHistory(channelId);
    return history.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));
  }

  /**
   * Clear history for a channel.
   */
  clearHistory(channelId: string): void {
    this.histories.delete(channelId);
  }

  /**
   * Clear all history.
   */
  clearAll(): void {
    this.histories.clear();
  }
}

// Singleton instance
export const conversationHistory = new ConversationHistoryStore();

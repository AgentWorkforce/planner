/**
 * Conversation History
 *
 * In-memory conversation history per session channel.
 * Hydrates from database transcript on first access after server restart.
 */

import type Anthropic from '@anthropic-ai/sdk';

// =============================================================================
// XML Sanitization
// =============================================================================

/**
 * Known tool names that the model may write as XML instead of using tool_use.
 * These patterns poison conversation history and cause the model to keep
 * producing XML in future turns (few-shot mimicry from its own output).
 */
const TOOL_XML_PATTERN = /<(start_session|read_session|add_message|update_understanding|send_to_planner|spawn_specialist|update_synthesis|graduate_blocks)\b[^>]*>[\s\S]*?<\/\1>/g;

/**
 * Strip XML tool invocations from assistant messages.
 * When the model writes `<send_to_planner>...</send_to_planner>` as text instead
 * of using the tool_use mechanism, that XML gets stored in transcript and replayed
 * in future conversation history — teaching the model to keep doing it.
 */
function stripXmlToolInvocations(content: string): string {
  const cleaned = content.replace(TOOL_XML_PATTERN, '').trim();
  // If stripping XML left the message empty, return a neutral placeholder
  // so the conversation structure isn't broken
  return cleaned || '(tool action performed)';
}

// =============================================================================
// Types
// =============================================================================

export type ConversationRole = 'user' | 'assistant';

export interface ConversationMessage {
  role: ConversationRole;
  content: string;
  timestamp: string;
}

/** Minimal transcript message shape for hydration (matches domain TranscriptMessage). */
export interface TranscriptEntry {
  role: string;
  content: string;
  timestamp?: string;
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
  /** Tracks which channels have been hydrated from DB. */
  private hydrated: Set<string> = new Set();

  /**
   * Check if a channel has any in-memory history.
   */
  hasHistory(channelId: string): boolean {
    return this.hydrated.has(channelId);
  }

  /**
   * Hydrate in-memory history from a database transcript.
   * Called once per channel after server restart to restore context.
   * Only user and assistant messages are loaded (matching ConversationRole).
   */
  hydrateFromTranscript(channelId: string, transcript: TranscriptEntry[]): void {
    if (this.hydrated.has(channelId)) return; // Already hydrated

    const messages: ConversationMessage[] = [];
    for (const msg of transcript) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp ?? new Date().toISOString(),
        });
      }
    }

    // Apply same trimming as addMessage
    if (messages.length > MAX_HISTORY_MESSAGES) {
      const trimCount = messages.length - MAX_HISTORY_MESSAGES;
      const adjustedTrimCount = trimCount % 2 === 0 ? trimCount : trimCount + 1;
      messages.splice(0, adjustedTrimCount);
    }

    this.histories.set(channelId, messages);
    this.hydrated.add(channelId);
    console.log(`[History] Hydrated ${messages.length} messages for ${channelId} from DB transcript`);
  }

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
   * Ensures the message sequence is valid for Anthropic API:
   * - First message must be from 'user'
   * - Messages should alternate between user and assistant
   * - XML tool invocations stripped from assistant messages (prevents model mimicry)
   */
  getAnthropicMessages(channelId: string): Anthropic.MessageParam[] {
    const history = this.getHistory(channelId);

    // Anthropic API requires first message to be from user
    // If history starts with assistant message, skip it
    let messages = history;
    if (messages.length > 0 && messages[0]?.role === 'assistant') {
      console.warn('[History] Skipping initial assistant message - Anthropic requires user-first');
      messages = messages.slice(1);
    }

    return messages.map(msg => ({
      role: msg.role,
      content: msg.role === 'assistant' ? stripXmlToolInvocations(msg.content) : msg.content,
    }));
  }

  /**
   * Clear history for a channel.
   */
  clearHistory(channelId: string): void {
    this.histories.delete(channelId);
    this.hydrated.delete(channelId);
  }

  /**
   * Clear all history.
   */
  clearAll(): void {
    this.histories.clear();
    this.hydrated.clear();
  }
}

// Singleton instance
export const conversationHistory = new ConversationHistoryStore();

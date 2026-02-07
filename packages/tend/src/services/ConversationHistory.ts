/**
 * Conversation history management for the unified interviewer
 */

export interface ToolCall {
  name: string;
  arguments: Record<string, any>;
}

export interface HistoryMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  phase?: 'ideation' | 'planning' | 'execution';
  tool_calls?: ToolCall[];
  timestamp: string;
}

export class ConversationHistory {
  private messages: HistoryMessage[] = [];

  /**
   * Add a message to the conversation history
   */
  addMessage(msg: HistoryMessage): void {
    this.messages.push({
      ...msg,
      timestamp: msg.timestamp || new Date().toISOString(),
    });
  }

  /**
   * Get conversation history with optional limit
   */
  getHistory(limit?: number): HistoryMessage[] {
    if (limit && limit > 0) {
      return this.messages.slice(-limit);
    }
    return [...this.messages];
  }

  /**
   * Get history for a specific phase
   */
  getPhaseHistory(phase: 'ideation' | 'planning' | 'execution'): HistoryMessage[] {
    return this.messages.filter((msg) => msg.phase === phase);
  }

  /**
   * Get recent messages (last N)
   */
  getRecent(count: number): HistoryMessage[] {
    return this.messages.slice(-count);
  }

  /**
   * Get all tool calls from history
   */
  getToolCalls(): Array<{ message: HistoryMessage; toolCall: ToolCall }> {
    const result: Array<{ message: HistoryMessage; toolCall: ToolCall }> = [];

    for (const msg of this.messages) {
      if (msg.tool_calls) {
        for (const toolCall of msg.tool_calls) {
          result.push({ message: msg, toolCall });
        }
      }
    }

    return result;
  }

  /**
   * Clear all history
   */
  clear(): void {
    this.messages = [];
  }

  /**
   * Clear history for a specific phase
   */
  clearPhase(phase: 'ideation' | 'planning' | 'execution'): void {
    this.messages = this.messages.filter((msg) => msg.phase !== phase);
  }

  /**
   * Get message count
   */
  getCount(): number {
    return this.messages.length;
  }

  /**
   * Get count by role
   */
  getCountByRole(role: 'user' | 'assistant' | 'system'): number {
    return this.messages.filter((msg) => msg.role === role).length;
  }
}

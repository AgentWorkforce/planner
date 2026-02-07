/**
 * Conversation types for tend package
 * Supports multi-agent conversations with channel-based messaging
 */

/**
 * Message from an agent in a project conversation
 * Messages are organized by channel (e.g., #planning, #ideation, #forge)
 */
export interface ProjectMessage {
  channel_id: string;
  agent_id: string;
  content: string;
  metadata?: {
    options?: string[];
    [key: string]: unknown;
  };
  timestamp: string;
}

/**
 * Agent tab representation in the UI
 * Each active agent channel gets its own tab
 */
export interface AgentTab {
  id: string;
  label: string;
  channel_id: string;
  agent_role?: string;
  unread_count?: number;
  last_message_at?: string;
}

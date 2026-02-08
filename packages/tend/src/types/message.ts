/**
 * ProjectMessage Interface
 *
 * Core message type for tend conversations with channel-based filtering.
 * Messages are tagged with channel_id to enable agent tab views.
 */

export interface ProjectMessage {
  /** Unique message identifier */
  id: string;

  /** Message role */
  role: 'user' | 'assistant' | 'system';

  /** Message content */
  content: string;

  /** Channel identifier for filtering
   * - 'main' for project conversation
   * - 'agent-{agentId}' for individual agent streams
   */
  channel_id: string;

  /** Optional metadata */
  metadata?: {
    /** Agent name if from an agent */
    agent_name?: string;

    /** Agent role (e.g., "Coder", "Architect") */
    agent_role?: string;

    /** Step ID if message relates to a specific step */
    step_id?: string;

    /** Tool call identifier */
    tool_call?: string;

    /** Attention level (1-3) */
    attention_level?: number;

    /** Referenced blocks */
    block_refs?: string[];

    /** Referenced steps */
    step_refs?: string[];

    /** Event type for system messages */
    event_type?: string;
  };

  /** Creation timestamp */
  created_at: string;
}

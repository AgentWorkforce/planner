/**
 * Channel Message Types for Planner UI
 *
 * Simplified message type for channel display.
 * Channel and ChannelType are re-exported from relay.ts.
 */

/**
 * Message in a channel (simplified from RelayMessage for UI display).
 */
export interface ChannelMessage {
  /** Unique message ID */
  id: string;
  /** Sender identifier (agent name or user name) */
  from: string;
  /** Optional display name for sender */
  fromName?: string;
  /** Message content */
  content: string;
  /** Unix timestamp when message was sent */
  timestamp: number;
  /** Optional structured data attached to message */
  data?: Record<string, unknown>;
}

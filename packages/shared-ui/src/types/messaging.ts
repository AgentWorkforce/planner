/**
 * Messaging Types
 *
 * Canonical message interface and related types for cross-app messaging.
 * This provides a standard contract that both planner-ui and relay-dashboard
 * can use for their messaging components.
 */

/** Entity type in the messaging system */
export type EntityType = 'user' | 'agent';

/** Message delivery/read status */
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

/**
 * Canonical Message interface
 *
 * This is the standard message format used by shared messaging components.
 * Applications should transform their internal message formats to this interface
 * before passing to shared components.
 */
export interface Message {
  /** Unique message identifier */
  id: string;

  /** Sender identifier (user ID or agent ID) */
  from: string;

  /** Display name for the sender */
  fromName?: string;

  /** Type of sender */
  entityType: EntityType;

  /** Channel this message belongs to (optional for DMs) */
  channelId?: string;

  /** Message text content */
  content: string;

  /** ISO timestamp of when the message was created */
  timestamp: string;

  /** Thread ID for threaded conversations */
  threadId?: string;

  /** Whether the current user has read this message */
  isRead?: boolean;

  /** Message delivery status */
  status?: MessageStatus;

  /** Arbitrary metadata (QA payloads, attachments, etc.) */
  data?: Record<string, unknown>;
}

/**
 * Thread metadata for threaded conversations
 */
export interface ThreadMetadata {
  threadId: string;
  replyCount: number;
  participants: string[];
  lastReplyAt: string;
  lastReplyPreview?: string;
}

/**
 * Props for message bubble/item components
 */
export interface MessageBubbleProps {
  /** The message to display */
  message: Message;

  /** Whether this message is from the current user */
  isOwn: boolean;

  /** Whether to show the avatar (hide for consecutive messages) */
  showAvatar: boolean;

  /** Optional CSS class name */
  className?: string;
}

/**
 * Props for message list components
 */
export interface MessageListProps {
  /** Messages to display */
  messages: Message[];

  /** Current user's ID (to identify own messages) */
  currentUserId?: string | null;

  /** Whether the list is loading */
  isLoading?: boolean;

  /** Empty state message */
  emptyMessage?: string;

  /** Empty state description */
  emptyDescription?: string;

  /** Optional CSS class name */
  className?: string;
}

/**
 * Props for message input components
 */
export interface MessageInputProps {
  /** Callback when user sends a message */
  onSend: (content: string, data?: Record<string, unknown>) => void;

  /** Whether the input is disabled */
  disabled?: boolean;

  /** Placeholder text */
  placeholder?: string;

  /** Initial value to pre-fill the input */
  initialValue?: string;

  /** Optional CSS class name */
  className?: string;
}

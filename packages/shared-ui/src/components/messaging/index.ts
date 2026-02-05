/**
 * Messaging Components
 *
 * Shared components for chat/messaging functionality across applications.
 */

export { DateSeparator } from './DateSeparator';
export type { DateSeparatorProps } from './DateSeparator';

export { MessageBubble } from './MessageBubble';
export type { MessageBubbleProps } from './MessageBubble';

export { MessageList } from './MessageList';

export { MessageInput } from './MessageInput';

// Re-export types from types/messaging for convenience
// Note: EntityType is exported from Avatar, MessageBubbleProps from MessageBubble.tsx
export type {
  Message,
  MessageStatus,
  ThreadMetadata,
  MessageListProps,
  MessageInputProps,
} from '../../types/messaging';

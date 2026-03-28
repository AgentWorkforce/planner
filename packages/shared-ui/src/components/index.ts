// Core components
export { Pagination, type PaginationProps } from "./Pagination";
export { ConfirmationDialog, type ConfirmationDialogProps } from "./ConfirmationDialog";
export { Modal, type ModalProps } from "./Modal";
export { Badge, type BadgeProps } from "./Badge";
export { Avatar, type AvatarProps, type EntityType } from "./Avatar";
export { Tabs, TabPanel, type TabsProps, type TabPanelProps, type Tab } from "./Tabs";
export { Tooltip, type TooltipProps } from "./Tooltip";
export { SearchInput, type SearchInputProps } from "./SearchInput";
export { EmptyState, type EmptyStateProps } from "./EmptyState";
export { LoadingSpinner, type LoadingSpinnerProps } from "./LoadingSpinner";
export {
  ThinkingIndicator,
  ThinkingDot,
  type ThinkingIndicatorProps,
} from "./ThinkingIndicator";
export { Dropdown, type DropdownProps, type DropdownItem } from "./Dropdown";
export { ErrorBoundary, type ErrorBoundaryProps } from "./ErrorBoundary";
export {
  TypingIndicator,
  TypingDots,
  type TypingIndicatorProps,
  type TypingUser,
} from "./TypingIndicator";
export {
  CommandPalette,
  useCommandPalette,
  type CommandPaletteProps,
  type CommandItem,
  type CommandSection,
} from "./CommandPalette";


// New extracted components
export {
  StatusIndicator,
  StatusDot,
  type StatusIndicatorProps,
  type StatusType,
} from "./StatusIndicator";
export {
  ListItem,
  ListItemGroup,
  FeedItem,
  type ListItemProps,
  type ListItemGroupProps,
  type FeedItemProps,
  type ListItemAccent,
} from "./ListItem";
export {
  NotificationBanner,
  type NotificationBannerProps,
  type NotificationBannerItem,
} from "./NotificationBanner";
export { EntityCard, type EntityCardProps } from "./EntityCard";
export { Autocomplete, type AutocompleteProps } from "./Autocomplete";
export {
  DetailPanel,
  DetailPanelSection,
  DetailPanelDivider,
  type DetailPanelProps,
} from "./DetailPanel";
export {
  StatusBar,
  type StatusBarProps,
  type AgentStatus,
  type StatusAction,
} from "./StatusBar";

export {
  ForgeConfigPanel,
  type ForgeConfigPanelProps,
  type ForgeConfigStep,
  type PlanExecutionDefaults,
} from "./ForgeConfigPanel";

// Messaging components
export {
  DateSeparator,
  MessageBubble,
  MessageList,
  MessageInput,
  type DateSeparatorProps,
  type MessageBubbleProps,
  type Message,
  type MessageListProps,
  type MessageInputProps,
  type MessageStatus,
  type ThreadMetadata,
} from "./messaging";

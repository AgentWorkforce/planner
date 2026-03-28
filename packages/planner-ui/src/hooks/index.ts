export { useExecutionStatus } from './useExecutionStatus';
export { useAIImprovements } from './useAIImprovements';
export { useChangeRequests } from './useChangeRequests';
export { useAIConnectionStatus } from './useAIConnectionStatus';
export type { ConnectionStatus } from './useAIConnectionStatus';
export { useTopologicalSort } from './useTopologicalSort';
export { useDependencyPositions } from './useDependencyPositions';
export { usePlanEvents } from './usePlanEvents';
export type { PlanChangeEvent, UsePlanEventsReturn } from './usePlanEvents';
export { useAttentionPlans } from './useAttentionPlans';
export { usePlansViewMode } from './usePlansViewMode';
export type { PlansViewMode } from './usePlansViewMode';
export { useScopeGroupExpansion } from './useScopeGroupExpansion';
export {
  useCommandPalette,
  openCommandPalette,
  closeCommandPalette,
  toggleCommandPalette,
} from './useCommandPalette';
export { useRecentPlans } from './useRecentPlans';
export { useFuzzySearch } from './useFuzzySearch';
export type { FuzzySearchResult } from './useFuzzySearch';
export { useSidebarState } from './useSidebarState';

// Relay messaging hooks
export { useRelayConnection } from './useRelayConnection';
export { useChannels } from './useChannels';
export { useChannelMessages } from './useChannelMessages';
export { usePresence } from './usePresence';
export { useActiveChannels } from './useActiveChannels';
export { useDmChannel } from './useDmChannel';

// Initiative management hooks
export { useInitiatives, invalidateInitiatives } from './useInitiatives';
export { useInitiative } from './useInitiative';

// Plans filtering
export { usePlansFilter } from './usePlansFilter';
export type { PlansFilter } from './usePlansFilter';

// Pipeline views
export { usePipelinePlans } from './usePipelinePlans';

// Auth hooks (stub for development)
export { useCurrentUser, useIsAuthenticated } from './useCurrentUser';
export type { CurrentUser } from './useCurrentUser';

// Theme management
export { useTheme } from './useTheme';
export type { Theme } from './useTheme';

// Agent orchestration
export { useAgentOrchestration } from './useAgentOrchestration';
export type {
  Agent,
  AgentState,
  AgentRole,
  AgentOrchestrationState,
  UseAgentOrchestrationResult,
} from './useAgentOrchestration';

// Question queue management
export { useQuestionQueue } from './useQuestionQueue';

// Question notifications
export { useQuestionNotifications } from './useQuestionNotifications';
export type { QuestionNotification } from './useQuestionNotifications';

// User trajectory management
export { useUserTrajectory } from './useUserTrajectory';

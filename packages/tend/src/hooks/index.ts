/**
 * Hooks barrel export
 */

// Physics engine
export { usePhysicsEngine } from './usePhysicsEngine';
export type { PhysicsBody, CreateBodyOptions, UsePhysicsEngineReturn } from './usePhysicsEngine';

// Media queries and layout
export { useMediaQuery, useIsMobile } from './useMediaQuery';
export { usePanelState } from './usePanelState';

// Session management
export { useSessions } from './useSessions';
export { useSession } from './useSession';
export { useSessionEvents } from './useSessionEvents';

// Ideation features
export { useConfidence } from './useConfidence';
export { useUnderstanding } from './useUnderstanding';
export { useIdeationApi } from './useIdeationApi';
export { useBlocks } from './useBlocks';

// User settings
export { useUserSettings, shouldAutoCurate, isBlockVisible } from './useUserSettings';
export type { UserSettings } from './useUserSettings';

// Tend settings
export { useSettings } from './useSettings';
export type { TendSettings } from './useSettings';

// Initiatives
export { useInitiatives } from './useInitiatives';
export type { Initiative } from './useInitiatives';

// Command palette
export { useCommandPalette } from './useCommandPalette';
export type { CommandAction } from './useCommandPalette';

// Toast notifications
export { useToast } from './useToast';
export type { Toast, ToastOptions, ToastVariant } from './useToast';

// Project events
export { useProjectEvents } from './useProjectEvents';

// Agent orchestration
export { useAgentOrchestration } from './useAgentOrchestration';
export type { AgentRole, AgentState, AgentOrchestrationState, UseAgentOrchestrationResult } from './useAgentOrchestration';
export type { Agent as OrchestrationAgent } from './useAgentOrchestration';

// Question notifications
export { useQuestionNotifications } from './useQuestionNotifications';
export type { Question, QuestionNotification, QuestionPriority } from './useQuestionNotifications';

// Question queue
export { useQuestionQueue } from './useQuestionQueue';
export type { UseQuestionQueueReturn } from './useQuestionQueue';

// Agent tabs
export { useAgents } from './useAgents';
export type { Agent as TabAgent } from './useAgents';

// Plan steps
export { usePlanSteps } from './usePlanSteps';
export type { Step, UsePlanStepsReturn } from './usePlanSteps';

// Relay channel hooks
export { useRelayChannel } from './useRelayChannel';
export type { UseRelayChannelResult } from './useRelayChannel';
export { useSessionChannel } from './useSessionChannel';
export { usePlanChannel } from './usePlanChannel';

// Status line
export { useStatusLine } from './useStatusLine';
export type { StatusContent, MessageLevel, UseStatusLineReturn, WipeSignal } from './useStatusLine';

// Frame player (animation system)
export { useFramePlayer } from './useFramePlayer';

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
export { useSendMessage } from './useSendMessage';
export { useIdeationApi } from './useIdeationApi';
export { useBlocks } from './useBlocks';

// User settings
export { useUserSettings, shouldAutoCurate, isBlockVisible } from './useUserSettings';
export type { UserSettings } from './useUserSettings';

// Initiatives
export { useInitiatives } from './useInitiatives';
export type { Initiative } from './useInitiatives';

// Command palette
export { useCommandPalette } from './useCommandPalette';
export type { CommandAction } from './useCommandPalette';

// Toast notifications
export { useToast } from './useToast';
export type { Toast, ToastOptions, ToastVariant } from './useToast';

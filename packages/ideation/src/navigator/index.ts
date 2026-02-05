/**
 * Navigator Agent
 *
 * Meta-level assistant that helps users navigate their ideation workflow.
 * Lives in the dashboard and provides guidance on what to work on next.
 */

// Prompt template
export {
  getNavigatorPrompt,
  getNavigatorWelcome,
  getRecommendationResponse,
  type NavigatorPromptContext,
  type SessionSummary,
  type RecentActivity,
  type NavigatorRecommendation,
} from './prompt.js';

// Tool definitions
export {
  NAVIGATOR_TOOLS,
  type ListSessionsInput,
  type RecommendActionInput,
  type StartNewSessionInput,
  type NavigatorToolInput,
  type NavigatorToolResult,
  type ListSessionsResult,
  type RecommendActionResult,
  type StartNewSessionResult,
} from './tools.js';

// Service
export {
  navigatorService,
  initNavigator,
  stopNavigator,
  isNavigatorActive,
  type NavigatorDeps,
} from './service.js';

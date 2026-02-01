/**
 * Interviewer Module - Index
 *
 * Exports the Interviewer service and utilities.
 */

// Config
export {
  INTERVIEWER_CONFIG,
  IDEATION_CHANNEL,
  sessionChannelId,
  isIdeationChannel,
  extractSessionPrefix,
  LLM_CONFIG,
} from './config.js';

// Prompt
export {
  getInterviewerPrompt,
  getWelcomeMessage,
  getMockResponse,
  type InterviewerPromptContext,
} from './prompt.js';

// Tools
export {
  INTERVIEWER_TOOLS,
  type ToolResult,
  type StartSessionInput,
  type ReadSessionInput,
  type AddMessageInput,
  type UpdateUnderstandingInput,
  type SendToPlannerInput,
  type SpawnSpecialistInput,
  type ToolInput,
} from './tools.js';

// Tool Executor
export {
  executeTool,
  getMockToolResult,
  type ToolExecutorDeps,
} from './tool-executor.js';

// History
export {
  conversationHistory,
  type ConversationRole,
  type ConversationMessage,
} from './history.js';

// Specialist Queue
export {
  specialistQueue,
  formatPendingInsights,
  type SpecialistInputType,
  type SpecialistInput,
} from './specialist-queue.js';

// Service
export {
  interviewer,
  initInterviewer,
  stopInterviewer,
  isInterviewerActive,
  type InterviewerDeps,
  type InterviewerState,
} from './service.js';

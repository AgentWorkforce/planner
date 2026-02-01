/**
 * Specialists Module - Index
 *
 * Exports specialist templates, tools, and lifecycle management.
 */

// Templates
export {
  SPECIALIST_TEMPLATES,
  getSpecialistPrompt,
  getTemplateNames,
  hasTemplate,
  type SpecialistTemplate,
  type SpecialistPromptContext,
} from './templates.js';

// Tools
export {
  SPECIALIST_TOOLS,
  type SpecialistToolResult,
  type UpdateObservationsInput,
  type ReadUnderstandingInput,
  type QueueInsightInput,
  type SpecialistToolInput,
} from './tools.js';

// Tool Executor
export {
  executeSpecialistTool,
  getMockSpecialistToolResult,
  type SpecialistToolExecutorDeps,
} from './tool-executor.js';

// Lifecycle
export {
  releaseSpecialists,
  releaseSpecialist,
  hasActiveSpecialists,
  getActiveSpecialistCount,
  type LifecycleDeps,
} from './lifecycle.js';

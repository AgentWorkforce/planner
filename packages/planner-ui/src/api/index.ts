export { ApiError } from './client';
export {
  listPlans,
  getPlan,
  createPlan,
  updatePlan,
  listVersions,
  getVersion,
  createVersion,
  submitVersion,
  approveVersion,
  publishVersion,
} from './plans';
export type { ListPlansParams } from './plans';
export { getExecutionStatus, createMockExecutionStatus } from './execution';
export {
  sendChatMessage,
  streamChatMessage,
  applySuggestion,
  createMockChatResponse,
} from './chat';
export {
  getPendingGates,
  approveGate,
  rejectGate,
  getGateHistory,
  createMockPendingGates,
} from './gates';
export {
  getChangeRequests,
  acceptChangeRequest,
  rejectChangeRequest,
  createMockChangeRequests,
} from './changeRequests';
export {
  getImprovements,
  applyImprovement,
  dismissImprovement,
} from './improvements';
export type { ApiImprovement, ImprovementsResponse } from './improvements';
export {
  getComments,
  getStepComments,
  createComment,
  resolveComment,
  unresolveComment,
  deleteComment,
} from './comments';
export type { CommentsResponse, CommentResponse } from './comments';
export {
  importDocument,
  detectFormat as detectDocumentFormat,
  createPlanFromImport,
} from './import';
export type {
  ImportResponse,
  ImportedScope,
  ImportedStep,
  DetectResponse,
  CreateFromImportRequest,
  CreateFromImportResponse,
} from './import';
export {
  listInitiatives,
  getInitiative,
  createInitiative,
  updateInitiative,
  deleteInitiative,
  reorderInitiatives,
} from './initiatives';
export type {
  Initiative,
  InitiativeStatus,
  CreateInitiativeInput,
  UpdateInitiativeInput,
  PlanCounts,
  InitiativeWithPlanCounts,
  InitiativeWithPlans,
} from '../types/initiative';
export {
  getQuestions,
  getQuestion,
  createQuestion as createQuestionApi,
  answerQuestion,
  dismissQuestion as dismissQuestionApi,
  subscribeToQuestion,
  checkDuplicates,
} from './questions';
export type {
  QuestionsResponse,
  QuestionResponse,
  AnswerQuestionInput,
  CreateQuestionInput,
} from './questions';
export {
  getEvents,
  recordDecision,
  getPreferences,
  findSimilarQuestions,
} from './trajectories';
export type {
  EventsResponse,
  EventResponse,
  PreferencesResponse,
  SimilarQuestionsResponse,
} from './trajectories';

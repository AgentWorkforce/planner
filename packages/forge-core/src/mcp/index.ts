// MCP types
export {
  type ToolSuccessResponse,
  type ToolErrorResponse,
  type ToolResponse,
  type CallToolResult,
  type ToolDefinition,
  type ToolInputSchema,
  type ToolHandlerContext,
  type ToolHandler,
  success,
  error,
  toCallToolResult,
  TaskIdSchema,
  ArtifactInputSchema,
  type ArtifactInput,
  AuditFindingInputSchema,
  type AuditFindingInput,
} from './types.js';

// MCP tools
export {
  // Tool registry
  tools,
  toolRegistry,
  // Handler dispatcher
  handleToolCall,
  handleToolCallMCP,
  // Individual tool definitions
  reportProgressTool,
  reportCompleteTool,
  reportBlockedTool,
  requestHumanInputTool,
  recordDecisionTool,
  reportAuditResultTool,
  // Individual handlers
  handleReportProgress,
  handleReportComplete,
  handleReportBlocked,
  handleRequestHumanInput,
  handleRecordDecision,
  handleReportAuditResult,
  // Types
  type ReportProgressArgs,
  type ReportProgressResult,
  type ReportCompleteArgs,
  type ReportCompleteResult,
  type ReportBlockedArgs,
  type ReportBlockedResult,
  type RequestHumanInputArgs,
  type RequestHumanInputResult,
  type RecordDecisionArgs,
  type RecordDecisionResult,
  type ReportAuditResultArgs,
  type ReportAuditResultResult,
} from './tools/index.js';

// MCP server
export {
  MCPServer,
  createMCPApp,
  startMCPServer,
  type MCPServerConfig,
} from './server.js';

// Answer notification service
export {
  AnswerNotificationService,
  createAnswerNotificationService,
  createNotifySubscribersFn,
  type QuestionAnsweredMessage,
  type SendRelayMessageFn,
  type NotifyAgentsResult,
} from './answer-notification.js';

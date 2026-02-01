import type { Tool, CallToolResult } from '@modelcontextprotocol/sdk/types.js';

/**
 * Successful tool response.
 */
export interface ToolSuccessResponse<T = unknown> {
  success: true;
  data: T;
}

/**
 * Error tool response.
 */
export interface ToolErrorResponse {
  success: false;
  error: string;
}

/**
 * Tool response - either success or error.
 */
export type ToolResponse<T = unknown> = ToolSuccessResponse<T> | ToolErrorResponse;

/**
 * Create success response.
 */
export function success<T>(data: T): ToolResponse<T> {
  return { success: true, data };
}

/**
 * Create error response.
 */
export function error(message: string): ToolErrorResponse {
  return { success: false, error: message };
}

/**
 * Convert ToolResponse to MCP CallToolResult.
 */
export function toCallToolResult(response: ToolResponse): CallToolResult {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
    isError: !response.success,
  };
}

/**
 * Tool definition with handler.
 */
export interface ToolDefinition {
  tool: Tool;
  handler: (args: Record<string, unknown>) => ToolResponse;
}

import { z } from 'zod';

// ============================================
// MCP Tool Response Types
// ============================================

/**
 * Successful tool response
 */
export interface ToolSuccessResponse<T> {
  success: true;
  data: T;
}

/**
 * Error tool response
 */
export interface ToolErrorResponse {
  success: false;
  error: string;
}

/**
 * Union type for tool responses
 */
export type ToolResponse<T> = ToolSuccessResponse<T> | ToolErrorResponse;

// ============================================
// Helper Functions
// ============================================

/**
 * Creates a successful tool response
 */
export function success<T>(data: T): ToolSuccessResponse<T> {
  return { success: true, data };
}

/**
 * Creates an error tool response
 */
export function error(message: string): ToolErrorResponse {
  return { success: false, error: message };
}

// ============================================
// MCP SDK Types (simplified for compatibility)
// ============================================

/**
 * MCP CallToolResult format compatible with MCP SDK
 */
export interface CallToolResult {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  isError?: boolean;
}

/**
 * Converts a ToolResponse to MCP SDK CallToolResult format
 */
export function toCallToolResult<T>(response: ToolResponse<T>): CallToolResult {
  if (response.success) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.data, null, 2),
        },
      ],
      isError: false,
    };
  } else {
    return {
      content: [
        {
          type: 'text',
          text: response.error,
        },
      ],
      isError: true,
    };
  }
}

// ============================================
// Tool Definition Types
// ============================================

/**
 * Tool input schema definition using JSON Schema format
 */
export interface ToolInputSchema {
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
}

/**
 * MCP Tool definition
 */
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: ToolInputSchema;
}

// ============================================
// Tool Handler Context
// ============================================

import type { ForgeStorage } from '../storage/interface.js';
import type { TrajectoryCapture } from '../services/trajectory-capture.js';
import type { HealthMonitor } from '../services/health-monitor.js';
import type { GateResultRegistry } from '../services/gate-registry.js';

/**
 * Context provided to tool handlers
 */
export interface ToolHandlerContext {
  storage: ForgeStorage;
  trajectoryCapture: TrajectoryCapture;
  healthMonitor?: HealthMonitor;
  /** Gate registry for quality gate result coordination */
  gateRegistry?: GateResultRegistry;
  /** Send relay message to an agent */
  sendRelayMessage?: (agentId: string, message: Record<string, unknown>) => void;
  /** Emit SSE event */
  emitSSE?: (eventType: string, payload: Record<string, unknown>) => void;
}

/**
 * Tool handler function type
 */
export type ToolHandler<TArgs, TResult> = (
  context: ToolHandlerContext,
  args: TArgs
) => ToolResponse<TResult>;

// ============================================
// Common Zod Schemas
// ============================================

/**
 * Common task_id schema
 */
export const TaskIdSchema = z.string().uuid();

/**
 * Artifact schema for tool inputs
 */
export const ArtifactInputSchema = z.object({
  type: z.enum(['commit', 'pr', 'file', 'deployment', 'test_result']),
  reference: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
});

export type ArtifactInput = z.infer<typeof ArtifactInputSchema>;

/**
 * Audit finding schema for tool inputs
 */
export const AuditFindingInputSchema = z.object({
  criterion_id: z.string().min(1),
  status: z.enum(['pass', 'fail']),
  details: z.string(),
});

export type AuditFindingInput = z.infer<typeof AuditFindingInputSchema>;

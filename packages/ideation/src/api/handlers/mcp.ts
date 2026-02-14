/**
 * MCP HTTP Transport Handlers for Ideation
 *
 * Provides HTTP endpoints for interviewer agents to call MCP tools.
 * POST /mcp/tools/list - List available tools
 * POST /mcp/tools/call - Execute a tool
 */

import type { Request, Response, NextFunction } from 'express';
import { INTERVIEWER_TOOLS } from '../../interviewer/tools.js';
import { executeTool, type ToolExecutorDeps } from '../../interviewer/tool-executor.js';
import { sendChannelMessage } from '../../relay/client.js';
import { sessionChannelId } from '../../interviewer/config.js';
import { createTranscriptMessage } from '../../domain/index.js';

/**
 * Request body for tool call endpoint.
 */
interface ToolCallRequest {
  name: string;
  arguments?: Record<string, unknown>;
}

// Track session_id from tool calls for channel routing.
// The first tool call with session_id sets this for subsequent calls.
let lastSessionId: string | null = null;

/**
 * Build a short summary string for a tool action indicator.
 * Returns empty string for tools that don't need a summary.
 */
function buildToolSummary(
  toolName: string,
  args: Record<string, unknown>,
  resultData: unknown
): string {
  switch (toolName) {
    case 'spawn_specialist':
      return (args.name as string) || '';
    case 'update_understanding':
      return (args.specialist_name as string) || '';
    case 'graduate_blocks': {
      const data = resultData as Record<string, unknown> | undefined;
      const count = data?.graduated_count ?? (args.block_ids as unknown[])?.length;
      return count ? `${count} blocks` : '';
    }
    case 'start_session': {
      const intent = (args.initial_intent as string) || '';
      return intent.length > 30 ? intent.slice(0, 30) + '...' : intent;
    }
    default:
      return '';
  }
}

/**
 * Creates MCP HTTP transport handlers for ideation with injected dependencies.
 */
export function createIdeationMcpHandlers(deps: ToolExecutorDeps) {
  return {
    /**
     * POST /mcp/tools/list
     * Returns list of available interviewer tools with their schemas.
     */
    listTools: (_req: Request, res: Response, _next: NextFunction) => {
      // Transform Anthropic tools to HTTP response format
      // Note: Anthropic tools use input_schema, not inputSchema
      const toolList = INTERVIEWER_TOOLS.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.input_schema,
      }));

      res.json({ tools: toolList });
    },

    /**
     * POST /mcp/tools/call
     * Execute a tool with the given arguments.
     * Returns { result: any } on success or { error: string } on failure.
     */
    callTool: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = req.body as ToolCallRequest;

        // Validate request
        if (!body.name || typeof body.name !== 'string') {
          res.status(400).json({
            error: 'INVALID_REQUEST',
            message: 'name is required and must be a string'
          });
          return;
        }

        // Check if tool exists
        const toolExists = INTERVIEWER_TOOLS.some((t) => t.name === body.name);
        if (!toolExists) {
          res.status(404).json({
            error: 'TOOL_NOT_FOUND',
            message: `Unknown tool: ${body.name}`
          });
          return;
        }

        const args = body.arguments ?? {};
        const result = await executeTool(body.name, args, deps);

        // executeTool returns { success, data?, error? }
        if (!result.success) {
          res.status(500).json({
            error: 'TOOL_EXECUTION_FAILED',
            message: result.error ?? 'Unknown error'
          });
          return;
        }

        res.json({ result: result.data });

        // --- Emit channel messages for chat indicators ---

        // Track session_id from tool args
        const sessionId = (args.session_id as string) || lastSessionId;
        if (args.session_id) {
          lastSessionId = args.session_id as string;
        }
        // For start_session, extract from result
        if (body.name === 'start_session' && !sessionId) {
          const data = result.data as Record<string, unknown> | undefined;
          const newSessionId = data?.session_id as string;
          if (newSessionId) {
            lastSessionId = newSessionId;
          }
        }

        const effectiveSessionId = lastSessionId || sessionId;
        if (!effectiveSessionId) return; // Can't route without session

        const channelId = sessionChannelId(effectiveSessionId);

        // Handle report_agent_status: emit thinking indicator (not tool_action)
        if (body.name === 'report_agent_status') {
          const thought = args.thought as string;
          if (thought) {
            const data = { type: 'thinking' as const, thought };
            sendChannelMessage(channelId, '', data);
            // Persist to transcript
            const msg = createTranscriptMessage('system', '', data);
            deps.storage.appendTranscript(effectiveSessionId, msg).catch(() => {});
          }
          return; // Don't also emit tool_action
        }

        // Handle report_tool_use: emit as tool_action indicator
        if (body.name === 'report_tool_use') {
          const tool = args.tool as string;
          const summary = args.summary as string;
          const filePath = args.file_path as string;
          const displaySummary = filePath
            ? `${filePath.split('/').pop()} — ${summary}`
            : summary;
          const data = { type: 'tool_action' as const, tool, summary: displaySummary };
          sendChannelMessage(channelId, '', data);
          // Persist to transcript
          const msg = createTranscriptMessage('system', '', data);
          deps.storage.appendTranscript(effectiveSessionId, msg).catch(() => {});
          return;
        }

        // Skip noisy/internal tools (users already see messages directly)
        if (body.name === 'read_session' || body.name === 'report_tool_use') return;

        // Emit tool_action for all other tools
        const summary = buildToolSummary(body.name, args, result.data);
        const data = { type: 'tool_action' as const, tool: body.name, summary };
        sendChannelMessage(channelId, '', data);
        // Persist to transcript
        const msg = createTranscriptMessage('system', '', data);
        deps.storage.appendTranscript(effectiveSessionId, msg).catch(() => {});
      } catch (err) {
        next(err);
      }
    },
  };
}

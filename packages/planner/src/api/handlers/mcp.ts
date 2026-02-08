/**
 * MCP HTTP Transport Handlers
 *
 * Provides HTTP endpoints for planning agents to call MCP tools.
 * POST /mcp/tools/list - List available tools (public)
 * POST /mcp/tools/call - Execute a tool (authenticated, uses session context)
 */

import type { Request, Response, NextFunction } from 'express';
import type { PlanStorage } from '../../storage/interface.js';
import type { AuthenticatedMcpRequest, McpSessionContext } from '../middleware/mcp-auth.js';
import { tools, handleToolCall } from '../../mcp/tools/index.js';

/**
 * Request body for tool call endpoint.
 */
interface ToolCallRequest {
  name: string;
  arguments?: Record<string, unknown>;
}

/**
 * Tools that require a plan_id in their arguments.
 * For authenticated sessions, the session's plan_id is used as default.
 */
const TOOLS_REQUIRING_PLAN_ID = [
  'read_plan',
  'add_step',
  'edit_step',
  'remove_step',
  'set_dependencies',
  'add_criteria',
  'add_gate',
  'submit_plan',
];

/**
 * Inject session's plan_id into tool arguments if not provided.
 */
function injectSessionContext(
  toolName: string,
  args: Record<string, unknown>,
  session: McpSessionContext | undefined
): Record<string, unknown> {
  // If no session context, return args as-is
  if (!session) {
    return args;
  }

  // Only inject plan_id for tools that need it and don't have it
  if (TOOLS_REQUIRING_PLAN_ID.includes(toolName) && !args.plan_id) {
    return { ...args, plan_id: session.plan_id };
  }

  return args;
}

/**
 * Validate that the requested plan_id matches the session's plan_id.
 * Agents can only operate on their assigned plan.
 */
function validatePlanScope(
  toolName: string,
  args: Record<string, unknown>,
  session: McpSessionContext | undefined
): string | null {
  // If no session (unauthenticated), skip validation
  if (!session) {
    return null;
  }

  // For tools that take a plan_id, ensure it matches the session
  if (TOOLS_REQUIRING_PLAN_ID.includes(toolName) && args.plan_id) {
    if (args.plan_id !== session.plan_id) {
      return `Access denied: agent can only access plan ${session.plan_id}`;
    }
  }

  return null;
}

/**
 * Creates MCP HTTP transport handlers with injected storage dependency.
 */
export function createMcpHandlers(storage: PlanStorage) {
  return {
    /**
     * POST /mcp/tools/list
     * Returns list of available tools with their schemas.
     */
    listTools: (_req: Request, res: Response, _next: NextFunction) => {
      // Transform tools to HTTP response format
      const toolList = tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      }));

      res.json({ tools: toolList });
    },

    /**
     * POST /mcp/tools/call
     * Execute a tool with the given arguments.
     * Authenticated requests have session context injected automatically.
     * Returns { result: any } on success or { error: string } on failure.
     */
    callTool: (req: Request, res: Response, next: NextFunction) => {
      try {
        const authReq = req as AuthenticatedMcpRequest;
        const body = req.body as ToolCallRequest;
        const session = authReq.mcpSession;

        // Validate request
        if (!body.name || typeof body.name !== 'string') {
          res.status(400).json({ error: 'INVALID_REQUEST', message: 'name is required and must be a string' });
          return;
        }

        // Check if tool exists
        const toolExists = tools.some((t) => t.name === body.name);
        if (!toolExists) {
          res.status(404).json({ error: 'TOOL_NOT_FOUND', message: `Unknown tool: ${body.name}` });
          return;
        }

        // Inject session context into arguments
        const argsWithContext = injectSessionContext(body.name, body.arguments ?? {}, session);

        // Validate plan scope (agent can only access its assigned plan)
        const scopeError = validatePlanScope(body.name, argsWithContext, session);
        if (scopeError) {
          res.status(403).json({ error: 'ACCESS_DENIED', message: scopeError });
          return;
        }

        // Execute the tool
        const result = handleToolCall(storage, body.name, argsWithContext);

        // handleToolCall returns CallToolResult with content array
        // Extract and parse the result from the MCP format
        // Note: We always return the parsed result, even for business logic errors
        // like VERSION_CONFLICT, so clients can handle them programmatically.
        const content = result.content?.[0];
        if (content?.type === 'text') {
          try {
            const parsed = JSON.parse(content.text);
            res.json({ result: parsed });
          } catch {
            res.json({ result: content.text });
          }
        } else {
          res.json({ result: null });
        }
      } catch (err) {
        next(err);
      }
    },
  };
}

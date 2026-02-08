/**
 * MCP Tool Routes — Exposes forge MCP tools via HTTP endpoints.
 *
 * These routes allow agents to call forge MCP tools (report_complete,
 * report_progress, report_blocked, etc.) via HTTP POST requests.
 * This is the bridge between spawned agents and the forge orchestrator.
 */

import { Router, type Request, type Response } from 'express';
import type { ForgeStorage } from '../../storage/interface.js';
import type { TrajectoryCapture } from '../../services/trajectory-capture.js';
import { tools, handleToolCallMCP } from '../../mcp/tools/index.js';
import type { ToolHandlerContext } from '../../mcp/types.js';

// ============================================
// Types
// ============================================

export interface RegisterMCPRoutesOptions {
  trajectoryCapture: TrajectoryCapture;
}

// ============================================
// Route Registration
// ============================================

/**
 * Registers MCP tool routes on the forge router.
 *
 * Endpoints:
 * - POST /mcp/tools/list — List available MCP tools
 * - POST /mcp/tools/call — Call an MCP tool by name
 */
export function registerMCPRoutes(
  router: Router,
  storage: ForgeStorage,
  options: RegisterMCPRoutesOptions
): void {
  const context: ToolHandlerContext = {
    storage,
    trajectoryCapture: options.trajectoryCapture,
  };

  // POST /mcp/tools/list — list available tools
  router.post('/mcp/tools/list', (_req: Request, res: Response) => {
    res.json({
      tools: tools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      })),
    });
  });

  // POST /mcp/tools/call — call a tool
  router.post('/mcp/tools/call', (req: Request, res: Response) => {
    const { name, arguments: args } = req.body;

    if (!name || typeof name !== 'string') {
      res.status(400).json({ error: 'Missing required field: name', isError: true });
      return;
    }

    // Allow task_id from X-Task-ID header as fallback
    const taskIdHeader = req.headers['x-task-id'];
    const mergedArgs = { ...(args ?? {}) };
    if (taskIdHeader && typeof taskIdHeader === 'string' && !('task_id' in mergedArgs)) {
      mergedArgs.task_id = taskIdHeader;
    }

    const result = handleToolCallMCP(context, name, mergedArgs);
    res.json(result);
  });
}

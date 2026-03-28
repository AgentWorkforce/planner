/**
 * MCP HTTP routes for Cultivate
 *
 * Follows the forge-core MCP pattern:
 *   POST /mcp/tools/list  — returns tool definitions
 *   POST /mcp/tools/call  — executes a tool by name
 */

import type { Router } from 'express';
import type { CultivateStorage } from '../storage/interface.js';
import { CULTIVATE_TOOLS } from './tools.js';
import { handleToolCall } from './handler.js';

/**
 * Register MCP routes on the given Express router.
 *
 * @param router  - Express Router (already mounted at /api/cultivate)
 * @param storage - CultivateStorage instance for data access
 */
export function registerMCPRoutes(router: Router, storage: CultivateStorage): void {
  /**
   * POST /mcp/tools/list
   * Returns the list of available MCP tools with their JSON Schema definitions.
   */
  router.post('/mcp/tools/list', (_req, res) => {
    res.json({ tools: CULTIVATE_TOOLS });
  });

  /**
   * POST /mcp/tools/call
   * Executes the named tool with the provided arguments.
   *
   * Body: { name: string, arguments?: Record<string, unknown> }
   */
  router.post('/mcp/tools/call', async (req, res, next) => {
    try {
      const { name, arguments: args } = req.body as {
        name?: string;
        arguments?: Record<string, unknown>;
      };

      if (!name || typeof name !== 'string') {
        res.status(400).json({
          content: [{ type: 'text', text: 'Missing required field: name' }],
          isError: true,
        });
        return;
      }

      const result = await handleToolCall(storage, name, args ?? {});
      res.json(result);
    } catch (err) {
      next(err);
    }
  });
}

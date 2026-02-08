import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { PlanStorage } from '../storage/interface.js';
import { tools, handleToolCall } from './tools/index.js';

/**
 * Create and configure MCP server for Planner tools.
 */
export function createMcpServer(storage: PlanStorage): Server {
  const server = new Server(
    {
      name: 'planner-mcp',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Handle list tools request
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    return handleToolCall(storage, name, args ?? {});
  });

  return server;
}

/**
 * Start MCP server with stdio transport.
 */
export async function startMcpServer(storage: PlanStorage): Promise<void> {
  const server = createMcpServer(storage);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

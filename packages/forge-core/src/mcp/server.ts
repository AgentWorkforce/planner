import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import type { ToolHandlerContext, CallToolResult } from './types.js';
import { tools, handleToolCallMCP } from './tools/index.js';
import type { ForgeStorage } from '../storage/interface.js';
import type { TrajectoryCapture } from '../services/trajectory-capture.js';
import type { HealthMonitor } from '../services/health-monitor.js';

// ============================================
// Server Configuration
// ============================================

const DEFAULT_MCP_PORT = 3100;

export interface MCPServerConfig {
  /** Port to listen on. Default: 3100 */
  port?: number;
  /** ForgeStorage instance */
  storage: ForgeStorage;
  /** TrajectoryCapture instance */
  trajectoryCapture: TrajectoryCapture;
  /** Optional HealthMonitor instance */
  healthMonitor?: HealthMonitor;
  /** Optional callback to send relay messages to agents */
  sendRelayMessage?: (agentId: string, message: Record<string, unknown>) => void;
  /** Optional callback to emit SSE events */
  emitSSE?: (eventType: string, payload: Record<string, unknown>) => void;
  /** Enable CORS. Default: true */
  enableCors?: boolean;
}

// ============================================
// Request/Response Types
// ============================================

interface ListToolsResponse {
  tools: Array<{
    name: string;
    description: string;
    inputSchema: {
      type: 'object';
      properties: Record<string, unknown>;
      required?: string[];
    };
  }>;
}

interface CallToolRequest {
  name: string;
  arguments?: Record<string, unknown>;
}

// ============================================
// Middleware
// ============================================

/**
 * Middleware to extract and validate X-Task-ID header for authorization
 */
function taskIdAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const taskId = req.headers['x-task-id'];

  // For list tools, no auth required
  if (req.path === '/mcp/tools/list') {
    return next();
  }

  // For tool calls, task_id can come from header or body
  // Header takes precedence for authorization purposes
  if (taskId && typeof taskId === 'string') {
    // Store in request for later use
    (req as Request & { taskIdFromHeader?: string }).taskIdFromHeader = taskId;
  }

  next();
}

/**
 * Error handling middleware
 */
function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('[MCP Server] Error:', err);
  res.status(500).json({
    error: err.message,
    isError: true,
  });
}

// ============================================
// Route Handlers
// ============================================

/**
 * Handler for POST /mcp/tools/list
 */
function createListToolsHandler(): (req: Request, res: Response) => void {
  return (_req: Request, res: Response): void => {
    const response: ListToolsResponse = {
      tools: tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
    };
    res.json(response);
  };
}

/**
 * Handler for POST /mcp/tools/call
 */
function createCallToolHandler(
  context: ToolHandlerContext
): (req: Request, res: Response) => void {
  return (req: Request, res: Response): void => {
    const body = req.body as CallToolRequest;

    if (!body.name || typeof body.name !== 'string') {
      res.status(400).json({
        content: [{ type: 'text', text: 'Missing required field: name' }],
        isError: true,
      } as CallToolResult);
      return;
    }

    // Get task_id from header if present (for authorization tracking)
    const taskIdFromHeader = (req as Request & { taskIdFromHeader?: string })
      .taskIdFromHeader;

    // Merge header task_id with arguments (arguments take precedence if provided)
    const args = body.arguments ?? {};
    if (taskIdFromHeader && !('task_id' in args)) {
      args.task_id = taskIdFromHeader;
    }

    // Execute the tool
    const result = handleToolCallMCP(context, body.name, args);
    res.json(result);
  };
}

// ============================================
// Server Creation
// ============================================

/**
 * Creates an Express app configured as an MCP server
 */
export function createMCPApp(config: MCPServerConfig): express.Application {
  const app = express();

  // Middleware
  if (config.enableCors !== false) {
    app.use(cors());
  }
  app.use(express.json());
  app.use(taskIdAuthMiddleware);

  // Build tool handler context
  const context: ToolHandlerContext = {
    storage: config.storage,
    trajectoryCapture: config.trajectoryCapture,
    healthMonitor: config.healthMonitor,
    sendRelayMessage: config.sendRelayMessage,
    emitSSE: config.emitSSE,
  };

  // Routes
  app.post('/mcp/tools/list', createListToolsHandler());
  app.post('/mcp/tools/call', createCallToolHandler(context));

  // Health check endpoint
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'forge-mcp' });
  });

  // Error handling
  app.use(errorHandler);

  return app;
}

/**
 * Starts the MCP server
 */
export function startMCPServer(
  config: MCPServerConfig
): { app: express.Application; server: ReturnType<express.Application['listen']> } {
  const port = config.port ?? DEFAULT_MCP_PORT;
  const app = createMCPApp(config);

  const server = app.listen(port, () => {
    console.log(`[MCP Server] Listening on port ${port}`);
    console.log(`[MCP Server] Tools available: ${tools.map((t) => t.name).join(', ')}`);
  });

  return { app, server };
}

// ============================================
// Server Class (alternative API)
// ============================================

/**
 * MCP Server class for more control over lifecycle
 */
export class MCPServer {
  private app: express.Application;
  private server: ReturnType<express.Application['listen']> | null = null;
  private config: MCPServerConfig;

  constructor(config: MCPServerConfig) {
    this.config = config;
    this.app = createMCPApp(config);
  }

  /**
   * Starts the server
   */
  start(): Promise<void> {
    return new Promise((resolve) => {
      const port = this.config.port ?? DEFAULT_MCP_PORT;
      this.server = this.app.listen(port, () => {
        console.log(`[MCP Server] Listening on port ${port}`);
        console.log(`[MCP Server] Tools available: ${tools.map((t) => t.name).join(', ')}`);
        resolve();
      });
    });
  }

  /**
   * Stops the server
   */
  stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close((err) => {
        if (err) {
          reject(err);
        } else {
          console.log('[MCP Server] Stopped');
          this.server = null;
          resolve();
        }
      });
    });
  }

  /**
   * Gets the Express app instance
   */
  getApp(): express.Application {
    return this.app;
  }

  /**
   * Gets the port the server is configured to use
   */
  getPort(): number {
    return this.config.port ?? DEFAULT_MCP_PORT;
  }

  /**
   * Checks if the server is running
   */
  isRunning(): boolean {
    return this.server !== null;
  }
}

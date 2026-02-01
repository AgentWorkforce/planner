/**
 * MCP Authentication Middleware
 *
 * Validates session tokens for MCP HTTP endpoints.
 * Extracts session context (plan_id, agent_id) and attaches to request.
 */

import type { Request, Response, NextFunction } from 'express';
import type { PlanStorage, Session } from '../../storage/interface.js';

/**
 * Session context attached to authenticated MCP requests.
 */
export interface McpSessionContext {
  session_id: string;
  plan_id: string;
  agent_id: string;
}

/**
 * Extended request type with MCP session context.
 */
export interface AuthenticatedMcpRequest extends Request {
  mcpSession?: McpSessionContext;
}

/**
 * Create MCP authentication middleware.
 * Validates Bearer token and attaches session context to request.
 */
export function createMcpAuthMiddleware(storage: PlanStorage) {
  return (req: AuthenticatedMcpRequest, res: Response, next: NextFunction) => {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Missing or invalid Authorization header. Expected: Bearer <token>',
      });
      return;
    }

    const token = authHeader.slice(7); // Remove 'Bearer ' prefix
    if (!token) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Empty token',
      });
      return;
    }

    // Look up session by token
    const session: Session | null = storage.getSessionByToken(token);
    if (!session) {
      res.status(401).json({
        error: 'INVALID_TOKEN',
        message: 'Session token not found or invalid',
      });
      return;
    }

    // Check if session has expired
    const now = new Date();
    const expiresAt = new Date(session.expires_at);
    if (now > expiresAt) {
      res.status(401).json({
        error: 'TOKEN_EXPIRED',
        message: 'Session token has expired',
      });
      return;
    }

    // Attach session context to request
    req.mcpSession = {
      session_id: session.session_id,
      plan_id: session.plan_id,
      agent_id: session.agent_id,
    };

    next();
  };
}

/**
 * Check if the request plan matches the session's plan.
 * Use in tool handlers to enforce session scoping.
 */
export function validatePlanAccess(session: McpSessionContext, requestedPlanId: string): boolean {
  return session.plan_id === requestedPlanId;
}

/**
 * Create optional MCP authentication middleware.
 * If a valid Bearer token is present, attaches session context.
 * If no token or invalid token, continues without session (allows unauthenticated access).
 * Use this for endpoints that work both authenticated and unauthenticated.
 */
export function createOptionalMcpAuthMiddleware(storage: PlanStorage) {
  return (req: AuthenticatedMcpRequest, res: Response, next: NextFunction) => {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No auth header - continue without session context
      next();
      return;
    }

    const token = authHeader.slice(7); // Remove 'Bearer ' prefix
    if (!token) {
      // Empty token - continue without session context
      next();
      return;
    }

    // Look up session by token
    const session: Session | null = storage.getSessionByToken(token);
    if (!session) {
      // Invalid token - continue without session context
      // (Could also return 401 here if we want strict auth)
      next();
      return;
    }

    // Check if session has expired
    const now = new Date();
    const expiresAt = new Date(session.expires_at);
    if (now > expiresAt) {
      // Expired token - continue without session context
      next();
      return;
    }

    // Attach session context to request
    req.mcpSession = {
      session_id: session.session_id,
      plan_id: session.plan_id,
      agent_id: session.agent_id,
    };

    next();
  };
}

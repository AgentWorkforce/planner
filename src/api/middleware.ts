import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

/**
 * Standard API error response shape.
 */
export interface ApiError {
  error: string;
  details?: unknown;
}

/**
 * Custom error class for API errors with status codes.
 */
export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

/**
 * Not found error helper.
 */
export function notFound(resource: string): HttpError {
  return new HttpError(404, `${resource} not found`);
}

/**
 * Bad request error helper.
 */
export function badRequest(message: string, details?: unknown): HttpError {
  return new HttpError(400, message, details);
}

/**
 * Error handling middleware.
 * Converts errors to consistent JSON responses.
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof HttpError) {
    const response: ApiError = { error: err.message };
    if (err.details) {
      response.details = err.details;
    }
    res.status(err.statusCode).json(response);
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Validation error',
      details: err.errors,
    } satisfies ApiError);
    return;
  }

  // Handle JSON parsing errors (from body-parser)
  if (err instanceof SyntaxError && 'status' in err && err.status === 400) {
    res.status(400).json({
      error: 'Invalid JSON',
    } satisfies ApiError);
    return;
  }

  // Unexpected errors
  console.error('Unexpected error:', err);
  res.status(500).json({
    error: 'Internal server error',
  } satisfies ApiError);
}

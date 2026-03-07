/**
 * Global Error Handler Middleware
 *
 * Catches all errors and formats consistent error responses
 * Logs errors with request context
 * Hides stack traces in production
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { APIError } from '../utils/errors';

export interface ErrorResponse {
  error: string;
  message: string;
  requestId?: string;
  details?: any;
  stack?: string;
}

/**
 * Global error handler
 *
 * Formats errors consistently and logs with context
 *
 * @param err Error object
 * @param req Express request
 * @param res Express response
 * @param next Express next function
 */
export function errorHandler(
  err: Error | APIError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // If response already sent, delegate to Express default handler
  if (res.headersSent) {
    next(err);
    return;
  }

  // Determine error type and status code
  const isAPIError = err instanceof APIError;
  const statusCode = isAPIError ? err.statusCode : 500;
  const errorName = err.name || 'Error';

  // Log error with context
  logger.error('Request error', {
    requestId: req.id,
    path: req.path,
    method: req.method,
    statusCode,
    errorName,
    errorMessage: err.message,
    stack: err.stack,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  // Build error response
  const response: ErrorResponse = {
    error: errorName,
    message: err.message || 'An unexpected error occurred',
    requestId: req.id,
  };

  // Add details if available (APIError)
  if (isAPIError && (err as APIError).details) {
    response.details = (err as APIError).details;
  }

  // Include stack trace in development mode
  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }

  // Send error response
  res.status(statusCode).json(response);
}

/**
 * 404 Not Found handler
 *
 * Handles requests to undefined routes
 */
export function notFoundHandler(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const error = new APIError(404, 'Route not found', 'router', false, {
    path: req.path,
    method: req.method,
  });

  next(error);
}

/**
 * Async handler wrapper
 *
 * Wraps async route handlers to catch errors
 * Passes errors to error handler middleware
 *
 * @param fn Async route handler function
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Request ID Middleware
 *
 * Generates unique ID for each request
 * Adds to request object and response header
 * Used for request tracking and logging
 */

import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

/**
 * Generate and attach request ID
 *
 * Creates UUID for each request
 * Adds to req.id and x-request-id response header
 *
 * @param req Express request
 * @param res Express response
 * @param next Express next function
 */
export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Check if request ID already exists (from proxy/load balancer)
  const existingId = req.header('x-request-id');

  // Use existing ID or generate new one
  const requestId = existingId || randomUUID();

  // Attach to request object
  req.id = requestId;

  // Add to response header
  res.setHeader('x-request-id', requestId);

  next();
}

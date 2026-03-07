/**
 * API Key Authentication Middleware
 *
 * Validates API key from x-api-key header
 * Returns 401 if missing or invalid
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { APIError } from '../utils/errors';

// Load valid API keys from environment
const validApiKeys = new Set(
  (process.env.API_KEYS || '').split(',').filter(Boolean)
);

// Check if API key validation is enabled
const isAuthEnabled = process.env.DISABLE_AUTH !== 'true';

export interface AuthenticatedRequest extends Request {
  apiKey?: string;
  authenticated: boolean;
}

/**
 * Authenticate API key from request header
 *
 * Checks x-api-key header against valid keys
 * Adds apiKey and authenticated to request object
 *
 * @param req Express request
 * @param res Express response
 * @param next Express next function
 */
export function authenticateApiKey(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authReq = req as AuthenticatedRequest;

  // Skip auth if disabled (development mode)
  if (!isAuthEnabled) {
    authReq.authenticated = true;
    logger.debug('Auth disabled, skipping API key check');
    next();
    return;
  }

  // Get API key from header
  const apiKey = req.header('x-api-key');

  if (!apiKey) {
    logger.warn('Missing API key in request', {
      requestId: req.id,
      path: req.path,
      ip: req.ip,
    });

    res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing API key. Provide x-api-key header.',
      requestId: req.id,
    });
    return;
  }

  // Validate API key
  if (!validApiKeys.has(apiKey)) {
    logger.warn('Invalid API key in request', {
      requestId: req.id,
      path: req.path,
      ip: req.ip,
      apiKeyPrefix: apiKey.substring(0, 8) + '...',
    });

    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid API key',
      requestId: req.id,
    });
    return;
  }

  // API key is valid
  authReq.apiKey = apiKey;
  authReq.authenticated = true;

  logger.debug('API key authenticated', {
    requestId: req.id,
    path: req.path,
  });

  next();
}

/**
 * Optional authentication middleware
 *
 * Checks API key but doesn't fail if missing
 * Useful for endpoints that have both public and authenticated access
 */
export function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authReq = req as AuthenticatedRequest;

  const apiKey = req.header('x-api-key');

  if (apiKey && validApiKeys.has(apiKey)) {
    authReq.apiKey = apiKey;
    authReq.authenticated = true;
  } else {
    authReq.authenticated = false;
  }

  next();
}

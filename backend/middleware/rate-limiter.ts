import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { logger } from '../utils/logger';

/**
 * Express Rate Limiting Middleware
 *
 * Protects API endpoints from abuse by limiting request rates per IP address.
 *
 * CRITICAL: This is different from API rate limiting (handled in http-client.ts).
 * This middleware protects OUR API endpoints from excessive requests.
 */

/**
 * Standard rate limiter for general API endpoints
 *
 * Limits: 100 requests per 15 minutes per IP
 */
export const standardRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  message: {
    error: {
      message: 'Too many requests from this IP, please try again later.',
      type: 'RateLimitError',
      status: 429,
      timestamp: new Date().toISOString()
    }
  },
  handler: (req: Request, res: Response) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      endpoint: req.path,
      method: req.method
    });

    res.status(429).json({
      error: {
        message: 'Too many requests from this IP, please try again in 15 minutes.',
        type: 'RateLimitError',
        status: 429,
        timestamp: new Date().toISOString()
      }
    });
  },
  skip: (req: Request) => {
    // Skip rate limiting for health checks
    return req.path === '/health' || req.path === '/ready';
  }
});

/**
 * Strict rate limiter for expensive operations
 *
 * Limits: 10 requests per 15 minutes per IP
 * Use for: Audit creation, bulk enrichment, report generation
 */
export const strictRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      message: 'Rate limit exceeded for this operation. Please try again later.',
      type: 'RateLimitError',
      status: 429,
      timestamp: new Date().toISOString()
    }
  },
  handler: (req: Request, res: Response) => {
    logger.warn('Strict rate limit exceeded', {
      ip: req.ip,
      endpoint: req.path,
      method: req.method
    });

    res.status(429).json({
      error: {
        message: 'Rate limit exceeded for expensive operations. Please try again in 15 minutes.',
        type: 'RateLimitError',
        status: 429,
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * Lenient rate limiter for read-only operations
 *
 * Limits: 300 requests per 15 minutes per IP
 * Use for: GET endpoints, status checks, metrics
 */
export const lenientRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // 300 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      message: 'Too many read requests from this IP, please try again later.',
      type: 'RateLimitError',
      status: 429,
      timestamp: new Date().toISOString()
    }
  },
  skip: (req: Request) => {
    // Skip rate limiting for health checks
    return req.path === '/health' || req.path === '/ready';
  }
});

/**
 * Authentication endpoint rate limiter
 *
 * Limits: 5 failed attempts per 15 minutes per IP
 * Use for: Login, password reset, API key validation
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Only count failed requests
  message: {
    error: {
      message: 'Too many authentication attempts, please try again in 15 minutes.',
      type: 'RateLimitError',
      status: 429,
      timestamp: new Date().toISOString()
    }
  },
  handler: (req: Request, res: Response) => {
    logger.warn('Authentication rate limit exceeded', {
      ip: req.ip,
      endpoint: req.path
    });

    res.status(429).json({
      error: {
        message: 'Too many authentication attempts. Your IP has been temporarily blocked.',
        type: 'RateLimitError',
        status: 429,
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * Create custom rate limiter with specific settings
 *
 * @param windowMs - Time window in milliseconds
 * @param max - Max requests per window
 * @param message - Custom error message
 */
export function createRateLimiter(
  windowMs: number,
  max: number,
  message: string = 'Too many requests'
) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: {
        message,
        type: 'RateLimitError',
        status: 429,
        timestamp: new Date().toISOString()
      }
    }
  });
}

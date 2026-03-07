/**
 * Rate Limiting Middleware
 *
 * Protects API endpoints from abuse
 * Uses Redis for distributed rate limiting
 */

import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { redis } from '../queue/setup';
import { Request, Response } from 'express';

/**
 * Default rate limit: 100 requests per 15 minutes per IP
 */
export const defaultRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  store: new RedisStore({
    // @ts-ignore - Redis client compatibility
    client: redis,
    prefix: 'rl:default:',
  }),
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: res.getHeader('Retry-After'),
      requestId: req.id,
    });
  },
});

/**
 * Strict rate limit for expensive operations
 * 10 requests per hour
 */
export const strictRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    // @ts-ignore - Redis client compatibility
    client: redis,
    prefix: 'rl:strict:',
  }),
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded for expensive operations.',
      retryAfter: res.getHeader('Retry-After'),
      requestId: req.id,
    });
  },
});

/**
 * Relaxed rate limit for read-only operations
 * 300 requests per 15 minutes
 */
export const relaxedRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    // @ts-ignore - Redis client compatibility
    client: redis,
    prefix: 'rl:relaxed:',
  }),
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please slow down.',
      retryAfter: res.getHeader('Retry-After'),
      requestId: req.id,
    });
  },
});

/**
 * Custom rate limiter factory
 *
 * Create a rate limiter with custom settings
 *
 * @param options Rate limit options
 */
export function createRateLimiter(options: {
  windowMs: number;
  max: number;
  prefix: string;
}) {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
      // @ts-ignore - Redis client compatibility
      client: redis,
      prefix: `rl:${options.prefix}:`,
    }),
    handler: (req: Request, res: Response) => {
      res.status(429).json({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded.',
        retryAfter: res.getHeader('Retry-After'),
        requestId: req.id,
      });
    },
  });
}

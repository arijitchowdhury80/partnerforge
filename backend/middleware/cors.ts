import cors, { CorsOptions } from 'cors';
import { config } from '../config';
import { logger } from '../utils/logger';

/**
 * CORS Configuration Middleware
 *
 * Configures Cross-Origin Resource Sharing for frontend access.
 * Allows requests from Vercel frontend (algolia-arian.vercel.app)
 * and localhost for development.
 */

// Allowed origins based on environment
const allowedOrigins = [
  'https://algolia-arian.vercel.app',
  'http://localhost:5173', // Vite dev server
  'http://localhost:3000', // Alternative dev port
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000'
];

// Add production domain if in production
if (config.server.nodeEnv === 'production') {
  // Only allow production domains
  allowedOrigins.splice(1); // Remove localhost origins
}

/**
 * CORS options configuration
 */
const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) {
      return callback(null, true);
    }

    // Check if origin is allowed
    if (allowedOrigins.includes(origin)) {
      logger.debug(`CORS: Allowing origin ${origin}`);
      callback(null, true);
    } else {
      logger.warn(`CORS: Blocking origin ${origin}`);
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  credentials: true, // Allow cookies and authentication headers
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Request-ID',
    'X-API-Key',
    'X-Requested-With'
  ],
  exposedHeaders: [
    'X-Request-ID',
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
    'Retry-After'
  ],
  maxAge: 86400, // Cache preflight requests for 24 hours
  optionsSuccessStatus: 200 // For legacy browser support
};

/**
 * CORS middleware instance
 *
 * Usage:
 *   app.use(corsMiddleware);
 */
export const corsMiddleware = cors(corsOptions);

/**
 * Lenient CORS for development
 *
 * Allows all origins in development mode.
 * DO NOT USE IN PRODUCTION.
 */
export const lenientCors = cors({
  origin: true, // Allow all origins
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-API-Key'],
  exposedHeaders: ['X-Request-ID', 'X-RateLimit-Limit', 'Retry-After']
});

/**
 * Get CORS middleware based on environment
 *
 * @returns CORS middleware (strict for production, lenient for dev)
 */
export function getCorsMiddleware() {
  if (config.server.nodeEnv === 'development') {
    logger.info('CORS: Using lenient CORS for development');
    return lenientCors;
  }

  logger.info('CORS: Using strict CORS for production');
  logger.info(`CORS: Allowed origins: ${allowedOrigins.join(', ')}`);
  return corsMiddleware;
}

/**
 * Base API error
 */
export class APIError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public provider: string,
    public retryable: boolean = false,
    public details?: any
  ) {
    super(message);
    this.name = 'APIError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Rate limit exceeded error
 */
export class RateLimitError extends APIError {
  public retryAfter: number;

  constructor(provider: string, retryAfter: number = 60) {
    super(429, `Rate limit exceeded for ${provider}`, provider, true);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

/**
 * Cache operation error
 */
export class CacheError extends Error {
  constructor(message: string, public operation: string, public key?: string) {
    super(message);
    this.name = 'CacheError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Database operation error
 */
export class DatabaseError extends Error {
  constructor(
    message: string,
    public operation: string,
    public table?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'DatabaseError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Configuration error
 */
export class ConfigError extends Error {
  constructor(message: string, public missingKeys?: string[]) {
    super(message);
    this.name = 'ConfigError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Validation error
 */
export class ValidationError extends Error {
  constructor(message: string, public field?: string, public value?: any) {
    super(message);
    this.name = 'ValidationError';
    Error.captureStackTrace(this, this.constructor);
  }
}

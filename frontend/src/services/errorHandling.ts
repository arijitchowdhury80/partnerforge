/**
 * Error Handling Service
 *
 * Provides user-friendly error messages and recovery actions for enrichment errors.
 * Parses various API error types into structured EnrichmentError objects.
 */

// =============================================================================
// Types
// =============================================================================

export type ErrorType =
  | 'network'
  | 'rate_limit'
  | 'auth'
  | 'not_found'
  | 'partial_success'
  | 'unknown';

export interface FailedSource {
  source: string;
  reason: string;
}

export interface EnrichmentErrorData {
  type: ErrorType;
  message: string;
  userMessage: string;
  suggestedActions: string[];
  errorCode: string;
  retryAfter?: number;
  completedSources?: string[];
  failedSources?: FailedSource[];
}

// =============================================================================
// EnrichmentError Class
// =============================================================================

export class EnrichmentError extends Error {
  public readonly type: ErrorType;
  public readonly userMessage: string;
  public readonly suggestedActions: string[];
  public readonly errorCode: string;
  public readonly retryAfter?: number;
  public readonly completedSources?: string[];
  public readonly failedSources?: FailedSource[];

  constructor(data: EnrichmentErrorData) {
    super(data.message);
    this.name = 'EnrichmentError';
    this.type = data.type;
    this.userMessage = data.userMessage;
    this.suggestedActions = data.suggestedActions;
    this.errorCode = data.errorCode;
    this.retryAfter = data.retryAfter;
    this.completedSources = data.completedSources;
    this.failedSources = data.failedSources;

    // Maintains proper stack trace for where the error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, EnrichmentError);
    }
  }
}

// =============================================================================
// Error Code Generation
// =============================================================================

const ERROR_TYPE_CODES: Record<ErrorType, string> = {
  network: 'NET',
  rate_limit: 'RATE',
  auth: 'AUTH',
  not_found: 'NOTFOUND',
  partial_success: 'PARTIAL',
  unknown: 'UNKNOWN',
};

/**
 * Creates a unique error code for support purposes.
 * Format: ERR-{TYPE}-{RANDOM}
 */
export function createErrorCode(type: ErrorType): string {
  const typeCode = ERROR_TYPE_CODES[type];
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  const timestamp = Date.now().toString(36).toUpperCase();
  return `ERR-${typeCode}-${timestamp}${random}`;
}

// =============================================================================
// Error Detection Helpers
// =============================================================================

function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) {
    const message = error.message.toLowerCase();
    return message.includes('fetch') || message.includes('network');
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    const code = (error as any).code?.toLowerCase() ?? '';
    return (
      message.includes('econnrefused') ||
      message.includes('network') ||
      code === 'etimedout' ||
      code === 'econnreset' ||
      code === 'enotfound'
    );
  }

  return false;
}

function isTimeoutError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    const code = (error as any).code?.toLowerCase() ?? '';
    return (
      message.includes('timeout') ||
      code === 'etimedout' ||
      code === 'timeout'
    );
  }
  return false;
}

function isRateLimitError(error: unknown): boolean {
  if (error && typeof error === 'object') {
    const status = (error as any).status;
    if (status === 429) return true;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return message.includes('rate limit') || message.includes('too many');
  }

  return false;
}

function isAuthError(error: unknown): boolean {
  if (error && typeof error === 'object') {
    const status = (error as any).status;
    if (status === 401 || status === 403) return true;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('unauthorized') ||
      message.includes('forbidden') ||
      message.includes('api key') ||
      message.includes('authentication')
    );
  }

  return false;
}

function isNotFoundError(error: unknown): boolean {
  if (error && typeof error === 'object') {
    const status = (error as any).status;
    if (status === 404) return true;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return message.includes('not found') || message.includes('domain not found');
  }

  return false;
}

function isPartialSuccessError(error: unknown): boolean {
  if (error && typeof error === 'object') {
    return (
      Array.isArray((error as any).completedSources) &&
      Array.isArray((error as any).failedSources)
    );
  }
  return false;
}

// =============================================================================
// User Message Generators
// =============================================================================

function formatRetryTime(seconds: number): string {
  if (seconds >= 60) {
    const minutes = Math.ceil(seconds / 60);
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }
  return `${seconds} seconds`;
}

function getNetworkUserMessage(error: unknown): string {
  if (isTimeoutError(error)) {
    return 'The request timed out. Please try again in a few moments.';
  }
  return 'A network error occurred. Please check your internet connection and try again.';
}

function getRateLimitUserMessage(error: unknown): string {
  const retryAfter = (error as any)?.retryAfter;
  if (retryAfter) {
    return `Too many requests. Please wait ${formatRetryTime(retryAfter)} before trying again.`;
  }
  return 'Too many requests have been made. Please wait a moment before trying again.';
}

function getAuthUserMessage(error: unknown): string {
  const status = (error as any)?.status;
  if (status === 403) {
    return 'Access denied. You do not have permission to access this resource.';
  }
  return 'Authentication failed. Please check your API key configuration.';
}

function getNotFoundUserMessage(): string {
  return 'The requested resource or domain was not found. Please verify the domain name.';
}

function getPartialSuccessUserMessage(error: unknown): string {
  const completedSources = (error as any)?.completedSources ?? [];
  const failedSources = (error as any)?.failedSources ?? [];

  const completedCount = completedSources.length;
  const failedCount = failedSources.length;

  let message = 'Enrichment partially completed.';

  if (completedCount > 0 && failedCount > 0) {
    message = `Enrichment partially completed: ${completedCount} source${completedCount !== 1 ? 's' : ''} succeeded, ${failedCount} failed.`;
    if (completedSources.length > 0) {
      message += ` Completed: ${completedSources.join(', ')}.`;
    }
  }

  return message;
}

function getUnknownUserMessage(): string {
  return 'An unexpected error occurred. Please try again later.';
}

// =============================================================================
// Suggested Actions
// =============================================================================

function getNetworkActions(): string[] {
  return [
    'Check your internet connection',
    'Try again in a few moments',
    'Refresh the page',
  ];
}

function getRateLimitActions(): string[] {
  return [
    'Wait before trying again',
    'Consider reducing the number of requests',
    'Try again later',
  ];
}

function getAuthActions(): string[] {
  return [
    'Check API key configuration',
    'Contact administrator',
    'Verify your permissions',
  ];
}

function getNotFoundActions(): string[] {
  return [
    'Verify the domain name is correct',
    'Check if the resource exists',
    'Try a different domain',
  ];
}

function getPartialSuccessActions(): string[] {
  return [
    'Retry failed sources',
    'Continue with partial data',
    'Check failed source details',
  ];
}

function getUnknownActions(): string[] {
  return [
    'Try again later',
    'Refresh the page',
    'Contact support if the issue persists',
  ];
}

// =============================================================================
// Main Parser Function
// =============================================================================

/**
 * Parses any error into a structured EnrichmentError with user-friendly messages.
 *
 * @param error - The original error (can be Error, string, object, or null)
 * @returns EnrichmentErrorData - Structured error information
 */
export function parseEnrichmentError(error: unknown): EnrichmentErrorData {
  // Handle null/undefined
  if (error === null || error === undefined) {
    return {
      type: 'unknown',
      message: 'Unknown error (null)',
      userMessage: getUnknownUserMessage(),
      suggestedActions: getUnknownActions(),
      errorCode: createErrorCode('unknown'),
    };
  }

  // Extract original message
  let message: string;
  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'string') {
    message = error;
  } else if (typeof error === 'object' && 'message' in error) {
    message = String((error as any).message);
  } else {
    message = 'Unknown error';
  }

  // Check for partial success (has both completedSources and failedSources)
  if (isPartialSuccessError(error)) {
    return {
      type: 'partial_success',
      message,
      userMessage: getPartialSuccessUserMessage(error),
      suggestedActions: getPartialSuccessActions(),
      errorCode: createErrorCode('partial_success'),
      completedSources: (error as any).completedSources,
      failedSources: (error as any).failedSources,
    };
  }

  // Check for rate limit errors
  if (isRateLimitError(error)) {
    const retryAfter = (error as any)?.retryAfter;
    return {
      type: 'rate_limit',
      message,
      userMessage: getRateLimitUserMessage(error),
      suggestedActions: getRateLimitActions(),
      errorCode: createErrorCode('rate_limit'),
      retryAfter,
    };
  }

  // Check for auth errors
  if (isAuthError(error)) {
    return {
      type: 'auth',
      message,
      userMessage: getAuthUserMessage(error),
      suggestedActions: getAuthActions(),
      errorCode: createErrorCode('auth'),
    };
  }

  // Check for not found errors
  if (isNotFoundError(error)) {
    return {
      type: 'not_found',
      message,
      userMessage: getNotFoundUserMessage(),
      suggestedActions: getNotFoundActions(),
      errorCode: createErrorCode('not_found'),
    };
  }

  // Check for network errors (after rate limit to avoid false positives)
  if (isNetworkError(error)) {
    return {
      type: 'network',
      message,
      userMessage: getNetworkUserMessage(error),
      suggestedActions: getNetworkActions(),
      errorCode: createErrorCode('network'),
    };
  }

  // Default: unknown error
  return {
    type: 'unknown',
    message,
    userMessage: getUnknownUserMessage(),
    suggestedActions: getUnknownActions(),
    errorCode: createErrorCode('unknown'),
  };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Checks if an error should trigger a retry.
 */
export function isRetryableError(error: EnrichmentErrorData): boolean {
  return (
    error.type === 'network' ||
    error.type === 'rate_limit' ||
    error.type === 'partial_success'
  );
}

/**
 * Gets the human-readable title for an error type.
 */
export function getErrorTitle(type: ErrorType): string {
  switch (type) {
    case 'network':
      return 'Network Error';
    case 'rate_limit':
      return 'Rate Limit Exceeded';
    case 'auth':
      return 'Authentication Error';
    case 'not_found':
      return 'Not Found';
    case 'partial_success':
      return 'Partial Success';
    default:
      return 'Error';
  }
}

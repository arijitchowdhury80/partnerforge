/**
 * Error Handling Service Test Suite
 *
 * Tests for parsing API errors into user-friendly EnrichmentError objects.
 * TDD approach: These tests are written BEFORE the implementation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  EnrichmentError,
  parseEnrichmentError,
  ErrorType,
  createErrorCode,
} from '../errorHandling';

describe('errorHandling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // parseEnrichmentError - Network Errors
  // ============================================================================
  describe('parseEnrichmentError - network errors', () => {
    it('should handle network errors with fetch failure', () => {
      const error = new TypeError('Failed to fetch');

      const result = parseEnrichmentError(error);

      expect(result.type).toBe('network');
      expect(result.message).toContain('fetch');
      expect(result.userMessage).toContain('network');
      expect(result.userMessage).not.toContain('fetch'); // Should be user-friendly
      expect(result.suggestedActions).toContain('Check your internet connection');
      expect(result.errorCode).toMatch(/^ERR-NET-/);
    });

    it('should handle network errors with connection refused', () => {
      const error = new Error('ECONNREFUSED');

      const result = parseEnrichmentError(error);

      expect(result.type).toBe('network');
      expect(result.userMessage).toContain('network');
      expect(result.suggestedActions.length).toBeGreaterThan(0);
    });

    it('should handle timeout errors', () => {
      const error = new Error('Request timeout');
      (error as any).code = 'ETIMEDOUT';

      const result = parseEnrichmentError(error);

      expect(result.type).toBe('network');
      expect(result.userMessage).toContain('timed out');
      expect(result.suggestedActions).toContain('Try again in a few moments');
    });
  });

  // ============================================================================
  // parseEnrichmentError - Rate Limit Errors
  // ============================================================================
  describe('parseEnrichmentError - rate limit errors', () => {
    it('should handle 429 status code errors', () => {
      const error = new Error('Too Many Requests');
      (error as any).status = 429;

      const result = parseEnrichmentError(error);

      expect(result.type).toBe('rate_limit');
      expect(result.userMessage).toContain('requests');
      expect(result.suggestedActions).toContain('Wait before trying again');
      expect(result.errorCode).toMatch(/^ERR-RATE-/);
    });

    it('should include retryAfter when provided in headers', () => {
      const error = new Error('Too Many Requests');
      (error as any).status = 429;
      (error as any).retryAfter = 60; // 60 seconds

      const result = parseEnrichmentError(error);

      expect(result.type).toBe('rate_limit');
      expect(result.retryAfter).toBe(60);
      // 60 seconds is formatted as "1 minute"
      expect(result.userMessage).toContain('1 minute');
    });

    it('should handle rate limit messages in error body', () => {
      const error = new Error('rate limit exceeded');

      const result = parseEnrichmentError(error);

      expect(result.type).toBe('rate_limit');
      expect(result.suggestedActions).toContain('Wait before trying again');
    });

    it('should suggest retry time based on retryAfter', () => {
      const error = new Error('Too Many Requests');
      (error as any).status = 429;
      (error as any).retryAfter = 120;

      const result = parseEnrichmentError(error);

      expect(result.retryAfter).toBe(120);
      expect(result.userMessage).toContain('2 minute');
    });
  });

  // ============================================================================
  // parseEnrichmentError - Authentication Errors
  // ============================================================================
  describe('parseEnrichmentError - authentication errors', () => {
    it('should handle 401 unauthorized errors', () => {
      const error = new Error('Unauthorized');
      (error as any).status = 401;

      const result = parseEnrichmentError(error);

      expect(result.type).toBe('auth');
      expect(result.userMessage).toContain('API key');
      expect(result.suggestedActions).toContain('Check API key configuration');
      expect(result.errorCode).toMatch(/^ERR-AUTH-/);
    });

    it('should handle 403 forbidden errors', () => {
      const error = new Error('Forbidden');
      (error as any).status = 403;

      const result = parseEnrichmentError(error);

      expect(result.type).toBe('auth');
      expect(result.userMessage).toContain('access');
      expect(result.suggestedActions.length).toBeGreaterThan(0);
    });

    it('should handle invalid API key messages', () => {
      const error = new Error('Invalid API key provided');

      const result = parseEnrichmentError(error);

      expect(result.type).toBe('auth');
      expect(result.userMessage).toContain('API key');
    });
  });

  // ============================================================================
  // parseEnrichmentError - Not Found Errors
  // ============================================================================
  describe('parseEnrichmentError - not found errors', () => {
    it('should handle 404 not found errors', () => {
      const error = new Error('Not Found');
      (error as any).status = 404;

      const result = parseEnrichmentError(error);

      expect(result.type).toBe('not_found');
      expect(result.userMessage).toContain('not found');
      expect(result.errorCode).toMatch(/^ERR-NOTFOUND-/);
    });

    it('should handle domain not found errors', () => {
      const error = new Error('Domain not found in database');

      const result = parseEnrichmentError(error);

      expect(result.type).toBe('not_found');
      expect(result.userMessage).toContain('domain');
    });
  });

  // ============================================================================
  // parseEnrichmentError - Partial Success
  // ============================================================================
  describe('parseEnrichmentError - partial success', () => {
    it('should handle partial success with completed and failed sources', () => {
      const error = new Error('Partial enrichment failure');
      (error as any).completedSources = ['SimilarWeb', 'BuiltWith'];
      (error as any).failedSources = [
        { source: 'YahooFinance', reason: 'API timeout' },
        { source: 'WebSearch', reason: 'Rate limited' },
      ];

      const result = parseEnrichmentError(error);

      expect(result.type).toBe('partial_success');
      expect(result.completedSources).toEqual(['SimilarWeb', 'BuiltWith']);
      expect(result.failedSources).toHaveLength(2);
      expect(result.failedSources![0].source).toBe('YahooFinance');
      expect(result.failedSources![0].reason).toBe('API timeout');
      expect(result.userMessage).toContain('partially');
      expect(result.suggestedActions).toContain('Retry failed sources');
    });

    it('should list completed sources in user message', () => {
      const error = new Error('Partial enrichment failure');
      (error as any).completedSources = ['SimilarWeb'];
      (error as any).failedSources = [{ source: 'BuiltWith', reason: 'Failed' }];

      const result = parseEnrichmentError(error);

      expect(result.userMessage).toContain('SimilarWeb');
      expect(result.completedSources).toContain('SimilarWeb');
    });

    it('should include count of successful and failed sources', () => {
      const error = new Error('Partial enrichment failure');
      (error as any).completedSources = ['SimilarWeb', 'BuiltWith', 'WebSearch'];
      (error as any).failedSources = [{ source: 'YahooFinance', reason: 'Failed' }];

      const result = parseEnrichmentError(error);

      expect(result.userMessage).toContain('3');
      expect(result.userMessage).toContain('1');
    });
  });

  // ============================================================================
  // parseEnrichmentError - Unknown Errors
  // ============================================================================
  describe('parseEnrichmentError - unknown errors', () => {
    it('should handle unknown errors with fallback message', () => {
      const error = new Error('Some unexpected error occurred');

      const result = parseEnrichmentError(error);

      expect(result.type).toBe('unknown');
      // User message should not include raw error details
      expect(result.userMessage).not.toContain('Some unexpected error occurred');
      // User message should convey that something unexpected happened
      expect(result.userMessage.toLowerCase()).toContain('unexpected');
      expect(result.suggestedActions).toContain('Try again later');
      expect(result.errorCode).toMatch(/^ERR-UNKNOWN-/);
    });

    it('should handle non-Error objects', () => {
      const error = 'string error message';

      const result = parseEnrichmentError(error);

      expect(result.type).toBe('unknown');
      expect(result.message).toBe('string error message');
      expect(result.userMessage).toBeTruthy();
    });

    it('should handle null/undefined errors', () => {
      const result = parseEnrichmentError(null);

      expect(result.type).toBe('unknown');
      expect(result.userMessage).toBeTruthy();
      expect(result.errorCode).toBeTruthy();
    });

    it('should handle objects without message property', () => {
      const error = { code: 'SOME_CODE', details: 'some details' };

      const result = parseEnrichmentError(error);

      expect(result.type).toBe('unknown');
      expect(result.userMessage).toBeTruthy();
    });
  });

  // ============================================================================
  // Error Codes
  // ============================================================================
  describe('error codes', () => {
    it('should generate unique error codes', () => {
      const error1 = parseEnrichmentError(new Error('Error 1'));
      const error2 = parseEnrichmentError(new Error('Error 2'));

      expect(error1.errorCode).not.toBe(error2.errorCode);
    });

    it('should include error type in code', () => {
      const networkError = new TypeError('Failed to fetch');
      const authError = new Error('Unauthorized');
      (authError as any).status = 401;

      const networkResult = parseEnrichmentError(networkError);
      const authResult = parseEnrichmentError(authError);

      expect(networkResult.errorCode).toContain('NET');
      expect(authResult.errorCode).toContain('AUTH');
    });

    it('should have valid format for support', () => {
      const error = parseEnrichmentError(new Error('Test'));

      // Format: ERR-TYPE-TIMESTAMP
      expect(error.errorCode).toMatch(/^ERR-[A-Z]+-[A-Za-z0-9]+$/);
    });
  });

  // ============================================================================
  // Suggested Actions
  // ============================================================================
  describe('suggested actions', () => {
    it('should include relevant actions for network errors', () => {
      const error = new TypeError('Failed to fetch');

      const result = parseEnrichmentError(error);

      expect(result.suggestedActions).toContain('Check your internet connection');
      expect(result.suggestedActions).toContain('Try again in a few moments');
    });

    it('should include relevant actions for rate limit errors', () => {
      const error = new Error('rate limit');
      (error as any).status = 429;

      const result = parseEnrichmentError(error);

      expect(result.suggestedActions).toContain('Wait before trying again');
      expect(result.suggestedActions.some(a => a.toLowerCase().includes('reduc'))).toBe(true);
    });

    it('should include relevant actions for auth errors', () => {
      const error = new Error('Unauthorized');
      (error as any).status = 401;

      const result = parseEnrichmentError(error);

      expect(result.suggestedActions).toContain('Check API key configuration');
      expect(result.suggestedActions).toContain('Contact administrator');
    });

    it('should include retry action for partial success', () => {
      const error = new Error('Partial');
      (error as any).completedSources = ['A'];
      (error as any).failedSources = [{ source: 'B', reason: 'Failed' }];

      const result = parseEnrichmentError(error);

      expect(result.suggestedActions).toContain('Retry failed sources');
      expect(result.suggestedActions).toContain('Continue with partial data');
    });
  });

  // ============================================================================
  // EnrichmentError class
  // ============================================================================
  describe('EnrichmentError class', () => {
    it('should be an instance of Error', () => {
      const enrichmentError = new EnrichmentError({
        type: 'network',
        message: 'Original error',
        userMessage: 'User-friendly message',
        suggestedActions: ['Retry'],
        errorCode: 'ERR-NET-123',
      });

      expect(enrichmentError).toBeInstanceOf(Error);
      expect(enrichmentError.name).toBe('EnrichmentError');
    });

    it('should expose all error properties', () => {
      const enrichmentError = new EnrichmentError({
        type: 'rate_limit',
        message: 'Too many requests',
        userMessage: 'Please wait before trying again',
        suggestedActions: ['Wait', 'Retry'],
        errorCode: 'ERR-RATE-456',
        retryAfter: 30,
      });

      expect(enrichmentError.type).toBe('rate_limit');
      expect(enrichmentError.userMessage).toBe('Please wait before trying again');
      expect(enrichmentError.suggestedActions).toEqual(['Wait', 'Retry']);
      expect(enrichmentError.errorCode).toBe('ERR-RATE-456');
      expect(enrichmentError.retryAfter).toBe(30);
    });

    it('should support partial success with source details', () => {
      const enrichmentError = new EnrichmentError({
        type: 'partial_success',
        message: 'Partial failure',
        userMessage: 'Some sources failed',
        suggestedActions: ['Retry'],
        errorCode: 'ERR-PARTIAL-789',
        completedSources: ['SimilarWeb'],
        failedSources: [{ source: 'BuiltWith', reason: 'Timeout' }],
      });

      expect(enrichmentError.completedSources).toEqual(['SimilarWeb']);
      expect(enrichmentError.failedSources).toEqual([
        { source: 'BuiltWith', reason: 'Timeout' },
      ]);
    });
  });

  // ============================================================================
  // createErrorCode helper
  // ============================================================================
  describe('createErrorCode', () => {
    it('should create valid error code format', () => {
      const code = createErrorCode('network');

      expect(code).toMatch(/^ERR-NET-/);
    });

    it('should create different codes for different types', () => {
      expect(createErrorCode('network')).toContain('NET');
      expect(createErrorCode('rate_limit')).toContain('RATE');
      expect(createErrorCode('auth')).toContain('AUTH');
      expect(createErrorCode('not_found')).toContain('NOTFOUND');
      expect(createErrorCode('partial_success')).toContain('PARTIAL');
      expect(createErrorCode('unknown')).toContain('UNKNOWN');
    });

    it('should generate unique codes on each call', () => {
      const code1 = createErrorCode('network');
      const code2 = createErrorCode('network');

      expect(code1).not.toBe(code2);
    });
  });
});

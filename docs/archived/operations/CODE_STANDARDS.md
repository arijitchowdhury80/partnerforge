# Code Hardening & Quality Standards

**Version**: 1.0
**Date**: March 6, 2026
**Status**: MANDATORY FOR ALL CODE
**Enforcement**: Pre-commit hooks + CI/CD

---

## Table of Contents

1. [Global Principles](#1-global-principles)
2. [Error Handling Standards](#2-error-handling-standards)
3. [Logging & Tracing Standards](#3-logging--tracing-standards)
4. [TypeScript Standards](#4-typescript-standards)
5. [Testing Standards](#5-testing-standards)
6. [Documentation Standards](#6-documentation-standards)
7. [Security Standards](#7-security-standards)
8. [Performance Standards](#8-performance-standards)
9. [Code Review Checklist](#9-code-review-checklist)
10. [Enforcement Automation](#10-enforcement-automation)

---

## 1. Global Principles

### The Three Commandments

1. **Every async function MUST have try-catch**
2. **Every function MUST log entry/exit/errors**
3. **Every function MUST have inline documentation**

These are **NON-NEGOTIABLE**. Code without these will be rejected in PR review.

---

### Code Quality Metrics (Enforced in CI)

| Metric | Threshold | Tool |
|--------|-----------|------|
| **Test Coverage** | ≥80% | Jest/Vitest |
| **TypeScript Strict** | 100% | tsc --noEmit |
| **Linting Errors** | 0 | ESLint |
| **Cyclomatic Complexity** | ≤10 per function | ESLint plugin |
| **Function Length** | ≤50 lines | ESLint plugin |
| **File Length** | ≤500 lines | Manual review |

---

## 2. Error Handling Standards

### Rule 1: Every Async Function Has Try-Catch

```typescript
// ✅ CORRECT
async function enrichCompany(domain: string): Promise<EnrichmentResult> {
  logger.info({ domain }, 'Starting company enrichment');

  try {
    const traffic = await getTrafficData(domain);
    const techStack = await getTechStack(domain);

    logger.info({ domain, traffic, techStack }, 'Enrichment successful');
    return { traffic, techStack };

  } catch (error) {
    logger.error({
      domain,
      error: error.message,
      stack: error.stack,
      context: 'enrichCompany'
    }, 'Enrichment failed');

    throw new AppError(
      `Failed to enrich company: ${domain}`,
      'ENRICHMENT_ERROR',
      500,
      { domain, originalError: error.message }
    );
  }
}

// ❌ WRONG - No error handling!
async function enrichCompany(domain: string): Promise<EnrichmentResult> {
  const traffic = await getTrafficData(domain); // Can throw!
  const techStack = await getTechStack(domain); // Can throw!
  return { traffic, techStack };
}
```

---

### Rule 2: Custom Error Classes

```typescript
// utils/errors.ts

/**
 * Base application error class
 */
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public metadata?: Record<string, any>,
    public isOperational: boolean = true
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      metadata: this.metadata
    };
  }
}

/**
 * API-specific errors
 */
export class APIError extends AppError {
  constructor(
    message: string,
    public service: string,
    public endpoint: string,
    statusCode: number = 502,
    metadata?: Record<string, any>
  ) {
    super(message, 'API_ERROR', statusCode, {
      ...metadata,
      service,
      endpoint
    });
  }
}

/**
 * Validation errors
 */
export class ValidationError extends AppError {
  constructor(
    message: string,
    public field: string,
    public value: any
  ) {
    super(message, 'VALIDATION_ERROR', 400, { field, value });
  }
}

/**
 * Rate limit errors
 */
export class RateLimitError extends AppError {
  constructor(
    message: string,
    public retryAfter: number // seconds
  ) {
    super(message, 'RATE_LIMIT_ERROR', 429, { retryAfter });
  }
}
```

---

### Rule 3: Error Handler Middleware

```typescript
// middleware/error-handler.ts
import { logger } from '@/utils/logger';
import { AppError } from '@/utils/errors';

/**
 * Global error handler for Express/Edge Functions
 */
export function errorHandler(error: Error, req: Request, res: Response, next: NextFunction) {
  // Log error
  logger.error({
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    userId: req.user?.id
  }, 'Request error');

  // Operational errors (known, expected)
  if (error instanceof AppError && error.isOperational) {
    return res.status(error.statusCode).json({
      error: {
        message: error.message,
        code: error.code,
        metadata: error.metadata
      }
    });
  }

  // Programming errors (unknown, unexpected)
  // Don't expose internal details to client
  res.status(500).json({
    error: {
      message: 'An unexpected error occurred',
      code: 'INTERNAL_ERROR'
    }
  });

  // In production, alert on programming errors
  if (process.env.NODE_ENV === 'production') {
    alertTeam(error);
  }
}
```

---

### Rule 4: Graceful Degradation

```typescript
/**
 * Fetch multiple data sources, continue even if some fail
 */
async function enrichCompanyMultiSource(domain: string): Promise<EnrichmentResult> {
  const results = await Promise.allSettled([
    getTrafficData(domain),      // Critical
    getTechStack(domain),         // Critical
    getFinancialData(domain),     // Optional
    getHiringSignals(domain)      // Optional
  ]);

  const [trafficResult, techStackResult, financialResult, hiringResult] = results;

  // Critical data - must succeed
  if (trafficResult.status === 'rejected') {
    throw new AppError(
      'Failed to fetch traffic data',
      'TRAFFIC_ERROR',
      502,
      { domain }
    );
  }

  if (techStackResult.status === 'rejected') {
    throw new AppError(
      'Failed to fetch tech stack',
      'TECHSTACK_ERROR',
      502,
      { domain }
    );
  }

  // Optional data - log but continue
  if (financialResult.status === 'rejected') {
    logger.warn({
      domain,
      error: financialResult.reason.message
    }, 'Financial data unavailable, continuing without it');
  }

  return {
    traffic: trafficResult.value,
    techStack: techStackResult.value,
    financial: financialResult.status === 'fulfilled' ? financialResult.value : null,
    hiring: hiringResult.status === 'fulfilled' ? hiringResult.value : null,
    dataCompleteness: calculateCompleteness([trafficResult, techStackResult, financialResult, hiringResult])
  };
}
```

---

### Rule 5: Retry Logic

```typescript
// utils/retry.ts

interface RetryOptions {
  maxAttempts: number;
  baseDelay: number; // milliseconds
  maxDelay: number;
  shouldRetry?: (error: Error) => boolean;
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  const { maxAttempts, baseDelay, maxDelay, shouldRetry = () => true } = options;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      logger.info({ attempt, maxAttempts }, 'Attempting operation');
      return await fn();
    } catch (error) {
      const isLastAttempt = attempt === maxAttempts;

      // Don't retry if error is not retryable
      if (!shouldRetry(error)) {
        logger.warn({
          attempt,
          error: error.message
        }, 'Error not retryable, aborting');
        throw error;
      }

      if (isLastAttempt) {
        logger.error({
          attempt,
          maxAttempts,
          error: error.message
        }, 'Max retries exceeded');
        throw error;
      }

      // Exponential backoff with jitter
      const delay = Math.min(
        baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000,
        maxDelay
      );

      logger.warn({
        attempt,
        maxAttempts,
        delayMs: delay,
        error: error.message
      }, 'Retrying after delay');

      await sleep(delay);
    }
  }

  throw new Error('Unreachable');
}

// Usage
const traffic = await retry(
  () => similarWebClient.getTrafficData(domain),
  {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    shouldRetry: (error) => {
      // Retry on network errors, not on 4xx client errors
      return error instanceof APIError && error.statusCode >= 500;
    }
  }
);
```

---

## 3. Logging & Tracing Standards

### Rule 6: Structured Logging with Pino

```typescript
// utils/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
    bindings: (bindings) => ({
      pid: bindings.pid,
      hostname: bindings.hostname,
      service: process.env.SERVICE_NAME || 'algolia-arian'
    })
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: ['req.headers.authorization', 'req.body.password', '*.apiKey'],
    remove: true
  }
});

// Child loggers for modules
export const enrichmentLogger = logger.child({ module: 'enrichment' });
export const apiLogger = logger.child({ module: 'api' });
export const dbLogger = logger.child({ module: 'database' });
```

---

### Rule 7: Log Entry, Exit, and Errors

```typescript
/**
 * Example: Logging best practices
 */
async function processCompany(domain: string, userId: string): Promise<void> {
  // 1. Log entry with context
  logger.info({
    function: 'processCompany',
    domain,
    userId,
    timestamp: new Date().toISOString()
  }, 'Function entry');

  const startTime = Date.now();

  try {
    // 2. Log key steps
    logger.info({ domain }, 'Fetching company data');
    const company = await fetchCompany(domain);

    logger.info({ domain, companyId: company.id }, 'Enriching company');
    const enriched = await enrichCompany(company);

    logger.info({ domain, score: enriched.score }, 'Saving results');
    await saveResults(enriched);

    // 3. Log successful exit with metrics
    const duration = Date.now() - startTime;
    logger.info({
      function: 'processCompany',
      domain,
      userId,
      duration_ms: duration,
      result: 'success'
    }, 'Function exit (success)');

  } catch (error) {
    // 4. Log errors with full context
    const duration = Date.now() - startTime;
    logger.error({
      function: 'processCompany',
      domain,
      userId,
      duration_ms: duration,
      error: error.message,
      errorCode: error.code,
      stack: error.stack,
      result: 'error'
    }, 'Function exit (error)');

    throw error;
  }
}
```

---

### Rule 8: Distributed Tracing

```typescript
// utils/tracing.ts
import { trace, context, SpanStatusCode } from '@opentelemetry/api';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';

// Initialize tracer
const provider = new NodeTracerProvider();
const exporter = new JaegerExporter({
  endpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces'
});
provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
provider.register();

export const tracer = trace.getTracer('algolia-arian', '1.0.0');

/**
 * Trace wrapper for functions
 */
export function traced<T extends (...args: any[]) => Promise<any>>(
  spanName: string,
  fn: T
): T {
  return (async (...args: any[]) => {
    return tracer.startActiveSpan(spanName, async (span) => {
      try {
        // Add function arguments as span attributes
        span.setAttribute('args', JSON.stringify(args));

        const result = await fn(...args);

        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.recordException(error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error.message
        });
        throw error;
      } finally {
        span.end();
      }
    });
  }) as T;
}

// Usage
export const enrichCompanyTraced = traced('enrich-company', enrichCompany);
```

---

## 4. TypeScript Standards

### Rule 9: Strict Mode Always

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

---

### Rule 10: Type Everything

```typescript
// ✅ CORRECT - Fully typed
interface EnrichmentOptions {
  domain: string;
  level: 'basic' | 'standard' | 'deep' | 'full';
  forceRefresh?: boolean;
  onProgress?: (stage: EnrichmentStage, progress: number) => void;
}

async function enrichCompany(options: EnrichmentOptions): Promise<EnrichmentResult> {
  const { domain, level, forceRefresh = false, onProgress } = options;
  // ...
}

// ❌ WRONG - Implicit any
async function enrichCompany(options) {
  const { domain, level } = options;
  // ...
}
```

---

### Rule 11: No Any (Use Unknown Instead)

```typescript
// ✅ CORRECT - Use unknown, then narrow
async function parseJSON(text: string): Promise<unknown> {
  return JSON.parse(text);
}

const data = await parseJSON(response);

// Type guard
if (isTrafficData(data)) {
  // TypeScript knows data is TrafficData here
  console.log(data.monthly_visits);
}

// ❌ WRONG - Any disables type checking
async function parseJSON(text: string): Promise<any> {
  return JSON.parse(text);
}
```

---

### Rule 12: Zod for Runtime Validation

```typescript
// types/validation.ts
import { z } from 'zod';

export const TrafficDataSchema = z.object({
  domain: z.string().url(),
  monthly_visits: z.number().nonnegative(),
  bounce_rate: z.number().min(0).max(1),
  pages_per_visit: z.number().nonnegative(),
  fetched_at: z.string().datetime()
});

export type TrafficData = z.infer<typeof TrafficDataSchema>;

// Usage
async function parseTrafficData(raw: unknown): Promise<TrafficData> {
  try {
    return TrafficDataSchema.parse(raw);
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error({ errors: error.errors }, 'Invalid traffic data');
      throw new ValidationError(
        'Invalid traffic data format',
        'traffic_data',
        error.errors
      );
    }
    throw error;
  }
}
```

---

## 5. Testing Standards

### Rule 13: 80% Coverage Minimum

```typescript
// ✅ Every service file MUST have a test file

// services/scoring.ts
export function calculateCompositeScore(company: Company): CompositeScore {
  // ...
}

// services/__tests__/scoring.test.ts
import { describe, it, expect } from 'vitest';
import { calculateCompositeScore } from '../scoring';

describe('calculateCompositeScore', () => {
  it('should return hot status for high scores', () => {
    const company = {
      domain: 'test.com',
      revenue: 1_000_000_000,
      sw_monthly_visits: 50_000_000,
      hiring_signal_score: 80
    };

    const score = calculateCompositeScore(company);

    expect(score.total).toBeGreaterThan(70);
    expect(score.status).toBe('hot');
  });

  it('should handle missing data gracefully', () => {
    const company = { domain: 'test.com' };
    const score = calculateCompositeScore(company);

    expect(score.total).toBe(0);
    expect(score.confidence).toBe('low');
  });
});
```

---

### Rule 14: Test Naming Convention

```typescript
// Pattern: describe(FunctionName) > it(should...when...)

describe('enrichCompany', () => {
  it('should enrich all data sources when level is full', async () => {
    // ...
  });

  it('should skip optional sources when level is basic', async () => {
    // ...
  });

  it('should throw ValidationError when domain is invalid', async () => {
    // ...
  });

  it('should retry API calls when network error occurs', async () => {
    // ...
  });

  it('should cache results when forceRefresh is false', async () => {
    // ...
  });
});
```

---

### Rule 15: AAA Pattern (Arrange, Act, Assert)

```typescript
it('should calculate hot status for enterprise company', () => {
  // Arrange - Set up test data
  const company: Company = {
    domain: 'costco.com',
    revenue: 250_000_000_000,
    sw_monthly_visits: 100_000_000,
    hiring_signal_score: 85,
    current_search: 'elasticsearch'
  };

  // Act - Execute function under test
  const score = calculateCompositeScore(company);

  // Assert - Verify results
  expect(score.total).toBeGreaterThan(70);
  expect(score.factors.fit).toBeGreaterThan(80);
  expect(score.factors.value).toBeGreaterThan(90);
  expect(score.status).toBe('hot');
});
```

---

## 6. Documentation Standards

### Rule 16: JSDoc for All Public Functions

```typescript
/**
 * Enriches a company with multi-source data.
 *
 * @param domain - Company domain (e.g., "costco.com")
 * @param level - Enrichment depth: basic (tech stack only),
 *                standard (+ traffic), deep (+ financials),
 *                full (+ hiring/exec/investor)
 * @param options - Optional configuration
 * @returns Enrichment result with all data sources
 *
 * @throws {ValidationError} If domain is invalid
 * @throws {APIError} If critical API calls fail (traffic, tech stack)
 *
 * @example
 * ```typescript
 * const result = await enrichCompany('costco.com', 'standard', {
 *   forceRefresh: true,
 *   onProgress: (stage, progress) => console.log(stage, progress)
 * });
 * ```
 */
export async function enrichCompany(
  domain: string,
  level: EnrichmentLevel = 'standard',
  options?: EnrichmentOptions
): Promise<EnrichmentResult> {
  // ...
}
```

---

### Rule 17: README per Module

```markdown
# Enrichment Service

## Overview
Multi-source data enrichment for companies using SimilarWeb, BuiltWith, Yahoo Finance, and more.

## Architecture
```
Orchestrator → API Clients → External APIs
           ↓
       Transformers → Typed Data
```

## Usage
\`\`\`typescript
import { enrichmentOrchestrator } from './enrichment';

const result = await enrichmentOrchestrator.enrich('costco.com', 'standard');
\`\`\`

## API Clients
- **SimilarWeb** (14 endpoints) - Traffic, engagement, competitors
- **BuiltWith** (7 endpoints) - Tech stack detection
- **Yahoo Finance** (5 endpoints) - Financial data

## Caching
- **TTL**: 7 days for traffic/tech, 24 hours for hiring
- **Storage**: Redis (Upstash)
- **Refresh**: Manual refresh via \`forceRefresh: true\`

## Error Handling
All errors inherit from \`AppError\`. Critical data sources (traffic, tech stack) throw errors on failure. Optional sources (hiring, investor) log warnings and continue.

## Testing
Run tests: \`npm test services/enrichment\`
Coverage: 85% (target: 80%)
```

---

## 7. Security Standards

### Rule 18: Never Log Sensitive Data

```typescript
// ✅ CORRECT - Redact sensitive fields
logger.info({
  userId: user.id,
  email: user.email,
  // ❌ Don't log: password, tokens, API keys
}, 'User logged in');

// ❌ WRONG - Logging sensitive data
logger.info({
  userId: user.id,
  password: user.password,  // NEVER!
  apiKey: config.apiKey     // NEVER!
}, 'User logged in');
```

---

### Rule 19: Input Validation

```typescript
import { z } from 'zod';

const EnrichRequestSchema = z.object({
  domain: z.string()
    .url('Invalid domain format')
    .refine(d => !d.includes('localhost'), 'Cannot enrich localhost'),
  level: z.enum(['basic', 'standard', 'deep', 'full']),
  forceRefresh: z.boolean().optional()
});

// Validate ALL user input
export async function handleEnrichRequest(req: Request) {
  const body = EnrichRequestSchema.parse(req.body);
  return enrichCompany(body.domain, body.level, {
    forceRefresh: body.forceRefresh
  });
}
```

---

### Rule 20: Rate Limiting

```typescript
// middleware/rate-limit.ts
import rateLimit from 'express-rate-limit';

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn({
      ip: req.ip,
      userId: req.user?.id,
      url: req.url
    }, 'Rate limit exceeded');

    res.status(429).json({
      error: {
        message: 'Too many requests',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: res.getHeader('Retry-After')
      }
    });
  }
});
```

---

## 8. Performance Standards

### Rule 21: Cache Expensive Operations

```typescript
// ✅ CORRECT - Cache API responses
async function getTrafficData(domain: string): Promise<TrafficData> {
  const cacheKey = `traffic:${domain}`;
  const cached = await redis.get(cacheKey);

  if (cached) {
    logger.info({ domain, source: 'cache' }, 'Traffic data cache hit');
    return JSON.parse(cached);
  }

  logger.info({ domain, source: 'api' }, 'Traffic data cache miss');
  const data = await similarWebClient.getTrafficData(domain);

  await redis.setex(cacheKey, 604800, JSON.stringify(data)); // 7 days
  return data;
}
```

---

### Rule 22: Parallel API Calls

```typescript
// ✅ CORRECT - Parallel when independent
async function enrichCompany(domain: string): Promise<EnrichmentResult> {
  const [traffic, techStack, financial] = await Promise.all([
    getTrafficData(domain),
    getTechStack(domain),
    getFinancialData(domain)
  ]);

  return { traffic, techStack, financial };
}

// ❌ WRONG - Sequential (3x slower!)
async function enrichCompany(domain: string): Promise<EnrichmentResult> {
  const traffic = await getTrafficData(domain);    // 2 sec
  const techStack = await getTechStack(domain);    // 2 sec
  const financial = await getFinancialData(domain); // 2 sec
  // Total: 6 seconds instead of 2!

  return { traffic, techStack, financial };
}
```

---

### Rule 23: Database Query Optimization

```typescript
// ✅ CORRECT - Use indexes, limit results
const companies = await supabase
  .from('companies')
  .select('id, domain, company_name, icp_score')
  .gte('icp_score', 70)
  .order('icp_score', { ascending: false })
  .limit(50);

// ❌ WRONG - No limit, fetch all columns
const companies = await supabase
  .from('companies')
  .select('*')
  .gte('icp_score', 70); // Could return 10,000 rows!
```

---

## 9. Code Review Checklist

### Pre-Commit (Automated)

- [ ] All tests pass (`npm test`)
- [ ] Coverage ≥80% (`npm test -- --coverage`)
- [ ] TypeScript compiles (`npm run type-check`)
- [ ] No ESLint errors (`npm run lint`)
- [ ] Code formatted (`npm run format`)

### PR Review (Manual)

**Error Handling**
- [ ] Every async function has try-catch
- [ ] Errors use custom error classes (AppError, APIError, etc.)
- [ ] Errors are logged with full context

**Logging**
- [ ] Function entry/exit logged
- [ ] Key steps logged
- [ ] No sensitive data in logs

**TypeScript**
- [ ] All functions fully typed
- [ ] No `any` types (use `unknown`)
- [ ] Runtime validation with Zod for external data

**Testing**
- [ ] Unit tests for all new functions
- [ ] Integration tests for API clients
- [ ] Edge cases covered

**Documentation**
- [ ] JSDoc for all public functions
- [ ] README updated if API changed
- [ ] Code comments for complex logic

**Security**
- [ ] Input validation
- [ ] No hardcoded secrets
- [ ] Rate limiting where applicable

**Performance**
- [ ] Expensive operations cached
- [ ] Parallel API calls where possible
- [ ] Database queries optimized

---

## 10. Enforcement Automation

### Pre-Commit Hook

```bash
# .husky/pre-commit
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

echo "🔍 Running pre-commit checks..."

# 1. Type check
echo "TypeScript..."
npm run type-check || exit 1

# 2. Lint
echo "ESLint..."
npm run lint || exit 1

# 3. Format
echo "Prettier..."
npm run format:check || exit 1

# 4. Test
echo "Tests..."
npm test || exit 1

echo "✅ All checks passed!"
```

---

### CI/CD Pipeline (GitHub Actions)

```yaml
# .github/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Type check
        run: npm run type-check

      - name: Lint
        run: npm run lint

      - name: Format check
        run: npm run format:check

      - name: Test with coverage
        run: npm test -- --coverage

      - name: Coverage gate (80%)
        run: |
          COVERAGE=$(cat coverage/coverage-summary.json | jq '.total.lines.pct')
          if (( $(echo "$COVERAGE < 80" | bc -l) )); then
            echo "Coverage is $COVERAGE%, below 80% threshold"
            exit 1
          fi

      - name: Build
        run: npm run build

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
```

---

### ESLint Configuration

```javascript
// .eslintrc.js
module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'prettier'
  ],
  rules: {
    // Error handling
    'require-await': 'error',
    'no-async-promise-executor': 'error',

    // Complexity
    'complexity': ['error', 10],
    'max-lines-per-function': ['error', { max: 50, skipBlankLines: true }],
    'max-depth': ['error', 4],

    // TypeScript
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/explicit-function-return-type': 'error',
    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/no-floating-promises': 'error',

    // Security
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error'
  }
};
```

---

## Summary

### The 23 Golden Rules

1. Every async function has try-catch
2. Use custom error classes
3. Global error handler middleware
4. Graceful degradation for optional data
5. Retry logic with exponential backoff
6. Structured logging with Pino
7. Log entry, exit, and errors
8. Distributed tracing
9. TypeScript strict mode always
10. Type everything, no implicit any
11. Use unknown instead of any
12. Zod for runtime validation
13. 80% test coverage minimum
14. Test naming: describe(name) > it(should...when...)
15. AAA pattern: Arrange, Act, Assert
16. JSDoc for all public functions
17. README per module
18. Never log sensitive data
19. Input validation with Zod
20. Rate limiting
21. Cache expensive operations
22. Parallel API calls
23. Database query optimization

---

**Last Updated**: March 6, 2026
**Enforcement**: PRE-COMMIT HOOKS + CI/CD
**Violations**: PR will be rejected

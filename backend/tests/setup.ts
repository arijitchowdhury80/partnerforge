/**
 * Vitest Test Configuration
 *
 * Setup for testing:
 * - Test database configuration
 * - Mock Redis connections
 * - Before/after hooks
 * - Test utilities
 */

import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import dotenv from 'dotenv';

// Load test environment variables FIRST
dotenv.config({ path: '.env.test' });

// Override any missing required variables for tests
process.env.NODE_ENV = 'test';
process.env.DISABLE_AUTH = 'true';
process.env.PORT = process.env.PORT || '3001';
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_KEY = process.env.SUPABASE_KEY || 'test-key-12345';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';

// Now import redis after env vars are set
import { redis } from '../queue/setup';

// Database configuration for tests
export const testDbConfig = {
  host: process.env.TEST_DB_HOST || 'localhost',
  port: parseInt(process.env.TEST_DB_PORT || '5432', 10),
  database: process.env.TEST_DB_NAME || 'arian_test',
  user: process.env.TEST_DB_USER || 'postgres',
  password: process.env.TEST_DB_PASSWORD || 'postgres',
};

// Track Redis connection state
let redisConnected = false;

/**
 * Setup before all tests
 */
beforeAll(async () => {
  // Connect to Redis if not already connected
  if (!redisConnected) {
    try {
      await redis.ping();
      redisConnected = true;
      console.log('✓ Redis connected for tests');
    } catch (error) {
      console.warn('⚠ Redis not available, using mocks');
      redisConnected = false;
    }
  }

  // Setup test database
  // TODO: Run migrations on test database
  console.log('✓ Test database setup');
});

/**
 * Cleanup after all tests
 */
afterAll(async () => {
  // Close Redis connection
  if (redisConnected) {
    await redis.quit();
    console.log('✓ Redis disconnected');
  }

  // Cleanup test database
  // TODO: Drop test data
  console.log('✓ Test cleanup complete');
});

/**
 * Reset state before each test
 */
beforeEach(async () => {
  // Clear Redis cache if connected
  if (redisConnected) {
    const keys = await redis.keys('test:*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }
});

/**
 * Cleanup after each test
 */
afterEach(async () => {
  // Additional per-test cleanup if needed
});

/**
 * Mock HTTP response helper
 */
export function mockResponse(data: any, status = 200) {
  return {
    status,
    data,
    headers: {},
  };
}

/**
 * Mock error helper
 */
export function mockError(message: string, code?: string) {
  const error: any = new Error(message);
  if (code) {
    error.code = code;
  }
  return error;
}

/**
 * Wait helper for async tests
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create test company data
 */
export function createTestCompany(overrides = {}) {
  return {
    id: 'test-company-1',
    name: 'Test Company Inc',
    domain: 'testcompany.com',
    industry: 'ecommerce',
    employee_count: 500,
    revenue: 50000000,
    ...overrides,
  };
}

/**
 * Create test audit data
 */
export function createTestAudit(overrides = {}) {
  return {
    id: 'test-audit-1',
    company_id: 'test-company-1',
    audit_type: 'search-audit',
    status: 'pending',
    started_at: new Date().toISOString(),
    ...overrides,
  };
}

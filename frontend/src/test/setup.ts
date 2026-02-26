/**
 * Vitest Test Setup
 *
 * This file runs before each test file.
 * Sets up environment, mocks, and global test utilities.
 */

import { vi, beforeAll, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// =============================================================================
// Environment Variables
// =============================================================================

vi.stubEnv('VITE_SIMILARWEB_API_KEY', 'test-api-key-123');
vi.stubEnv('VITE_BUILTWITH_API_KEY', 'test-builtwith-key-456');
vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');
vi.stubEnv('VITE_SUPABASE_SERVICE_KEY', 'test-service-key');

// =============================================================================
// Global Mocks
// =============================================================================

// Mock window.matchMedia for Mantine components (only in jsdom environment)
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

// Mock ResizeObserver for Mantine components (must be a class)
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
(global as Record<string, unknown>).ResizeObserver = MockResizeObserver;

// Mock IntersectionObserver (must be a class)
class MockIntersectionObserver {
  root = null;
  rootMargin = '';
  thresholds = [];
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn().mockReturnValue([]);
}
(global as Record<string, unknown>).IntersectionObserver = MockIntersectionObserver;

// =============================================================================
// Lifecycle Hooks
// =============================================================================

beforeAll(() => {
  // Suppress console.error for expected errors in tests
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  // Clean up React components after each test
  cleanup();
  // Clear all mocks
  vi.clearAllMocks();
});

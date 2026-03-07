import { defineConfig } from 'vitest/config';
import dotenv from 'dotenv';

// Load test environment variables BEFORE any tests run
dotenv.config({ path: '.env.test' });

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});

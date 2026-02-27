import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@services': path.resolve(__dirname, './src/services'),
      '@types': path.resolve(__dirname, './src/types'),
    },
  },
  server: {
    port: 5173,
    // No backend proxy needed - all data via direct Supabase REST API
  },
  build: {
    outDir: 'dist',
    // SECURITY: Disable sourcemaps in production (MEDIUM-1)
    // Sourcemaps expose original TypeScript source code
    sourcemap: process.env.NODE_ENV !== 'production',
  },
});

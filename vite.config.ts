/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { designTokens } from './build/tokens-plugin.ts';

export default defineConfig({
  plugins: [react(), designTokens()],
  build: {
    target: 'es2022',
    cssTarget: ['chrome111', 'edge111', 'firefox115', 'safari16.4'],
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
  worker: {
    format: 'es',
  },
  server: {
    port: 5173,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'build/**/*.test.ts'],
  },
});

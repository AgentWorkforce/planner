import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@plannr/storage-base': path.resolve(__dirname, 'packages/storage-base/src/index.ts'),
      '@plannr/errors': path.resolve(__dirname, 'packages/errors/src/index.ts'),
    },
  },
  test: {
    // Run backend tests from packages
    include: [
      'packages/planner/src/**/*.test.ts',
      'packages/server/src/**/*.test.ts',
      'packages/ideation/src/**/*.test.ts',
      'packages/forge-core/src/**/*.test.ts',
      'packages/mull/src/**/*.test.ts',
      'packages/cultivate/src/**/*.test.ts',
      'packages/forge-next/src/**/*.test.ts',
    ],
    exclude: ['node_modules/**'],
  },
});

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Run backend tests from packages
    include: [
      'packages/planner/src/**/*.test.ts',
      'packages/server/src/**/*.test.ts',
      'packages/ideation/src/**/*.test.ts',
      'packages/forge-core/src/**/*.test.ts',
      'packages/mull/src/**/*.test.ts',
    ],
    exclude: ['node_modules/**'],
  },
});

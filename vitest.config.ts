import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Backend tests only - uses node environment
    include: ['src/**/*.test.ts'],
    // planner-ui has its own vitest config with jsdom environment
    // npm test runs both: backend tests then UI tests
    exclude: ['packages/**', 'node_modules/**'],
  },
});

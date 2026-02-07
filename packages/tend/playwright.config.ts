import { defineConfig, devices } from '@playwright/test';

const BASE_URL = 'http://localhost:3004';
const API_URL = 'http://localhost:3001';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: [
    {
      command: `node --env-file=../../.env --import tsx ../../packages/server/src/server.ts`,
      url: `${API_URL}/api/health/relay`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      env: {
        PORT: '3001',
        DB_PATH: process.env.TEST_DB_DIR
          ? `${process.env.TEST_DB_DIR}/planner.db`
          : './test-planner.db',
        IDEATION_DB_PATH: process.env.TEST_DB_DIR
          ? `${process.env.TEST_DB_DIR}/ideation.db`
          : './test-ideation.db',
        FORGE_DB_PATH: process.env.TEST_DB_DIR
          ? `${process.env.TEST_DB_DIR}/forge.db`
          : './test-forge.db',
        FORGE_MODE: 'test',
      },
      cwd: '../../',
    },
    {
      command: 'npx vite --port 3004',
      url: BASE_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      cwd: './',
    },
  ],
});

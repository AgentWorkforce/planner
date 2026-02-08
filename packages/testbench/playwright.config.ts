import { defineConfig, devices } from '@playwright/test';

const BASE_URL_PLANNER = 'http://localhost:3000';
const BASE_URL_IDEATION = 'http://localhost:3002';
const BASE_URL_FORGE = 'http://localhost:3003';
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

  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',

  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'planner',
      testDir: './e2e/planner',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: BASE_URL_PLANNER,
      },
    },
    {
      name: 'ideation',
      testDir: './e2e/ideation',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: BASE_URL_IDEATION,
      },
    },
    {
      name: 'forge',
      testDir: './e2e/forge',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: BASE_URL_FORGE,
      },
    },
    {
      name: 'cross-domain',
      testDir: './e2e/cross-domain',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: BASE_URL_PLANNER,
      },
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
      command: 'npx vite --port 3000',
      url: BASE_URL_PLANNER,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      cwd: '../../packages/planner-ui',
    },
    {
      command: 'npx vite --port 3002',
      url: BASE_URL_IDEATION,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      cwd: '../../packages/ideation-ui',
    },
    {
      command: 'npx vite --port 3003',
      url: BASE_URL_FORGE,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      cwd: '../../packages/forge-ui',
    },
  ],
});

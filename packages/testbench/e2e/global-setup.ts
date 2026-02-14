import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { FullConfig } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Global setup for Playwright E2E tests.
 *
 * Creates an isolated test database directory so tests don't touch
 * production data. The webServer config in playwright.config.ts handles
 * actually starting/stopping the servers.
 */
export default async function globalSetup(_config: FullConfig) {
  // Create temp directory for test databases
  const testDbDir = path.resolve(__dirname, '..', '.test-dbs');
  if (!fs.existsSync(testDbDir)) {
    fs.mkdirSync(testDbDir, { recursive: true });
  }

  // Store the test DB dir path for the webServer env to pick up
  process.env.TEST_DB_DIR = testDbDir;

  console.log(`[e2e] Test database directory: ${testDbDir}`);
}

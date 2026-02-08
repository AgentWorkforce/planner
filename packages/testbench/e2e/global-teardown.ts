import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { FullConfig } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Global teardown for Playwright E2E tests.
 *
 * Cleans up test databases. Servers are stopped automatically
 * by Playwright's webServer config.
 */
export default async function globalTeardown(_config: FullConfig) {
  const testDbDir = path.resolve(__dirname, '..', '.test-dbs');

  if (fs.existsSync(testDbDir)) {
    fs.rmSync(testDbDir, { recursive: true });
    console.log(`[e2e] Cleaned up test database directory: ${testDbDir}`);
  }
}

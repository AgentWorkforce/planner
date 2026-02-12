/**
 * Cursor persistence for incremental adapter processing.
 *
 * Cursors track the last-processed timestamp per adapter per session,
 * stored as JSON files at .mull/cursors/{adapterType}/{sessionId}.json.
 * This enables adapters to only return data after the cursor timestamp.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Cursor } from './core-types.js';

const CURSORS_DIR = 'cursors';
const DEFAULT_MULL_DIR = '.mull';

/** Characters allowed in adapterType and sessionId path segments. */
const SAFE_SEGMENT = /^[a-zA-Z0-9_-]+$/;

function validateSegment(value: string, label: string): void {
  if (!SAFE_SEGMENT.test(value)) {
    throw new Error(
      `Invalid ${label}: "${value}". Only alphanumeric, underscore, and hyphen are allowed.`,
    );
  }
}

function cursorPath(adapterType: string, sessionId: string, mullDir: string): string {
  return path.join(mullDir, CURSORS_DIR, adapterType, `${sessionId}.json`);
}

/**
 * Read the cursor for a specific adapter and session.
 * Returns the cursor object or null if no cursor file exists.
 */
export async function getCursor(
  adapterType: string,
  sessionId: string,
  mullDir: string = DEFAULT_MULL_DIR,
): Promise<Cursor | null> {
  validateSegment(adapterType, 'adapterType');
  validateSegment(sessionId, 'sessionId');

  const filePath = cursorPath(adapterType, sessionId, mullDir);

  try {
    const raw = await readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as Cursor;
    return parsed;
  } catch (err: unknown) {
    if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw err;
  }
}

/**
 * Write a cursor for a specific adapter and session.
 * Creates the directory structure if it doesn't exist.
 */
export async function setCursor(
  adapterType: string,
  sessionId: string,
  timestamp: string,
  mullDir: string = DEFAULT_MULL_DIR,
): Promise<void> {
  validateSegment(adapterType, 'adapterType');
  validateSegment(sessionId, 'sessionId');

  const filePath = cursorPath(adapterType, sessionId, mullDir);
  const dir = path.dirname(filePath);

  await mkdir(dir, { recursive: true });

  const cursor: Cursor & { adapter_type: string; session_id: string } = {
    last_mulled_at: timestamp,
    adapter_type: adapterType,
    session_id: sessionId,
  };

  await writeFile(filePath, JSON.stringify(cursor, null, 2) + '\n', 'utf-8');
}

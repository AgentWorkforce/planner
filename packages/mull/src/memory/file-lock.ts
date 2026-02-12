import { mkdirSync, unlinkSync, openSync, closeSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const MAX_LOCK_WAIT_MS = 5_000;
const INITIAL_BACKOFF_MS = 10;
const STALE_LOCK_AGE_MS = 30_000;

/**
 * Acquires an advisory lock by creating an exclusive lock file.
 * Lock file is created at {mullDir}/locks/{name}.lock.
 * Uses exponential backoff (10ms, 20ms, 40ms, ...) with a maximum total wait of 5 seconds.
 * Detects and removes stale locks older than 30 seconds.
 */
export function acquireLock(name: string, mullDir: string): void {
  const locksDir = resolve(mullDir, 'locks');
  mkdirSync(locksDir, { recursive: true });

  const lockPath = resolve(locksDir, `${name}.lock`);
  let elapsed = 0;
  let backoff = INITIAL_BACKOFF_MS;

  while (elapsed < MAX_LOCK_WAIT_MS) {
    try {
      // Attempt exclusive file creation (fails if file exists)
      const fd = openSync(lockPath, 'wx');
      closeSync(fd);
      return; // Lock acquired
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== 'EEXIST') {
        throw err; // Unexpected error
      }

      // Lock file exists — check if stale
      if (isLockStale(lockPath)) {
        try {
          unlinkSync(lockPath);
          continue; // Retry immediately after removing stale lock
        } catch {
          // Another process may have removed it, retry
        }
      }

      // Backoff and retry
      sleepSync(backoff);
      elapsed += backoff;
      backoff = Math.min(backoff * 2, MAX_LOCK_WAIT_MS - elapsed);
    }
  }

  throw new Error(`Failed to acquire lock "${name}" after ${MAX_LOCK_WAIT_MS}ms`);
}

/**
 * Releases an advisory lock by removing the lock file.
 * Safe to call even if the lock file has already been removed.
 */
export function releaseLock(name: string, mullDir: string): void {
  const lockPath = resolve(mullDir, 'locks', `${name}.lock`);
  try {
    unlinkSync(lockPath);
  } catch {
    // Lock file may already be removed, ignore
  }
}

/**
 * Executes an async function while holding an advisory lock.
 * Acquires the lock before calling fn, and releases it in a finally block
 * regardless of whether fn succeeds or throws.
 */
export async function withLock<T>(
  name: string,
  mullDir: string,
  fn: () => Promise<T>,
): Promise<T> {
  acquireLock(name, mullDir);
  try {
    return await fn();
  } finally {
    releaseLock(name, mullDir);
  }
}

/**
 * Returns true if a lock file is older than the stale threshold (30s).
 */
function isLockStale(lockPath: string): boolean {
  try {
    const stat = statSync(lockPath);
    return Date.now() - stat.mtimeMs > STALE_LOCK_AGE_MS;
  } catch {
    return false;
  }
}

/**
 * Synchronous sleep using Atomics.wait on a SharedArrayBuffer.
 */
function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

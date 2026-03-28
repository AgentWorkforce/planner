import { describe, it, expect, vi, beforeEach } from 'vitest';
import { acquireLock, releaseLock, withLock } from './file-lock.js';

vi.mock('node:fs', () => ({
  mkdirSync: vi.fn(),
  unlinkSync: vi.fn(),
  openSync: vi.fn(),
  closeSync: vi.fn(),
  statSync: vi.fn(),
}));

import { mkdirSync, unlinkSync, openSync, closeSync, statSync } from 'node:fs';

const mockMkdirSync = vi.mocked(mkdirSync);
const mockUnlinkSync = vi.mocked(unlinkSync);
const mockOpenSync = vi.mocked(openSync);
const mockCloseSync = vi.mocked(closeSync);
const mockStatSync = vi.mocked(statSync);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('acquireLock', () => {
  it('creates lock file with exclusive flag on first attempt', () => {
    mockOpenSync.mockReturnValue(42 as any);

    acquireLock('my-topic', '/tmp/.mull');

    expect(mockMkdirSync).toHaveBeenCalledWith(
      expect.stringContaining('locks'),
      { recursive: true },
    );
    expect(mockOpenSync).toHaveBeenCalledWith(
      expect.stringContaining('my-topic.lock'),
      'wx',
    );
    expect(mockCloseSync).toHaveBeenCalledWith(42);
  });

  it('retries on EEXIST and succeeds when lock becomes available', () => {
    const eexist = Object.assign(new Error('EEXIST'), { code: 'EEXIST' });
    // First attempt: EEXIST with non-stale lock, second attempt: success
    mockOpenSync
      .mockImplementationOnce(() => { throw eexist; })
      .mockReturnValueOnce(7 as any);
    mockStatSync.mockReturnValue({ mtimeMs: Date.now() } as any);

    acquireLock('contested', '/tmp/.mull');

    expect(mockOpenSync).toHaveBeenCalledTimes(2);
    expect(mockCloseSync).toHaveBeenCalledWith(7);
  });

  it('removes stale lock and retries', () => {
    const eexist = Object.assign(new Error('EEXIST'), { code: 'EEXIST' });
    mockOpenSync
      .mockImplementationOnce(() => { throw eexist; })
      .mockReturnValueOnce(9 as any);
    // Lock is 60 seconds old — stale
    mockStatSync.mockReturnValue({ mtimeMs: Date.now() - 60_000 } as any);

    acquireLock('stale-topic', '/tmp/.mull');

    expect(mockUnlinkSync).toHaveBeenCalledWith(
      expect.stringContaining('stale-topic.lock'),
    );
    expect(mockOpenSync).toHaveBeenCalledTimes(2);
  });

  it('throws on non-EEXIST errors', () => {
    const eperm = Object.assign(new Error('EPERM'), { code: 'EPERM' });
    mockOpenSync.mockImplementation(() => { throw eperm; });

    expect(() => acquireLock('perm-err', '/tmp/.mull')).toThrow('EPERM');
  });

  it('throws timeout error when lock is never released within 5 seconds', () => {
    const eexist = Object.assign(new Error('EEXIST'), { code: 'EEXIST' });
    // Lock always exists and is never stale
    mockOpenSync.mockImplementation(() => { throw eexist; });
    mockStatSync.mockReturnValue({ mtimeMs: Date.now() } as any);

    expect(() => acquireLock('stuck', '/tmp/.mull')).toThrow(
      /Failed to acquire lock "stuck" after 5000ms/,
    );
  });

  it('detects stale locks older than 30 seconds', () => {
    const eexist = Object.assign(new Error('EEXIST'), { code: 'EEXIST' });
    mockOpenSync
      .mockImplementationOnce(() => { throw eexist; })
      .mockReturnValueOnce(10 as any);
    // Lock is 31 seconds old — just past the stale threshold
    mockStatSync.mockReturnValue({ mtimeMs: Date.now() - 31_000 } as any);

    acquireLock('barely-stale', '/tmp/.mull');

    expect(mockUnlinkSync).toHaveBeenCalledWith(
      expect.stringContaining('barely-stale.lock'),
    );
    expect(mockOpenSync).toHaveBeenCalledTimes(2);
  });

  it('does not remove lock that is under 30 seconds old', () => {
    const eexist = Object.assign(new Error('EEXIST'), { code: 'EEXIST' });
    // First call: EEXIST (lock exists, not stale), second call: success
    mockOpenSync
      .mockImplementationOnce(() => { throw eexist; })
      .mockReturnValueOnce(11 as any);
    // Lock is 29 seconds old — just under the stale threshold
    mockStatSync.mockReturnValue({ mtimeMs: Date.now() - 29_000 } as any);

    acquireLock('not-stale', '/tmp/.mull');

    // unlinkSync should NOT have been called for stale cleanup
    // (it would only be called if isLockStale returned true)
    expect(mockUnlinkSync).not.toHaveBeenCalled();
  });

  it('uses exponential backoff between retries', () => {
    const eexist = Object.assign(new Error('EEXIST'), { code: 'EEXIST' });
    // Fail 3 times, then succeed
    mockOpenSync
      .mockImplementationOnce(() => { throw eexist; })
      .mockImplementationOnce(() => { throw eexist; })
      .mockImplementationOnce(() => { throw eexist; })
      .mockReturnValueOnce(5 as any);
    mockStatSync.mockReturnValue({ mtimeMs: Date.now() } as any);

    acquireLock('backoff', '/tmp/.mull');

    // 4 attempts total: 3 failures + 1 success
    expect(mockOpenSync).toHaveBeenCalledTimes(4);
  });

  it('creates locks directory with recursive flag', () => {
    mockOpenSync.mockReturnValue(1 as any);

    acquireLock('dir-test', '/tmp/deep/.mull');

    expect(mockMkdirSync).toHaveBeenCalledWith(
      expect.stringContaining('locks'),
      { recursive: true },
    );
  });
});

describe('releaseLock', () => {
  it('removes the lock file', () => {
    releaseLock('my-topic', '/tmp/.mull');

    expect(mockUnlinkSync).toHaveBeenCalledWith(
      expect.stringContaining('my-topic.lock'),
    );
  });

  it('does not throw if lock file is already removed', () => {
    mockUnlinkSync.mockImplementation(() => {
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    });

    expect(() => releaseLock('gone', '/tmp/.mull')).not.toThrow();
  });
});

describe('withLock', () => {
  it('acquires lock, runs fn, and releases lock', async () => {
    mockOpenSync.mockReturnValue(1 as any);

    const result = await withLock('test', '/tmp/.mull', async () => {
      return 'done';
    });

    expect(result).toBe('done');
    // Lock acquired (openSync with 'wx') and released (unlinkSync)
    expect(mockOpenSync).toHaveBeenCalledWith(
      expect.stringContaining('test.lock'),
      'wx',
    );
    expect(mockUnlinkSync).toHaveBeenCalledWith(
      expect.stringContaining('test.lock'),
    );
  });

  it('releases lock even when fn throws', async () => {
    mockOpenSync.mockReturnValue(1 as any);

    await expect(
      withLock('err-test', '/tmp/.mull', async () => {
        throw new Error('fn failed');
      }),
    ).rejects.toThrow('fn failed');

    // Lock was still released
    expect(mockUnlinkSync).toHaveBeenCalledWith(
      expect.stringContaining('err-test.lock'),
    );
  });
});

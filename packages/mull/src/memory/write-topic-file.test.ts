import { describe, it, expect, vi, beforeEach } from 'vitest';
import { writeTopicFile } from './write-topic-file.js';
import type { TopicFrontmatter } from './read-topic-file.js';

vi.mock('node:fs', () => ({
  writeFileSync: vi.fn(),
  renameSync: vi.fn(),
  mkdirSync: vi.fn(),
  unlinkSync: vi.fn(),
  openSync: vi.fn(),
  closeSync: vi.fn(),
  statSync: vi.fn(),
}));

import {
  writeFileSync,
  renameSync,
  mkdirSync,
  unlinkSync,
  openSync,
  closeSync,
} from 'node:fs';

const mockWriteFileSync = vi.mocked(writeFileSync);
const mockRenameSync = vi.mocked(renameSync);
const mockMkdirSync = vi.mocked(mkdirSync);
const mockUnlinkSync = vi.mocked(unlinkSync);
const mockOpenSync = vi.mocked(openSync);
const mockCloseSync = vi.mocked(closeSync);

const sampleFrontmatter: TopicFrontmatter = {
  topic: 'Error Handling',
  updated: '2026-02-11T12:00:00.000Z',
  sessions: ['session-1'],
  tags: ['errors'],
};

const sampleBody = '## Decisions\n\n### prefer-result-types\n\nUse Result types.';

beforeEach(() => {
  vi.resetAllMocks();
  // Default: lock acquisition succeeds
  mockOpenSync.mockReturnValue(42 as any);
});

describe('writeTopicFile', () => {
  describe('atomic write', () => {
    it('writes to .tmp file then renames to final path', () => {
      writeTopicFile('error-handling', sampleFrontmatter, sampleBody, '/tmp/memory');

      // Should write to .tmp
      expect(mockWriteFileSync).toHaveBeenCalledTimes(1);
      const writePath = String(mockWriteFileSync.mock.calls[0]![0]);
      expect(writePath).toBe('/tmp/memory/error-handling.md.tmp');

      // Should rename .tmp to final
      expect(mockRenameSync).toHaveBeenCalledTimes(1);
      expect(mockRenameSync).toHaveBeenCalledWith(
        '/tmp/memory/error-handling.md.tmp',
        '/tmp/memory/error-handling.md',
      );
    });

    it('writes before renaming (correct ordering)', () => {
      writeTopicFile('test-topic', sampleFrontmatter, sampleBody, '/tmp/memory');

      const writeOrder = mockWriteFileSync.mock.invocationCallOrder[0]!;
      const renameOrder = mockRenameSync.mock.invocationCallOrder[0]!;
      expect(writeOrder).toBeLessThan(renameOrder);
    });

    it('no .tmp file persists after successful write', () => {
      writeTopicFile('clean-write', sampleFrontmatter, sampleBody, '/tmp/memory');

      // After success: writeFileSync wrote to .tmp, renameSync moved it
      // unlinkSync should NOT be called for .tmp cleanup on success path
      // (unlinkSync is only called for lock release, not .tmp cleanup on success)
      const unlinkCalls = mockUnlinkSync.mock.calls.map((c) => String(c[0]));
      const tmpCleanupCalls = unlinkCalls.filter((p) => p.endsWith('.md.tmp'));
      expect(tmpCleanupCalls).toHaveLength(0);

      // The .tmp was renamed away, so it doesn't persist
      expect(mockRenameSync).toHaveBeenCalledWith(
        expect.stringContaining('clean-write.md.tmp'),
        expect.stringContaining('clean-write.md'),
      );
    });

    it('cleans up .tmp file on write error', () => {
      mockWriteFileSync.mockImplementationOnce(() => {
        throw new Error('disk full');
      });

      expect(() =>
        writeTopicFile('fail-write', sampleFrontmatter, sampleBody, '/tmp/memory'),
      ).toThrow('disk full');

      // .tmp should be cleaned up
      expect(mockUnlinkSync).toHaveBeenCalledWith(
        '/tmp/memory/fail-write.md.tmp',
      );
    });

    it('cleans up .tmp file on rename error', () => {
      mockRenameSync.mockImplementationOnce(() => {
        throw new Error('rename failed');
      });

      expect(() =>
        writeTopicFile('fail-rename', sampleFrontmatter, sampleBody, '/tmp/memory'),
      ).toThrow('rename failed');

      // .tmp should be cleaned up
      expect(mockUnlinkSync).toHaveBeenCalledWith(
        '/tmp/memory/fail-rename.md.tmp',
      );
    });
  });

  describe('directory creation', () => {
    it('creates memoryDir if it does not exist', () => {
      writeTopicFile('new-topic', sampleFrontmatter, sampleBody, '/tmp/new-memory');

      expect(mockMkdirSync).toHaveBeenCalledWith('/tmp/new-memory', { recursive: true });
    });

    it('creates memoryDir with recursive flag for nested paths', () => {
      writeTopicFile('deep', sampleFrontmatter, sampleBody, '/tmp/a/b/c/memory');

      expect(mockMkdirSync).toHaveBeenCalledWith('/tmp/a/b/c/memory', { recursive: true });
    });
  });

  describe('lock integration', () => {
    it('acquires lock before writing', () => {
      writeTopicFile('locked-topic', sampleFrontmatter, sampleBody, '/tmp/memory');

      // openSync (lock acquire) should happen before writeFileSync
      const lockOrder = mockOpenSync.mock.invocationCallOrder[0]!;
      const writeOrder = mockWriteFileSync.mock.invocationCallOrder[0]!;
      expect(lockOrder).toBeLessThan(writeOrder);
    });

    it('releases lock after successful write', () => {
      writeTopicFile('locked-topic', sampleFrontmatter, sampleBody, '/tmp/memory');

      // Lock release (unlinkSync on .lock file) should happen after rename
      const renameOrder = mockRenameSync.mock.invocationCallOrder[0]!;
      const lockReleaseCalls = mockUnlinkSync.mock.calls.filter((c) =>
        String(c[0]).endsWith('.lock'),
      );
      expect(lockReleaseCalls).toHaveLength(1);

      const lockReleaseIdx = mockUnlinkSync.mock.calls.findIndex((c) =>
        String(c[0]).endsWith('.lock'),
      );
      const lockReleaseOrder = mockUnlinkSync.mock.invocationCallOrder[lockReleaseIdx]!;
      expect(lockReleaseOrder).toBeGreaterThan(renameOrder);
    });

    it('releases lock even when write fails', () => {
      mockWriteFileSync.mockImplementationOnce(() => {
        throw new Error('write error');
      });

      expect(() =>
        writeTopicFile('error-topic', sampleFrontmatter, sampleBody, '/tmp/memory'),
      ).toThrow('write error');

      // Lock should still be released
      const lockReleaseCalls = mockUnlinkSync.mock.calls.filter((c) =>
        String(c[0]).endsWith('.lock'),
      );
      expect(lockReleaseCalls).toHaveLength(1);
      expect(String(lockReleaseCalls[0]![0])).toContain('error-topic.lock');
    });

    it('uses topic slug as lock name', () => {
      writeTopicFile('my-specific-topic', sampleFrontmatter, sampleBody, '/tmp/memory');

      expect(mockOpenSync).toHaveBeenCalledWith(
        expect.stringContaining('my-specific-topic.lock'),
        'wx',
      );
    });

    it('creates locks directory under .mull/', () => {
      writeTopicFile('topic', sampleFrontmatter, sampleBody, '/tmp/memory');

      // mkdirSync should be called for both memoryDir and locks dir
      const mkdirCalls = mockMkdirSync.mock.calls.map((c) => String(c[0]));
      expect(mkdirCalls).toContain('/tmp/memory');
      const locksDirCall = mkdirCalls.find((p) => p.includes('locks'));
      expect(locksDirCall).toContain('.mull');
      expect(locksDirCall).toContain('locks');
    });
  });

  describe('content generation', () => {
    it('writes valid gray-matter content with frontmatter and body', () => {
      writeTopicFile('content-test', sampleFrontmatter, sampleBody, '/tmp/memory');

      const content = String(mockWriteFileSync.mock.calls[0]![1]);
      // gray-matter stringify wraps frontmatter in ---
      expect(content).toContain('---');
      expect(content).toContain('topic: Error Handling');
      expect(content).toContain('session-1');
      expect(content).toContain('errors');
      // Body should be present
      expect(content).toContain('## Decisions');
      expect(content).toContain('### prefer-result-types');
      expect(content).toContain('Use Result types.');
    });

    it('writes content encoded as utf-8', () => {
      writeTopicFile('encoding', sampleFrontmatter, sampleBody, '/tmp/memory');

      expect(mockWriteFileSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        'utf-8',
      );
    });

    it('handles empty body', () => {
      writeTopicFile('empty-body', sampleFrontmatter, '', '/tmp/memory');

      const content = String(mockWriteFileSync.mock.calls[0]![1]);
      expect(content).toContain('---');
      expect(content).toContain('topic: Error Handling');
    });

    it('handles empty tags and sessions in frontmatter', () => {
      const emptyFrontmatter: TopicFrontmatter = {
        topic: 'Bare Topic',
        updated: '2026-02-11T12:00:00.000Z',
        sessions: [],
        tags: [],
      };

      writeTopicFile('bare', emptyFrontmatter, 'Some body.', '/tmp/memory');

      const content = String(mockWriteFileSync.mock.calls[0]![1]);
      expect(content).toContain('topic: Bare Topic');
      expect(content).toContain('sessions: []');
      expect(content).toContain('tags: []');
    });
  });
});

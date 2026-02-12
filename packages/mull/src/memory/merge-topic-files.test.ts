import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mergeIntoTopicFiles } from './merge-topic-files.js';
import type { MergeNugget } from './merge-topic-files.js';

// Mock dependencies
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  renameSync: vi.fn(),
  unlinkSync: vi.fn(),
  mkdirSync: vi.fn(),
  openSync: vi.fn(() => 99),
  closeSync: vi.fn(),
  statSync: vi.fn(),
  readdirSync: vi.fn(() => []),
}));

import {
  existsSync,
  readFileSync,
  writeFileSync,
  renameSync,
  mkdirSync,
  openSync,
  closeSync,
  readdirSync,
} from 'node:fs';

const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);
const mockWriteFileSync = vi.mocked(writeFileSync);
const mockRenameSync = vi.mocked(renameSync);
const mockMkdirSync = vi.mocked(mkdirSync);
const mockOpenSync = vi.mocked(openSync);
const mockCloseSync = vi.mocked(closeSync);
const mockReaddirSync = vi.mocked(readdirSync);

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-02-11T12:00:00.000Z'));

  // Default: lock acquisition succeeds (openSync with 'wx' succeeds)
  mockOpenSync.mockReturnValue(99);
  // Default: no existing files in memoryDir
  mockReaddirSync.mockReturnValue([]);
  // Default: file does not exist (new topic)
  mockExistsSync.mockReturnValue(false);
});

/** Helper to extract the body content written to the .tmp file via writeTopicFile. */
function getWrittenContent(topicSlug: string): string | null {
  for (const call of mockWriteFileSync.mock.calls) {
    const path = String(call[0]);
    if (path.includes(`${topicSlug}.md.tmp`)) {
      return String(call[1]);
    }
  }
  return null;
}

/** Helper to extract all written content across all topics. */
function getAllWrittenContents(): Map<string, string> {
  const contents = new Map<string, string>();
  for (const call of mockWriteFileSync.mock.calls) {
    const path = String(call[0]);
    const match = path.match(/\/([^/]+)\.md\.tmp$/);
    if (match) {
      contents.set(match[1]!, String(call[1]));
    }
  }
  return contents;
}

describe('mergeIntoTopicFiles', () => {
  describe('basic merge — new topic creation', () => {
    it('creates a new topic file for a single nugget', () => {
      const nuggets: MergeNugget[] = [
        {
          topic: 'error-handling',
          slug: 'prefer-result-types',
          category: 'Decisions',
          description: 'Use Result types instead of throwing exceptions.',
          tags: ['errors', 'scope:backend'],
        },
      ];

      const result = mergeIntoTopicFiles(nuggets, '/tmp/memory', 'session-1');

      expect(result.topicsCreated).toEqual(['error-handling']);
      expect(result.topicsUpdated).toEqual([]);
      expect(result.nuggetsWritten).toBe(1);

      // Verify writeTopicFile was called (write + rename)
      expect(mockMkdirSync).toHaveBeenCalled();
      expect(mockWriteFileSync).toHaveBeenCalledTimes(1);
      expect(mockRenameSync).toHaveBeenCalledTimes(1);

      const content = getWrittenContent('error-handling');
      expect(content).not.toBeNull();
      expect(content).toContain('topic: Error Handling');
      expect(content).toContain('session-1');
      expect(content).toContain('errors');
      expect(content).toContain('scope:backend');
      expect(content).toContain('## Decisions');
      expect(content).toContain('### prefer-result-types');
      expect(content).toContain('Use Result types instead of throwing exceptions.');
    });

    it('returns empty result for empty nuggets array', () => {
      const result = mergeIntoTopicFiles([], '/tmp/memory', 'session-1');

      expect(result.topicsCreated).toEqual([]);
      expect(result.topicsUpdated).toEqual([]);
      expect(result.nuggetsWritten).toBe(0);
      expect(mockWriteFileSync).not.toHaveBeenCalled();
    });

    it('derives topic display name from slug for new files', () => {
      const nuggets: MergeNugget[] = [
        {
          topic: 'api-design-patterns',
          slug: 'use-rest',
          category: 'Decisions',
          description: 'Use REST for all APIs.',
        },
      ];

      mergeIntoTopicFiles(nuggets, '/tmp/memory', 'session-1');

      const content = getWrittenContent('api-design-patterns');
      expect(content).toContain('topic: Api Design Patterns');
    });
  });

  describe('merge into existing topic — slug replacement', () => {
    const existingTopicContent = `---
topic: Error Handling
updated: 2026-02-10T10:00:00Z
sessions:
  - session-1
tags:
  - errors
---

## Decisions

### prefer-result-types

Use Result types instead of throwing exceptions.

### use-custom-errors

Create domain-specific error classes.

## Patterns

### error-boundary

Wrap components in error boundaries.
`;

    it('replaces existing nugget with same slug in-place', () => {
      mockReaddirSync.mockReturnValue([
        'error-handling.md' as unknown as import('node:fs').Dirent,
      ]);
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(existingTopicContent);

      const nuggets: MergeNugget[] = [
        {
          topic: 'error-handling',
          slug: 'prefer-result-types',
          category: 'Decisions',
          description: 'UPDATED: Use Result<T, E> union types consistently.',
          tags: ['errors', 'typescript'],
        },
      ];

      const result = mergeIntoTopicFiles(nuggets, '/tmp/memory', 'session-2');

      expect(result.topicsUpdated).toEqual(['error-handling']);
      expect(result.topicsCreated).toEqual([]);
      expect(result.nuggetsWritten).toBe(1);

      const content = getWrittenContent('error-handling')!;
      // Updated nugget content
      expect(content).toContain('UPDATED: Use Result<T, E> union types consistently.');
      // Original nugget content should NOT be present
      expect(content).not.toContain('Use Result types instead of throwing exceptions.');
      // Other existing nuggets preserved
      expect(content).toContain('### use-custom-errors');
      expect(content).toContain('Create domain-specific error classes.');
      expect(content).toContain('### error-boundary');
    });

    it('never duplicates nuggets with same slug', () => {
      mockReaddirSync.mockReturnValue([
        'error-handling.md' as unknown as import('node:fs').Dirent,
      ]);
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(existingTopicContent);

      const nuggets: MergeNugget[] = [
        {
          topic: 'error-handling',
          slug: 'prefer-result-types',
          category: 'Decisions',
          description: 'Updated description.',
        },
      ];

      mergeIntoTopicFiles(nuggets, '/tmp/memory', 'session-2');

      const content = getWrittenContent('error-handling')!;
      // Count occurrences of the slug header
      const matches = content.match(/### prefer-result-types/g);
      expect(matches).toHaveLength(1);
    });

    it('appends new nuggets that do not exist yet', () => {
      mockReaddirSync.mockReturnValue([
        'error-handling.md' as unknown as import('node:fs').Dirent,
      ]);
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(existingTopicContent);

      const nuggets: MergeNugget[] = [
        {
          topic: 'error-handling',
          slug: 'retry-with-backoff',
          category: 'Patterns',
          description: 'Use exponential backoff for retries.',
        },
      ];

      mergeIntoTopicFiles(nuggets, '/tmp/memory', 'session-2');

      const content = getWrittenContent('error-handling')!;
      // New nugget appended
      expect(content).toContain('### retry-with-backoff');
      expect(content).toContain('Use exponential backoff for retries.');
      // Existing nuggets preserved
      expect(content).toContain('### prefer-result-types');
      expect(content).toContain('### use-custom-errors');
      expect(content).toContain('### error-boundary');
    });
  });

  describe('section ordering', () => {
    it('orders sections: Decisions, Constraints, Patterns, Gotchas, Context', () => {
      const nuggets: MergeNugget[] = [
        { topic: 'arch', slug: 'gotcha-1', category: 'Gotchas', description: 'A gotcha.' },
        { topic: 'arch', slug: 'decision-1', category: 'Decisions', description: 'A decision.' },
        { topic: 'arch', slug: 'context-1', category: 'Context', description: 'Some context.' },
        { topic: 'arch', slug: 'constraint-1', category: 'Constraints', description: 'A constraint.' },
        { topic: 'arch', slug: 'pattern-1', category: 'Patterns', description: 'A pattern.' },
      ];

      mergeIntoTopicFiles(nuggets, '/tmp/memory', 'session-1');

      const content = getWrittenContent('arch')!;
      const decIdx = content.indexOf('## Decisions');
      const conIdx = content.indexOf('## Constraints');
      const patIdx = content.indexOf('## Patterns');
      const gotIdx = content.indexOf('## Gotchas');
      const ctxIdx = content.indexOf('## Context');

      expect(decIdx).toBeGreaterThan(-1);
      expect(conIdx).toBeGreaterThan(decIdx);
      expect(patIdx).toBeGreaterThan(conIdx);
      expect(gotIdx).toBeGreaterThan(patIdx);
      expect(ctxIdx).toBeGreaterThan(gotIdx);
    });

    it('omits empty sections', () => {
      const nuggets: MergeNugget[] = [
        { topic: 'arch', slug: 'decision-1', category: 'Decisions', description: 'A decision.' },
        { topic: 'arch', slug: 'pattern-1', category: 'Patterns', description: 'A pattern.' },
      ];

      mergeIntoTopicFiles(nuggets, '/tmp/memory', 'session-1');

      const content = getWrittenContent('arch')!;
      expect(content).toContain('## Decisions');
      expect(content).toContain('## Patterns');
      expect(content).not.toContain('## Constraints');
      expect(content).not.toContain('## Gotchas');
      expect(content).not.toContain('## Context');
    });
  });

  describe('frontmatter management', () => {
    it('appends sessionId to sessions (append-only)', () => {
      const existingContent = `---
topic: Testing
updated: 2026-02-10T10:00:00Z
sessions:
  - session-1
  - session-2
tags:
  - testing
---

## Decisions

### use-vitest

Use vitest for testing.
`;
      mockReaddirSync.mockReturnValue([
        'testing.md' as unknown as import('node:fs').Dirent,
      ]);
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(existingContent);

      mergeIntoTopicFiles(
        [{ topic: 'testing', slug: 'new-nugget', category: 'Decisions', description: 'New.' }],
        '/tmp/memory',
        'session-3',
      );

      const content = getWrittenContent('testing')!;
      expect(content).toContain('session-1');
      expect(content).toContain('session-2');
      expect(content).toContain('session-3');
    });

    it('does not duplicate existing sessionId', () => {
      const existingContent = `---
topic: Testing
updated: 2026-02-10T10:00:00Z
sessions:
  - session-1
tags:
  - testing
---

## Decisions

### use-vitest

Use vitest.
`;
      mockReaddirSync.mockReturnValue([
        'testing.md' as unknown as import('node:fs').Dirent,
      ]);
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(existingContent);

      mergeIntoTopicFiles(
        [{ topic: 'testing', slug: 'new-nugget', category: 'Decisions', description: 'New.' }],
        '/tmp/memory',
        'session-1', // Same session
      );

      const content = getWrittenContent('testing')!;
      const sessionMatches = content.match(/session-1/g);
      // session-1 should appear only once in the sessions array
      expect(sessionMatches).toHaveLength(1);
    });

    it('unions tags from all nuggets including scope-derived tags', () => {
      const existingContent = `---
topic: Testing
updated: 2026-02-10T10:00:00Z
sessions:
  - session-1
tags:
  - testing
  - quality
---

## Decisions

### use-vitest

Use vitest.
`;
      mockReaddirSync.mockReturnValue([
        'testing.md' as unknown as import('node:fs').Dirent,
      ]);
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(existingContent);

      mergeIntoTopicFiles(
        [
          {
            topic: 'testing',
            slug: 'new-nugget',
            category: 'Decisions',
            description: 'New.',
            tags: ['scope:backend', 'testing', 'ci'],
          },
          {
            topic: 'testing',
            slug: 'another-nugget',
            category: 'Patterns',
            description: 'Another.',
            tags: ['scope:frontend', 'e2e'],
          },
        ],
        '/tmp/memory',
        'session-2',
      );

      const content = getWrittenContent('testing')!;
      // Existing tags preserved
      expect(content).toContain('testing');
      expect(content).toContain('quality');
      // New tags added
      expect(content).toContain('scope:backend');
      expect(content).toContain('scope:frontend');
      expect(content).toContain('ci');
      expect(content).toContain('e2e');
    });

    it('updates the timestamp', () => {
      mergeIntoTopicFiles(
        [{ topic: 'test', slug: 's1', category: 'Decisions', description: 'D.' }],
        '/tmp/memory',
        'session-1',
      );

      const content = getWrittenContent('test')!;
      expect(content).toContain('2026-02-11T12:00:00.000Z');
    });

    it('preserves existing topic display name', () => {
      const existingContent = `---
topic: Custom Display Name
updated: 2026-02-10T10:00:00Z
sessions:
  - session-1
tags: []
---

## Decisions

### old-nugget

Old content.
`;
      mockReaddirSync.mockReturnValue([
        'custom-name.md' as unknown as import('node:fs').Dirent,
      ]);
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(existingContent);

      mergeIntoTopicFiles(
        [{ topic: 'custom-name', slug: 'new-nugget', category: 'Decisions', description: 'New.' }],
        '/tmp/memory',
        'session-2',
      );

      const content = getWrittenContent('custom-name')!;
      expect(content).toContain('topic: Custom Display Name');
    });
  });

  describe('nugget rendering', () => {
    it('renders nugget with ### slug-name header and description', () => {
      mergeIntoTopicFiles(
        [{
          topic: 'test',
          slug: 'my-decision',
          category: 'Decisions',
          description: 'This is the decision description.',
        }],
        '/tmp/memory',
        'session-1',
      );

      const content = getWrittenContent('test')!;
      expect(content).toContain('### my-decision');
      expect(content).toContain('This is the decision description.');
    });

    it('renders **Why** metadata line', () => {
      mergeIntoTopicFiles(
        [{
          topic: 'test',
          slug: 'decision-1',
          category: 'Decisions',
          description: 'Use SQLite.',
          why: 'Simplicity and zero-ops deployment.',
        }],
        '/tmp/memory',
        'session-1',
      );

      const content = getWrittenContent('test')!;
      expect(content).toContain('**Why**: Simplicity and zero-ops deployment.');
    });

    it('renders **Caused** metadata line with comma-separated slugs', () => {
      mergeIntoTopicFiles(
        [{
          topic: 'test',
          slug: 'decision-1',
          category: 'Decisions',
          description: 'Use SQLite.',
          caused: ['storage-simplification', 'reduced-ops'],
        }],
        '/tmp/memory',
        'session-1',
      );

      const content = getWrittenContent('test')!;
      expect(content).toContain('**Caused**: storage-simplification, reduced-ops');
    });

    it('renders **When** metadata line', () => {
      mergeIntoTopicFiles(
        [{
          topic: 'test',
          slug: 'decision-1',
          category: 'Decisions',
          description: 'Use SQLite.',
          when: '2026-01-15',
        }],
        '/tmp/memory',
        'session-1',
      );

      const content = getWrittenContent('test')!;
      expect(content).toContain('**When**: 2026-01-15');
    });

    it('omits metadata lines when fields are absent', () => {
      mergeIntoTopicFiles(
        [{
          topic: 'test',
          slug: 'simple',
          category: 'Decisions',
          description: 'Simple nugget without metadata.',
        }],
        '/tmp/memory',
        'session-1',
      );

      const content = getWrittenContent('test')!;
      expect(content).not.toContain('**Why**');
      expect(content).not.toContain('**Caused**');
      expect(content).not.toContain('**When**');
    });
  });

  describe('causal link validation', () => {
    it('warns when caused references a slug not in memory', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      mergeIntoTopicFiles(
        [{
          topic: 'test',
          slug: 'decision-1',
          category: 'Decisions',
          description: 'A decision.',
          caused: ['nonexistent-slug', 'another-missing'],
        }],
        '/tmp/memory',
        'session-1',
      );

      expect(warnSpy).toHaveBeenCalledTimes(2);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('nonexistent-slug'),
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('another-missing'),
      );

      warnSpy.mockRestore();
    });

    it('does not warn when caused references exist in input nuggets', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      mergeIntoTopicFiles(
        [
          {
            topic: 'test',
            slug: 'decision-1',
            category: 'Decisions',
            description: 'A decision.',
            caused: ['pattern-1'],
          },
          {
            topic: 'test',
            slug: 'pattern-1',
            category: 'Patterns',
            description: 'A pattern.',
          },
        ],
        '/tmp/memory',
        'session-1',
      );

      expect(warnSpy).not.toHaveBeenCalled();

      warnSpy.mockRestore();
    });

    it('does not warn when caused references exist in existing topic files', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      mockReaddirSync.mockReturnValue([
        'existing-topic.md' as unknown as import('node:fs').Dirent,
      ]);
      // existsSync: true for existing file, false for new file
      mockExistsSync.mockImplementation((path) => {
        return String(path).includes('existing-topic.md');
      });
      mockReadFileSync.mockReturnValue(`---
topic: Existing
updated: 2026-02-10T10:00:00Z
sessions:
  - session-0
tags: []
---

## Decisions

### existing-slug

An existing decision.
`);

      mergeIntoTopicFiles(
        [{
          topic: 'new-topic',
          slug: 'references-existing',
          category: 'Decisions',
          description: 'This references an existing slug.',
          caused: ['existing-slug'],
        }],
        '/tmp/memory',
        'session-1',
      );

      expect(warnSpy).not.toHaveBeenCalled();

      warnSpy.mockRestore();
    });

    it('does not error — only warns — for invalid causal links', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Should not throw
      const result = mergeIntoTopicFiles(
        [{
          topic: 'test',
          slug: 'decision-1',
          category: 'Decisions',
          description: 'A decision.',
          caused: ['totally-missing'],
        }],
        '/tmp/memory',
        'session-1',
      );

      // Should still complete successfully
      expect(result.nuggetsWritten).toBe(1);
      expect(result.topicsCreated).toEqual(['test']);
      expect(warnSpy).toHaveBeenCalledTimes(1);

      warnSpy.mockRestore();
    });
  });

  describe('multi-topic merge', () => {
    it('creates multiple new topic files in one call', () => {
      const nuggets: MergeNugget[] = [
        { topic: 'testing', slug: 'use-vitest', category: 'Decisions', description: 'Use vitest.', tags: ['testing'] },
        { topic: 'architecture', slug: 'use-sqlite', category: 'Decisions', description: 'Use SQLite.', tags: ['storage'] },
        { topic: 'testing', slug: 'arrange-act-assert', category: 'Patterns', description: 'AAA pattern.', tags: ['testing'] },
      ];

      const result = mergeIntoTopicFiles(nuggets, '/tmp/memory', 'session-1');

      expect(result.topicsCreated).toContain('testing');
      expect(result.topicsCreated).toContain('architecture');
      expect(result.nuggetsWritten).toBe(3);
    });

    it('tracks both created and updated topics correctly', () => {
      const existingContent = `---
topic: Testing
updated: 2026-02-10T10:00:00Z
sessions:
  - session-1
tags:
  - testing
---

## Decisions

### use-vitest

Use vitest.
`;

      mockReaddirSync.mockReturnValue([
        'testing.md' as unknown as import('node:fs').Dirent,
      ]);
      mockExistsSync.mockImplementation((path) => {
        return String(path).includes('testing.md');
      });
      mockReadFileSync.mockImplementation((path) => {
        if (String(path).includes('testing.md')) return existingContent;
        return '';
      });

      const nuggets: MergeNugget[] = [
        { topic: 'testing', slug: 'new-test-nugget', category: 'Patterns', description: 'New pattern.' },
        { topic: 'brand-new-topic', slug: 'new-nugget', category: 'Decisions', description: 'Brand new.' },
      ];

      const result = mergeIntoTopicFiles(nuggets, '/tmp/memory', 'session-2');

      expect(result.topicsUpdated).toEqual(['testing']);
      expect(result.topicsCreated).toEqual(['brand-new-topic']);
      expect(result.nuggetsWritten).toBe(2);
    });
  });

  describe('idempotent re-run', () => {
    it('re-running same nuggets produces no duplicates', () => {
      // First run: creates the topic
      const nuggets: MergeNugget[] = [
        { topic: 'test', slug: 'slug-a', category: 'Decisions', description: 'Decision A.', tags: ['tag1'] },
        { topic: 'test', slug: 'slug-b', category: 'Patterns', description: 'Pattern B.', tags: ['tag2'] },
      ];

      mergeIntoTopicFiles(nuggets, '/tmp/memory', 'session-1');
      const firstRunContent = getWrittenContent('test')!;

      // Second run: simulate reading back what was written, then merge again
      vi.clearAllMocks();
      mockOpenSync.mockReturnValue(99);
      mockReaddirSync.mockReturnValue([
        'test.md' as unknown as import('node:fs').Dirent,
      ]);
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(firstRunContent);

      const result = mergeIntoTopicFiles(nuggets, '/tmp/memory', 'session-1');
      const secondRunContent = getWrittenContent('test')!;

      // Should update, not create
      expect(result.topicsUpdated).toEqual(['test']);
      expect(result.topicsCreated).toEqual([]);

      // Each slug should appear exactly once
      const slugAMatches = secondRunContent.match(/### slug-a/g);
      const slugBMatches = secondRunContent.match(/### slug-b/g);
      expect(slugAMatches).toHaveLength(1);
      expect(slugBMatches).toHaveLength(1);

      // Session should not be duplicated
      const sessionMatches = secondRunContent.match(/session-1/g);
      expect(sessionMatches).toHaveLength(1);
    });
  });

  describe('edge cases', () => {
    it('handles nuggets with tags: undefined gracefully', () => {
      const nuggets: MergeNugget[] = [
        { topic: 'test', slug: 's1', category: 'Decisions', description: 'D.' },
      ];

      const result = mergeIntoTopicFiles(nuggets, '/tmp/memory', 'session-1');
      expect(result.nuggetsWritten).toBe(1);

      const content = getWrittenContent('test')!;
      expect(content).toContain('tags: []');
    });

    it('handles memoryDir that does not exist yet', () => {
      mockReaddirSync.mockImplementation(() => {
        throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      });

      const nuggets: MergeNugget[] = [
        { topic: 'test', slug: 's1', category: 'Decisions', description: 'D.' },
      ];

      // Should not throw — directory gets created by writeTopicFile
      const result = mergeIntoTopicFiles(nuggets, '/tmp/new-memory', 'session-1');
      expect(result.topicsCreated).toEqual(['test']);
    });

    it('preserves nuggets from other sessions when merging', () => {
      const existingContent = `---
topic: Testing
updated: 2026-02-10T10:00:00Z
sessions:
  - session-1
tags:
  - testing
---

## Decisions

### use-vitest

Use vitest for testing.

## Patterns

### arrange-act-assert

All tests follow the AAA pattern.

## Gotchas

### sqlite-locking

SQLite has file-level locking.
`;
      mockReaddirSync.mockReturnValue([
        'testing.md' as unknown as import('node:fs').Dirent,
      ]);
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(existingContent);

      // Only adding one new nugget - all existing should be preserved
      mergeIntoTopicFiles(
        [{ topic: 'testing', slug: 'new-constraint', category: 'Constraints', description: 'A constraint.' }],
        '/tmp/memory',
        'session-2',
      );

      const content = getWrittenContent('testing')!;
      // All existing nuggets preserved
      expect(content).toContain('### use-vitest');
      expect(content).toContain('### arrange-act-assert');
      expect(content).toContain('### sqlite-locking');
      // New nugget added
      expect(content).toContain('### new-constraint');
    });
  });
});

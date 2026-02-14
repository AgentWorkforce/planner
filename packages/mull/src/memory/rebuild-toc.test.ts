import { describe, it, expect, vi, beforeEach } from 'vitest';
import { rebuildTOC } from './rebuild-toc.js';

vi.mock('node:fs', () => ({
  readdirSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  renameSync: vi.fn(),
}));

import { readdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';

const mockReaddirSync = vi.mocked(readdirSync);
const mockReadFileSync = vi.mocked(readFileSync);
const mockWriteFileSync = vi.mocked(writeFileSync);
const mockRenameSync = vi.mocked(renameSync);

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-02-11T12:00:00.000Z'));
});

describe('rebuildTOC', () => {
  it('generates index.md from topic files sorted alphabetically', () => {
    mockReaddirSync.mockReturnValue([
      'testing.md' as unknown as import('node:fs').Dirent,
      'architecture.md' as unknown as import('node:fs').Dirent,
      'error-handling.md' as unknown as import('node:fs').Dirent,
    ]);

    mockReadFileSync.mockImplementation((filePath) => {
      const path = String(filePath);
      if (path.endsWith('architecture.md')) {
        return `---
topic: Architecture
updated: 2026-02-10T10:00:00Z
sessions:
  - session-1
  - session-2
tags:
  - design
  - patterns
---

## Decisions
`;
      }
      if (path.endsWith('error-handling.md')) {
        return `---
topic: Error Handling
updated: 2026-02-09T08:00:00Z
sessions:
  - session-3
tags:
  - errors
---

## Decisions
`;
      }
      if (path.endsWith('testing.md')) {
        return `---
topic: Testing
updated: 2026-02-11T06:00:00Z
sessions:
  - session-1
  - session-4
  - session-5
tags:
  - testing
  - quality
---

## Decisions
`;
      }
      return '';
    });

    rebuildTOC('/tmp/memory');

    // Should write to temp file first
    expect(mockWriteFileSync).toHaveBeenCalledTimes(1);
    const [tmpPath, content] = mockWriteFileSync.mock.calls[0]!;
    expect(String(tmpPath)).toBe('/tmp/memory/index.md.tmp');

    // Should rename temp to final
    expect(mockRenameSync).toHaveBeenCalledWith(
      '/tmp/memory/index.md.tmp',
      '/tmp/memory/index.md'
    );

    const written = String(content);

    // Check frontmatter
    expect(written).toContain('updated: 2026-02-11T12:00:00.000Z');
    expect(written).toContain('topics: 3');

    // Check table header
    expect(written).toContain('| Topic | Tags | Sessions | Updated |');
    expect(written).toContain('|-------|------|----------|---------|');

    // Check alphabetical sorting: Architecture < Error Handling < Testing
    const lines = written.split('\n');
    const tableRows = lines.filter((l) => l.startsWith('| ') && !l.startsWith('| Topic') && !l.startsWith('|---'));
    expect(tableRows).toHaveLength(3);
    expect(tableRows[0]).toContain('Architecture');
    expect(tableRows[1]).toContain('Error Handling');
    expect(tableRows[2]).toContain('Testing');
  });

  it('excludes index.md from topic listing', () => {
    mockReaddirSync.mockReturnValue([
      'index.md' as unknown as import('node:fs').Dirent,
      'one-topic.md' as unknown as import('node:fs').Dirent,
    ]);

    mockReadFileSync.mockReturnValue(`---
topic: One Topic
updated: 2026-02-11T00:00:00Z
sessions:
  - s1
tags:
  - tag1
---
`);

    rebuildTOC('/tmp/memory');

    // readFileSync should only be called for one-topic.md, not index.md
    expect(mockReadFileSync).toHaveBeenCalledTimes(1);
    expect(String(mockReadFileSync.mock.calls[0]![0])).toContain('one-topic.md');
  });

  it('handles empty memory directory', () => {
    mockReaddirSync.mockReturnValue([]);

    rebuildTOC('/tmp/memory');

    const written = String(mockWriteFileSync.mock.calls[0]![1]);
    expect(written).toContain('topics: 0');
    // Table header present but no rows
    expect(written).toContain('| Topic | Tags | Sessions | Updated |');
  });

  it('skips files without valid frontmatter', () => {
    mockReaddirSync.mockReturnValue([
      'valid.md' as unknown as import('node:fs').Dirent,
      'no-frontmatter.md' as unknown as import('node:fs').Dirent,
    ]);

    mockReadFileSync.mockImplementation((filePath) => {
      const path = String(filePath);
      if (path.endsWith('valid.md')) {
        return `---
topic: Valid Topic
updated: 2026-02-11T00:00:00Z
sessions: []
tags:
  - valid
---
`;
      }
      // No frontmatter
      return '## Just some markdown\n\nNo frontmatter here.';
    });

    rebuildTOC('/tmp/memory');

    const written = String(mockWriteFileSync.mock.calls[0]![1]);
    expect(written).toContain('topics: 1');
    expect(written).toContain('Valid Topic');
    expect(written).not.toContain('no-frontmatter');
  });

  it('formats tags and session count correctly in table rows', () => {
    mockReaddirSync.mockReturnValue([
      'multi-tag.md' as unknown as import('node:fs').Dirent,
    ]);

    mockReadFileSync.mockReturnValue(`---
topic: Multi Tag
updated: 2026-02-10T15:30:00Z
sessions:
  - s1
  - s2
  - s3
tags:
  - alpha
  - beta
  - gamma
---
`);

    rebuildTOC('/tmp/memory');

    const written = String(mockWriteFileSync.mock.calls[0]![1]);
    expect(written).toContain('| Multi Tag | alpha, beta, gamma | 3 | 2026-02-10T15:30:00Z |');
  });

  it('uses atomic write pattern (temp file + rename)', () => {
    mockReaddirSync.mockReturnValue([]);

    rebuildTOC('/some/dir');

    expect(mockWriteFileSync).toHaveBeenCalledWith(
      '/some/dir/index.md.tmp',
      expect.any(String),
      'utf-8'
    );
    expect(mockRenameSync).toHaveBeenCalledWith(
      '/some/dir/index.md.tmp',
      '/some/dir/index.md'
    );
    // writeFileSync called before renameSync
    const writeOrder = mockWriteFileSync.mock.invocationCallOrder[0]!;
    const renameOrder = mockRenameSync.mock.invocationCallOrder[0]!;
    expect(writeOrder).toBeLessThan(renameOrder);
  });

  it('excludes non-.md files from listing', () => {
    mockReaddirSync.mockReturnValue([
      'topic.md' as unknown as import('node:fs').Dirent,
      'notes.txt' as unknown as import('node:fs').Dirent,
      '.DS_Store' as unknown as import('node:fs').Dirent,
    ]);

    mockReadFileSync.mockReturnValue(`---
topic: Topic
updated: 2026-02-11T00:00:00Z
sessions: []
tags: []
---
`);

    rebuildTOC('/tmp/memory');

    expect(mockReadFileSync).toHaveBeenCalledTimes(1);
    const written = String(mockWriteFileSync.mock.calls[0]![1]);
    expect(written).toContain('topics: 1');
  });
});

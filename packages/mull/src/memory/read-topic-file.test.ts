import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readTopicFile } from './read-topic-file.js';

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

import { existsSync, readFileSync } from 'node:fs';

const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('readTopicFile', () => {
  it('returns null when file does not exist', () => {
    mockExistsSync.mockReturnValue(false);

    const result = readTopicFile('nonexistent', '/tmp/memory');

    expect(result).toBeNull();
    expect(mockExistsSync).toHaveBeenCalledWith(expect.stringContaining('nonexistent.md'));
  });

  it('parses frontmatter fields correctly', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(
      `---
topic: Error Handling
updated: 2026-02-11T10:00:00Z
sessions:
  - session-abc
  - session-def
tags:
  - errors
  - resilience
---

## Decisions

### prefer-result-types

Use Result types instead of throwing exceptions.
`
    );

    const result = readTopicFile('error-handling', '/tmp/memory');

    expect(result).not.toBeNull();
    expect(result!.frontmatter.topic).toBe('Error Handling');
    expect(result!.frontmatter.updated).toBe('2026-02-11T10:00:00Z');
    expect(result!.frontmatter.sessions).toEqual(['session-abc', 'session-def']);
    expect(result!.frontmatter.tags).toEqual(['errors', 'resilience']);
  });

  it('extracts nuggets with correct category from parent ## section', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(
      `---
topic: Testing
updated: 2026-02-11T10:00:00Z
sessions:
  - session-1
tags:
  - testing
---

## Decisions

### use-vitest

Vitest is the standard test runner for this project.

### prefer-unit-tests

Unit tests should cover all domain logic.

## Patterns

### arrange-act-assert

All tests follow the AAA pattern.
`
    );

    const result = readTopicFile('testing', '/tmp/memory');

    expect(result).not.toBeNull();
    expect(result!.nuggets).toHaveLength(3);

    expect(result!.nuggets[0]).toEqual({
      slug: 'use-vitest',
      category: 'Decisions',
      body: 'Vitest is the standard test runner for this project.',
    });

    expect(result!.nuggets[1]).toEqual({
      slug: 'prefer-unit-tests',
      category: 'Decisions',
      body: 'Unit tests should cover all domain logic.',
    });

    expect(result!.nuggets[2]).toEqual({
      slug: 'arrange-act-assert',
      category: 'Patterns',
      body: 'All tests follow the AAA pattern.',
    });
  });

  it('extracts caused and when metadata from nuggets', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(
      `---
topic: Architecture
updated: 2026-02-11T10:00:00Z
sessions:
  - session-x
tags:
  - architecture
---

## Decisions

### use-sqlite

SQLite is the storage engine for all domains.

caused: storage-simplification, reduced-ops
when: 2026-01-15

## Constraints

### no-cross-db-queries

Never query across domain databases.

caused: domain-isolation
`
    );

    const result = readTopicFile('architecture', '/tmp/memory');

    expect(result).not.toBeNull();
    expect(result!.nuggets).toHaveLength(2);

    expect(result!.nuggets[0]).toEqual({
      slug: 'use-sqlite',
      category: 'Decisions',
      body: 'SQLite is the storage engine for all domains.',
      caused: ['storage-simplification', 'reduced-ops'],
      when: '2026-01-15',
    });

    expect(result!.nuggets[1]).toEqual({
      slug: 'no-cross-db-queries',
      category: 'Constraints',
      body: 'Never query across domain databases.',
      caused: ['domain-isolation'],
    });
  });

  it('handles file with frontmatter but no nuggets', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(
      `---
topic: Empty Topic
updated: 2026-02-11T10:00:00Z
sessions: []
tags: []
---

## Decisions
`
    );

    const result = readTopicFile('empty-topic', '/tmp/memory');

    expect(result).not.toBeNull();
    expect(result!.frontmatter.topic).toBe('Empty Topic');
    expect(result!.nuggets).toEqual([]);
  });

  it('handles file with no frontmatter', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(
      `## Decisions

### some-decision

A decision made without frontmatter.
`
    );

    const result = readTopicFile('no-frontmatter', '/tmp/memory');

    expect(result).not.toBeNull();
    expect(result!.frontmatter).toEqual({
      topic: '',
      updated: '',
      sessions: [],
      tags: [],
    });
    expect(result!.nuggets).toHaveLength(1);
    expect(result!.nuggets[0]!.slug).toBe('some-decision');
    expect(result!.nuggets[0]!.category).toBe('Decisions');
  });

  it('handles multiline nugget body', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(
      `---
topic: Multiline
updated: 2026-02-11T10:00:00Z
sessions:
  - s1
tags: []
---

## Gotchas

### sqlite-locking

SQLite has file-level locking.
This means concurrent writes can fail.

Use WAL mode to mitigate.
`
    );

    const result = readTopicFile('multiline', '/tmp/memory');

    expect(result).not.toBeNull();
    expect(result!.nuggets).toHaveLength(1);
    expect(result!.nuggets[0]!.body).toBe(
      'SQLite has file-level locking.\nThis means concurrent writes can fail.\n\nUse WAL mode to mitigate.'
    );
  });

  it('resolves file path correctly with path.resolve', () => {
    mockExistsSync.mockReturnValue(false);

    readTopicFile('my-topic', '/some/memory/dir');

    expect(mockExistsSync).toHaveBeenCalledWith('/some/memory/dir/my-topic.md');
  });
});

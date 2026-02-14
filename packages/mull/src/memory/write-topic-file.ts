import { writeFileSync, renameSync, mkdirSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import matter from 'gray-matter';
import type { TopicFrontmatter } from './read-topic-file.js';
import { acquireLock, releaseLock } from './file-lock.js';

/**
 * Writes a topic file atomically with per-topic advisory locking.
 *
 * Flow: acquire lock → write to .tmp → rename to final → release lock.
 * Creates memoryDir and .mull/locks/ directories if they don't exist.
 */
export function writeTopicFile(
  topicSlug: string,
  frontmatter: TopicFrontmatter,
  body: string,
  memoryDir: string,
): void {
  // Ensure directories exist
  mkdirSync(memoryDir, { recursive: true });
  const mullDir = resolve(memoryDir, '.mull');

  const finalPath = resolve(memoryDir, `${topicSlug}.md`);
  const tmpPath = resolve(memoryDir, `${topicSlug}.md.tmp`);

  acquireLock(topicSlug, mullDir);
  try {
    // Stringify frontmatter + body using gray-matter
    const content = matter.stringify(body, frontmatter as unknown as object);
    writeFileSync(tmpPath, content, 'utf-8');
    renameSync(tmpPath, finalPath);
  } catch (err) {
    // Clean up tmp file on error
    try {
      unlinkSync(tmpPath);
    } catch {
      // tmp may not exist, ignore
    }
    throw err;
  } finally {
    releaseLock(topicSlug, mullDir);
  }
}

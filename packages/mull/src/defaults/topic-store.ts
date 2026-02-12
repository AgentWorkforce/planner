import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { TopicStore, Nugget, TopicMergeResult } from '../domain/types.js';

/**
 * Slugify a topic name for use as a filename.
 * Converts to lowercase, replaces non-alphanumeric chars with hyphens, trims.
 */
function slugify(topic: string): string {
  return topic
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Filesystem-based TopicStore that manages markdown topic files.
 *
 * Each topic is a markdown file at `<memoryDir>/<slug>.md`.
 * Nuggets are appended as sections. The TOC is an `_index.md` file.
 */
export class FileTopicStore implements TopicStore {
  async listTopics(memoryDir: string): Promise<string[]> {
    try {
      const entries = await fs.readdir(memoryDir);
      return entries
        .filter(e => e.endsWith('.md') && e !== '_index.md')
        .map(e => e.replace(/\.md$/, ''));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw err;
    }
  }

  async merge(nuggets: Nugget[], memoryDir: string): Promise<TopicMergeResult> {
    await fs.mkdir(memoryDir, { recursive: true });

    const existingTopics = new Set(await this.listTopics(memoryDir));
    let topicsUpdated = 0;
    let topicsCreated = 0;
    let nuggetsWritten = 0;

    // Group nuggets by topic slug
    const byTopic = new Map<string, Nugget[]>();
    for (const nugget of nuggets) {
      const slug = slugify(nugget.topic);
      if (!byTopic.has(slug)) {
        byTopic.set(slug, []);
      }
      byTopic.get(slug)!.push(nugget);
    }

    for (const [slug, topicNuggets] of byTopic) {
      const filePath = path.join(memoryDir, `${slug}.md`);
      const isNew = !existingTopics.has(slug);

      // Build content to append
      const lines: string[] = [];
      for (const nugget of topicNuggets) {
        lines.push('');
        lines.push(`<!-- nugget:${nugget.id} confidence:${nugget.confidence} -->`);
        lines.push(nugget.content);
        nuggetsWritten++;
      }
      const content = lines.join('\n') + '\n';

      if (isNew) {
        // Create new topic file with header
        const header = `# ${topicNuggets[0]!.topic}\n`;
        await fs.writeFile(filePath, header + content, 'utf-8');
        topicsCreated++;
      } else {
        // Append to existing topic file
        await fs.appendFile(filePath, content, 'utf-8');
        topicsUpdated++;
      }
    }

    return { topicsUpdated, topicsCreated, nuggetsWritten };
  }

  async rebuildToc(memoryDir: string): Promise<void> {
    const topics = await this.listTopics(memoryDir);
    if (topics.length === 0) return;

    topics.sort();
    const lines = ['# Memory Index', ''];
    for (const slug of topics) {
      lines.push(`- [${slug}](./${slug}.md)`);
    }
    lines.push('');

    await fs.writeFile(path.join(memoryDir, '_index.md'), lines.join('\n'), 'utf-8');
  }
}

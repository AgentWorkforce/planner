import * as fs from 'node:fs/promises';
import type { TopicStore, Nugget, TopicMergeResult, TopicSummaryMap } from '../domain/types.js';
import { mergeIntoTopicFiles } from '../memory/merge-topic-files.js';
import type { MergeNugget } from '../memory/merge-topic-files.js';
import { rebuildTOC } from '../memory/rebuild-toc.js';

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
 * Filesystem-based TopicStore that delegates to proper merge layer.
 *
 * Converts domain Nugget[] → MergeNugget[] and calls mergeIntoTopicFiles()
 * which handles YAML frontmatter, slug-based dedup, and section ordering.
 *
 * The TOC is built from topic frontmatter into index.md.
 */
export class FileTopicStore implements TopicStore {
  async listTopics(memoryDir: string): Promise<string[]> {
    try {
      const entries = await fs.readdir(memoryDir);
      return entries
        .filter(e => e.endsWith('.md') && e !== 'index.md' && e !== '_index.md')
        .map(e => e.replace(/\.md$/, ''));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw err;
    }
  }

  async merge(nuggets: Nugget[], memoryDir: string, sessionId: string, topicSummaries?: TopicSummaryMap): Promise<TopicMergeResult> {
    await fs.mkdir(memoryDir, { recursive: true });

    // Convert domain Nugget[] → MergeNugget[]
    const mergeNuggets: MergeNugget[] = [];

    // Structured nuggets (with slug + category)
    const structured = nuggets.filter(n => n.slug && n.category);
    for (const n of structured) {
      mergeNuggets.push({
        topic: slugify(n.topic),
        slug: n.slug!,
        category: n.category!,
        description: n.content,
        why: n.why,
        caused: n.caused,
        when: n.when,
        tags: n.tags,
      });
    }

    // Unstructured nuggets (backward compat — generate slug + default category)
    const unstructured = nuggets.filter(n => !n.slug || !n.category);
    for (const n of unstructured) {
      mergeNuggets.push({
        topic: slugify(n.topic),
        slug: n.slug || slugify(n.content.slice(0, 60)),
        category: n.category || 'Context',
        description: n.content,
        tags: n.tags,
      });
    }

    // Slugify topic summary keys to match the slugified nugget topics
    let slugifiedSummaries = topicSummaries;
    if (topicSummaries) {
      slugifiedSummaries = {};
      for (const [key, value] of Object.entries(topicSummaries)) {
        slugifiedSummaries[slugify(key)] = value;
      }
    }

    // Delegate to proper merge layer (synchronous)
    const result = mergeIntoTopicFiles(mergeNuggets, memoryDir, sessionId, slugifiedSummaries);

    // Map MergeResult (string[]) → TopicMergeResult (numbers)
    return {
      topicsUpdated: result.topicsUpdated.length,
      topicsCreated: result.topicsCreated.length,
      nuggetsWritten: result.nuggetsWritten,
    };
  }

  async rebuildToc(memoryDir: string): Promise<void> {
    // Delegate to proper TOC builder (synchronous)
    rebuildTOC(memoryDir);
  }
}

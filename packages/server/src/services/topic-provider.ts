import { readdirSync, readFileSync, writeFileSync, renameSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { readTopicFile, computeHotness } from '../../../mull/src/index.js';
import type { TopicFrontmatter } from '../../../mull/src/index.js';
import type {
  TopicProvider,
  TopicSummary,
  TopicRetrievalResult,
  TopicRetrievalCandidate,
} from '../../../forge-next/src/index.js';
import matter from 'gray-matter';

/** Minimum combined score for a topic to be selected. */
const SCORE_THRESHOLD = 0.1;

/**
 * Filesystem-based TopicProvider that reads mull topic files,
 * scores them by keyword relevance × hotness, and returns
 * L1 overviews for context injection.
 *
 * Implements the TopicProvider interface from forge-next.
 */
export class MullTopicProvider implements TopicProvider {
  constructor(private memoryDir: string) {}

  async findRelevant(
    keywords: string[],
    maxTopics: number = 3,
  ): Promise<TopicRetrievalResult> {
    const slugs = this.listTopicSlugs();
    if (slugs.length === 0 || keywords.length === 0) {
      return {
        topics: [],
        trace: {
          query_keywords: keywords,
          candidates_considered: 0,
          results: [],
        },
      };
    }

    const lowerKeywords = keywords.map(k => k.toLowerCase());
    const candidates: TopicRetrievalCandidate[] = [];
    const topicDataMap = new Map<string, { content: string }>();

    for (const slug of slugs) {
      const topicFile = readTopicFile(slug, this.memoryDir);
      if (!topicFile) continue;

      const fm = topicFile.frontmatter;

      // Keyword matching: score against slug, tags, and topic name
      const keywordScore = computeKeywordScore(slug, fm, lowerKeywords);
      if (keywordScore === 0) continue;

      // Hotness scoring
      const hotnessScore = computeHotness(
        fm.access_count ?? 0,
        fm.last_accessed,
      );

      const combined = keywordScore * (0.5 + 0.5 * hotnessScore);

      // Build content: prefer overview (L1), fall back to body excerpt
      const content = fm.overview
        ?? buildBodyExcerpt(topicFile.nuggets);

      // Skip topics with no usable content — empty summaries waste token budget
      if (!content) continue;

      topicDataMap.set(slug, { content });

      candidates.push({
        slug,
        keyword_score: round(keywordScore),
        hotness_score: round(hotnessScore),
        combined_score: round(combined),
        selected: false,
        reason: 'below_threshold',
      });
    }

    // Sort by combined score descending
    candidates.sort((a, b) => b.combined_score - a.combined_score);

    // Select top N above threshold
    const selected: TopicSummary[] = [];
    for (const candidate of candidates) {
      if (candidate.combined_score < SCORE_THRESHOLD) break;
      if (selected.length >= maxTopics) {
        candidate.reason = 'budget_exceeded';
        continue;
      }

      candidate.selected = true;
      candidate.reason = 'selected';

      const data = topicDataMap.get(candidate.slug);
      if (data) {
        selected.push({
          slug: candidate.slug,
          content: data.content,
        });
      }
    }

    return {
      topics: selected,
      trace: {
        query_keywords: keywords,
        candidates_considered: candidates.length,
        results: candidates,
      },
    };
  }

  /**
   * Increment access_count and update last_accessed for a topic.
   * Called after a topic is injected into agent context.
   *
   * Uses a single read → narrow mutation → atomic write pattern to
   * minimize the race window with concurrent mergeIntoTopicFiles.
   */
  recordAccess(slug: string): void {
    const filePath = resolve(this.memoryDir, `${slug}.md`);
    const tmpPath = filePath + '.access.tmp';

    try {
      // Single read — parse raw file as source of truth
      const rawContent = readFileSync(filePath, 'utf-8');
      const parsed = matter(rawContent);

      // Narrow mutation: only touch access fields, preserve everything else
      const data = parsed.data as Record<string, unknown>;
      data.access_count = (typeof data.access_count === 'number' ? data.access_count : 0) + 1;
      data.last_accessed = new Date().toISOString();

      // Atomic write: tmp → rename
      const updated = matter.stringify(parsed.content, data);
      writeFileSync(tmpPath, updated, 'utf-8');
      renameSync(tmpPath, filePath);
    } catch {
      // Best-effort — access tracking is not critical
      try { unlinkSync(tmpPath); } catch { /* tmp may not exist */ }
    }
  }

  private listTopicSlugs(): string[] {
    try {
      return readdirSync(this.memoryDir)
        .filter(f => f.endsWith('.md') && f !== 'index.md' && f !== '_index.md')
        .map(f => f.replace(/\.md$/, ''));
    } catch {
      return [];
    }
  }
}

/**
 * Score keyword relevance against topic slug, tags, and name.
 * Returns 0.0-1.0 based on proportion of keywords matched.
 */
function computeKeywordScore(
  slug: string,
  fm: TopicFrontmatter,
  lowerKeywords: string[],
): number {
  // Build a Set of individual words for exact word matching (not substring)
  const words = new Set<string>();

  // Slug parts: "relay-handoff" → ["relay", "handoff"]
  for (const part of slug.toLowerCase().split('-')) {
    if (part) words.add(part);
  }
  // Topic name words
  for (const w of fm.topic.toLowerCase().split(/\s+/)) {
    if (w) words.add(w);
  }
  // Tags (each tag is a word or hyphenated — split on hyphens too)
  for (const tag of fm.tags ?? []) {
    for (const part of tag.toLowerCase().split('-')) {
      if (part) words.add(part);
    }
    // Also add the full tag for compound matches like "phase-boundary"
    words.add(tag.toLowerCase());
  }
  // Abstract words
  if (fm.abstract) {
    for (const w of fm.abstract.toLowerCase().split(/[^a-z0-9]+/)) {
      if (w) words.add(w);
    }
  }

  let matches = 0;
  for (const kw of lowerKeywords) {
    if (words.has(kw)) {
      matches++;
    }
  }

  return matches / lowerKeywords.length;
}

/**
 * Build a compact body excerpt from nuggets when no overview exists.
 * Includes Decisions and Gotchas sections only (highest signal).
 */
function buildBodyExcerpt(
  nuggets: Array<{ slug: string; category: string; body: string }>,
): string {
  const highSignal = nuggets.filter(
    n => n.category === 'Decisions' || n.category === 'Gotchas',
  );

  if (highSignal.length === 0) {
    return nuggets
      .slice(0, 3)
      .map(n => `- ${n.body}`)
      .join('\n')
      .slice(0, 500);
  }

  return highSignal
    .slice(0, 5)
    .map(n => `- ${n.body}`)
    .join('\n')
    .slice(0, 500);
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

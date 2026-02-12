import { readdirSync } from 'node:fs';
import { readTopicFile } from './read-topic-file.js';
import { writeTopicFile } from './write-topic-file.js';
import type { TopicFrontmatter, Nugget } from './read-topic-file.js';

/** Fixed section ordering for topic files. */
const SECTION_ORDER = ['Decisions', 'Constraints', 'Patterns', 'Gotchas', 'Context'] as const;

/** A nugget to be merged into a topic file. */
export interface MergeNugget {
  topic: string;       // topic slug (filename without .md)
  slug: string;        // nugget identifier within the topic
  category: string;    // section: 'Decisions' | 'Constraints' | 'Patterns' | 'Gotchas' | 'Context'
  description: string; // body text
  why?: string;        // rationale
  caused?: string[];   // causal links to other slugs
  when?: string;       // timestamp/date
  tags?: string[];     // tags to union into frontmatter
}

/** Result of a merge operation. */
export interface MergeResult {
  topicsUpdated: string[];
  topicsCreated: string[];
  nuggetsWritten: number;
}

/** Internal nugget used during merge before rendering. */
interface InternalNugget {
  slug: string;
  category: string;
  description: string;
  why?: string;
  caused?: string[];
  when?: string;
}

/**
 * Merges nuggets into topic files in the memory directory.
 *
 * Groups nuggets by topic, reads existing files (or starts empty),
 * merges by slug (in-place update or append), reorders sections
 * in fixed order, updates frontmatter, and validates causal links.
 */
export function mergeIntoTopicFiles(
  nuggets: MergeNugget[],
  memoryDir: string,
  sessionId: string,
): MergeResult {
  const result: MergeResult = {
    topicsUpdated: [],
    topicsCreated: [],
    nuggetsWritten: 0,
  };

  if (nuggets.length === 0) {
    return result;
  }

  // Collect all known slugs for causal link validation (before writing)
  const allSlugs = collectAllSlugs(memoryDir, nuggets);

  // Validate causal links (warn only, never error)
  validateCausalLinks(nuggets, allSlugs);

  // Group nuggets by topic
  const byTopic = groupByTopic(nuggets);

  // Process each topic
  for (const [topicSlug, topicNuggets] of byTopic) {
    const existing = readTopicFile(topicSlug, memoryDir);
    const isNew = existing === null;

    // Merge nuggets: existing + new (slug-based replacement)
    const mergedNuggets = mergeNuggets(
      existing?.nuggets ?? [],
      topicNuggets,
    );

    // Build updated frontmatter
    const frontmatter = buildFrontmatter(
      existing?.frontmatter ?? null,
      topicSlug,
      sessionId,
      topicNuggets,
    );

    // Render body with fixed section ordering, empty sections omitted
    const body = renderBody(mergedNuggets);

    // Write topic file (atomic with advisory locking)
    writeTopicFile(topicSlug, frontmatter, body, memoryDir);

    if (isNew) {
      result.topicsCreated.push(topicSlug);
    } else {
      result.topicsUpdated.push(topicSlug);
    }
    result.nuggetsWritten += topicNuggets.length;
  }

  return result;
}

/**
 * Groups nuggets by their topic slug.
 */
function groupByTopic(nuggets: MergeNugget[]): Map<string, MergeNugget[]> {
  const map = new Map<string, MergeNugget[]>();
  for (const nugget of nuggets) {
    const group = map.get(nugget.topic);
    if (group) {
      group.push(nugget);
    } else {
      map.set(nugget.topic, [nugget]);
    }
  }
  return map;
}

/**
 * Collects all nugget slugs from existing topic files and input nuggets.
 * Used for causal link validation.
 */
function collectAllSlugs(memoryDir: string, inputNuggets: MergeNugget[]): Set<string> {
  const slugs = new Set<string>();

  // Collect from input nuggets
  for (const nugget of inputNuggets) {
    slugs.add(nugget.slug);
  }

  // Collect from existing topic files in memoryDir
  try {
    const files = readdirSync(memoryDir).filter(
      (f) => f.endsWith('.md') && f !== 'index.md',
    );
    for (const file of files) {
      const topicSlug = file.replace(/\.md$/, '');
      const topicFile = readTopicFile(topicSlug, memoryDir);
      if (topicFile) {
        for (const nugget of topicFile.nuggets) {
          slugs.add(nugget.slug);
        }
      }
    }
  } catch {
    // Directory may not exist yet — no existing slugs to collect
  }

  return slugs;
}

/**
 * Merges incoming nuggets into existing ones by slug.
 * Existing nuggets with the same slug are replaced in-place (never duplicated).
 * New slugs are appended.
 */
function mergeNuggets(existing: Nugget[], incoming: MergeNugget[]): InternalNugget[] {
  // Convert existing nuggets to internal format, preserving order
  const merged: InternalNugget[] = existing.map((n) => ({
    slug: n.slug,
    category: n.category,
    description: n.body,
    caused: n.caused,
    when: n.when,
  }));

  // Track slug positions for in-place replacement
  const slugIndex = new Map<string, number>();
  for (let i = 0; i < merged.length; i++) {
    slugIndex.set(merged[i]!.slug, i);
  }

  // Merge incoming nuggets
  for (const nugget of incoming) {
    const internal: InternalNugget = {
      slug: nugget.slug,
      category: nugget.category,
      description: nugget.description,
      why: nugget.why,
      caused: nugget.caused,
      when: nugget.when,
    };

    const idx = slugIndex.get(nugget.slug);
    if (idx !== undefined) {
      merged[idx] = internal; // Replace in-place
    } else {
      slugIndex.set(nugget.slug, merged.length);
      merged.push(internal); // Append
    }
  }

  return merged;
}

/**
 * Builds updated frontmatter for a topic file.
 *
 * - topic: preserved from existing, or derived from slug for new files
 * - sessions: append-only (adds sessionId if not present)
 * - tags: union of existing + all nugget tags
 * - updated: current timestamp
 */
function buildFrontmatter(
  existing: TopicFrontmatter | null,
  topicSlug: string,
  sessionId: string,
  nuggets: MergeNugget[],
): TopicFrontmatter {
  // Sessions: append-only
  const sessions = existing?.sessions ? [...existing.sessions] : [];
  if (!sessions.includes(sessionId)) {
    sessions.push(sessionId);
  }

  // Tags: union of existing + all nugget tags
  const tagSet = new Set<string>(existing?.tags ?? []);
  for (const nugget of nuggets) {
    if (nugget.tags) {
      for (const tag of nugget.tags) {
        tagSet.add(tag);
      }
    }
  }

  return {
    topic: existing?.topic || slugToTitle(topicSlug),
    updated: new Date().toISOString(),
    sessions,
    tags: [...tagSet],
  };
}

/**
 * Converts a slug to title case: 'error-handling' -> 'Error Handling'
 */
function slugToTitle(slug: string): string {
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Renders the body of a topic file with nuggets grouped by section
 * in fixed order (Decisions, Constraints, Patterns, Gotchas, Context).
 * Empty sections are omitted.
 */
function renderBody(nuggets: InternalNugget[]): string {
  // Group nuggets by category
  const byCategory = new Map<string, InternalNugget[]>();
  for (const nugget of nuggets) {
    const group = byCategory.get(nugget.category);
    if (group) {
      group.push(nugget);
    } else {
      byCategory.set(nugget.category, [nugget]);
    }
  }

  const lines: string[] = [];

  // Render sections in fixed order
  for (const sectionName of SECTION_ORDER) {
    const sectionNuggets = byCategory.get(sectionName);
    if (!sectionNuggets || sectionNuggets.length === 0) {
      continue;
    }

    lines.push(`## ${sectionName}`);
    lines.push('');

    for (const nugget of sectionNuggets) {
      lines.push(`### ${nugget.slug}`);
      lines.push('');
      lines.push(nugget.description);
      lines.push('');

      if (nugget.why) {
        lines.push(`**Why**: ${nugget.why}`);
        lines.push('');
      }
      if (nugget.caused && nugget.caused.length > 0) {
        lines.push(`**Caused**: ${nugget.caused.join(', ')}`);
        lines.push('');
      }
      if (nugget.when) {
        lines.push(`**When**: ${nugget.when}`);
        lines.push('');
      }
    }
  }

  // Render any categories not in the fixed order (defensive: prevents data loss)
  const orderedSet = new Set<string>(SECTION_ORDER);
  for (const [category, sectionNuggets] of byCategory) {
    if (orderedSet.has(category)) continue;

    lines.push(`## ${category}`);
    lines.push('');

    for (const nugget of sectionNuggets) {
      lines.push(`### ${nugget.slug}`);
      lines.push('');
      lines.push(nugget.description);
      lines.push('');

      if (nugget.why) {
        lines.push(`**Why**: ${nugget.why}`);
        lines.push('');
      }
      if (nugget.caused && nugget.caused.length > 0) {
        lines.push(`**Caused**: ${nugget.caused.join(', ')}`);
        lines.push('');
      }
      if (nugget.when) {
        lines.push(`**When**: ${nugget.when}`);
        lines.push('');
      }
    }
  }

  return lines.join('\n').trim();
}

/**
 * Validates causal links: warns (never errors) when a nugget's caused[]
 * references a slug not found in the known slug set.
 */
function validateCausalLinks(nuggets: MergeNugget[], allSlugs: Set<string>): void {
  for (const nugget of nuggets) {
    if (!nugget.caused) continue;
    for (const ref of nugget.caused) {
      if (!allSlugs.has(ref)) {
        console.warn(
          `[mull] Causal link warning: nugget "${nugget.slug}" references "${ref}" which was not found in memory`,
        );
      }
    }
  }
}
